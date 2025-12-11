import { pool } from '../database/db';
import type { Like } from '../types/database.types';

export class LikeService {
  /**
   * لایک کردن پروفایل
   */
  async likeProfile(likerId: number, likedProfileId: number): Promise<Like> {
    const query = `
      INSERT INTO likes (liker_id, liked_profile_id)
      VALUES ($1, $2)
      ON CONFLICT (liker_id, liked_profile_id) DO NOTHING
      RETURNING *
    `;

    const result = await pool.query(query, [likerId, likedProfileId]);
    return result.rows[0];
  }

  /**
   * برداشتن لایک
   */
  async unlikeProfile(likerId: number, likedProfileId: number): Promise<boolean> {
    const query = `
      DELETE FROM likes
      WHERE liker_id = $1 AND liked_profile_id = $2
    `;

    const result = await pool.query(query, [likerId, likedProfileId]);
    return result.rowCount > 0;
  }

  /**
   * تاگل لایک (اگه لایک کرده برداره، اگه نکرده لایک کنه)
   */
  async toggleLike(likerId: number, likedProfileId: number): Promise<boolean> {
    const hasLiked = await this.hasLiked(likerId, likedProfileId);

    if (hasLiked) {
      await this.unlikeProfile(likerId, likedProfileId);
      return false;
    } else {
      await this.likeProfile(likerId, likedProfileId);
      return true;
    }
  }

  /**
   * چک کردن آیا کاربر لایک کرده
   */
  async hasLiked(likerId: number, likedProfileId: number): Promise<boolean> {
    const query = `
      SELECT EXISTS(
        SELECT 1 FROM likes
        WHERE liker_id = $1 AND liked_profile_id = $2
      ) as exists
    `;

    const result = await pool.query(query, [likerId, likedProfileId]);
    return result.rows[0].exists;
  }

  /**
   * دریافت تعداد لایک‌های پروفایل
   */
  async getLikesCount(profileId: number): Promise<number> {
    const query = `
      SELECT likes_count
      FROM profiles
      WHERE id = $1
    `;

    const result = await pool.query(query, [profileId]);
    return result.rows[0]?.likes_count ?? 0;
  }

  /**
   * دریافت لیست کسانی که پروفایل رو لایک کردن با pagination
   */
  async getProfileLikers(profileId: number, page: number = 1, limit: number = 10) {
    const offset = (page - 1) * limit;
    
    const query = `
      SELECT 
        l.id,
        l.liker_id,
        l.created_at,
        p.custom_id,
        p.display_name,
        p.gender,
        p.age,
        p.province,
        p.city,
        p.latitude,
        p.longitude,
        p.photo_file_id,
        p.likes_count,
        u.is_online,
        u.last_activity,
        u.first_name,
        EXISTS(
          SELECT 1 FROM chats 
          WHERE (user1_id = u.id OR user2_id = u.id) 
          AND status = 'active'
        ) as has_active_chat
      FROM likes l
      JOIN profiles p ON l.liker_id = p.id
      JOIN users u ON p.user_id = u.id
      WHERE l.liked_profile_id = $1
      ORDER BY l.created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await pool.query(query, [profileId, limit, offset]);
    
    // شمارش کل لایکر‌ها
    const countQuery = 'SELECT COUNT(*) FROM likes WHERE liked_profile_id = $1';
    const countResult = await pool.query(countQuery, [profileId]);
    const totalCount = parseInt(countResult.rows[0].count);
    
    return {
      likers: result.rows,
      totalCount,
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
      hasNext: page < Math.ceil(totalCount / limit),
      hasPrev: page > 1,
    };
  }

  /**
   * دریافت لیست پروفایل‌هایی که کاربر لایک کرده
   */
  async getUserLikes(userId: number, limit: number = 50) {
    const query = `
      SELECT 
        l.id,
        l.liked_profile_id,
        l.created_at,
        p.custom_id,
        p.display_name,
        p.gender,
        p.age,
        p.province,
        p.city,
        p.latitude,
        p.longitude,
        p.photo_file_id,
        p.likes_count,
        u.is_online,
        u.last_activity,
        u.first_name
      FROM likes l
      JOIN profiles p ON l.liked_profile_id = p.id
      JOIN users u ON p.user_id = u.id
      WHERE l.liker_id = $1
      ORDER BY l.created_at DESC
      LIMIT $2
    `;

    const result = await pool.query(query, [userId, limit]);
    return result.rows;
  }
}

export const likeService = new LikeService();
