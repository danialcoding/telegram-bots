// src/services/user.service.ts
import { query, pool } from "../database/db";
import { redis } from "../utils/redis";
import { CustomError } from "../utils/errors";
import { coinService } from "./coin.service";
import logger from "../utils/logger";

export interface User {
  id: number;
  telegram_id: number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  is_blocked: boolean;
  block_reason: string | null;
  blocked_at: Date | null;
  unblock_fine: number;
  referral_code: string;
  referred_by: number | null;
  last_activity: Date;
  created_at: Date;
}

export class UserService {
  /**
   * بررسی وجود پروفایل کامل
   */
  async hasProfile(userId: number): Promise<boolean> {
    try {
      const result = await pool.query(
        `SELECT id FROM profiles 
       WHERE user_id = $1 
       AND display_name IS NOT NULL 
       AND gender IS NOT NULL 
       AND age IS NOT NULL
       LIMIT 1`,
        [userId]
      );
      return result.rows.length > 0;
    } catch (error) {
      logger.error("❌ Error checking profile:", error);
      return false;
    }
  }

  /**
   * به‌روزرسانی پروفایل کاربر
   */
  async updateProfile(
    userId: number,
    data: {
      username?: string;
      firstName?: string;
      lastName?: string;
    }
  ): Promise<void> {
    const { username, firstName, lastName } = data;

    try {
      await pool.query(
        `UPDATE users 
       SET username = COALESCE($2, username),
           first_name = COALESCE($3, first_name),
           last_name = COALESCE($4, last_name),
           updated_at = NOW()
       WHERE id = $1`,
        [userId, username, firstName, lastName]
      );

      logger.debug(`✅ User profile updated: ${userId}`);
    } catch (error) {
      logger.error("❌ Error updating user profile:", error);
      throw error;
    }
  }

  /**
   * پیدا کردن کاربر با کد رفرال
   */
  async findByReferralCode(referralCode: string): Promise<User | null> {
    try {
      const result = await pool.query<User>(
        "SELECT * FROM users WHERE referral_code = $1",
        [referralCode]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error("❌ Error finding user by referral code:", error);
      throw error;
    }
  }

  /**
   * ✅ متد create اصلاح شده
   */
  async create(data: {
    telegram_id: number;
    username: string | null;
    first_name: string;
    last_name: string | null;
  }): Promise<User> {
    // تولید کد رفرال یکتا
    const referralCode = await this.generateUniqueReferralCode();

    const queryText = `
      INSERT INTO users (
        telegram_id, username, first_name, last_name, referral_code
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const values = [
      data.telegram_id,
      data.username,
      data.first_name,
      data.last_name,
      referralCode,
    ];

    const result = await pool.query(queryText, values);
    return result.rows[0];
  }
  
  /**
   * پیدا کردن کاربر با Telegram ID
   */
  async findById(userId: number): Promise<User | null> {
    const result = await pool.query(
      `SELECT 
        id, telegram_id, username, first_name, 
        is_blocked, block_reason, blocked_at,
        referral_count, referred_by, created_at, updated_at
      FROM users 
      WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) return null;
    return result.rows[0];
  }

  /**
   * ✅ متد processReferral جدید
   */
  async processReferral(userId: number, referrerId: number): Promise<boolean> {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // چک کنیم قبلاً رفرال ثبت نشده باشه
      const checkQuery = "SELECT referred_by FROM users WHERE id = $1";
      const checkResult = await client.query(checkQuery, [userId]);

      if (checkResult.rows[0]?.referred_by) {
        await client.query("ROLLBACK");
        return false; // قبلاً رفرال ثبت شده
      }

      // ثبت رفرال
      await client.query("UPDATE users SET referred_by = $1 WHERE id = $2", [
        referrerId,
        userId,
      ]);

      // اضافه کردن سکه به هر دو نفر (اگه coin_service داری)
      try {
        await coinService.addReferralBonus(referrerId, userId, client);
      } catch (error) {
        console.log("⚠️ Coin service not available, skipping bonus");
      }

      await client.query("COMMIT");
      return true;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * پیدا کردن یا ایجاد کاربر جدید
   */
  async findOrCreateUser(
    telegramId: number,
    username?: string,
    firstName?: string,
    referralCode?: string
  ): Promise<User> {
    let user = await this.findByTelegramId(telegramId);

    if (!user) {
      const client = await pool.connect();

      try {
        await client.query("BEGIN");

        // تولید کد رفرال یکتا
        const newReferralCode = await this.generateUniqueReferralCode();

        // بررسی کد رفرال معرف
        let referrerId: number | null = null;
        if (referralCode) {
          const referrer = await this.findUserByReferralCode(referralCode);
          if (referrer && referrer.telegram_id !== telegramId) {
            referrerId = referrer.id;
          }
        }

        // ایجاد کاربر
        const result = await client.query(
          `INSERT INTO users (telegram_id, username, first_name, referral_code, referred_by)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
          [telegramId, username, firstName, newReferralCode, referrerId]
        );
        user = result.rows[0];

        // ایجاد رکورد سکه با موجودی اولیه
        await client.query(
          `INSERT INTO coins (user_id, balance)
           VALUES ($1, 5)`, // 5 سکه اولیه رایگان
          [user.id]
        );

        // پاداش رفرال به معرف
        if (referrerId) {
          await coinService.addReferralBonus(referrerId, user.id, client);
        }

        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    } else {
      // به‌روزرسانی اطلاعات در صورت تغییر
      if (user.username !== username || user.first_name !== firstName) {
        await this.updateUserInfo(user.id, username, firstName);
      }
      await this.updateLastActivity(user.id);
    }

    return user;
  }

  /**
   * تولید کد رفرال یکتا
   */
  private async generateUniqueReferralCode(): Promise<string> {
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code: string;
    let isUnique = false;

    while (!isUnique) {
      code = "";
      for (let i = 0; i < 8; i++) {
        code += characters.charAt(
          Math.floor(Math.random() * characters.length)
        );
      }

      const existing = await query(
        "SELECT id FROM users WHERE referral_code = $1",
        [code]
      );

      if (existing.rows.length === 0) {
        isUnique = true;
      }
    }

    return code!;
  }

  /**
   * جستجوی کاربر با Telegram ID
   */
  async findByTelegramId(telegramId: number): Promise<User | null> {
    const result = await pool.query(
      `SELECT 
      id, telegram_id, username, first_name, last_name,
      is_blocked, block_reason, blocked_at,
      referral_code, referral_count, successful_referrals, referred_by, 
      created_at, updated_at
    FROM users 
    WHERE telegram_id = $1`,
      [telegramId]
    );

    if (result.rows.length === 0) return null;
    return result.rows[0];
  }

  /**
   * پیدا کردن کاربر با آیدی داخلی
   */
  async findUserById(userId: number): Promise<User | null> {
    const result = await query("SELECT * FROM users WHERE id = $1", [userId]);
    return result.rows[0] || null;
  }

  /**
   * پیدا کردن کاربر با کد رفرال
   */
  async findUserByReferralCode(referralCode: string): Promise<User | null> {
    const result = await query("SELECT * FROM users WHERE referral_code = $1", [
      referralCode,
    ]);
    return result.rows[0] || null;
  }

  /**
   * دریافت پروفایل کامل کاربر
   */
  async getUserProfile(userId: number): Promise<any> {
    const result = await query(
      `SELECT 
         p.*,
         u.telegram_id,
         u.username,
         u.is_blocked,
         u.block_reason,
         u.unblock_fine,
         u.referral_code,
         u.last_activity,
         u.created_at as user_created_at,
         c.balance as coin_balance
       FROM users u
       LEFT JOIN profiles p ON u.id = p.user_id
       LEFT JOIN coins c ON u.id = c.user_id
       WHERE u.id = $1`,
      [userId]
    );
    return result.rows[0] || null;
  }

  /**
   * به‌روزرسانی اطلاعات کاربر
   */
  async updateUserInfo(
    userId: number,
    username?: string,
    firstName?: string
  ): Promise<void> {
    await query(
      `UPDATE users 
       SET username = COALESCE($2, username), 
           first_name = COALESCE($3, first_name)
       WHERE id = $1`,
      [userId, username, firstName]
    );
  }

  /**
   * به‌روزرسانی آخرین فعالیت
   */
  async updateLastActivity(userId: number): Promise<void> {
    await query(
      "UPDATE users SET last_activity = CURRENT_TIMESTAMP WHERE id = $1",
      [userId]
    );
    await redis.setUserOnline(userId);
  }

  /**
   * بررسی بلاک بودن کاربر
   */
  async isUserBlocked(userId: number): Promise<boolean> {
    const result = await query("SELECT is_blocked FROM users WHERE id = $1", [
      userId,
    ]);
    return result.rows[0]?.is_blocked || false;
  }

  /**
   * دریافت اطلاعات بلاک
   */
  async getBlockInfo(userId: number): Promise<{
    isBlocked: boolean;
    reason: string | null;
    fine: number;
    blockedAt: Date | null;
  }> {
    const result = await query(
      "SELECT is_blocked, block_reason, unblock_fine, blocked_at FROM users WHERE id = $1",
      [userId]
    );

    const user = result.rows[0];
    if (!user) {
      throw new CustomError("کاربر یافت نشد.", 404);
    }

    return {
      isBlocked: user.is_blocked,
      reason: user.block_reason,
      fine: user.unblock_fine || 50,
      blockedAt: user.blocked_at,
    };
  }

  /**
   * مسدود کردن کاربر
   */
  async blockUser(
    userId: number,
    reason: string,
    fine: number = 50
  ): Promise<void> {
    await query(
      `UPDATE users 
     SET is_blocked = TRUE, 
         block_reason = $2, 
         blocked_at = CURRENT_TIMESTAMP, 
         unblock_fine = $3
     WHERE id = $1`,
      [userId, reason, fine]
    );

    await query(
      `UPDATE chats 
     SET status = 'ended', ended_at = CURRENT_TIMESTAMP 
     WHERE (user1_id = $1 OR user2_id = $1) AND status = 'active'`,
      [userId]
    );

    await redis.removeFromQueue(userId);
  }

  /**
   * رفع مسدودیت با پرداخت جریمه
   */
  async unblockUserWithFine(userId: number): Promise<void> {
    const blockInfo = await this.getBlockInfo(userId);

    if (!blockInfo.isBlocked) {
      throw new CustomError("کاربر مسدود نیست.", 400);
    }

    // کسر جریمه
    await coinService.deductUnblockFine(userId, blockInfo.fine);

    // رفع مسدودیت
    await query(
      `UPDATE users 
       SET is_blocked = FALSE, 
           block_reason = NULL, 
           unblock_fine = 0,
           blocked_at = NULL
       WHERE id = $1`,
      [userId]
    );
  }

  /**
   * رفع مسدودیت توسط ادمین (بدون جریمه)
   */
  async unblockUserByAdmin(userId: number): Promise<void> {
    await query(
      `UPDATE users 
       SET is_blocked = FALSE, 
           block_reason = NULL, 
           unblock_fine = 0,
           blocked_at = NULL
       WHERE id = $1`,
      [userId]
    );
  }

  /**
   * دریافت لیست افراد دعوت شده
   */
  async getReferrals(userId: number): Promise<
    Array<{
      id: number;
      username: string | null;
      first_name: string | null;
      created_at: Date;
    }>
  > {
    const result = await query(
      `SELECT id, username, first_name, created_at
       FROM users
       WHERE referred_by = $1
       ORDER BY created_at DESC`,
      [userId]
    );
    return result.rows;
  }

  /**
   * دریافت تعداد رفرال‌ها
   */
  async getReferralCount(userId: number): Promise<number> {
    const result = await query(
      "SELECT COUNT(*) as count FROM users WHERE referred_by = $1",
      [userId]
    );
    return parseInt(result.rows[0].count) || 0;
  }

  /**
   * دریافت لیست کاربران (برای ادمین)
   */
  async getAllUsers(
    limit: number = 20,
    offset: number = 0,
    filters?: {
      isBlocked?: boolean;
      search?: string;
    }
  ): Promise<{ users: User[]; total: number }> {
    let whereClause = "WHERE 1=1";
    const params: any[] = [];
    let paramIndex = 1;

    if (filters?.isBlocked !== undefined) {
      whereClause += ` AND is_blocked = $${paramIndex}`;
      params.push(filters.isBlocked);
      paramIndex++;
    }

    if (filters?.search) {
      whereClause += ` AND (username ILIKE $${paramIndex} OR first_name ILIKE $${paramIndex} OR telegram_id::text LIKE $${paramIndex})`;
      params.push(`%${filters.search}%`);
      paramIndex++;
    }

    // دریافت تعداد کل
    const countResult = await query(
      `SELECT COUNT(*) as total FROM users ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total);

    // دریافت کاربران
    const result = await query(
      `SELECT * FROM users ${whereClause} 
       ORDER BY created_at DESC 
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    return { users: result.rows, total };
  }

  /**
   * دریافت کاربران آنلاین
   */
  async getOnlineUsers(): Promise<number[]> {
    return await redis.getOnlineUsers();
  }

  /**
   * بررسی آنلاین بودن کاربر
   */
  async isUserOnline(userId: number): Promise<boolean> {
    return await redis.isUserOnline(userId);
  }

  /**
   * آفلاین کردن کاربر
   */
  async setUserOffline(userId: number): Promise<void> {
    await redis.setUserOffline(userId);
  }

  /**
   * حذف کاربر (soft delete)
   */
  async deactivateUser(userId: number): Promise<void> {
    await query("UPDATE users SET is_active = FALSE WHERE id = $1", [userId]);
  }

  /**
   * فعال‌سازی مجدد کاربر
   */
  async activateUser(userId: number): Promise<void> {
    await query("UPDATE users SET is_active = TRUE WHERE id = $1", [userId]);
  }

  /**
   * بررسی تکمیل بودن پروفایل
   */
  async hasCompleteProfile(userId: number): Promise<boolean> {
    const result = await query(
      `SELECT id FROM profiles 
       WHERE user_id = $1 
       AND name IS NOT NULL 
       AND gender IS NOT NULL 
       AND age IS NOT NULL`,
      [userId]
    );
    return result.rows.length > 0;
  }

  /**
   * دریافت آمار کاربر
   */
  async getUserStats(userId: number): Promise<{
    totalChats: number;
    totalMessages: number;
    referralCount: number;
    coinsEarned: number;
    coinsSpent: number;
    reportCount: number;
  }> {
    const result = await query(
      `SELECT 
         (SELECT COUNT(*) FROM chats WHERE user1_id = $1 OR user2_id = $1) as total_chats,
         (SELECT COUNT(*) FROM messages WHERE sender_id = $1) as total_messages,
         (SELECT COUNT(*) FROM users WHERE referred_by = $1) as referral_count,
         (SELECT COALESCE(SUM(amount), 0) FROM coin_transactions WHERE user_id = $1 AND transaction_type = 'earn') as coins_earned,
         (SELECT COALESCE(SUM(amount), 0) FROM coin_transactions WHERE user_id = $1 AND transaction_type = 'spend') as coins_spent,
         (SELECT COUNT(*) FROM reports WHERE reported_user_id = $1) as report_count`,
      [userId]
    );

    const row = result.rows[0];
    return {
      totalChats: parseInt(row.total_chats) || 0,
      totalMessages: parseInt(row.total_messages) || 0,
      referralCount: parseInt(row.referral_count) || 0,
      coinsEarned: parseInt(row.coins_earned) || 0,
      coinsSpent: parseInt(row.coins_spent) || 0,
      reportCount: parseInt(row.report_count) || 0,
    };
  }
}

export const userService = new UserService();
