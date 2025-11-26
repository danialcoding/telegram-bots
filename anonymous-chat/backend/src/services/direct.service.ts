// src/services/direct.service.ts
import { pool } from '../database/db';
import { Context, Markup } from 'telegraf';
import { CustomError } from '../utils/errors';
import { coinService } from './coin.service';
import { userService } from './user.service';
import { profileService } from './profile.service';
import { COIN_COSTS } from '../utils/constants';

interface DirectMessage {
  id: number;
  sender_id: number;
  receiver_id: number;
  message_text: string | null;
  message_type: 'text' | 'photo' | 'video' | 'voice' | 'document' | 'sticker';
  file_id: string | null;
  is_read: boolean;
  created_at: Date;
}

interface Contact {
  id: number;
  user_id: number;
  contact_user_id: number;
  nickname: string | null;
  created_at: Date;
}

class DirectService {
  /**
   * ارسال پیام دایرکت
   */
  async sendDirectMessage(
    ctx: Context,
    senderId: number,
    receiverId: number,
    messageText: string | null,
    messageType: string,
    fileId: string | null = null
  ): Promise<void> {
    // بررسی موجودی
    const hasEnough = await coinService.hasEnoughCoins(senderId, COIN_COSTS.DIRECT_MESSAGE);
    if (!hasEnough) {
      throw new CustomError(
        `❌ موجودی شما کافی نیست. برای ارسال دایرکت به ${COIN_COSTS.DIRECT_MESSAGE} سکه نیاز دارید.`,
        400
      );
    }

    // بررسی اینکه گیرنده بلاک نباشد
    const receiver = await userService.findUserById(receiverId);
    if (receiver.is_blocked) {
      throw new CustomError('❌ این کاربر مسدود شده است.', 400);
    }

    // کسر هزینه
    await coinService.deductCoins(
      senderId,
      COIN_COSTS.DIRECT_MESSAGE,
      'spend',
      'ارسال پیام دایرکت',
      receiverId
    );

    // ذخیره پیام
    const message = await pool.query(
      `INSERT INTO direct_messages 
       (sender_id, receiver_id, message_text, message_type, file_id, is_read)
       VALUES ($1, $2, $3, $4, $5, false)
       RETURNING *`,
      [senderId, receiverId, messageText, messageType, fileId]
    );

    // ارسال نوتیفیکیشن به گیرنده
    const senderProfile = await profileService.getProfileByUserId(senderId);
    await ctx.telegram.sendMessage(
      receiver.telegram_id,
      `📨 پیام جدید از ${senderProfile?.name || 'کاربر'}\n\n` +
      `برای مشاهده و پاسخ، به بخش "دایرکت‌های من" مراجعه کنید.`,
      Markup.inlineKeyboard([
        [Markup.button.callback('📨 مشاهده دایرکت‌ها', 'view_directs')]
      ])
    );

    await ctx.reply('✅ پیام شما با موفقیت ارسال شد!');
  }

  /**
   * دریافت لیست دایرکت‌های دریافتی
   */
  async getReceivedDirects(
    userId: number,
    limit: number = 20,
    offset: number = 0
  ): Promise<Array<DirectMessage & { sender_profile: any }>> {
    const result = await pool.query(
      `SELECT 
         dm.*,
         json_build_object(
           'name', p.name,
           'age', p.age,
           'city', p.city,
           'gender', p.gender,
           'custom_id', p.custom_id
         ) as sender_profile
       FROM direct_messages dm
       JOIN profiles p ON dm.sender_id = p.user_id
       WHERE dm.receiver_id = $1
       ORDER BY dm.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return result.rows;
  }

  /**
   * دریافت لیست دایرکت‌های ارسالی
   */
  async getSentDirects(
    userId: number,
    limit: number = 20,
    offset: number = 0
  ): Promise<Array<DirectMessage & { receiver_profile: any }>> {
    const result = await pool.query(
      `SELECT 
         dm.*,
         json_build_object(
           'name', p.name,
           'age', p.age,
           'city', p.city,
           'gender', p.gender,
           'custom_id', p.custom_id
         ) as receiver_profile
       FROM direct_messages dm
       JOIN profiles p ON dm.receiver_id = p.user_id
       WHERE dm.sender_id = $1
       ORDER BY dm.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return result.rows;
  }

  /**
   * تعداد دایرکت‌های خوانده نشده
   */
  async getUnreadCount(userId: number): Promise<number> {
    const result = await pool.query(
      'SELECT COUNT(*) as count FROM direct_messages WHERE receiver_id = $1 AND is_read = false',
      [userId]
    );

    return parseInt(result.rows[0].count);
  }

  /**
   * علامت‌گذاری به عنوان خوانده شده
   */
  async markAsRead(messageId: number, userId: number): Promise<void> {
    await pool.query(
      `UPDATE direct_messages 
       SET is_read = true 
       WHERE id = $1 AND receiver_id = $2`,
      [messageId, userId]
    );
  }

  /**
   * پاسخ به دایرکت (رایگان)
   */
  async replyToDirect(
    originalMessageId: number,
    senderId: number,
    messageText: string | null,
    messageType: string,
    fileId: string | null = null
  ): Promise<DirectMessage> {
    // پیدا کردن پیام اصلی
    const originalMessage = await pool.query(
      'SELECT * FROM direct_messages WHERE id = $1',
      [originalMessageId]
    );

    if (originalMessage.rows.length === 0) {
      throw new CustomError('پیام یافت نشد.', 404);
    }

    const original = originalMessage.rows[0];

    // بررسی اینکه فرستنده واقعاً گیرنده پیام اصلی بوده
    if (original.receiver_id !== senderId) {
      throw new CustomError('شما مجاز به پاسخ این پیام نیستید.', 403);
    }

    // ذخیره پاسخ (رایگان)
    const result = await pool.query(
      `INSERT INTO direct_messages 
       (sender_id, receiver_id, message_text, message_type, file_id, is_read, reply_to)
       VALUES ($1, $2, $3, $4, $5, false, $6)
       RETURNING *`,
      [senderId, original.sender_id, messageText, messageType, fileId, originalMessageId]
    );

    return result.rows[0];
  }

  /**
   * اضافه کردن به لیست مخاطبین
   */
  async addToContacts(
    userId: number,
    contactUserId: number,
    nickname: string | null = null
  ): Promise<Contact> {
    // بررسی تکراری نبودن
    const existing = await pool.query(
      'SELECT id FROM contacts WHERE user_id = $1 AND contact_user_id = $2',
      [userId, contactUserId]
    );

    if (existing.rows.length > 0) {
      throw new CustomError('این کاربر از قبل در لیست مخاطبین شما وجود دارد.', 400);
    }

    const result = await pool.query(
      `INSERT INTO contacts (user_id, contact_user_id, nickname)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [userId, contactUserId, nickname]
    );

    return result.rows[0];
  }

  /**
   * حذف از لیست مخاطبین
   */
  async removeFromContacts(userId: number, contactUserId: number): Promise<void> {
    await pool.query(
      'DELETE FROM contacts WHERE user_id = $1 AND contact_user_id = $2',
      [userId, contactUserId]
    );
  }

  /**
   * دریافت لیست مخاطبین
   */
  async getContacts(userId: number): Promise<Array<Contact & { profile: any }>> {
    const result = await pool.query(
      `SELECT 
         c.*,
         json_build_object(
           'name', p.name,
           'age', p.age,
           'city', p.city,
           'gender', p.gender,
           'custom_id', p.custom_id,
           'is_online', p.is_online
         ) as profile
       FROM contacts c
       JOIN profiles p ON c.contact_user_id = p.user_id
       ORDER BY c.created_at DESC`,
      [userId]
    );

    return result.rows;
  }

  /**
   * بررسی اینکه آیا کاربر در لیست مخاطبین است
   */
  async isInContacts(userId: number, contactUserId: number): Promise<boolean> {
    const result = await pool.query(
      'SELECT id FROM contacts WHERE user_id = $1 AND contact_user_id = $2',
      [userId, contactUserId]
    );

    return result.rows.length > 0;
  }

  /**
   * به‌روزرسانی نام مستعار
   */
  async updateContactNickname(
    userId: number,
    contactUserId: number,
    nickname: string
  ): Promise<void> {
    await pool.query(
      `UPDATE contacts 
       SET nickname = $1 
       WHERE user_id = $2 AND contact_user_id = $3`,
      [nickname, userId, contactUserId]
    );
  }
}

export const directService = new DirectService();
