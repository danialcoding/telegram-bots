/**
 * انواع Helper برای Database queries
 */

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginationResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface SortParams {
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface DateRangeFilter {
  startDate?: Date;
  endDate?: Date;
}

/**
 * Helper برای ساخت نتیجه Pagination
 */
export function createPaginationResult<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
): PaginationResult<T> {
  const totalPages = Math.ceil(total / limit);
  
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}


/**
 * ========================================
 * 👥 CONTACTS
 * ========================================
 */

export interface Contact {
  id: number;
  user_id: number;
  contact_user_id: number;
  nickname: string | null;
  notes: string | null;
  is_favorite: boolean;
  added_at: Date;
}

/**
 * Contact با اطلاعات پروفایل (برای نمایش در لیست)
 */
export interface ContactWithProfile extends Contact {
  // اطلاعات پروفایل مخاطب
  display_name: string;
  gender: 'male' | 'female';
  age: number;
  city: string;
  province: string;
  bio: string | null;
  photo_file_id: string | null;
  is_online: boolean;
  likes_count: number;
  custom_id: string;
}

/**
 * ========================================
 * 💖 LIKES (Profile Likes)
 * ========================================
 */

export interface Like {
  id: number;
  liker_id: number;
  liked_profile_id: number;
  created_at: Date;
}

/**
 * Like با اطلاعات کامل لایک‌کننده
 */
export interface LikeWithUser extends Like {
  // اطلاعات لایک‌کننده
  liker_telegram_id: number;
  liker_username: string | null;
  liker_first_name: string | null;
  
  // اطلاعات پروفایل لایک‌کننده
  liker_display_name: string;
  liker_gender: 'male' | 'female';
  liker_age: number;
  liker_city: string;
  liker_province: string;
  liker_photo_file_id: string | null;
  liker_is_online: boolean;
  liker_custom_id: string;
}

/**
 * ========================================
 * 📊 STATISTICS FOR CONTACTS & LIKES
 * ========================================
 */

export interface ContactStats {
  total_contacts: number;
  favorite_contacts: number;
  contacts_with_nickname: number;
  most_recent_contact_date: Date | null;
}

export interface LikeStats {
  total_likes_received: number;
  total_likes_given: number;
  mutual_likes: number;
  recent_likes: number; // لایک‌های 24 ساعت اخیر
}
