// src/services/block.service.ts
import { pool } from "../database/db";
import { CustomError } from "../utils/errors";
import logger from "../utils/logger";

class BlockService {
  /**
   * بلاک کردن کاربر
   */
  async blockUser(blockerId: number, blockedId: number): Promise<void> {
    if (blockerId === blockedId) {
      throw new CustomError("شما نمی‌توانید خودتان را بلاک کنید.", 400);
    }

    try {
      await pool.query(
        `INSERT INTO blocks (blocker_id, blocked_id)
         VALUES ($1, $2)
         ON CONFLICT (blocker_id, blocked_id) DO NOTHING`,
        [blockerId, blockedId]
      );

      logger.info(`✅ User ${blockerId} blocked user ${blockedId}`);
    } catch (error) {
      logger.error("❌ Block user error:", error);
      throw new CustomError("خطا در بلاک کردن کاربر", 500);
    }
  }

  /**
   * آنبلاک کردن کاربر
   */
  async unblockUser(blockerId: number, blockedId: number): Promise<void> {
    try {
      const result = await pool.query(
        "DELETE FROM blocks WHERE blocker_id = $1 AND blocked_id = $2",
        [blockerId, blockedId]
      );

      if (result.rowCount === 0) {
        throw new CustomError("این کاربر بلاک نشده است.", 404);
      }

      logger.info(`✅ User ${blockerId} unblocked user ${blockedId}`);
    } catch (error) {
      logger.error("❌ Unblock user error:", error);
      throw new CustomError("خطا در آنبلاک کردن کاربر", 500);
    }
  }

  /**
   * بررسی بلاک بودن
   */
  async isBlocked(blockerId: number, blockedId: number): Promise<boolean> {
    const result = await pool.query(
      "SELECT 1 FROM blocks WHERE blocker_id = $1 AND blocked_id = $2",
      [blockerId, blockedId]
    );

    return result.rows.length > 0;
  }

  /**
   * بررسی بلاک دوطرفه
   */
  async getBlockStatus(
    user1Id: number,
    user2Id: number
  ): Promise<{
    user1BlockedUser2: boolean;
    user2BlockedUser1: boolean;
    hasBlockRelation: boolean;
  }> {
    const result = await pool.query(
      `SELECT 
        EXISTS(SELECT 1 FROM blocks WHERE blocker_id = $1 AND blocked_id = $2) as user1_blocked_user2,
        EXISTS(SELECT 1 FROM blocks WHERE blocker_id = $2 AND blocked_id = $1) as user2_blocked_user1
      `,
      [user1Id, user2Id]
    );

    const row = result.rows[0];

    return {
      user1BlockedUser2: row.user1_blocked_user2,
      user2BlockedUser1: row.user2_blocked_user1,
      hasBlockRelation: row.user1_blocked_user2 || row.user2_blocked_user1,
    };
  }

  /**
   * دریافت لیست افراد بلاک شده توسط کاربر با pagination
   */
  async getBlockedUsers(userId: number, page: number = 1, limit: number = 10): Promise<any> {
    const offset = (page - 1) * limit;
    
    const result = await pool.query(
      `SELECT 
        u.id,
        u.telegram_id,
        u.first_name,
        u.username,
        u.is_online,
        u.last_activity,
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
        b.created_at as blocked_at,
        EXISTS(
          SELECT 1 FROM chats 
          WHERE (user1_id = u.id OR user2_id = u.id) 
          AND status = 'active'
        ) as has_active_chat
      FROM blocks b
      JOIN users u ON b.blocked_id = u.id
      LEFT JOIN profiles p ON u.id = p.user_id
      WHERE b.blocker_id = $1
      ORDER BY b.created_at DESC
      LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    
    // شمارش کل بلاک‌ها
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM blocks WHERE blocker_id = $1',
      [userId]
    );
    const totalCount = parseInt(countResult.rows[0].count);
    
    return {
      blockedUsers: result.rows,
      totalCount,
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
      hasNext: page < Math.ceil(totalCount / limit),
      hasPrev: page > 1,
    };
  }

  /**
   * حذف تمام بلاک‌های مربوط به کاربر (هنگام حذف اکانت)
   */
  async removeAllBlocks(userId: number): Promise<void> {
    await pool.query(
      "DELETE FROM blocks WHERE blocker_id = $1 OR blocked_id = $1",
      [userId]
    );

    logger.info(`✅ All blocks removed for user ${userId}`);
  }
}

export const blockService = new BlockService();
