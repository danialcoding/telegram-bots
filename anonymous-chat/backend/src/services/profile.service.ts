// src/services/profile.service.ts
import { pool } from "../database/db";
import { CustomError } from "../utils/errors";
import crypto from "crypto";
import { Province, City } from "../utils/locations";
import logger from "../utils/logger";

interface CreateProfileData {
  userId: number;
  gender: "male" | "female";
  name: string;
  age: number;
  bio: string;
  province: Province;
  city: City;
  latitude?: number;
  longitude?: number;
  photoFileId?: string;
}

export interface UpdateProfileData {
  name?: string;
  display_name?: string;
  gender?: "male" | "female";
  age?: number;
  province?: number;
  city?: number;
  latitude?: number | null;
  longitude?: number | null;
  bio?: string | null;
  photo_url?: string | null;
  photoFileId?: string;
}

interface Profile {
  id: number;
  user_id: number;
  custom_id: string;
  gender: "male" | "female";
  name: string;
  age: number;
  bio: string;
  province: Province;
  city: City;
  latitude?: number | null;
  longitude?: number | null;
  photo_file_id: string | null;
  is_online: boolean;
  last_seen: Date;
  anonymous_link_token: string;
  created_at: Date;
  updated_at: Date;
}

interface SearchFilters {
  gender?: "male" | "female";
  minAge?: number;
  maxAge?: number;
  province?: Province;
  city?: City;
  isOnline?: boolean;
}

class ProfileService {
  /**
   * تولید Custom ID یکتا (6 رقمی)
   */
  private async generateUniqueCustomId(): Promise<string> {
    let customId: string;
    let exists = true;

    while (exists) {
      // تولید ID به شکل ID_XXXXXX (6 کاراکتر ترکیبی از حروف و اعداد)
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let randomPart = '';
      for (let i = 0; i < 6; i++) {
        randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      customId = `ID_${randomPart}`;
      
      const result = await pool.query(
        "SELECT 1 FROM profiles WHERE custom_id = $1",
        [customId]
      );
      exists = result.rows.length > 0;
    }

    return customId!;
  }

  /**
   * تولید توکن لینک ناشناس یکتا
   */
  private async generateUniqueAnonymousToken(): Promise<string> {
    let token: string;
    let exists = true;

    while (exists) {
      token = crypto.randomBytes(16).toString("hex");
      const result = await pool.query(
        "SELECT id FROM profiles WHERE anonymous_link_token = $1",
        [token]
      );
      exists = result.rows.length > 0;
    }

    return token!;
  }

  /**
   * ✅ تولید anonymous_link_token یکتا
   */
  private async generateAnonymousToken(): Promise<string> {
    let token: string;
    let exists = true;

    while (exists) {
      token = crypto.randomBytes(32).toString("hex");
      const result = await pool.query(
        "SELECT 1 FROM profiles WHERE anonymous_link_token = $1",
        [token]
      );
      exists = result.rows.length > 0;
    }

    return token!;
  }

  /**
   * ساخت پروفایل جدید
   */
  async createProfile(data: CreateProfileData): Promise<Profile> {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const existingProfile = await client.query(
        "SELECT id FROM profiles WHERE user_id = $1",
        [data.userId]
      );

      if (existingProfile.rows.length > 0) {
        throw new CustomError("شما قبلاً پروفایل ساخته‌اید.", 400);
      }

      const customId = await this.generateUniqueCustomId();
      const anonymousToken = await this.generateUniqueAnonymousToken();

      const result = await client.query(
        `INSERT INTO profiles 
        (user_id, custom_id, gender, name, age, bio, province, city, photo_file_id, anonymous_link_token)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *`,
        [
          data.userId,
          customId,
          data.gender,
          data.name,
          data.age,
          data.bio,
          data.province,
          data.city,
          data.photoFileId || null,
          anonymousToken,
        ]
      );

      await client.query("COMMIT");
      return result.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * دریافت پروفایل بر اساس user_id
   */
  async getProfileByUserId(userId: number): Promise<Profile | null> {
    const result = await pool.query(
      "SELECT * FROM profiles WHERE user_id = $1",
      [userId]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * دریافت پروفایل بر اساس custom_id
   */
  async getProfileByCustomId(customId: string): Promise<Profile | null> {
    const result = await pool.query(
      "SELECT * FROM profiles WHERE custom_id = $1",
      [customId]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * دریافت پروفایل بر اساس anonymous_link_token
   */
  async getProfileByAnonymousToken(token: string): Promise<Profile | null> {
    const result = await pool.query(
      "SELECT * FROM profiles WHERE anonymous_link_token = $1",
      [token]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * ✅ به‌روزرسانی یا ایجاد پروفایل
   */
  async updateProfile(
    userId: number,
    data: {
      display_name?: string;
      gender?: "male" | "female";
      age?: number;
      province?: number;
      city?: number;
      bio?: string | null;
      latitude?: number | null;
      longitude?: number | null;
    }
  ): Promise<void> {
    try {
      const existingProfile = await this.getProfile(userId);

      if (existingProfile) {
        // برای latitude و longitude از logic ویژه استفاده می‌کنیم
        const updates: string[] = [];
        const values: any[] = [userId];
        let paramIndex = 2;

        if (data.display_name !== undefined) {
          updates.push(`display_name = $${paramIndex++}`);
          values.push(data.display_name);
        }
        if (data.gender !== undefined) {
          updates.push(`gender = $${paramIndex++}`);
          values.push(data.gender);
        }
        if (data.age !== undefined) {
          updates.push(`age = $${paramIndex++}`);
          values.push(data.age);
        }
        if (data.province !== undefined) {
          updates.push(`province = $${paramIndex++}`);
          values.push(data.province);
        }
        if (data.city !== undefined) {
          updates.push(`city = $${paramIndex++}`);
          values.push(data.city);
        }
        if (data.bio !== undefined) {
          updates.push(`bio = $${paramIndex++}`);
          values.push(data.bio);
        }
        if (data.latitude !== undefined) {
          updates.push(`latitude = $${paramIndex++}`);
          values.push(data.latitude);
        }
        if (data.longitude !== undefined) {
          updates.push(`longitude = $${paramIndex++}`);
          values.push(data.longitude);
        }

        if (updates.length > 0) {
          updates.push('updated_at = CURRENT_TIMESTAMP');
          const queryText = `
            UPDATE profiles
            SET ${updates.join(', ')}
            WHERE user_id = $1
          `;
          await pool.query(queryText, values);
        }
      } else {
        const user = await pool.query(
          "SELECT first_name FROM users WHERE id = $1",
          [userId]
        );
        const displayName = data.display_name || user.rows[0]?.first_name || "کاربر";

        const customId = await this.generateUniqueCustomId();
        const anonymousToken = await this.generateAnonymousToken();

        const queryText = `
        INSERT INTO profiles (
          user_id, custom_id, display_name, gender, age, 
          province, city, bio, latitude, longitude, anonymous_link_token
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `;

        await pool.query(queryText, [
          userId,
          customId,
          displayName,
          data.gender,
          data.age,
          data.province,
          data.city,
          data.bio,
          data.latitude,
          data.longitude,
          anonymousToken,
        ]);
      }

      logger.info(`✅ Profile updated/created for user ${userId}`);
    } catch (error) {
      logger.error("❌ Update profile error:", error);
      throw new CustomError("خطا در به‌روزرسانی پروفایل", 500);
    }
  }

  /**
   * حذف پروفایل
   */
  async deleteProfile(userId: number): Promise<void> {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const profile = await this.getProfileByUserId(userId);

      if (!profile) {
        throw new CustomError("پروفایل یافت نشد.", 404);
      }

      const activeChat = await client.query(
        `SELECT id FROM active_chats 
         WHERE (user1_id = $1 OR user2_id = $1) AND status = 'active'`,
        [userId]
      );

      if (activeChat.rows.length > 0) {
        throw new CustomError(
          "شما نمی‌توانید پروفایل خود را در حین چت فعال حذف کنید.",
          400
        );
      }

      await client.query("DELETE FROM profiles WHERE user_id = $1", [userId]);

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * به‌روزرسانی وضعیت آنلاین
   */
  async updateOnlineStatus(userId: number, isOnline: boolean): Promise<void> {
    await pool.query(
      `UPDATE users 
       SET is_online = $1, last_activity = NOW(), updated_at = NOW()
       WHERE id = $2`,
      [isOnline, userId]
    );
  }

  /**
   * بررسی اینکه آیا کاربر چت فعال دارد
   */
  async hasActiveChat(userId: number): Promise<boolean> {
    const result = await pool.query(
      `SELECT EXISTS(
        SELECT 1 FROM random_chats 
        WHERE (user1_id = $1 OR user2_id = $1) 
        AND status = 'active'
      ) as has_chat`,
      [userId]
    );
    return result.rows[0]?.has_chat || false;
  }

  /**
   * جستجوی پروفایل‌ها با فیلترها
   */
  async searchProfiles(
    filters: SearchFilters,
    page: number = 1,
    limit: number = 10
  ): Promise<{ profiles: Profile[]; total: number; pages: number }> {
    const conditions: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (filters.gender) {
      conditions.push(`gender = $${paramCount++}`);
      values.push(filters.gender);
    }

    if (filters.minAge !== undefined) {
      conditions.push(`age >= $${paramCount++}`);
      values.push(filters.minAge);
    }

    if (filters.maxAge !== undefined) {
      conditions.push(`age <= $${paramCount++}`);
      values.push(filters.maxAge);
    }

    if (filters.province) {
      conditions.push(`province = $${paramCount++}`);
      values.push(filters.province);
    }

    if (filters.city) {
      conditions.push(`city = $${paramCount++}`);
      values.push(filters.city);
    }

    if (filters.isOnline !== undefined) {
      conditions.push(`is_online = $${paramCount++}`);
      values.push(filters.isOnline);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countQuery = `SELECT COUNT(*) FROM profiles ${whereClause}`;
    const countResult = await pool.query(countQuery, values);
    const total = parseInt(countResult.rows[0].count);

    const offset = (page - 1) * limit;
    const pages = Math.ceil(total / limit);

    values.push(limit, offset);
    const query = `
      SELECT * FROM profiles 
      ${whereClause}
      ORDER BY is_online DESC, last_seen DESC
      LIMIT $${paramCount++} OFFSET $${paramCount++}
    `;

    const result = await pool.query(query, values);

    return {
      profiles: result.rows,
      total,
      pages,
    };
  }

  /**
   * دریافت پروفایل‌های آنلاین
   */
  async getOnlineProfiles(limit: number = 50): Promise<Profile[]> {
    const result = await pool.query(
      `SELECT * FROM profiles 
       WHERE is_online = true 
       ORDER BY last_seen DESC 
       LIMIT $1`,
      [limit]
    );

    return result.rows;
  }

  /**
   * تولید لینک ناشناس جدید
   */
  async regenerateAnonymousLink(userId: number): Promise<string> {
    const profile = await this.getProfileByUserId(userId);

    if (!profile) {
      throw new CustomError("پروفایل یافت نشد.", 404);
    }

    const newToken = await this.generateUniqueAnonymousToken();

    await pool.query(
      `UPDATE profiles 
       SET anonymous_link_token = $1, updated_at = NOW()
       WHERE user_id = $2`,
      [newToken, userId]
    );

    return newToken;
  }

  /**
   * دریافت آمار پروفایل‌ها
   */
  async getProfileStats(): Promise<{
    total: number;
    male: number;
    female: number;
    online: number;
    withPhoto: number;
  }> {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE gender = 'male') as male,
        COUNT(*) FILTER (WHERE gender = 'female') as female,
        COUNT(*) FILTER (WHERE is_online = true) as online,
        COUNT(*) FILTER (WHERE photo_file_id IS NOT NULL) as with_photo
      FROM profiles
    `);

    return {
      total: parseInt(result.rows[0].total),
      male: parseInt(result.rows[0].male),
      female: parseInt(result.rows[0].female),
      online: parseInt(result.rows[0].online),
      withPhoto: parseInt(result.rows[0].with_photo),
    };
  }

  /**
   * دریافت پروفایل‌های اخیر
   */
  async getRecentProfiles(limit: number = 20): Promise<Profile[]> {
    const result = await pool.query(
      `SELECT * FROM profiles 
       ORDER BY created_at DESC 
       LIMIT $1`,
      [limit]
    );

    return result.rows;
  }

  /**
   * دریافت پروفایل کاربر
   */
  async getProfile(userId: number) {
    const result = await pool.query(
      `SELECT 
      p.*,
      u.telegram_id,
      u.username,
      u.first_name,
      u.last_name
    FROM profiles p
    LEFT JOIN users u ON p.user_id = u.id
    WHERE p.user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) return null;

    return result.rows[0];
  }

  /**
   * ✅ دریافت پروفایل کامل (برای خود کاربر - شامل لینک ناشناس و تنظیمات)
   */
  async getFullProfile(userId: number) {
    const result = await pool.query(
      `SELECT 
        p.*,
        u.telegram_id,
        u.username,
        u.first_name,
        u.last_name,
        u.is_blocked,
        u.block_reason,
        u.blocked_at,
        u.unblock_fine,
        u.is_online,
        u.last_activity as last_seen,
        EXISTS(
          SELECT 1 FROM random_chats 
          WHERE (user1_id = u.id OR user2_id = u.id) 
          AND status = 'active'
        ) as has_active_chat
      FROM profiles p
      LEFT JOIN users u ON p.user_id = u.id
      WHERE p.user_id = $1`,
      [userId]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * ✅ دریافت پروفایل عمومی با جزئیات کامل بلاک
   */
  async getPublicProfile(
    identifier: { customId: string } | { userId: number },
    viewerId?: number
  ) {
    const isCustomId = "customId" in identifier;

    const query = `
      SELECT 
        p.id,
        p.user_id,
        p.custom_id,
        p.display_name,
        p.gender,
        p.age,
        p.bio,
        p.province,
        p.city,
        p.photo_file_id,
        p.latitude,
        p.longitude,
        p.rating,
        p.total_chats,
        p.show_likes,
        p.created_at,
        p.updated_at,
        CASE 
          WHEN p.show_likes = TRUE THEN p.likes_count 
          ELSE NULL 
        END as likes_count,
        u.is_online,
        u.last_activity,
        u.is_blocked as is_admin_blocked,
        u.block_reason,
        u.unblock_fine,
        ${
          viewerId
            ? `
          EXISTS(
            SELECT 1 FROM likes 
            WHERE liker_id = $2 AND liked_profile_id = p.id
          ) as is_liked_by_viewer,
          EXISTS(
            SELECT 1 FROM blocks 
            WHERE blocker_id = $2 AND blocked_id = p.user_id
          ) as viewer_blocked_target,
          EXISTS(
            SELECT 1 FROM blocks 
            WHERE blocker_id = p.user_id AND blocked_id = $2
          ) as target_blocked_viewer,
          EXISTS(
            SELECT 1 FROM contacts 
            WHERE user_id = $2 AND contact_user_id = p.user_id
          ) as is_in_contacts,
          EXISTS(
            SELECT 1 FROM random_chats
            WHERE (user1_id = $2 AND user2_id = p.user_id)
               OR (user1_id = p.user_id AND user2_id = $2)
          ) as has_chat_history,
          EXISTS(
            SELECT 1 FROM random_chats 
            WHERE (user1_id = p.user_id OR user2_id = p.user_id) 
            AND status = 'active'
          ) as has_active_chat
        `
            : `
          FALSE as is_liked_by_viewer,
          FALSE as viewer_blocked_target,
          FALSE as target_blocked_viewer,
          FALSE as is_in_contacts,
          FALSE as has_chat_history,
          FALSE as has_active_chat
        `
        }
      FROM profiles p
      JOIN users u ON p.user_id = u.id
      WHERE ${isCustomId ? "p.custom_id = $1" : "p.user_id = $1"}
    `;

    const params = isCustomId
      ? viewerId
        ? [identifier.customId, viewerId]
        : [identifier.customId]
      : viewerId
      ? [identifier.userId, viewerId]
      : [identifier.userId];

    const result = await pool.query(query, params);

    // اضافه کردن فیلد ترکیبی has_block_relation
    if (result.rows[0]) {
      result.rows[0].has_block_relation =
        result.rows[0].viewer_blocked_target ||
        result.rows[0].target_blocked_viewer;
      
      // لاگ برای دیباگ
      logger.info(`Public profile for user ${result.rows[0].user_id}: photo_file_id = ${result.rows[0].photo_file_id}`);
    }

    return result.rows[0] || null;
  }

  /**
   * ✅ ثبت بازدید پروفایل
   */
  async recordProfileView(viewerId: number, profileUserId: number): Promise<void> {
    await pool.query(
      `INSERT INTO profile_views (viewer_id, profile_user_id)
       VALUES ($1, $2)
       ON CONFLICT (viewer_id, profile_user_id) 
       DO UPDATE SET viewed_at = CURRENT_TIMESTAMP`,
      [viewerId, profileUserId]
    );
  }

  /**
   * ✅ به‌روزرسانی تنظیمات حریم خصوصی
   */
  async updatePrivacySettings(
    userId: number,
    settings: {
      show_likes?: boolean;
      alert_profile_view?: boolean;
      alert_profile_like?: boolean;
    }
  ): Promise<void> {
    const queryText = `
      UPDATE profiles
      SET
        show_likes = COALESCE($2, show_likes),
        alert_profile_view = COALESCE($3, alert_profile_view),
        alert_profile_like = COALESCE($4, alert_profile_like),
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1
    `;

    await pool.query(queryText, [
      userId,
      settings.show_likes,
      settings.alert_profile_view,
      settings.alert_profile_like,
    ]);
  }

  /**
   * آپدیت عکس پروفایل
   */
  async updateProfilePhoto(userId: number, photoFileId: string): Promise<void> {
    const queryText = `
    UPDATE profiles
    SET photo_file_id = $2, updated_at = CURRENT_TIMESTAMP
    WHERE user_id = $1
  `;

    await pool.query(queryText, [userId, photoFileId]);
  }

  /**
   * چک کردن اینکه پروفایل کامل هست یا نه
   */
  async isProfileComplete(userId: number): Promise<boolean> {
    const result = await pool.query(
      `SELECT 
      CASE WHEN 
        display_name IS NOT NULL AND 
        gender IS NOT NULL AND 
        age IS NOT NULL AND 
        province IS NOT NULL AND 
        city IS NOT NULL 
      THEN TRUE ELSE FALSE END as is_complete
    FROM profiles 
    WHERE user_id = $1`,
      [userId]
    );

    return result.rows[0]?.is_complete || false;
  }
}

export const profileService = new ProfileService();
