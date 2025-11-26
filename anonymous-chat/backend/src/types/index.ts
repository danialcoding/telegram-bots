import { Request } from 'express';

export interface AuthRequest extends Request {
  userId?: number;
  user?: {
    id: number;
    role: string;
  };
}

export interface User {
  id: number;
  telegram_id: number;
  username: string | null;
  first_name: string;
  last_name: string | null;
  language_code: string;
  referred_by: number | null;
  referral_code: string;
  referral_count: number;
  is_blocked: boolean;
  is_banned: boolean;
  ban_reason: string | null;
  banned_at: Date | null;
  banned_until: Date | null;
  is_online: boolean;
  last_activity: Date;
  created_at: Date;
  updated_at: Date;
}


export interface CoinTransaction {
  id: number;
  user_id: number;
  amount: number;
  type: 'purchase' | 'gift' | 'referral' | 'admin_add' | 'admin_deduct' | 'spend';
  description?: string;
  payment_id?: number;
  created_at: Date;
}

export interface Payment {
  id: number;
  user_id: number;
  amount: number;
  coins: number;
  gateway: 'zarinpal' | 'idpay';
  status: 'pending' | 'completed' | 'failed';
  authority?: string;
  track_id?: string;
  ref_id?: string;
  card_number?: string;
  created_at: Date;
  updated_at: Date;
}

export interface Report {
  id: number;
  reporter_id: number;
  reported_user_id?: number;
  reported_message_id?: number;
  reason: string;
  description?: string;
  status: 'pending' | 'reviewed' | 'resolved' | 'rejected';
  reviewed_by?: number;
  review_note?: string;
  created_at: Date;
  updated_at: Date;
}

export interface Admin {
  id: number;
  username: string;
  email: string;
  role: 'super_admin' | 'admin' | 'moderator';
  is_active: boolean;
  last_login?: Date;
  created_at: Date;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: {
    message: string;
    code: string;
  };
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
