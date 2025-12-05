import { pool } from '../database/db';
import logger from '../utils/logger';

export class DirectMessageService {
  /**
   * ارسال پیام دایرکت
   */
  async sendMessage(senderId: number, receiverId: number, message: string): Promise<any> {
    const query = `
      INSERT INTO direct_messages (sender_id, receiver_id, message)
      VALUES ($1, $2, $3)
      RETURNING *
    `;

    const result = await pool.query(query, [senderId, receiverId, message]);
    logger.info(`✅ Direct message sent from ${senderId} to ${receiverId}`);
    return result.rows[0];
  }

  /**
   * دریافت پیام‌های دریافت شده با pagination
   */
  async getReceivedMessages(userId: number, page: number = 1, limit: number = 10, sortOrder: 'DESC' | 'ASC' = 'DESC') {
    const offset = (page - 1) * limit;
    
    const query = `
      SELECT 
        dm.*,
        p.custom_id as sender_custom_id,
        p.display_name as sender_name,
        p.gender as sender_gender,
        p.age as sender_age,
        p.province as sender_province,
        p.city as sender_city,
        p.photo_file_id as sender_photo,
        u.first_name as sender_first_name,
        u.last_activity
      FROM direct_messages dm
      JOIN users u ON dm.sender_id = u.id
      LEFT JOIN profiles p ON u.id = p.user_id
      WHERE dm.receiver_id = $1
      ORDER BY dm.created_at ${sortOrder}
      LIMIT $2 OFFSET $3
    `;

    const result = await pool.query(query, [userId, limit, offset]);
    
    // شمارش کل پیام‌ها
    const countQuery = 'SELECT COUNT(*) FROM direct_messages WHERE receiver_id = $1';
    const countResult = await pool.query(countQuery, [userId]);
    const totalCount = parseInt(countResult.rows[0].count);
    
    return {
      messages: result.rows,
      totalCount,
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
      hasNext: page < Math.ceil(totalCount / limit),
      hasPrev: page > 1,
    };
  }

  /**
   * دریافت پیام‌های ارسال شده با pagination
   */
  async getSentMessages(userId: number, page: number = 1, limit: number = 10, sortOrder: 'DESC' | 'ASC' = 'DESC') {
    const offset = (page - 1) * limit;
    
    const query = `
      SELECT 
        dm.*,
        p.custom_id as receiver_custom_id,
        p.display_name as receiver_name,
        p.gender as receiver_gender,
        p.age as receiver_age,
        p.province as receiver_province,
        p.city as receiver_city,
        p.photo_file_id as receiver_photo,
        u.first_name as receiver_first_name,
        u.last_activity
      FROM direct_messages dm
      JOIN users u ON dm.receiver_id = u.id
      LEFT JOIN profiles p ON u.id = p.user_id
      WHERE dm.sender_id = $1
      ORDER BY dm.created_at ${sortOrder}
      LIMIT $2 OFFSET $3
    `;

    const result = await pool.query(query, [userId, limit, offset]);
    
    // شمارش کل پیام‌ها
    const countQuery = 'SELECT COUNT(*) FROM direct_messages WHERE sender_id = $1';
    const countResult = await pool.query(countQuery, [userId]);
    const totalCount = parseInt(countResult.rows[0].count);
    
    return {
      messages: result.rows,
      totalCount,
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
      hasNext: page < Math.ceil(totalCount / limit),
      hasPrev: page > 1,
    };
  }

  /**
   * تعداد پیام‌های خوانده نشده
   */
  async getUnreadCount(userId: number): Promise<number> {
    const query = `
      SELECT COUNT(*) as count
      FROM direct_messages
      WHERE receiver_id = $1 AND is_read = FALSE
    `;

    const result = await pool.query(query, [userId]);
    return parseInt(result.rows[0].count);
  }

  /**
   * علامت‌گذاری پیام به عنوان خوانده شده
   */
  async markAsRead(messageId: number): Promise<void> {
    const query = `
      UPDATE direct_messages
      SET is_read = TRUE
      WHERE id = $1
    `;

    await pool.query(query, [messageId]);
  }

  /**
   * علامت‌گذاری تمام پیام‌های یک فرستنده به عنوان خوانده شده
   */
  async markAllAsRead(receiverId: number, senderId: number): Promise<void> {
    const query = `
      UPDATE direct_messages
      SET is_read = TRUE
      WHERE receiver_id = $1 AND sender_id = $2 AND is_read = FALSE
    `;

    await pool.query(query, [receiverId, senderId]);
    logger.info(`✅ All messages from ${senderId} marked as read by ${receiverId}`);
  }

  /**
   * حذف پیام
   */
  async deleteMessage(messageId: number, userId: number): Promise<boolean> {
    const query = `
      DELETE FROM direct_messages
      WHERE id = $1 AND (sender_id = $2 OR receiver_id = $2)
    `;

    const result = await pool.query(query, [messageId, userId]);
    return result.rowCount > 0;
  }

  /**
   * تعداد کل پیام‌ها بین دو کاربر
   */
  async getMessageCount(user1Id: number, user2Id: number): Promise<number> {
    const query = `
      SELECT COUNT(*) as count
      FROM direct_messages
      WHERE (sender_id = $1 AND receiver_id = $2)
         OR (sender_id = $2 AND receiver_id = $1)
    `;

    const result = await pool.query(query, [user1Id, user2Id]);
    return parseInt(result.rows[0].count);
  }
}

export const directMessageService = new DirectMessageService();
