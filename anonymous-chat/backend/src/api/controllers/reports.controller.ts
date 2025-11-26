import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { ValidationError, NotFoundError } from '../../utils/errors';
import logger from '../../utils/logger';
import { pool } from '../../database/db';

export class ReportsController {
  /**
   * ثبت گزارش تخلف
   */
  static async createReport(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        throw new ValidationError('کاربر شناخته نشد');
      }

      const { reportedUserId, chatId, reason, description } = req.body;

      // بررسی وجود کاربر گزارش‌شده
      const reportedUser = await pool.query(
        'SELECT id FROM users WHERE id = $1',
        [reportedUserId]
      );
      if (reportedUser.rows.length === 0) {
        throw new NotFoundError('کاربر مورد نظر یافت نشد');
      }

      // ثبت گزارش
      const result = await pool.query(
        `INSERT INTO reports 
         (reporter_id, reported_user_id, chat_id, reason, description, status, created_at) 
         VALUES ($1, $2, $3, $4, $5, 'pending', NOW())
         RETURNING *`,
        [req.userId, reportedUserId, chatId || null, reason, description || null]
      );

      logger.info('New report created', {
        reportId: result.rows[0].id,
        reporterId: req.userId,
        reportedUserId,
        reason,
      });

      res.status(201).json({
        success: true,
        message: 'گزارش شما با موفقیت ثبت شد',
        data: {
          reportId: result.rows[0].id,
        },
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * دریافت لیست گزارش‌ها (برای ادمین)
   */
  static async getReports(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { status = 'all', limit = 50, offset = 0 } = req.query;

      let query = `
        SELECT r.*, 
               reporter.username as reporter_username,
               reporter.telegram_id as reporter_telegram_id,
               reported.username as reported_username,
               reported.telegram_id as reported_telegram_id
        FROM reports r
        JOIN users reporter ON r.reporter_id = reporter.id
        JOIN users reported ON r.reported_user_id = reported.id
      `;

      const params: any[] = [];
      
      if (status !== 'all') {
        query += ' WHERE r.status = $1';
        params.push(status);
      }

      query += ` ORDER BY r.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);

      const result = await pool.query(query, params);

      // شمارش کل گزارش‌ها
      let countQuery = 'SELECT COUNT(*) FROM reports';
      if (status !== 'all') {
        countQuery += ' WHERE status = $1';
      }
      const countResult = await pool.query(
        countQuery,
        status !== 'all' ? [status] : []
      );

      res.json({
        success: true,
        data: {
          reports: result.rows,
          total: parseInt(countResult.rows[0].count),
        },
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * دریافت جزئیات یک گزارش
   */
  static async getReportDetails(req: AuthRequest, res: Response): Promise<void> {
    try {
      const reportId = parseInt(req.params.id);

      if (isNaN(reportId)) {
        throw new ValidationError('شناسه گزارش نامعتبر است');
      }

      const result = await pool.query(
        `SELECT r.*, 
                reporter.username as reporter_username,
                reporter.telegram_id as reporter_telegram_id,
                reported.username as reported_username,
                reported.telegram_id as reported_telegram_id,
                admin.username as handled_by_username
         FROM reports r
         JOIN users reporter ON r.reporter_id = reporter.id
         JOIN users reported ON r.reported_user_id = reported.id
         LEFT JOIN users admin ON r.handled_by = admin.id
         WHERE r.id = $1`,
        [reportId]
      );

      if (result.rows.length === 0) {
        throw new NotFoundError('گزارش یافت نشد');
      }

      // دریافت پیام‌های چت مرتبط (اگر وجود دارد)
      let messages = [];
      if (result.rows[0].chat_id) {
        const messagesResult = await pool.query(
          `SELECT * FROM messages 
           WHERE chat_id = $1 
           ORDER BY created_at DESC 
           LIMIT 100`,
          [result.rows[0].chat_id]
        );
        messages = messagesResult.rows;
      }

      res.json({
        success: true,
        data: {
          report: result.rows[0],
          messages,
        },
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * به‌روزرسانی وضعیت گزارش
   */
  static async updateReportStatus(req: AuthRequest, res: Response): Promise<void> {
    try {
      const reportId = parseInt(req.params.id);
      const { status, adminNote } = req.body;

      if (isNaN(reportId)) {
        throw new ValidationError('شناسه گزارش نامعتبر است');
      }

      const validStatuses = ['pending', 'reviewed', 'resolved', 'rejected'];
      if (!validStatuses.includes(status)) {
        throw new ValidationError('وضعیت نامعتبر است');
      }

      const result = await pool.query(
        `UPDATE reports 
         SET status = $1, 
             admin_note = $2, 
             handled_by = $3, 
             handled_at = NOW(),
             updated_at = NOW()
         WHERE id = $4
         RETURNING *`,
        [status, adminNote || null, req.userId, reportId]
      );

      if (result.rows.length === 0) {
        throw new NotFoundError('گزارش یافت نشد');
      }

      logger.info('Report status updated', {
        reportId,
        newStatus: status,
        adminId: req.userId,
      });

      res.json({
        success: true,
        message: 'وضعیت گزارش به‌روزرسانی شد',
        data: {
          report: result.rows[0],
        },
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * اقدام روی گزارش (بن کردن کاربر)
   */
  static async takeAction(req: AuthRequest, res: Response): Promise<void> {
    try {
      const reportId = parseInt(req.params.id);
      const { action, duration, reason } = req.body;

      if (isNaN(reportId)) {
        throw new ValidationError('شناسه گزارش نامعتبر است');
      }

      // دریافت اطلاعات گزارش
      const reportResult = await pool.query(
        'SELECT * FROM reports WHERE id = $1',
        [reportId]
      );

      if (reportResult.rows.length === 0) {
        throw new NotFoundError('گزارش یافت نشد');
      }

      const report = reportResult.rows[0];

      if (action === 'ban') {
        // محاسبه تاریخ پایان بن
        const banUntil = duration 
          ? new Date(Date.now() + duration * 24 * 60 * 60 * 1000) // duration به روز
          : null; // بن دائمی

        await pool.query(
          `UPDATE users 
           SET is_banned = true, 
               ban_until = $1, 
               ban_reason = $2,
               updated_at = NOW()
           WHERE id = $3`,
          [banUntil, reason, report.reported_user_id]
        );

        // ثبت لاگ بن
        await pool.query(
          `INSERT INTO ban_logs 
           (user_id, admin_id, reason, duration_days, report_id, created_at)
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [report.reported_user_id, req.userId, reason, duration || null, reportId]
        );

        logger.info('User banned from report', {
          userId: report.reported_user_id,
          adminId: req.userId,
          reportId,
          duration,
        });
      } else if (action === 'warn') {
        // ارسال هشدار به کاربر
        await pool.query(
          `INSERT INTO warnings 
           (user_id, admin_id, reason, report_id, created_at)
           VALUES ($1, $2, $3, $4, NOW())`,
          [report.reported_user_id, req.userId, reason, reportId]
        );
      }

      // به‌روزرسانی وضعیت گزارش
      await pool.query(
        `UPDATE reports 
         SET status = 'resolved', 
             action_taken = $1,
             handled_by = $2,
             handled_at = NOW(),
             updated_at = NOW()
         WHERE id = $3`,
        [action, req.userId, reportId]
      );

      res.json({
        success: true,
        message: `اقدام "${action}" با موفقیت انجام شد`,
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * آمار گزارش‌ها
   */
  static async getReportStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      const stats = await pool.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'pending') as pending,
          COUNT(*) FILTER (WHERE status = 'reviewed') as reviewed,
          COUNT(*) FILTER (WHERE status = 'resolved') as resolved,
          COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as today,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as this_week
        FROM reports
      `);

      // گزارش‌های پرتکرار بر اساس reason
      const topReasons = await pool.query(`
        SELECT reason, COUNT(*) as count
        FROM reports
        WHERE created_at > NOW() - INTERVAL '30 days'
        GROUP BY reason
        ORDER BY count DESC
        LIMIT 5
      `);

      res.json({
        success: true,
        data: {
          stats: stats.rows[0],
          topReasons: topReasons.rows,
        },
      });
    } catch (error) {
      throw error;
    }
  }
}
