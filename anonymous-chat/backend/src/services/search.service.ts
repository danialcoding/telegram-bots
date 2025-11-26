// src/services/search.service.ts
import { query } from '../database/db';
import { redis } from '../utils/redis';
import { CustomError } from '../utils/errors';

export interface SearchFilters {
  gender?: 'male' | 'female';
  minAge?: number;
  maxAge?: number;
  province?: string;
  city?: string;
  onlineOnly?: boolean;
}

export interface SearchResult {
  custom_id: string;
  name: string;
  gender: 'male' | 'female';
  age: number;
  province: string;
  city: string;
  bio: string | null;
  is_online: boolean;
  last_seen: Date | null;
}

export class SearchService {
  
  /**
   * جستجوی پیشرفته کاربران
   */
  async searchUsers(
    requesterId: number,
    filters: SearchFilters,
    page: number = 1,
    limit: number = 10
  ): Promise<{ results: SearchResult[]; total: number; pages: number }> {
    
    const offset = (page - 1) * limit;
    let whereConditions: string[] = ['p.user_id != $1', 'u.is_blocked = FALSE', 'u.is_active = TRUE'];
    let params: any[] = [requesterId];
    let paramIndex = 2;
    
    // فیلتر جنسیت
    if (filters.gender) {
      whereConditions.push(`p.gender = $${paramIndex}`);
      params.push(filters.gender);
      paramIndex++;
    }
    
    // فیلتر سن
    if (filters.minAge) {
      whereConditions.push(`p.age >= $${paramIndex}`);
      params.push(filters.minAge);
      paramIndex++;
    }
    
    if (filters.maxAge) {
      whereConditions.push(`p.age <= $${paramIndex}`);
      params.push(filters.maxAge);
      paramIndex++;
    }
    
    // فیلتر استان
    if (filters.province) {
      whereConditions.push(`p.province = $${paramIndex}`);
      params.push(filters.province);
      paramIndex++;
    }
    
    // فیلتر شهر
    if (filters.city) {
      whereConditions.push(`p.city = $${paramIndex}`);
      params.push(filters.city);
      paramIndex++;
    }
    
    const whereClause = whereConditions.join(' AND ');
    
    // دریافت تعداد کل
    const countResult = await query(
      `SELECT COUNT(*) as total 
       FROM profiles p
       JOIN users u ON p.user_id = u.id
       WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total);
    
    // دریافت نتایج
    const result = await query(
      `SELECT 
         p.custom_id,
         p.name,
         p.gender,
         p.age,
         p.province,
         p.city,
         p.bio,
         p.is_online,
         u.last_activity as last_seen
       FROM profiles p
       JOIN users u ON p.user_id = u.id
       WHERE ${whereClause}
       ORDER BY p.is_online DESC, u.last_activity DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );
    
    // بررسی وضعیت آنلاین از Redis
    const results: SearchResult[] = [];
    for (const row of result.rows) {
      const userId = await this.getUserIdByCustomId(row.custom_id);
      const isOnline = userId ? await redis.isUserOnline(userId) : false;
      
      // اگر فیلتر آنلاین فعال است و کاربر آفلاین است، رد شود
      if (filters.onlineOnly && !isOnline) {
        continue;
      }
      
      results.push({
        ...row,
        is_online: isOnline
      });
    }
    
    return {
      results,
      total: filters.onlineOnly ? results.length : total,
      pages: Math.ceil(total / limit)
    };
  }
  
  /**
   * جستجوی فقط کاربران آنلاین
   */
  async searchOnlineUsers(
    requesterId: number,
    filters: Omit<SearchFilters, 'onlineOnly'>,
    page: number = 1,
    limit: number = 10
  ): Promise<{ results: SearchResult[]; total: number; pages: number }> {
    
    // دریافت لیست آنلاین‌ها از Redis
    const onlineUserIds = await redis.getOnlineUsers();
    
    if (onlineUserIds.length === 0) {
      return { results: [], total: 0, pages: 0 };
    }
    
    const offset = (page - 1) * limit;
    let whereConditions: string[] = [
      'p.user_id != $1',
      'u.is_blocked = FALSE',
      'u.is_active = TRUE',
      `p.user_id = ANY($2::int[])`
    ];
    let params: any[] = [requesterId, onlineUserIds];
    let paramIndex = 3;
    
    if (filters.gender) {
      whereConditions.push(`p.gender = $${paramIndex}`);
      params.push(filters.gender);
      paramIndex++;
    }
    
    if (filters.minAge) {
      whereConditions.push(`p.age >= $${paramIndex}`);
      params.push(filters.minAge);
      paramIndex++;
    }
    
    if (filters.maxAge) {
      whereConditions.push(`p.age <= $${paramIndex}`);
      params.push(filters.maxAge);
      paramIndex++;
    }
    
    if (filters.province) {
      whereConditions.push(`p.province = $${paramIndex}`);
      params.push(filters.province);
      paramIndex++;
    }
    
    if (filters.city) {
      whereConditions.push(`p.city = $${paramIndex}`);
      params.push(filters.city);
      paramIndex++;
    }
    
    const whereClause = whereConditions.join(' AND ');
    
    const countResult = await query(
      `SELECT COUNT(*) as total 
       FROM profiles p
       JOIN users u ON p.user_id = u.id
       WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total);
    
    const result = await query(
      `SELECT 
         p.custom_id,
         p.name,
         p.gender,
         p.age,
         p.province,
         p.city,
         p.bio,
         u.last_activity as last_seen
       FROM profiles p
       JOIN users u ON p.user_id = u.id
       WHERE ${whereClause}
       ORDER BY u.last_activity DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );
    
    const results: SearchResult[] = result.rows.map(row => ({
      ...row,
      is_online: true
    }));
    
    return {
      results,
      total,
      pages: Math.ceil(total / limit)
    };
  }
  
  /**
   * دریافت پروفایل با شناسه سفارشی
   */
  async getProfileByCustomId(customId: string, requesterId: number): Promise<SearchResult | null> {
    const result = await query(
      `SELECT 
         p.custom_id,
         p.name,
         p.gender,
         p.age,
         p.province,
         p.city,
         p.bio,
         p.user_id,
         u.last_activity as last_seen
       FROM profiles p
       JOIN users u ON p.user_id = u.id
       WHERE p.custom_id = $1 AND u.is_blocked = FALSE AND u.is_active = TRUE`,
      [customId]
    );
    
    if (result.rows.length === 0) return null;
    
    const row = result.rows[0];
    const isOnline = await redis.isUserOnline(row.user_id);
    
    return {
      custom_id: row.custom_id,
      name: row.name,
      gender: row.gender,
      age: row.age,
      province: row.province,
      city: row.city,
      bio: row.bio,
      is_online: isOnline,
      last_seen: row.last_seen
    };
  }
  
  /**
   * دریافت userId از customId
   */
  private async getUserIdByCustomId(customId: string): Promise<number | null> {
    const result = await query(
      'SELECT user_id FROM profiles WHERE custom_id = $1',
      [customId]
    );
    return result.rows[0]?.user_id || null;
  }
  
  /**
   * دریافت لیست استان‌ها
   */
  getProvinces(): string[] {
    return [
      'تهران', 'اصفهان', 'فارس', 'خراسان رضوی', 'آذربایجان شرقی',
      'خوزستان', 'مازندران', 'کرمان', 'آذربایجان غربی', 'گیلان',
      'سیستان و بلوچستان', 'لرستان', 'کرمانشاه', 'گلستان', 'هرمزگان',
      'همدان', 'یزد', 'کردستان', 'مرکزی', 'اردبیل',
      'قزوین', 'زنجان', 'بوشهر', 'چهارمحال و بختیاری', 'قم',
      'سمنان', 'کهگیلویه و بویراحمد', 'خراسان شمالی', 'خراسان جنوبی',
      'ایلام', 'البرز'
    ];
  }
  
  /**
   * دریافت شهرهای یک استان
   */
  getCitiesByProvince(province: string): string[] {
    const cities: Record<string, string[]> = {
      'تهران': ['تهران', 'کرج', 'شهریار', 'اسلامشهر', 'ورامین', 'پاکدشت', 'رباط‌کریم', 'قدس', 'ملارد', 'بهارستان'],
      'اصفهان': ['اصفهان', 'کاشان', 'خمینی‌شهر', 'نجف‌آباد', 'شاهین‌شهر', 'فلاورجان', 'لنجان', 'مبارکه', 'گلپایگان'],
      'فارس': ['شیراز', 'مرودشت', 'جهرم', 'کازرون', 'فسا', 'داراب', 'لار', 'آباده', 'نی‌ریز'],
      'خراسان رضوی': ['مشهد', 'نیشابور', 'سبزوار', 'تربت حیدریه', 'کاشمر', 'قوچان', 'گناباد', 'تربت جام', 'چناران'],
      'آذربایجان شرقی': ['تبریز', 'مراغه', 'مرند', 'میانه', 'اهر', 'بناب', 'سراب', 'شبستر', 'ملکان'],
      'خوزستان': ['اهواز', 'دزفول', 'آبادان', 'خرمشهر', 'بهبهان', 'ماهشهر', 'اندیمشک', 'شوشتر', 'ایذه'],
      'مازندران': ['ساری', 'بابل', 'آمل', 'قائم‌شهر', 'بابلسر', 'تنکابن', 'نوشهر', 'چالوس', 'رامسر'],
      'کرمان': ['کرمان', 'رفسنجان', 'جیرفت', 'سیرجان', 'بم', 'زرند', 'کهنوج', 'بافت', 'شهربابک'],
      'آذربایجان غربی': ['ارومیه', 'خوی', 'میاندوآب', 'بوکان', 'مهاباد', 'سلماس', 'پیرانشهر', 'نقده', 'سردشت'],
      'گیلان': ['رشت', 'لاهیجان', 'انزلی', 'لنگرود', 'تالش', 'آستارا', 'رودسر', 'صومعه‌سرا', 'فومن'],
      'البرز': ['کرج', 'فردیس', 'نظرآباد', 'ساوجبلاغ', 'اشتهارد', 'طالقان', 'چهارباغ'],
      // سایر استان‌ها...
    };
    
    return cities[province] || [];
  }
  
  /**
   * پیشنهاد کاربران مشابه
   */
  async getSuggestedUsers(
    userId: number,
    limit: number = 5
  ): Promise<SearchResult[]> {
    // دریافت پروفایل کاربر
    const userProfile = await query(
      'SELECT province, city, age, gender FROM profiles WHERE user_id = $1',
      [userId]
    );
    
    if (userProfile.rows.length === 0) {
      return [];
    }
    
    const { province, city, age, gender } = userProfile.rows[0];
    const oppositeGender = gender === 'male' ? 'female' : 'male';
    
    // جستجوی کاربران مشابه (جنس مخالف، سن نزدیک، همشهری)
    const result = await query(
      `SELECT 
         p.custom_id,
         p.name,
         p.gender,
         p.age,
         p.province,
         p.city,
         p.bio,
         p.user_id,
         u.last_activity as last_seen
       FROM profiles p
       JOIN users u ON p.user_id = u.id
       WHERE p.user_id != $1 
         AND u.is_blocked = FALSE 
         AND u.is_active = TRUE
         AND p.gender = $2
       ORDER BY 
         CASE WHEN p.city = $3 THEN 0 ELSE 1 END,
         CASE WHEN p.province = $4 THEN 0 ELSE 1 END,
         ABS(p.age - $5),
         u.last_activity DESC
       LIMIT $6`,
      [userId, oppositeGender, city, province, age, limit]
    );
    
    const results: SearchResult[] = [];
    for (const row of result.rows) {
      const isOnline = await redis.isUserOnline(row.user_id);
      results.push({
        custom_id: row.custom_id,
        name: row.name,
        gender: row.gender,
        age: row.age,
        province: row.province,
        city: row.city,
        bio: row.bio,
        is_online: isOnline,
        last_seen: row.last_seen
      });
    }
    
    return results;
  }
}

export const searchService = new SearchService();