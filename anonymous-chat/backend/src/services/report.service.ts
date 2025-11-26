// src/services/report.service.ts
import { pool } from '../database/db';
import { CustomError } from '../utils/errors';
import { profileService } from './profile.service';
import { userService } from './user.service';

interface Report {
  id: number;
  reporter_id: number;
  reported_user_id: number;
  reason: string;
  description: string | null;
  status: 'pending' | 'reviewed' | 'resolved' | 'rejected';
  admin_note: string | null;
  created_at: Date;
  reviewed_at: Date | null;
}

interface ReportStats {
  totalReports: number;
  pendingReports: number;
  resolvedReports: number;
  rejectedReports: number;
}

class ReportService {
  private readonly REPORT_REASONS = [
    'محتوای نامناسب',
    'رفتار توهین‌آمیز',
    'هرزنامه/اسپم',
    'تقلب یا کلاهبرداری',
    'محتوای خشونت‌آمیز',
    'سایر موارد'
  ];

  /**
   * ثبت گزارش جدید
   */
  async createReport(
    reporterId: number,
    reportedUserId: number,
    reason: string,
    description: string | null = null
  ): Promise<Report> {
    // بررسی معتبر بودن دلیل
    if (!this.REPORT_REASONS.includes(reason)) {
      throw new CustomError('دلیل گزارش نامعتبر است.', 400);
    }

    // بررسی اینکه کاربر خودش را گزارش نکند
    if (reporterId === reportedUserId) {
      throw new CustomError('شما نمی‌توانید خودتان را گزارش کنید.', 400);
    }

    // بررسی وجود کاربر گزارش شده
    const reportedUser = await userService.findUserById(reportedUserId);
    if (!reportedUser) {
      throw new CustomError('کاربر گزارش شده یافت نشد.', 404);
    }

    // بررسی گزارش تکراری (در 24 ساعت گذشته)
    const existingReport = await pool.query(
      `SELECT id FROM reports 
       WHERE reporter_id = $1 
       AND reported_user_id = $2 
       AND created_at > NOW() - INTERVAL '24 hours'`,
      [reporterId, reportedUserId]
    );

    if (existingReport.rows.length > 0) {
      throw new CustomError('شما اخیراً این کاربر را گزارش کرده‌اید. لطفاً صبر کنید.', 400);
    }

    // ثبت گزارش
    const result = await pool.query(
      `INSERT INTO reports 
       (reporter_id, reported_user_id, reason, description, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING *`,
      [reporterId, reportedUserId, reason, description]
    );

    return result.rows[0];
  }

  /**
   * دریافت لیست گزارش‌ها (برای ادمین)
   */
  async getReports(
    status?: string,
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
      LEFT JOIN profiles rpp ON r.reported_user_id = rpp.user_id
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
        (SELECT COUNT(*) FROM reports WHERE reported_user_id = r.reported_user_id) as report_count
      FROM reports r
      LEFT JOIN profiles rp ON r.reporter_id = rp.user_id
      LEFT JOIN profiles rpp ON r.reported_user_id = rpp.user_id
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
    status: 'reviewed' | 'resolved' | 'rejected',
    adminNote: string | null = null
  ): Promise<Report> {
    const result = await pool.query(
      `UPDATE reports 
       SET status = $1, admin_note = $2, reviewed_at = NOW(), reviewed_by = $3
       WHERE id = $4
       RETURNING *`,
      [status, adminNote, adminId, reportId]
    );

    if (result.rows.length === 0) {
      throw new CustomError('گزارش یافت نشد.', 404);
    }

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
    await userService.blockUser(report.reported_user_id, reason);

    // به‌روزرسانی وضعیت گزارش
    await this.reviewReport(reportId, adminId, 'resolved', `کاربر مسدود شد: ${reason}`);
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
         r.reported_user_id as user_id,
         COUNT(*) as report_count,
         json_build_object(
           'name', p.name,
           'custom_id', p.custom_id,
           'gender', p.gender,
           'age', p.age,
           'city', p.city
         ) as profile
       FROM reports r
       LEFT JOIN profiles p ON r.reported_user_id = p.user_id
       GROUP BY r.reported_user_id, p.name, p.custom_id, p.gender, p.age, p.city
       ORDER BY report_count DESC
       LIMIT $1`,
      [limit]
    );

    return result.rows;
  }

  /**
   * دریافت دلایل گزارش
   */
  getReportReasons(): string[] {
    return this.REPORT_REASONS;
  }

  /**
   * دریافت گزارش‌های یک کاربر خاص
   */
  async getUserReports(userId: number): Promise<Report[]> {
    const result = await pool.query(
      `SELECT * FROM reports 
       WHERE reported_user_id = $1 
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
  }
}

export const reportService = new ReportService();
