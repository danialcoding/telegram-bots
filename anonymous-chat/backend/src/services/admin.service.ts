// src/services/admin.service.ts
import { pool } from "../database/db";
import { CustomError } from "../utils/errors";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

interface Admin {
  id: number;
  username: string;
  email: string;
  role: "super_admin" | "admin" | "moderator";
  is_active: boolean;
  last_login: Date | null;
  created_at: Date;
}

interface AdminLoginResponse {
  admin: Omit<Admin, "password_hash">;
  token: string;
}

interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  blockedUsers: number;
  totalChats: number;
  activeChats: number;
  totalCoins: number;
  totalReports: number;
  pendingReports: number;
  newUsersToday: number;
  newUsersThisWeek: number;
  newUsersThisMonth: number;
}

class AdminService {
  private readonly JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
  private readonly JWT_EXPIRES_IN = "7d";

  /**
   * ایجاد ادمین جدید
   */
  async createAdmin(
    username: string,
    email: string,
    password: string,
    role: "super_admin" | "admin" | "moderator" = "moderator"
  ): Promise<Admin> {
    // بررسی یکتا بودن نام کاربری
    const existingUsername = await pool.query(
      "SELECT id FROM admins WHERE username = $1",
      [username]
    );

    if (existingUsername.rows.length > 0) {
      throw new CustomError("این نام کاربری قبلاً استفاده شده است.", 400);
    }

    // بررسی یکتا بودن ایمیل
    const existingEmail = await pool.query(
      "SELECT id FROM admins WHERE email = $1",
      [email]
    );

    if (existingEmail.rows.length > 0) {
      throw new CustomError("این ایمیل قبلاً استفاده شده است.", 400);
    }

    // هش کردن پسورد
    const passwordHash = await bcrypt.hash(password, 10);

    // ثبت ادمین
    const result = await pool.query(
      `INSERT INTO admins (username, email, password_hash, role, is_active)
       VALUES ($1, $2, $3, $4, true)
       RETURNING id, username, email, role, is_active, last_login, created_at`,
      [username, email, passwordHash, role]
    );

    return result.rows[0];
  }

  /**
   * پیدا کردن ادمین با ID
   */
  async findById(userId: number): Promise<any> {
    try {
      const query = `
        SELECT id, telegram_id, username, role, is_active, created_at
        FROM admins
        WHERE telegram_id = $1 AND is_active = true
        LIMIT 1
      `;

      const result = await pool.query(query, [userId]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error("❌ Error finding admin:", error);
      throw error;
    }
  }

  /**
   * دریافت تمام ادمین‌ها
   */
  async findAll(): Promise<any[]> {
    try {
      const query = `
        SELECT id, telegram_id, username, role, is_active, created_at
        FROM admins
        ORDER BY created_at DESC
      `;

      const result = await pool.query(query);
      return result.rows;
    } catch (error) {
      logger.error("❌ Error fetching admins:", error);
      throw error;
    }
  }
  /**
   * غیرفعال کردن ادمین
   */
  async deactivate(userId: number): Promise<void> {
    try {
      const query = `
        UPDATE admins SET is_active = false
        WHERE telegram_id = $1
      `;

      await pool.query(query, [userId]);
      logger.info(`✅ Admin deactivated: ${userId}`);
    } catch (error) {
      logger.error("❌ Error deactivating admin:", error);
      throw error;
    }
  }

  /**
   * ورود ادمین
   */
  async login(username: string, password: string): Promise<AdminLoginResponse> {
    // پیدا کردن ادمین
    const result = await pool.query(
      "SELECT * FROM admins WHERE username = $1",
      [username]
    );

    if (result.rows.length === 0) {
      throw new CustomError("نام کاربری یا رمز عبور اشتباه است.", 401);
    }

    const admin = result.rows[0];

    // بررسی فعال بودن
    if (!admin.is_active) {
      throw new CustomError("حساب شما غیرفعال شده است.", 403);
    }

    // بررسی پسورد
    const isPasswordValid = await bcrypt.compare(password, admin.password_hash);

    if (!isPasswordValid) {
      throw new CustomError("نام کاربری یا رمز عبور اشتباه است.", 401);
    }

    // به‌روزرسانی آخرین ورود
    await pool.query("UPDATE admins SET last_login = NOW() WHERE id = $1", [
      admin.id,
    ]);

    // تولید توکن
    const token = jwt.sign(
      {
        id: admin.id,
        username: admin.username,
        role: admin.role,
      },
      this.JWT_SECRET,
      { expiresIn: this.JWT_EXPIRES_IN }
    );

    // حذف پسورد از پاسخ
    const { password_hash, ...adminWithoutPassword } = admin;

    return {
      admin: adminWithoutPassword,
      token,
    };
  }

  /**
   * تأیید توکن
   */
  verifyToken(token: string): any {
    try {
      return jwt.verify(token, this.JWT_SECRET);
    } catch (error) {
      throw new CustomError("توکن نامعتبر است.", 401);
    }
  }

  /**
   * دریافت اطلاعات ادمین
   */
  async getAdminById(adminId: number): Promise<Omit<Admin, "password_hash">> {
    const result = await pool.query(
      "SELECT id, username, email, role, is_active, last_login, created_at FROM admins WHERE id = $1",
      [adminId]
    );

    if (result.rows.length === 0) {
      throw new CustomError("ادمین یافت نشد.", 404);
    }

    return result.rows[0];
  }

  /**
   * دریافت لیست ادمین‌ها
   */
  async getAllAdmins(): Promise<Omit<Admin, "password_hash">[]> {
    const result = await pool.query(
      `SELECT id, username, email, role, is_active, last_login, created_at 
       FROM admins 
       ORDER BY created_at DESC`
    );

    return result.rows;
  }

  /**
   * به‌روزرسانی رمز عبور
   */
  async updatePassword(adminId: number, newPassword: string): Promise<void> {
    const passwordHash = await bcrypt.hash(newPassword, 10);

    await pool.query("UPDATE admins SET password_hash = $1 WHERE id = $2", [
      passwordHash,
      adminId,
    ]);
  }

  /**
   * غیرفعال/فعال کردن ادمین
   */
  async toggleAdminStatus(adminId: number, isActive: boolean): Promise<void> {
    await pool.query("UPDATE admins SET is_active = $1 WHERE id = $2", [
      isActive,
      adminId,
    ]);
  }

  /**
   * حذف ادمین
   */
  async deleteAdmin(adminId: number): Promise<void> {
    await pool.query("DELETE FROM admins WHERE id = $1", [adminId]);
  }

  /**
   * دریافت آمار داشبورد
   */
  async getDashboardStats(): Promise<DashboardStats> {
    const stats = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM users WHERE is_active = true) as active_users,
        (SELECT COUNT(*) FROM users WHERE is_blocked = true) as blocked_users,
        (SELECT COUNT(*) FROM chats) as total_chats,
        (SELECT COUNT(*) FROM chats WHERE status = 'active') as active_chats,
        (SELECT COALESCE(SUM(balance), 0) FROM users) as total_coins,
        (SELECT COUNT(*) FROM reports) as total_reports,
        (SELECT COUNT(*) FROM reports WHERE status = 'pending') as pending_reports,
        (SELECT COUNT(*) FROM users WHERE created_at::date = CURRENT_DATE) as new_users_today,
        (SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '7 days') as new_users_this_week,
        (SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '30 days') as new_users_this_month
    `);

    const row = stats.rows[0];

    return {
      totalUsers: parseInt(row.total_users) || 0,
      activeUsers: parseInt(row.active_users) || 0,
      blockedUsers: parseInt(row.blocked_users) || 0,
      totalChats: parseInt(row.total_chats) || 0,
      activeChats: parseInt(row.active_chats) || 0,
      totalCoins: parseInt(row.total_coins) || 0,
      totalReports: parseInt(row.total_reports) || 0,
      pendingReports: parseInt(row.pending_reports) || 0,
      newUsersToday: parseInt(row.new_users_today) || 0,
      newUsersThisWeek: parseInt(row.new_users_this_week) || 0,
      newUsersThisMonth: parseInt(row.new_users_this_month) || 0,
    };
  }

  /**
   * دریافت آمار کاربران (چارت)
   */
  async getUsersChartData(days: number = 30): Promise<
    Array<{
      date: string;
      count: number;
    }>
  > {
    const result = await pool.query(
      `SELECT 
         DATE(created_at) as date,
         COUNT(*) as count
       FROM users
       WHERE created_at >= NOW() - INTERVAL '${days} days'
       GROUP BY DATE(created_at)
       ORDER BY date ASC`
    );

    return result.rows;
  }

  /**
   * دریافت آمار چت‌ها (چارت)
   */
  async getChatsChartData(days: number = 30): Promise<
    Array<{
      date: string;
      count: number;
    }>
  > {
    const result = await pool.query(
      `SELECT 
         DATE(started_at) as date,
         COUNT(*) as count
       FROM chats
       WHERE started_at >= NOW() - INTERVAL '${days} days'
       GROUP BY DATE(started_at)
       ORDER BY date ASC`
    );

    return result.rows;
  }

  /**
   * دریافت آمار سکه‌ها (چارت)
   */
  async getCoinsChartData(days: number = 30): Promise<
    Array<{
      date: string;
      earned: number;
      spent: number;
    }>
  > {
    const result = await pool.query(
      `SELECT 
         DATE(created_at) as date,
         SUM(CASE WHEN transaction_type = 'earn' THEN amount ELSE 0 END) as earned,
         SUM(CASE WHEN transaction_type = 'spend' THEN amount ELSE 0 END) as spent
       FROM coin_transactions
       WHERE created_at >= NOW() - INTERVAL '${days} days'
       GROUP BY DATE(created_at)
       ORDER BY date ASC`
    );

    return result.rows;
  }

  async validateCredentials(username: string, password: string) {
    const result = await pool.query(
      "SELECT * FROM admins WHERE username = $1",
      [username]
    );
    const admin = result.rows[0];
    if (!admin) return null;

    const bcrypt = await import("bcrypt");
    const isMatch = await bcrypt.compare(password, admin.password);
    return isMatch ? admin : null;
  }

  async updateLastLogin(adminId: number) {
    await pool.query(
      "UPDATE admins SET last_login = NOW() WHERE id = $1 OR user_id = $1",
      [adminId]
    );
  }
}

export const adminService = new AdminService();
