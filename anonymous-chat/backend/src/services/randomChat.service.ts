import { pool } from '../database/db';
import logger from '../utils/logger';

interface RandomChat {
  id: number;
  user1_id: number;
  user2_id: number;
  status: 'active' | 'ended';
  safe_mode_user1: boolean;
  safe_mode_user2: boolean;
  started_at: Date;
  ended_at: Date | null;
  ended_by: number | null;
}

interface ChatMessage {
  id: number;
  chat_id: number;
  sender_id: number;
  message_text: string | null;
  message_type: 'text' | 'photo' | 'video' | 'voice' | 'document' | 'sticker';
  file_id: string | null;
  telegram_message_id_user1: number | null;
  telegram_message_id_user2: number | null;
  created_at: Date;
}

interface QueueEntry {
  id: number;
  user_id: number;
  search_type: 'any' | 'male' | 'female';
  created_at: Date;
}

class RandomChatService {
  /**
   * اضافه کردن کاربر به صف انتظار
   */
  async addToQueue(userId: number, searchType: 'any' | 'male' | 'female'): Promise<void> {
    try {
      await pool.query(
        `INSERT INTO random_chat_queue (user_id, search_type)
         VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET search_type = $2, created_at = NOW()`,
        [userId, searchType]
      );
      logger.info(`✅ User ${userId} added to queue with search type: ${searchType}`);
    } catch (error) {
      logger.error('❌ Error adding to queue:', error);
      throw error;
    }
  }

  /**
   * حذف کاربر از صف انتظار
   */
  async removeFromQueue(userId: number): Promise<void> {
    try {
      await pool.query(
        `DELETE FROM random_chat_queue WHERE user_id = $1`,
        [userId]
      );
      logger.info(`✅ User ${userId} removed from queue`);
    } catch (error) {
      logger.error('❌ Error removing from queue:', error);
      throw error;
    }
  }

  /**
   * جستجوی کاربر در صف انتظار
   */
  async findMatchInQueue(userId: number, userGender: 'male' | 'female', searchType: 'any' | 'male' | 'female'): Promise<any | null> {
    try {
      // منطق matching:
      // 1. اگر من به دنبال جنسیت خاص هستم (searchType = male/female):
      //    - فرد پیدا شده باید آن جنسیت را داشته باشد
      //    - فرد پیدا شده باید به دنبال جنسیت من باشد یا any
      //
      // 2. اگر من به دنبال any هستم:
      //    - فرد پیدا شده هر جنسیتی باشد
      //    - فرد پیدا شده باید به دنبال جنسیت من باشد یا any
      
      let query = `
        SELECT 
          q.user_id AS id, q.user_id, q.search_type,
          u.telegram_id, u.first_name, u.last_name, u.username,
          p.custom_id, p.display_name as name, p.gender, p.age, p.province, p.city
        FROM random_chat_queue q
        INNER JOIN users u ON q.user_id = u.id
        INNER JOIN profiles p ON u.id = p.user_id
        WHERE q.user_id != $1
          AND u.is_blocked = false
          AND u.id NOT IN (
            SELECT blocked_id FROM blocks WHERE blocker_id = $1
            UNION
            SELECT blocker_id FROM blocks WHERE blocked_id = $1
          )
      `;

      const params: any[] = [userId];
      let paramIndex = 2;

      // شرط 1: اگر من به دنبال جنسیت خاص هستم، فرد پیدا شده باید آن جنسیت را داشته باشد
      if (searchType !== 'any') {
        query += ` AND p.gender = $${paramIndex}`;
        params.push(searchType);
        paramIndex++;
      }

      // شرط 2: فرد پیدا شده باید به دنبال جنسیت من باشد یا any
      // اگر او به دنبال جنسیت خاصی است، باید با جنسیت من match کند
      query += ` AND (q.search_type = 'any' OR q.search_type = $${paramIndex})`;
      params.push(userGender);

      query += ` ORDER BY q.created_at ASC LIMIT 1`;

      const result = await pool.query(query, params);
      
      logger.info(`🔍 Match search for user ${userId} (gender: ${userGender}, searchType: ${searchType})`);
      logger.info(`📋 Query: ${query}`);
      logger.info(`📋 Params: ${JSON.stringify(params)}`);
      logger.info(`📋 Result: ${result.rows.length > 0 ? 'Match found' : 'No match'}`);
      
      return result.rows[0] || null;
    } catch (error) {
      logger.error('❌ Error finding match in queue:', error);
      throw error;
    }
  }

  /**
   * بررسی وجود کاربر در صف انتظار
   */
  async isInQueue(userId: number): Promise<boolean> {
    try {
      const result = await pool.query(
        `SELECT 1 FROM random_chat_queue WHERE user_id = $1`,
        [userId]
      );
      return result.rows.length > 0;
    } catch (error) {
      logger.error('❌ Error checking queue:', error);
      return false;
    }
  }

  /**
   * ایجاد چت جدید
   */
  async createChat(user1Id: number, user2Id: number): Promise<RandomChat> {
    try {
      const result = await pool.query(
        `INSERT INTO random_chats (user1_id, user2_id, status, safe_mode_user1, safe_mode_user2)
         VALUES ($1, $2, 'active', false, false)
         RETURNING *`,
        [user1Id, user2Id]
      );

      // حذف هر دو کاربر از صف انتظار
      await this.removeFromQueue(user1Id);
      await this.removeFromQueue(user2Id);

      return result.rows[0];
    } catch (error) {
      logger.error('❌ Error creating random chat:', error);
      throw error;
    }
  }

  /**
   * دریافت چت فعال کاربر
   */
  async getUserActiveChat(userId: number): Promise<RandomChat | null> {
    try {
      const result = await pool.query(
        `SELECT * FROM random_chats
         WHERE (user1_id = $1 OR user2_id = $1)
           AND status = 'active'
         LIMIT 1`,
        [userId]
      );

      return result.rows[0] || null;
    } catch (error) {
      logger.error('❌ Error getting active chat:', error);
      throw error;
    }
  }

  /**
   * دریافت آیدی کاربر مقابل در چت
   */
  getPartnerUserId(chat: RandomChat, currentUserId: number): number {
    return chat.user1_id === currentUserId ? chat.user2_id : chat.user1_id;
  }

  /**
   * فعال/غیرفعال کردن حالت امن
   */
  async toggleSafeMode(chatId: number, userId: number, enable: boolean): Promise<void> {
    try {
      const chat = await pool.query(
        `SELECT * FROM random_chats WHERE id = $1`,
        [chatId]
      );

      if (!chat.rows[0]) {
        throw new Error('Chat not found');
      }

      const isUser1 = chat.rows[0].user1_id === userId;
      const column = isUser1 ? 'safe_mode_user1' : 'safe_mode_user2';

      await pool.query(
        `UPDATE random_chats
         SET ${column} = $1
         WHERE id = $2`,
        [enable, chatId]
      );

      logger.info(`✅ Safe mode ${enable ? 'enabled' : 'disabled'} for user ${userId} in chat ${chatId}`);
    } catch (error) {
      logger.error('❌ Error toggling safe mode:', error);
      throw error;
    }
  }

  /**
   * بررسی وضعیت حالت امن کاربر
   */
  async isSafeModeEnabled(chatId: number, userId: number): Promise<boolean> {
    try {
      const result = await pool.query(
        `SELECT safe_mode_user1, safe_mode_user2, user1_id
         FROM random_chats
         WHERE id = $1`,
        [chatId]
      );

      if (!result.rows[0]) {
        return false;
      }

      const chat = result.rows[0];
      const isUser1 = chat.user1_id === userId;
      
      return isUser1 ? chat.safe_mode_user1 : chat.safe_mode_user2;
    } catch (error) {
      logger.error('❌ Error checking safe mode:', error);
      return false;
    }
  }

  /**
   * پایان چت
   */
  async endChat(chatId: number, endedByUserId: number): Promise<void> {
    try {
      await pool.query(
        `UPDATE random_chats
         SET status = 'ended',
             ended_at = NOW(),
             ended_by = $1
         WHERE id = $2`,
        [endedByUserId, chatId]
      );

      logger.info(`✅ Chat ${chatId} ended by user ${endedByUserId}`);
    } catch (error) {
      logger.error('❌ Error ending chat:', error);
      throw error;
    }
  }

  /**
   * ذخیره پیام چت
   */
  async saveMessage(
    chatId: number,
    senderId: number,
    messageType: string,
    messageText: string | null,
    fileId: string | null,
    telegramMessageIdUser1: number | null,
    telegramMessageIdUser2: number | null,
    localFilePath?: string | null,
    fileSize?: number | null,
    mimeType?: string | null
  ): Promise<ChatMessage> {
    try {
      const result = await pool.query(
        `INSERT INTO random_chat_messages 
         (chat_id, sender_id, message_type, message_text, file_id, telegram_message_id_user1, telegram_message_id_user2, local_file_path, file_size, mime_type)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [chatId, senderId, messageType, messageText, fileId, telegramMessageIdUser1, telegramMessageIdUser2, localFilePath, fileSize, mimeType]
      );

      return result.rows[0];
    } catch (error) {
      logger.error('❌ Error saving chat message:', error);
      throw error;
    }
  }

  /**
   * دریافت تمام پیام‌های یک چت
   */
  async getChatMessages(chatId: number): Promise<ChatMessage[]> {
    try {
      const result = await pool.query(
        `SELECT * FROM random_chat_messages
         WHERE chat_id = $1
         ORDER BY created_at ASC`,
        [chatId]
      );

      return result.rows;
    } catch (error) {
      logger.error('❌ Error getting chat messages:', error);
      throw error;
    }
  }

  /**
   * دریافت اطلاعات کاربر که چت را تمام کرده
   */
  async getChatEndedBy(chatId: number): Promise<number | null> {
    try {
      const result = await pool.query(
        `SELECT ended_by FROM random_chats WHERE id = $1`,
        [chatId]
      );

      return result.rows[0]?.ended_by || null;
    } catch (error) {
      logger.error('❌ Error getting chat ended by:', error);
      return null;
    }
  }

  /**
   * ✅ Soft Delete پیام‌های چت برای یک کاربر
   * (پیام‌ها از تلگرام پاک می‌شوند اما در دیتابیس باقی می‌مانند)
   */
  async softDeleteMessages(chatId: number, userId: number): Promise<number> {
    try {
      const chat = await pool.query(
        `SELECT user1_id, user2_id FROM random_chats WHERE id = $1`,
        [chatId]
      );

      if (!chat.rows[0]) {
        throw new Error('Chat not found');
      }

      const isUser1 = chat.rows[0].user1_id === userId;
      const deleteField = isUser1 ? 'is_deleted_user1' : 'is_deleted_user2';
      const deletedAtField = isUser1 ? 'deleted_at_user1' : 'deleted_at_user2';
      const deletedByField = isUser1 ? 'deleted_by_user1' : 'deleted_by_user2';

      const result = await pool.query(
        `UPDATE random_chat_messages 
         SET ${deleteField} = true, 
             ${deletedAtField} = NOW(), 
             ${deletedByField} = $2
         WHERE chat_id = $1 AND ${deleteField} = false
         RETURNING id`,
        [chatId, userId]
      );

      logger.info(`✅ Soft deleted ${result.rowCount} messages for user ${userId} in chat ${chatId}`);
      return result.rowCount || 0;
    } catch (error) {
      logger.error('❌ Error soft deleting messages:', error);
      throw error;
    }
  }

  /**
   * ✅ دریافت پیام‌های پاک نشده برای یک کاربر
   */
  async getActiveMessagesForUser(chatId: number, userId: number): Promise<ChatMessage[]> {
    try {
      const chat = await pool.query(
        `SELECT user1_id, user2_id FROM random_chats WHERE id = $1`,
        [chatId]
      );

      if (!chat.rows[0]) {
        return [];
      }

      const isUser1 = chat.rows[0].user1_id === userId;
      const deleteField = isUser1 ? 'is_deleted_user1' : 'is_deleted_user2';

      const result = await pool.query(
        `SELECT * FROM random_chat_messages
         WHERE chat_id = $1 AND ${deleteField} = false
         ORDER BY created_at ASC`,
        [chatId]
      );

      return result.rows;
    } catch (error) {
      logger.error('❌ Error getting active messages:', error);
      throw error;
    }
  }

  /**
   * ✅ بازیابی تمام پیام‌های چت (حتی پاک شده‌ها) - برای ادمین
   */
  async getAllMessagesIncludingDeleted(chatId: number): Promise<any[]> {
    try {
      const result = await pool.query(
        `SELECT 
          m.*,
          u1.telegram_id as user1_telegram_id,
          u2.telegram_id as user2_telegram_id
         FROM random_chat_messages m
         INNER JOIN random_chats rc ON m.chat_id = rc.id
         INNER JOIN users u1 ON rc.user1_id = u1.id
         INNER JOIN users u2 ON rc.user2_id = u2.id
         WHERE m.chat_id = $1
         ORDER BY m.created_at ASC`,
        [chatId]
      );

      return result.rows;
    } catch (error) {
      logger.error('❌ Error getting all messages:', error);
      throw error;
    }
  }
}

export const randomChatService = new RandomChatService();
