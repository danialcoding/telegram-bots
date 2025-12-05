// src/services/anonymous.service.ts
import { pool } from '../database/db';
import { Context, Markup } from 'telegraf';
import { CustomError } from '../utils/errors';
import { userService } from './user.service';
import { profileService } from './profile.service';

interface AnonymousMessage {
  id: number;
  receiver_id: number;
  sender_id: number | null;
  message_text: string | null;
  message_type: 'text' | 'photo' | 'video' | 'voice' | 'document' | 'sticker';
  file_id: string | null;
  is_read: boolean;
  is_blocked: boolean;
  created_at: Date;
}

class AnonymousService {
  /**
   * دریافت لینک ناشناس کاربر
   */
  async getAnonymousLink(userId: number): Promise<string> {
    const profile = await profileService.getProfileByUserId(userId);
    
    if (!profile || !profile.anonymous_link_token) {
      throw new CustomError('لینک ناشناس یافت نشد.', 404);
    }

    // فرض می‌کنیم که نام کاربری ربات در متغیر محیطی است
    const botUsername = process.env.BOT_USERNAME || 'YourBotUsername';
    return `https://t.me/${botUsername}?start=anon_${profile.anonymous_link_token}`;
  }

  /**
   * ارسال پیام ناشناس (رایگان برای اولین پیام)
   */
  async sendAnonymousMessage(
    receiverToken: string,
    senderId: number | null,
    messageText: string | null,
    messageType: string,
    fileId: string | null = null
  ): Promise<AnonymousMessage> {
    // پیدا کردن گیرنده
    const receiverProfile = await pool.query(
      'SELECT user_id FROM profiles WHERE anonymous_link_token = $1',
      [receiverToken]
    );

    if (receiverProfile.rows.length === 0) {
      throw new CustomError('لینک نامعتبر است.', 404);
    }

    const receiverId = receiverProfile.rows[0].user_id;

    // بررسی اینکه فرستنده (اگر وجود دارد) پروفایل کامل کرده باشد
    if (senderId) {
      const senderProfile = await profileService.getProfileByUserId(senderId);
      if (!senderProfile) {
        throw new CustomError('لطفا ابتدا پروفایل خود را تکمیل کنید.', 400);
      }
    }

    // ذخیره پیام
    const result = await pool.query(
      `INSERT INTO anonymous_messages 
       (receiver_id, sender_id, message_text, message_type, file_id, is_read, is_blocked)
       VALUES ($1, $2, $3, $4, $5, false, false)
       RETURNING *`,
      [receiverId, senderId, messageText, messageType, fileId]
    );

    return result.rows[0];
  }

  /**
   * دریافت پیام‌های ناشناس دریافتی
   */
  async getReceivedAnonymousMessages(
    userId: number,
    limit: number = 20,
    offset: number = 0
  ): Promise<AnonymousMessage[]> {
    const result = await pool.query(
      `SELECT * FROM anonymous_messages 
       WHERE receiver_id = $1 AND is_blocked = false
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return result.rows;
  }

  /**
   * تعداد پیام‌های ناشناس خوانده نشده
   */
  async getUnreadAnonymousCount(userId: number): Promise<number> {
    const result = await pool.query(
      `SELECT COUNT(*) as count 
       FROM anonymous_messages 
       WHERE receiver_id = $1 AND is_read = false AND is_blocked = false`,
      [userId]
    );

    return parseInt(result.rows[0].count);
  }

  /**
   * علامت‌گذاری پیام ناشناس به عنوان خوانده شده
   */
  async markAnonymousAsRead(messageId: number, userId: number): Promise<void> {
    await pool.query(
      `UPDATE anonymous_messages 
       SET is_read = true 
       WHERE id = $1 AND receiver_id = $2`,
      [messageId, userId]
    );
  }

  /**
   * پاسخ به پیام ناشناس (رایگان)
   */
  async replyToAnonymous(
    originalMessageId: number,
    receiverId: number,
    messageText: string | null,
    messageType: string,
    fileId: string | null = null
  ): Promise<void> {
    // پیدا کردن پیام اصلی
    const originalMessage = await pool.query(
      'SELECT * FROM anonymous_messages WHERE id = $1',
      [originalMessageId]
    );

    if (originalMessage.rows.length === 0) {
      throw new CustomError('پیام یافت نشد.', 404);
    }

    const original = originalMessage.rows[0];

    // بررسی اینکه گیرنده واقعاً صاحب پیام است
    if (original.receiver_id !== receiverId) {
      throw new CustomError('شما مجاز به پاسخ این پیام نیستید.', 403);
    }

    // اگر فرستنده ناشناخته باشد، نمی‌توان پاسخ داد
    if (!original.sender_id) {
      throw new CustomError('نمی‌توانید به این پیام پاسخ دهید.', 400);
    }

    // ذخیره پاسخ (در جدول anonymous_messages)
    await pool.query(
      `INSERT INTO anonymous_messages 
       (receiver_id, sender_id, message_text, message_type, file_id, is_read, is_blocked, reply_to)
       VALUES ($1, $2, $3, $4, $5, false, false, $6)`,
      [original.sender_id, receiverId, messageText, messageType, fileId, originalMessageId]
    );
  }

  /**
   * بلاک کردن فرستنده ناشناس
   */
  async blockAnonymousSender(messageId: number, userId: number): Promise<void> {
    const message = await pool.query(
      'SELECT * FROM anonymous_messages WHERE id = $1',
      [messageId]
    );

    if (message.rows.length === 0) {
      throw new CustomError('پیام یافت نشد.', 404);
    }

    const msg = message.rows[0];

    if (msg.receiver_id !== userId) {
      throw new CustomError('شما مجاز به بلاک این پیام نیستید.', 403);
    }

    if (!msg.sender_id) {
      throw new CustomError('فرستنده ناشناخته قابل بلاک نیست.', 400);
    }

    // بلاک کردن تمام پیام‌های این فرستنده به این گیرنده
    await pool.query(
      `UPDATE anonymous_messages 
       SET is_blocked = true 
       WHERE sender_id = $1 AND receiver_id = $2`,
      [msg.sender_id, userId]
    );
  }

  /**
   * آمار پیام‌های ناشناس
   */
  async getAnonymousStats(userId: number): Promise<{
    totalReceived: number;
    totalUnread: number;
    totalBlocked: number;
  }> {
    const result = await pool.query(
      `SELECT 
         COUNT(*) as total_received,
         SUM(CASE WHEN is_read = false THEN 1 ELSE 0 END) as total_unread,
         SUM(CASE WHEN is_blocked = true THEN 1 ELSE 0 END) as total_blocked
       FROM anonymous_messages
       WHERE receiver_id = $1`,
      [userId]
    );

    return {
      totalReceived: parseInt(result.rows[0].total_received) || 0,
      totalUnread: parseInt(result.rows[0].total_unread) || 0,
      totalBlocked: parseInt(result.rows[0].total_blocked) || 0
    };
  }
}

export const anonymousService = new AnonymousService();
