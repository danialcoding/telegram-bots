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
        SET is_favorite = EXCLUDED.is_favorite,
            updated_at = NOW()
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
      SET is_favorite = NOT is_favorite,
          updated_at = NOW()
      WHERE user_id = $1 AND contact_user_id = $2
      RETURNING is_favorite
    `;

    const result = await pool.query(query, [userId, contactUserId]);
    return result.rows[0]?.is_favorite ?? false;
  }

  /**
   * دریافت لیست مخاطبین
   */
  async getContacts(userId: number, onlyFavorites: boolean = false) {
    const query = `
      SELECT 
        c.id,
        c.contact_user_id,
        c.is_favorite,
        c.created_at,
        p.custom_id,
        p.display_name,
        p.gender,
        p.age,
        p.province,
        p.city,
        p.photo_file_id,
        p.likes_count,
        u.is_online,
        u.last_activity
      FROM contacts c
      JOIN profiles p ON c.contact_user_id = p.user_id
      JOIN users u ON p.user_id = u.id
      WHERE c.user_id = $1
        ${onlyFavorites ? 'AND c.is_favorite = TRUE' : ''}
      ORDER BY c.is_favorite DESC, c.created_at DESC
    `;

    const result = await pool.query(query, [userId]);
    return result.rows;
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
