// src/services/chatRequest.service.ts
import { pool } from '../database/db';
import logger from '../utils/logger';
import { CHAT_REQUEST_COOLDOWN_MINUTES } from '../utils/constants';

interface ChatRequest {
  id: number;
  sender_id: number;
  receiver_id: number;
  status: 'pending' | 'viewed' | 'accepted' | 'rejected' | 'blocked' | 'expired';
  notification_message_id: number | null;
  created_at: Date;
  viewed_at: Date | null;
  responded_at: Date | null;
  connected: boolean;
}

class ChatRequestService {
  /**
   * بررسی آیا کاربر در حال چت است
   */
  async isUserInChat(userId: number): Promise<boolean> {
    try {
      const result = await pool.query(
        `SELECT 1 FROM random_chats
         WHERE (user1_id = $1 OR user2_id = $1)
           AND status = 'active'
         LIMIT 1`,
        [userId]
      );

      return result.rows.length > 0;
    } catch (error) {
      logger.error('❌ Error checking if user in chat:', error);
      return false;
    }
  }

  /**
   * بررسی محدودیت زمانی ارسال درخواست به یک کاربر خاص
   */
  async canSendRequest(senderId: number, receiverId: number): Promise<boolean> {
    try {
      const result = await pool.query(
        `SELECT created_at FROM chat_requests
         WHERE sender_id = $1 AND receiver_id = $2
         ORDER BY created_at DESC
         LIMIT 1`,
        [senderId, receiverId]
      );

      if (result.rows.length === 0) {
        return true;
      }

      const lastRequest = result.rows[0];
      const now = new Date();
      const lastRequestTime = new Date(lastRequest.created_at);
      const diffMinutes = (now.getTime() - lastRequestTime.getTime()) / (1000 * 60);

      return diffMinutes >= CHAT_REQUEST_COOLDOWN_MINUTES;
    } catch (error) {
      logger.error('❌ Error checking request cooldown:', error);
      return false;
    }
  }

  /**
   * ایجاد درخواست چت جدید
   */
  async createRequest(
    senderId: number,
    receiverId: number,
    notificationMessageId?: number
  ): Promise<ChatRequest> {
    try {
      const result = await pool.query(
        `INSERT INTO chat_requests (sender_id, receiver_id, notification_message_id, status)
         VALUES ($1, $2, $3, 'pending')
         RETURNING *`,
        [senderId, receiverId, notificationMessageId || null]
      );

      logger.info(`✅ Chat request created: ${senderId} -> ${receiverId}`);
      return result.rows[0];
    } catch (error) {
      logger.error('❌ Error creating chat request:', error);
      throw error;
    }
  }

  /**
   * مشاهده درخواست (تغییر وضعیت به viewed)
   */
  async markAsViewed(requestId: number): Promise<void> {
    try {
      await pool.query(
        `UPDATE chat_requests
         SET status = 'viewed', viewed_at = NOW()
         WHERE id = $1 AND status = 'pending'`,
        [requestId]
      );

      logger.info(`✅ Chat request ${requestId} marked as viewed`);
    } catch (error) {
      logger.error('❌ Error marking request as viewed:', error);
      throw error;
    }
  }

  /**
   * قبول درخواست چت
   */
  async acceptRequest(requestId: number): Promise<ChatRequest | null> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // دریافت اطلاعات درخواست
      const requestResult = await client.query(
        `SELECT * FROM chat_requests WHERE id = $1`,
        [requestId]
      );

      if (requestResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return null;
      }

      const request = requestResult.rows[0];

      // بررسی آیا هر دو کاربر در چت فعال نیستند
      const sender_in_chat = await this.isUserInChat(request.sender_id);
      const receiver_in_chat = await this.isUserInChat(request.receiver_id);

      if (sender_in_chat || receiver_in_chat) {
        // یکی از طرفین در چت است
        await client.query(
          `UPDATE chat_requests
           SET status = 'expired', responded_at = NOW()
           WHERE id = $1`,
          [requestId]
        );
        await client.query('COMMIT');
        return null;
      }

      // تغییر وضعیت درخواست به accepted
      await client.query(
        `UPDATE chat_requests
         SET status = 'accepted', responded_at = NOW(), connected = true
         WHERE id = $1`,
        [requestId]
      );

      await client.query('COMMIT');

      logger.info(`✅ Chat request ${requestId} accepted`);
      return request;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('❌ Error accepting chat request:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * رد درخواست چت
   */
  async rejectRequest(requestId: number): Promise<ChatRequest | null> {
    try {
      const result = await pool.query(
        `UPDATE chat_requests
         SET status = 'rejected', responded_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [requestId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      logger.info(`✅ Chat request ${requestId} rejected`);
      return result.rows[0];
    } catch (error) {
      logger.error('❌ Error rejecting chat request:', error);
      throw error;
    }
  }

  /**
   * بلاک کردن از طریق درخواست چت
   */
  async blockFromRequest(requestId: number): Promise<ChatRequest | null> {
    try {
      const result = await pool.query(
        `UPDATE chat_requests
         SET status = 'blocked', responded_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [requestId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      logger.info(`✅ Chat request ${requestId} blocked`);
      return result.rows[0];
    } catch (error) {
      logger.error('❌ Error blocking from request:', error);
      throw error;
    }
  }

  /**
   * دریافت درخواست بر اساس ID
   */
  async getRequestById(requestId: number): Promise<ChatRequest | null> {
    try {
      const result = await pool.query(
        `SELECT * FROM chat_requests WHERE id = $1`,
        [requestId]
      );

      return result.rows[0] || null;
    } catch (error) {
      logger.error('❌ Error getting request:', error);
      return null;
    }
  }

  /**
   * دریافت تمام درخواست‌های pending یک کاربر
   */
  async getPendingRequests(userId: number): Promise<ChatRequest[]> {
    try {
      const result = await pool.query(
        `SELECT * FROM chat_requests
         WHERE receiver_id = $1 AND status IN ('pending', 'viewed')
         ORDER BY created_at DESC`,
        [userId]
      );

      return result.rows;
    } catch (error) {
      logger.error('❌ Error getting pending requests:', error);
      return [];
    }
  }

  /**
   * شمارش درخواست‌های pending
   */
  async countPendingRequests(userId: number): Promise<number> {
    try {
      const result = await pool.query(
        `SELECT COUNT(*) as count FROM chat_requests
         WHERE receiver_id = $1 AND status IN ('pending', 'viewed')`,
        [userId]
      );

      return parseInt(result.rows[0].count);
    } catch (error) {
      logger.error('❌ Error counting pending requests:', error);
      return 0;
    }
  }
}

export const chatRequestService = new ChatRequestService();
export default chatRequestService;
