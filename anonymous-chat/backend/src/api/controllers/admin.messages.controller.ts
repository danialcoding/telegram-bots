// src/api/controllers/admin.messages.controller.ts
import { Request, Response } from 'express';
import { pool } from '../../database/db';
import logger from '../../utils/logger';

/**
 * کنترلر ادمین برای مدیریت پیام‌ها
 */
export class AdminMessagesController {
  /**
   * دریافت تمام پیام‌های پاک شده
   */
  static async getDeletedMessages(req: Request, res: Response): Promise<void> {
    try {
      const { page = 1, limit = 50, chatId } = req.query;
      const offset = (Number(page) - 1) * Number(limit);

      let query = `
        SELECT 
          m.id,
          m.chat_id,
          m.sender_id,
          m.message_type,
          m.message_text,
          m.file_id,
          m.local_file_path,
          m.file_size,
          m.mime_type,
          m.is_deleted_user1,
          m.is_deleted_user2,
          m.deleted_at_user1,
          m.deleted_at_user2,
          m.created_at,
          rc.user1_id,
          rc.user2_id,
          u1.telegram_id as user1_telegram_id,
          u1.first_name as user1_first_name,
          u2.telegram_id as user2_telegram_id,
          u2.first_name as user2_first_name,
          sender.telegram_id as sender_telegram_id,
          sender.first_name as sender_first_name
        FROM random_chat_messages m
        INNER JOIN random_chats rc ON m.chat_id = rc.id
        INNER JOIN users u1 ON rc.user1_id = u1.id
        INNER JOIN users u2 ON rc.user2_id = u2.id
        INNER JOIN users sender ON m.sender_id = sender.id
        WHERE (m.is_deleted_user1 = true OR m.is_deleted_user2 = true)
      `;

      const params: any[] = [];
      let paramIndex = 1;

      if (chatId) {
        query += ` AND m.chat_id = $${paramIndex}`;
        params.push(chatId);
        paramIndex++;
      }

      query += ` ORDER BY m.deleted_at_user1 DESC NULLS LAST, m.deleted_at_user2 DESC NULLS LAST
                 LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(Number(limit), offset);

      const result = await pool.query(query, params);

      // Get total count
      let countQuery = `
        SELECT COUNT(*) as total
        FROM random_chat_messages m
        WHERE (m.is_deleted_user1 = true OR m.is_deleted_user2 = true)
      `;
      const countParams: any[] = [];
      if (chatId) {
        countQuery += ` AND m.chat_id = $1`;
        countParams.push(chatId);
      }
      const countResult = await pool.query(countQuery, countParams);

      res.json({
        success: true,
        data: {
          messages: result.rows,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total: Number(countResult.rows[0].total),
            totalPages: Math.ceil(Number(countResult.rows[0].total) / Number(limit)),
          },
        },
      });
    } catch (error) {
      logger.error('❌ Error getting deleted messages:', error);
      res.status(500).json({
        success: false,
        message: 'خطا در دریافت پیام‌های پاک شده',
      });
    }
  }

  /**
   * دریافت تمام پیام‌های یک چت (شامل پاک شده‌ها)
   */
  static async getChatMessages(req: Request, res: Response): Promise<void> {
    try {
      const { chatId } = req.params;
      const { includeDeleted = 'true' } = req.query;

      let query = `
        SELECT 
          m.*,
          sender.telegram_id as sender_telegram_id,
          sender.first_name as sender_first_name
        FROM random_chat_messages m
        INNER JOIN users sender ON m.sender_id = sender.id
        WHERE m.chat_id = $1
      `;

      if (includeDeleted !== 'true') {
        query += ` AND m.is_deleted_user1 = false AND m.is_deleted_user2 = false`;
      }

      query += ` ORDER BY m.created_at ASC`;

      const result = await pool.query(query, [chatId]);

      res.json({
        success: true,
        data: {
          chatId: Number(chatId),
          messages: result.rows,
          totalMessages: result.rows.length,
          deletedCount: result.rows.filter(
            (m: any) => m.is_deleted_user1 || m.is_deleted_user2
          ).length,
        },
      });
    } catch (error) {
      logger.error('❌ Error getting chat messages:', error);
      res.status(500).json({
        success: false,
        message: 'خطا در دریافت پیام‌های چت',
      });
    }
  }

  /**
   * دریافت آمار پیام‌های پاک شده
   */
  static async getDeletedMessagesStats(req: Request, res: Response): Promise<void> {
    try {
      // Total deleted messages
      const totalResult = await pool.query(`
        SELECT COUNT(*) as total
        FROM random_chat_messages
        WHERE is_deleted_user1 = true OR is_deleted_user2 = true
      `);

      // By message type
      const typeResult = await pool.query(`
        SELECT 
          message_type,
          COUNT(*) as count
        FROM random_chat_messages
        WHERE is_deleted_user1 = true OR is_deleted_user2 = true
        GROUP BY message_type
        ORDER BY count DESC
      `);

      // Files storage
      const storageResult = await pool.query(`
        SELECT 
          message_type,
          COUNT(*) as count,
          pg_size_pretty(SUM(file_size)::bigint) as total_size,
          SUM(file_size) as total_bytes
        FROM random_chat_messages
        WHERE local_file_path IS NOT NULL
        GROUP BY message_type
      `);

      // Deleted messages with files
      const deletedFilesResult = await pool.query(`
        SELECT COUNT(*) as count, pg_size_pretty(SUM(file_size)::bigint) as size
        FROM random_chat_messages
        WHERE (is_deleted_user1 = true OR is_deleted_user2 = true)
          AND local_file_path IS NOT NULL
      `);

      // Recent deletions (last 7 days)
      const recentResult = await pool.query(`
        SELECT 
          DATE(COALESCE(deleted_at_user1, deleted_at_user2)) as date,
          COUNT(*) as count
        FROM random_chat_messages
        WHERE (is_deleted_user1 = true OR is_deleted_user2 = true)
          AND (deleted_at_user1 >= NOW() - INTERVAL '7 days' 
               OR deleted_at_user2 >= NOW() - INTERVAL '7 days')
        GROUP BY DATE(COALESCE(deleted_at_user1, deleted_at_user2))
        ORDER BY date DESC
      `);

      res.json({
        success: true,
        data: {
          totalDeleted: Number(totalResult.rows[0].total),
          byType: typeResult.rows,
          storage: storageResult.rows,
          deletedFiles: deletedFilesResult.rows[0],
          recentDeletions: recentResult.rows,
        },
      });
    } catch (error) {
      logger.error('❌ Error getting deleted messages stats:', error);
      res.status(500).json({
        success: false,
        message: 'خطا در دریافت آمار پیام‌های پاک شده',
      });
    }
  }

  /**
   * دریافت پیام‌های یک کاربر خاص
   */
  static async getUserMessages(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const { includeDeleted = 'false', page = 1, limit = 50 } = req.query;
      const offset = (Number(page) - 1) * Number(limit);

      let query = `
        SELECT 
          m.*,
          rc.user1_id,
          rc.user2_id,
          CASE 
            WHEN rc.user1_id = $1 THEN m.is_deleted_user1
            ELSE m.is_deleted_user2
          END as is_deleted_for_user
        FROM random_chat_messages m
        INNER JOIN random_chats rc ON m.chat_id = rc.id
        WHERE (rc.user1_id = $1 OR rc.user2_id = $1)
      `;

      if (includeDeleted !== 'true') {
        query += ` AND (
          (rc.user1_id = $1 AND m.is_deleted_user1 = false) OR
          (rc.user2_id = $1 AND m.is_deleted_user2 = false)
        )`;
      }

      query += ` ORDER BY m.created_at DESC
                 LIMIT $2 OFFSET $3`;

      const result = await pool.query(query, [userId, Number(limit), offset]);

      res.json({
        success: true,
        data: {
          userId: Number(userId),
          messages: result.rows,
        },
      });
    } catch (error) {
      logger.error('❌ Error getting user messages:', error);
      res.status(500).json({
        success: false,
        message: 'خطا در دریافت پیام‌های کاربر',
      });
    }
  }

  /**
   * بازگردانی پیام پاک شده (restore)
   */
  static async restoreDeletedMessage(req: Request, res: Response): Promise<void> {
    try {
      const { messageId } = req.params;
      const { userId } = req.body; // کاربری که می‌خواهیم برایش بازگردانی کنیم

      // Find message and chat
      const msgResult = await pool.query(
        `SELECT m.*, rc.user1_id, rc.user2_id
         FROM random_chat_messages m
         INNER JOIN random_chats rc ON m.chat_id = rc.id
         WHERE m.id = $1`,
        [messageId]
      );

      if (msgResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'پیام یافت نشد',
        });
      }

      const message = msgResult.rows[0];
      const isUser1 = message.user1_id === Number(userId);

      const deleteField = isUser1 ? 'is_deleted_user1' : 'is_deleted_user2';
      const deletedAtField = isUser1 ? 'deleted_at_user1' : 'deleted_at_user2';
      const deletedByField = isUser1 ? 'deleted_by_user1' : 'deleted_by_user2';

      await pool.query(
        `UPDATE random_chat_messages
         SET ${deleteField} = false,
             ${deletedAtField} = NULL,
             ${deletedByField} = NULL
         WHERE id = $1`,
        [messageId]
      );

      logger.info(`✅ Message ${messageId} restored for user ${userId}`);

      res.json({
        success: true,
        message: 'پیام با موفقیت بازگردانی شد',
      });
    } catch (error) {
      logger.error('❌ Error restoring message:', error);
      res.status(500).json({
        success: false,
        message: 'خطا در بازگردانی پیام',
      });
    }
  }
}
