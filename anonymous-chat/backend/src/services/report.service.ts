// src/services/report.service.ts
import { pool } from '../database/db';
import { CustomError } from '../utils/errors';
import { userService } from './user.service';
import logger from '../utils/logger';

// Enum values از دیتابیس: {inappropriate_content,harassment,spam,fake_profile,underage,other}
type ReportReasonEnum = 'inappropriate_content' | 'harassment' | 'spam' | 'fake_profile' | 'underage' | 'other';
type ReportStatusEnum = 'pending' | 'reviewed' | 'resolved' | 'rejected';

interface Report {
  id: number;
  reporter_id: number;
  reported_id: number;
  reason: ReportReasonEnum;
  description: string | null;
  chat_id: number | null;
  message_id: number | null;
  direct_id: number | null;
  status: ReportStatusEnum;
  reviewed_by: number | null;
  review_notes: string | null;
  reviewed_at: Date | null;
  action_taken: string | null;
  created_at: Date;
  updated_at: Date;
}

interface ReportStats {
  totalReports: number;
  pendingReports: number;
  resolvedReports: number;
  rejectedReports: number;
}

// نقشه دلایل فارسی به enum دیتابیس
const REASON_MAP: Record<string, ReportReasonEnum> = {
  'تبلیغات سایت‌ها و ربات‌ها و کانال‌ها': 'spam',
  'ارسال محتوای غیر اخلاقی': 'inappropriate_content',
  'ایجاد مزاحمت': 'harassment',
  'پخش شماره موبایل یا اطلاعات شخصی دیگران': 'harassment',
  'کلمات یا عکس غیر اخلاقی و توهین‌آمیز در پروفایل': 'inappropriate_content',
  'جنسیت اشتباه در پروفایل': 'fake_profile',
  'دیگر موارد': 'other',
  // دلایل قدیمی
  'محتوای نامناسب': 'inappropriate_content',
  'رفتار توهین‌آمیز': 'harassment',
  'هرزنامه/اسپم': 'spam',
  'تقلب یا کلاهبرداری': 'fake_profile',
  'محتوای خشونت‌آمیز': 'inappropriate_content',
  'سایر موارد': 'other',
};

// نقشه معکوس برای نمایش
const REASON_DISPLAY: Record<ReportReasonEnum, string> = {
  'spam': 'تبلیغات / اسپم',
  'inappropriate_content': 'محتوای نامناسب',
  'harassment': 'مزاحمت / توهین',
  'fake_profile': 'پروفایل جعلی / کلاهبرداری',
  'underage': 'سن کمتر از حد مجاز',
  'other': 'سایر موارد',
};

class ReportService {
  /**
   * ثبت گزارش جدید
   */
  async createReport(
    reporterId: number,
    reportedId: number,
    reasonPersian: string,
    description: string | null = null,
    chatId: number | null = null,
    messageId: number | null = null,
    directId: number | null = null
  ): Promise<Report> {
    // تبدیل دلیل فارسی به enum
    const reasonEnum = REASON_MAP[reasonPersian] || 'other';

    // بررسی اینکه کاربر خودش را گزارش نکند
    if (reporterId === reportedId) {
      throw new CustomError('شما نمی‌توانید خودتان را گزارش کنید.', 400);
    }

    // بررسی وجود کاربر گزارش شده
    const reportedUser = await userService.findUserById(reportedId);
    if (!reportedUser) {
      throw new CustomError('کاربر گزارش شده یافت نشد.', 404);
    }

    // بررسی گزارش تکراری (در 24 ساعت گذشته)
    const existingReport = await pool.query(
      `SELECT id FROM reports 
       WHERE reporter_id = $1 
       AND reported_id = $2 
       AND created_at > NOW() - INTERVAL '24 hours'`,
      [reporterId, reportedId]
    );

    if (existingReport.rows.length > 0) {
      throw new CustomError('شما اخیراً این کاربر را گزارش کرده‌اید. لطفاً صبر کنید.', 400);
    }

    // ساخت توضیحات کامل برای ذخیره
    const fullDescription = description 
      ? `[دلیل انتخابی: ${reasonPersian}]\n\n${description}`
      : `[دلیل انتخابی: ${reasonPersian}]`;

    // ثبت گزارش
    const result = await pool.query(
      `INSERT INTO reports 
       (reporter_id, reported_id, reason, description, chat_id, message_id, direct_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
       RETURNING *`,
      [reporterId, reportedId, reasonEnum, fullDescription, chatId, messageId, directId]
    );

    const report = result.rows[0];

    // لاگ برای بررسی بعدی
    logger.info(`📋 New report created:`, {
      reportId: report.id,
      reporterId,
      reportedId,
      reasonPersian,
      reasonEnum,
      description: description || 'N/A',
      chatId,
      messageId,
      directId,
    });

    return report;
  }

  /**
   * دریافت لیست گزارش‌ها (برای ادمین)
   */
  async getReports(
    status?: ReportStatusEnum,
    limit: number = 20,
    offset: number = 0
  ): Promise<Array<Report & { reporter_profile: any; reported_profile: any }>> {
    let query = `
      SELECT 
        r.*,
        json_build_object(
          'name', rp.name,
          'custom_id', rp.custom_id,
          'gender', rp.gender
        ) as reporter_profile,
        json_build_object(
          'name', rpp.name,
          'custom_id', rpp.custom_id,
          'gender', rpp.gender
        ) as reported_profile
      FROM reports r
      LEFT JOIN profiles rp ON r.reporter_id = rp.user_id
      LEFT JOIN profiles rpp ON r.reported_id = rpp.user_id
    `;

    const params: any[] = [];
    
    if (status) {
      query += ` WHERE r.status = $1`;
      params.push(status);
    }

    query += ` ORDER BY r.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    return result.rows;
  }

  /**
   * دریافت جزئیات یک گزارش
   */
  async getReportById(reportId: number): Promise<Report & { 
    reporter_profile: any; 
    reported_profile: any;
    report_count: number;
  }> {
    const result = await pool.query(
      `SELECT 
        r.*,
        json_build_object(
          'name', rp.name,
          'custom_id', rp.custom_id,
          'gender', rp.gender,
          'age', rp.age,
          'city', rp.city
        ) as reporter_profile,
        json_build_object(
          'name', rpp.name,
          'custom_id', rpp.custom_id,
          'gender', rpp.gender,
          'age', rpp.age,
          'city', rpp.city
        ) as reported_profile,
        (SELECT COUNT(*) FROM reports WHERE reported_id = r.reported_id) as report_count
      FROM reports r
      LEFT JOIN profiles rp ON r.reporter_id = rp.user_id
      LEFT JOIN profiles rpp ON r.reported_id = rpp.user_id
      WHERE r.id = $1`,
      [reportId]
    );

    if (result.rows.length === 0) {
      throw new CustomError('گزارش یافت نشد.', 404);
    }

    return result.rows[0];
  }

  /**
   * بررسی و تغییر وضعیت گزارش
   */
  async reviewReport(
    reportId: number,
    adminId: number,
    status: ReportStatusEnum,
    reviewNotes: string | null = null,
    actionTaken: string | null = null
  ): Promise<Report> {
    const result = await pool.query(
      `UPDATE reports 
       SET status = $1, review_notes = $2, reviewed_at = NOW(), reviewed_by = $3, action_taken = $4
       WHERE id = $5
       RETURNING *`,
      [status, reviewNotes, adminId, actionTaken, reportId]
    );

    if (result.rows.length === 0) {
      throw new CustomError('گزارش یافت نشد.', 404);
    }

    logger.info(`📋 Report ${reportId} reviewed by admin ${adminId}: status=${status}`);

    return result.rows[0];
  }

  /**
   * مسدود کردن کاربر بر اساس گزارش
   */
  async blockUserFromReport(
    reportId: number,
    adminId: number,
    reason: string
  ): Promise<void> {
    const report = await this.getReportById(reportId);

    // مسدود کردن کاربر
    await userService.blockUser(report.reported_id, reason);

    // به‌روزرسانی وضعیت گزارش
    await this.reviewReport(reportId, adminId, 'resolved', `کاربر مسدود شد: ${reason}`, 'blocked');

    logger.info(`🚫 User ${report.reported_id} blocked from report ${reportId}`);
  }

  /**
   * دریافت آمار گزارش‌ها
   */
  async getReportStats(): Promise<ReportStats> {
    const result = await pool.query(
      `SELECT 
         COUNT(*) as total_reports,
         SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_reports,
         SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved_reports,
         SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_reports
       FROM reports`
    );

    return {
      totalReports: parseInt(result.rows[0].total_reports) || 0,
      pendingReports: parseInt(result.rows[0].pending_reports) || 0,
      resolvedReports: parseInt(result.rows[0].resolved_reports) || 0,
      rejectedReports: parseInt(result.rows[0].rejected_reports) || 0
    };
  }

  /**
   * دریافت کاربران پرگزارش
   */
  async getMostReportedUsers(limit: number = 10): Promise<Array<{
    user_id: number;
    report_count: number;
    profile: any;
  }>> {
    const result = await pool.query(
      `SELECT 
         r.reported_id as user_id,
         COUNT(*) as report_count,
         json_build_object(
           'name', p.name,
           'custom_id', p.custom_id,
           'gender', p.gender,
           'age', p.age,
           'city', p.city
         ) as profile
       FROM reports r
       LEFT JOIN profiles p ON r.reported_id = p.user_id
       GROUP BY r.reported_id, p.name, p.custom_id, p.gender, p.age, p.city
       ORDER BY report_count DESC
       LIMIT $1`,
      [limit]
    );

    return result.rows;
  }

  /**
   * دریافت نمایش فارسی دلیل
   */
  getReasonDisplay(reason: ReportReasonEnum): string {
    return REASON_DISPLAY[reason] || reason;
  }

  /**
   * دریافت گزارش‌های یک کاربر خاص (کاربری که گزارش شده)
   */
  async getUserReports(userId: number): Promise<Report[]> {
    const result = await pool.query(
      `SELECT * FROM reports 
       WHERE reported_id = $1 
       ORDER BY created_at DESC`,
      [userId]
    );

    return result.rows;
  }

  /**
   * دریافت گزارش‌های ارسال شده توسط یک کاربر
   */
  async getReportsSentByUser(userId: number): Promise<Report[]> {
    const result = await pool.query(
      `SELECT * FROM reports 
       WHERE reporter_id = $1 
       ORDER BY created_at DESC`,
      [userId]
    );

    return result.rows;
  }

  /**
   * حذف گزارش
   */
  async deleteReport(reportId: number): Promise<void> {
    await pool.query('DELETE FROM reports WHERE id = $1', [reportId]);
    logger.info(`🗑️ Report ${reportId} deleted`);
  }

  /**
   * تعداد گزارش‌های pending
   */
  async getPendingCount(): Promise<number> {
    const result = await pool.query(
      `SELECT COUNT(*) as count FROM reports WHERE status = 'pending'`
    );
    return parseInt(result.rows[0].count) || 0;
  }
}

export const reportService = new ReportService();
