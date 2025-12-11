import { pool } from "../database/db";
import logger from "../utils/logger";

interface SearchFilters {
  userId: number;
  province?: number;
  age?: number;
  gender?: 'male' | 'female';
  minAge?: number;
  maxAge?: number;
  excludeBlocked?: boolean;
}

interface UserSearchResult {
  id: number;
  telegram_id: number;
  username: string | null;
  first_name: string;
  display_name: string;
  gender: 'male' | 'female';
  age: number;
  province: number;
  city: number;
  bio: string | null;
  photo_file_id: string | null;
  custom_id: string;
  likes_count: number;
  is_online: boolean;
  last_activity: Date;
}

class UserSearchService {
  async searchSameProvince(userId: number, page: number = 1, limit: number = 10, gender?: string): Promise<UserSearchResult[]> {
    try {
      const offset = (page - 1) * limit;
      const maxLimit = Math.min(limit, 200);

      const genderFilter = gender ? 'AND p.gender = $4' : '';
      const params = gender ? [userId, maxLimit, offset, gender] : [userId, maxLimit, offset];

      const result = await pool.query(
        `WITH candidate_users AS (
          SELECT 
            u.id, u.telegram_id, u.username, u.first_name,
            p.display_name, p.gender, p.age, p.province, p.city, p.bio, p.latitude, p.longitude, 
            p.photo_file_id, p.custom_id, p.likes_count,
            u.is_online, u.last_activity
          FROM users u
          INNER JOIN profiles p ON u.id = p.user_id
          WHERE p.province = (SELECT province FROM profiles WHERE user_id = $1)
            AND u.id != $1
            AND u.is_blocked = FALSE
            AND u.last_activity >= NOW() - INTERVAL '3 days'
            ${genderFilter}
            AND NOT EXISTS (
              SELECT 1 FROM blocks 
              WHERE (blocker_id = $1 AND blocked_id = u.id) 
                 OR (blocker_id = u.id AND blocked_id = $1)
            )
          ORDER BY u.is_online DESC, u.last_activity DESC
          LIMIT 300
        )
        SELECT * FROM candidate_users
        ORDER BY RANDOM()
        LIMIT $2 OFFSET $3`,
        params
      );

      return result.rows;
    } catch (error) {
      logger.error('Error searching same province users:', error);
      throw error;
    }
  }

  /**
   * جستجوی کاربران هم سن
   */
  async searchSameAge(userId: number, page: number = 1, limit: number = 10, gender?: string): Promise<UserSearchResult[]> {
    try {
      const offset = (page - 1) * limit;
      const maxLimit = Math.min(limit, 200); // حداکثر 200 نفر در هر صفحه

      const genderFilter = gender ? 'AND p.gender = $4' : '';
      const params = gender ? [userId, maxLimit, offset, gender] : [userId, maxLimit, offset];

      const result = await pool.query(
        `WITH candidate_users AS (
          SELECT 
            u.id, u.telegram_id, u.username, u.first_name,
            p.display_name, p.gender, p.age, p.province, p.city, p.bio, p.latitude, p.longitude, 
            p.photo_file_id, p.custom_id, p.likes_count,
            u.is_online, u.last_activity
          FROM users u
          INNER JOIN profiles p ON u.id = p.user_id
          WHERE ABS(p.age - (SELECT age FROM profiles WHERE user_id = $1)) <= 3
            AND u.id != $1
            AND u.is_blocked = FALSE
            AND u.last_activity >= NOW() - INTERVAL '3 days'
            ${genderFilter}
            AND NOT EXISTS (
              SELECT 1 FROM blocks 
              WHERE (blocker_id = $1 AND blocked_id = u.id) 
                 OR (blocker_id = u.id AND blocked_id = $1)
            )
          ORDER BY u.is_online DESC, u.last_activity DESC
          LIMIT 300
        )
        SELECT * FROM candidate_users
        ORDER BY RANDOM()
        LIMIT $2 OFFSET $3`,
        params
      );

      return result.rows;
    } catch (error) {
      logger.error('Error searching same age users:', error);
      throw error;
    }
  }

  /**
   * جستجوی پیشرفته
   */
  async advancedSearch(filters: SearchFilters, page: number = 1, limit: number = 10): Promise<UserSearchResult[]> {
    try {
      const offset = (page - 1) * limit;
      const conditions: string[] = ['u.id != $1', 'u.is_blocked = FALSE'];
      const params: any[] = [filters.userId, limit, offset];
      let paramIndex = 4;

      if (filters.province) {
        conditions.push(`p.province = $${paramIndex}`);
        params.splice(paramIndex - 1, 0, filters.province);
        paramIndex++;
      }

      if (filters.gender) {
        conditions.push(`p.gender = $${paramIndex}`);
        params.splice(paramIndex - 1, 0, filters.gender);
        paramIndex++;
      }

      if (filters.minAge) {
        conditions.push(`p.age >= $${paramIndex}`);
        params.splice(paramIndex - 1, 0, filters.minAge);
        paramIndex++;
      }

      if (filters.maxAge) {
        conditions.push(`p.age <= $${paramIndex}`);
        params.splice(paramIndex - 1, 0, filters.maxAge);
        paramIndex++;
      }

      if (filters.excludeBlocked !== false) {
        conditions.push(`NOT EXISTS (
          SELECT 1 FROM blocks 
          WHERE (blocker_id = $1 AND blocked_id = u.id) 
             OR (blocker_id = u.id AND blocked_id = $1)
        )`);
      }

      const query = `
        SELECT 
          u.id, u.telegram_id, u.username, u.first_name,
          p.display_name, p.gender, p.age, p.province, p.city, p.bio, p.latitude, p.longitude, 
          p.photo_file_id, p.custom_id, p.likes_count,
          u.is_online, u.last_activity
        FROM users u
        INNER JOIN profiles p ON u.id = p.user_id
        WHERE ${conditions.join(' AND ')}
        ORDER BY u.last_activity DESC
        LIMIT $2 OFFSET $3
      `;

      const result = await pool.query(query, params);
      return result.rows;
    } catch (error) {
      logger.error('Error in advanced search:', error);
      throw error;
    }
  }

  async searchNewUsers(userId: number, page: number = 1, limit: number = 10, gender?: string): Promise<UserSearchResult[]> {
    try {
      const offset = (page - 1) * limit;
      const maxLimit = Math.min(limit, 200);

      const genderFilter = gender ? 'AND p.gender = $4' : '';
      const params = gender ? [userId, maxLimit, offset, gender] : [userId, maxLimit, offset];

      const result = await pool.query(
        `WITH candidate_users AS (
          SELECT 
            u.id, u.telegram_id, u.username, u.first_name,
            p.display_name, p.gender, p.age, p.province, p.city, p.bio, p.latitude, p.longitude, 
            p.photo_file_id, p.custom_id, p.likes_count,
            u.is_online, u.last_activity, u.created_at
          FROM users u
          INNER JOIN profiles p ON u.id = p.user_id
          WHERE u.id != $1
            AND u.is_blocked = FALSE
            AND u.created_at >= NOW() - INTERVAL '3 days'
            AND u.last_activity >= NOW() - INTERVAL '3 days'
            ${genderFilter}
            AND NOT EXISTS (
              SELECT 1 FROM blocks 
              WHERE (blocker_id = $1 AND blocked_id = u.id) 
                 OR (blocker_id = u.id AND blocked_id = $1)
            )
          ORDER BY u.is_online DESC, u.created_at DESC
          LIMIT 300
        )
        SELECT * FROM candidate_users
        ORDER BY RANDOM()
        LIMIT $2 OFFSET $3`,
        params
      );

      return result.rows;
    } catch (error) {
      logger.error('Error searching new users:', error);
      throw error;
    }
  }

  async searchUsersWithoutChat(userId: number, page: number = 1, limit: number = 10, gender?: string): Promise<UserSearchResult[]> {
    try {
      const offset = (page - 1) * limit;
      const maxLimit = Math.min(limit, 200);

      const genderFilter = gender ? 'AND p.gender = $4' : '';
      const params = gender ? [userId, maxLimit, offset, gender] : [userId, maxLimit, offset];

      const result = await pool.query(
        `WITH candidate_users AS (
          SELECT 
            u.id, u.telegram_id, u.username, u.first_name,
            p.display_name, p.gender, p.age, p.province, p.city, p.bio, p.latitude, p.longitude, 
            p.photo_file_id, p.custom_id, p.likes_count,
            u.is_online, u.last_activity
          FROM users u
          INNER JOIN profiles p ON u.id = p.user_id
          WHERE u.id != $1
            AND u.is_blocked = FALSE
            AND u.last_activity >= NOW() - INTERVAL '3 days'
            ${genderFilter}
            AND NOT EXISTS (
              SELECT 1 FROM blocks 
              WHERE (blocker_id = $1 AND blocked_id = u.id) 
                 OR (blocker_id = u.id AND blocked_id = $1)
            )
            AND NOT EXISTS (
              SELECT 1 FROM random_chats 
              WHERE (user1_id = $1 AND user2_id = u.id) 
                 OR (user1_id = u.id AND user2_id = $1)
            )
          ORDER BY u.is_online DESC, u.last_activity DESC
          LIMIT 300
        )
        SELECT * FROM candidate_users
        ORDER BY RANDOM()
        LIMIT $2 OFFSET $3`,
        params
      );

      return result.rows;
    } catch (error) {
      logger.error('Error searching users without chat:', error);
      throw error;
    }
  }

  async searchRecentChats(userId: number, page: number = 1, limit: number = 10, gender?: string): Promise<UserSearchResult[]> {
    try {
      const offset = (page - 1) * limit;
      const maxLimit = Math.min(limit, 200);

      const genderFilter = gender ? 'AND p.gender = $4' : '';
      const params = gender ? [userId, maxLimit, offset, gender] : [userId, maxLimit, offset];

      const result = await pool.query(
        `WITH candidate_users AS (
          SELECT DISTINCT
            u.id, u.telegram_id, u.username, u.first_name,
            p.display_name, p.gender, p.age, p.province, p.city, p.bio, p.latitude, p.longitude, 
            p.photo_file_id, p.custom_id, p.likes_count,
            u.is_online, u.last_activity,
            rc.ended_at
          FROM random_chats rc
          INNER JOIN users u ON (
            CASE 
              WHEN rc.user1_id = $1 THEN rc.user2_id 
              ELSE rc.user1_id 
            END = u.id
          )
          INNER JOIN profiles p ON u.id = p.user_id
          WHERE (rc.user1_id = $1 OR rc.user2_id = $1)
            AND rc.status = 'ended'
            AND rc.ended_at >= NOW() - INTERVAL '7 days'
            AND u.is_blocked = FALSE
            AND u.last_activity >= NOW() - INTERVAL '3 days'
            ${genderFilter}
            AND NOT EXISTS (
              SELECT 1 FROM blocks 
              WHERE (blocker_id = $1 AND blocked_id = u.id) 
                 OR (blocker_id = u.id AND blocked_id = $1)
            )
          ORDER BY u.is_online DESC, rc.ended_at DESC
          LIMIT 300
        )
        SELECT * FROM candidate_users
        ORDER BY RANDOM()
        LIMIT $2 OFFSET $3`,
        params
      );

      return result.rows;
    } catch (error) {
      logger.error('Error searching recent chats:', error);
      throw error;
    }
  }

  async searchPopularUsers(userId: number, page: number = 1, limit: number = 10, gender?: string): Promise<UserSearchResult[]> {
    try {
      const offset = (page - 1) * limit;
      const maxLimit = Math.min(limit, 200);

      const genderFilter = gender ? 'AND p.gender = $4' : '';
      const params = gender ? [userId, maxLimit, offset, gender] : [userId, maxLimit, offset];

      const result = await pool.query(
        `WITH candidate_users AS (
          SELECT 
            u.id, u.telegram_id, u.username, u.first_name,
            p.display_name, p.gender, p.age, p.province, p.city, p.bio, p.latitude, p.longitude, 
            p.photo_file_id, p.custom_id, p.likes_count,
            u.is_online, u.last_activity
          FROM users u
          INNER JOIN profiles p ON u.id = p.user_id
          WHERE u.id != $1
            AND u.is_blocked = FALSE
            AND p.likes_count > 0
            AND u.last_activity >= NOW() - INTERVAL '3 days'
            ${genderFilter}
            AND NOT EXISTS (
              SELECT 1 FROM blocks 
              WHERE (blocker_id = $1 AND blocked_id = u.id) 
                 OR (blocker_id = u.id AND blocked_id = $1)
            )
          ORDER BY u.is_online DESC, p.likes_count DESC, u.last_activity DESC
          LIMIT 300
        )
        SELECT * FROM candidate_users
        ORDER BY RANDOM()
        LIMIT $2 OFFSET $3`,
        params
      );

      return result.rows;
    } catch (error) {
      logger.error('Error searching popular users:', error);
      throw error;
    }
  }

  /**
   * جستجوی مخاطب خاص با custom_id
   */
  async searchSpecificContact(userId: number, customId: string): Promise<UserSearchResult | null> {
    try {
      const result = await pool.query(
        `SELECT 
          u.id, u.telegram_id, u.username, u.first_name,
          p.display_name, p.gender, p.age, p.province, p.city, p.bio, p.latitude, p.longitude, 
          p.photo_file_id, p.custom_id, p.likes_count,
          u.is_online, u.last_activity
        FROM users u
        INNER JOIN profiles p ON u.id = p.user_id
        WHERE p.custom_id = $1
          AND u.id != $2
          AND u.is_blocked = FALSE`,
        [customId, userId]
      );

      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      logger.error('Error searching specific contact:', error);
      throw error;
    }
  }

  /**
   * یافتن کاربر با telegram_id
   */
  async findByTelegramId(telegramId: number): Promise<UserSearchResult | null> {
    try {
      const result = await pool.query(
        `SELECT 
          u.id, u.telegram_id, u.username, u.first_name,
          p.display_name, p.gender, p.age, p.province, p.city, p.bio, p.latitude, p.longitude, 
          p.photo_file_id, p.custom_id, p.likes_count,
          u.is_online, u.last_activity
        FROM users u
        LEFT JOIN profiles p ON u.id = p.user_id
        WHERE u.telegram_id = $1
          AND u.is_blocked = FALSE`,
        [telegramId]
      );

      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      logger.error('Error finding user by telegram_id:', error);
      throw error;
    }
  }

  /**
   * یافتن کاربر با username تلگرام (case-insensitive)
   */
  async findByUsername(username: string): Promise<UserSearchResult | null> {
    try {
      const result = await pool.query(
        `SELECT 
          u.id, u.telegram_id, u.username, u.first_name,
          p.display_name, p.gender, p.age, p.province, p.city, p.bio, p.latitude, p.longitude, 
          p.photo_file_id, p.custom_id, p.likes_count,
          u.is_online, u.last_activity
        FROM users u
        LEFT JOIN profiles p ON u.id = p.user_id
        WHERE LOWER(u.username) = LOWER($1)
          AND u.is_blocked = FALSE`,
        [username]
      );

      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      logger.error('Error finding user by username:', error);
      throw error;
    }
  }

  /**
   * ذخیره نتایج جستجو برای inline query
   */
  async saveSearchResults(
    searchCode: string,
    userId: number,
    searchType: string,
    userIds: number[],
    gender?: string
  ): Promise<void> {
    try {
      await pool.query(
        `INSERT INTO search_results (search_code, user_id, search_type, gender, user_ids, total_count)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (search_code) DO UPDATE
         SET user_ids = $5, total_count = $6, created_at = NOW(), expires_at = NOW() + INTERVAL '1 hour'`,
        [searchCode, userId, searchType, gender, userIds, userIds.length]
      );
    } catch (error) {
      logger.error('Error saving search results:', error);
      throw error;
    }
  }

  /**
   * دریافت نتایج جستجو بر اساس search code
   */
  async getSearchResults(searchCode: string): Promise<{
    searchType: string;
    gender?: string;
    userIds: number[];
  } | null> {
    try {
      const result = await pool.query(
        `SELECT search_type, gender, user_ids 
         FROM search_results 
         WHERE search_code = $1 AND expires_at > NOW()`,
        [searchCode]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return {
        searchType: result.rows[0].search_type,
        gender: result.rows[0].gender,
        userIds: result.rows[0].user_ids,
      };
    } catch (error) {
      logger.error('Error getting search results:', error);
      throw error;
    }
  }

  /**
   * دریافت اطلاعات کاربران برای inline query
   */
  async getUsersForInlineQuery(userIds: number[]): Promise<UserSearchResult[]> {
    try {
      if (userIds.length === 0) {
        return [];
      }

      const result = await pool.query(
        `SELECT 
          u.id, u.telegram_id, u.username, u.first_name,
          p.display_name, p.gender, p.age, p.province, p.city, p.bio, p.latitude, p.longitude, 
          p.photo_file_id, p.custom_id, p.likes_count,
          u.is_online, u.last_activity
        FROM users u
        LEFT JOIN profiles p ON u.id = p.user_id
        WHERE u.id = ANY($1)
        ORDER BY u.is_online DESC, u.last_activity DESC`,
        [userIds]
      );

      return result.rows;
    } catch (error) {
      logger.error('Error getting users for inline query:', error);
      throw error;
    }
  }
}

export const userSearchService = new UserSearchService();
