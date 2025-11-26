import { Request } from 'express';

/**
 * Interface برای Request با کاربر احراز هویت شده
 */
export interface AuthRequest extends Request {
  user?: {
    id: number;
    role: 'admin' | 'user';
  };
  admin?: {
    user_id: number;
    username: string;
    role: string;
    is_active: boolean;
  };
}

/**
 * پاسخ استاندارد API
 */
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: ValidationError[];
  pagination?: PaginationInfo;
}

/**
 * خطای اعتبارسنجی
 */
export interface ValidationError {
  field?: string;
  message: string;
}

/**
 * اطلاعات صفحه‌بندی
 */
export interface PaginationInfo {
  page?: number;
  limit: number;
  total: number;
  totalPages?: number;
  offset?: number;
}

/**
 * فیلترهای جستجو
 */
export interface SearchFilters {
  query?: string;
  status?: string;
  gender?: string;
  minAge?: number;
  maxAge?: number;
  province?: string;
  city?: string;
  sortBy?: string;
  order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}
