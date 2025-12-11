import { pool } from '../database/db';
import type { Contact } from '../types/database.types';

export class ContactService {
  /**
   * افزودن کاربر به لیست مخاطبین
   */
  async addContact(userId: number, contactUserId: number): Promise<Contact> {
    const query = `
      INSERT INTO contacts (user_id, contact_user_id)
      VALUES ($1, $2)
      ON CONFLICT (user_id, contact_user_id) DO UPDATE
        SET is_favorite = EXCLUDED.is_favorite
      RETURNING *
    `;

    const result = await pool.query(query, [userId, contactUserId]);
    return result.rows[0];
  }

  /**
   * حذف کاربر از لیست مخاطبین
   */
  async removeContact(userId: number, contactUserId: number): Promise<boolean> {
    const query = `
      DELETE FROM contacts
      WHERE user_id = $1 AND contact_user_id = $2
    `;

    const result = await pool.query(query, [userId, contactUserId]);
    return result.rowCount > 0;
  }

  /**
   * تنظیم/برداشتن علاقه‌مندی
   */
  async toggleFavorite(userId: number, contactUserId: number): Promise<boolean> {
    const query = `
      UPDATE contacts
      SET is_favorite = NOT is_favorite
      WHERE user_id = $1 AND contact_user_id = $2
      RETURNING is_favorite
    `;

    const result = await pool.query(query, [userId, contactUserId]);
    return result.rows[0]?.is_favorite ?? false;
  }

  /**
   * ✅ تاگل مخاطب (افزودن/حذف)
   */
  async toggleContact(userId: number, contactUserId: number): Promise<boolean> {
    // بررسی وجود در لیست مخاطبین
    const exists = await this.isContact(userId, contactUserId);

    if (exists) {
      // حذف از مخاطبین
      await this.removeContact(userId, contactUserId);
      return false;
    } else {
      // افزودن به مخاطبین
      await this.addContact(userId, contactUserId);
      return true;
    }
  }

  /**
   * دریافت لیست مخاطبین با pagination
   */
  async getContacts(userId: number, page: number = 1, limit: number = 10, onlyFavorites: boolean = false) {
    const offset = (page - 1) * limit;
    
    const query = `
      SELECT 
        c.id,
        c.contact_user_id,
        c.is_favorite,
        c.added_at,
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
      FROM contacts c
      JOIN profiles p ON c.contact_user_id = p.user_id
      JOIN users u ON p.user_id = u.id
      WHERE c.user_id = $1
        ${onlyFavorites ? 'AND c.is_favorite = TRUE' : ''}
      ORDER BY c.is_favorite DESC, c.added_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await pool.query(query, [userId, limit, offset]);
    
    // شمارش کل مخاطبین
    const countQuery = `
      SELECT COUNT(*) FROM contacts 
      WHERE user_id = $1 ${onlyFavorites ? 'AND is_favorite = TRUE' : ''}
    `;
    const countResult = await pool.query(countQuery, [userId]);
    const totalCount = parseInt(countResult.rows[0].count);
    
    return {
      contacts: result.rows,
      totalCount,
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
      hasNext: page < Math.ceil(totalCount / limit),
      hasPrev: page > 1,
    };
  }

  /**
   * چک کردن آیا کاربر در لیست مخاطبین هست
   */
  async isContact(userId: number, contactUserId: number): Promise<boolean> {
    const query = `
      SELECT EXISTS(
        SELECT 1 FROM contacts
        WHERE user_id = $1 AND contact_user_id = $2
      ) as exists
    `;

    const result = await pool.query(query, [userId, contactUserId]);
    return result.rows[0].exists;
  }

  /**
   * تعداد مخاطبین
   */
  async getContactsCount(userId: number): Promise<number> {
    const query = `
      SELECT COUNT(*) as count
      FROM contacts
      WHERE user_id = $1
    `;

    const result = await pool.query(query, [userId]);
    return parseInt(result.rows[0].count);
  }
}

export const contactService = new ContactService();
