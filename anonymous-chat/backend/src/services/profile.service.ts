// src/services/profile.service.ts
import { pool } from "../database/db";
import { CustomError } from "../utils/errors";
import crypto from "crypto";
import { Province, City } from "../utils/locations";

interface CreateProfileData {
  userId: number;
  gender: "male" | "female";
  name: string;
  age: number;
  bio: string;
  province: Province;
  city: City;
  photoFileId?: string;
}

export interface UpdateProfileData {
  name?: string;
  display_name?: string;
  gender?: "male" | "female";
  age?: number;
  province?: string;
  city?: string;
  provinceId?: number; // ✅ اضافه شد
  cityId?: number; // ✅ اضافه شد
  bio?: string | null;
  photo_url?: string | null;
  photoFileId?: string; // ✅ اضافه شد
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
      // تولید عدد 6 رقمی تصادفی
      customId = Math.floor(100000 + Math.random() * 900000).toString();

      // بررسی یکتا بودن
      const result = await pool.query(
        "SELECT id FROM profiles WHERE custom_id = $1",
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
      // تولید توکن 32 کاراکتری
      token = crypto.randomBytes(16).toString("hex");

      // بررسی یکتا بودن
      const result = await pool.query(
        "SELECT id FROM profiles WHERE anonymous_link_token = $1",
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

      // بررسی وجود پروفایل قبلی
      const existingProfile = await client.query(
        "SELECT id FROM profiles WHERE user_id = $1",
        [data.userId]
      );

      if (existingProfile.rows.length > 0) {
        throw new CustomError("شما قبلاً پروفایل ساخته‌اید.", 400);
      }

      // تولید Custom ID و Anonymous Token
      const customId = await this.generateUniqueCustomId();
      const anonymousToken = await this.generateUniqueAnonymousToken();

      // ایجاد پروفایل
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
   * به‌روزرسانی پروفایل
   */
  async updateProfile(
    userId: number,
    data: UpdateProfileData
  ): Promise<Profile> {
    const profile = await this.getProfileByUserId(userId);

    if (!profile) {
      throw new CustomError("پروفایل یافت نشد.", 404);
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (data.name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(data.name);
    }

    if (data.display_name !== undefined) {
      updates.push(`display_name = $${paramCount++}`);
      values.push(data.display_name);
    }

    if (data.gender !== undefined) {
      updates.push(`gender = $${paramCount++}`);
      values.push(data.gender);
    }

    if (data.age !== undefined) {
      updates.push(`age = $${paramCount++}`);
      values.push(data.age);
    }

    if (data.bio !== undefined) {
      updates.push(`bio = $${paramCount++}`);
      values.push(data.bio);
    }

    // ✅ پشتیبانی از provinceId
    if (data.provinceId !== undefined) {
      updates.push(`province_id = $${paramCount++}`);
      values.push(data.provinceId);
    }

    // ✅ پشتیبانی از province (string)
    if (data.province !== undefined) {
      updates.push(`province = $${paramCount++}`);
      values.push(data.province);
    }

    // ✅ پشتیبانی از cityId
    if (data.cityId !== undefined) {
      updates.push(`city_id = $${paramCount++}`);
      values.push(data.cityId);
    }

    // ✅ پشتیبانی از city (string)
    if (data.city !== undefined) {
      updates.push(`city = $${paramCount++}`);
      values.push(data.city);
    }

    // ✅ پشتیبانی از photoFileId
    if (data.photoFileId !== undefined) {
      updates.push(`photo_file_id = $${paramCount++}`);
      values.push(data.photoFileId);
    }

    // ✅ پشتیبانی از photo_url
    if (data.photo_url !== undefined) {
      updates.push(`photo_url = $${paramCount++}`);
      values.push(data.photo_url);
    }

    if (updates.length === 0) {
      return profile;
    }

    updates.push(`updated_at = NOW()`);
    values.push(userId);

    const query = `
    UPDATE profiles 
    SET ${updates.join(", ")}
    WHERE user_id = $${paramCount}
    RETURNING *
  `;

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  /**
   * حذف پروفایل
   */
  async deleteProfile(userId: number): Promise<void> {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // بررسی وجود پروفایل
      const profile = await this.getProfileByUserId(userId);

      if (!profile) {
        throw new CustomError("پروفایل یافت نشد.", 404);
      }

      // بررسی اینکه کاربر در چت فعال نباشد
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

      // حذف پروفایل
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
      `UPDATE profiles 
       SET is_online = $1, last_seen = NOW(), updated_at = NOW()
       WHERE user_id = $2`,
      [isOnline, userId]
    );
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

    // شمارش کل
    const countQuery = `SELECT COUNT(*) FROM profiles ${whereClause}`;
    const countResult = await pool.query(countQuery, values);
    const total = parseInt(countResult.rows[0].count);

    // محاسبه صفحه‌بندی
    const offset = (page - 1) * limit;
    const pages = Math.ceil(total / limit);

    // دریافت پروفایل‌ها
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
        name IS NOT NULL AND 
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
