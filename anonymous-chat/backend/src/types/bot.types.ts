import { Context } from 'telegraf';

/**
 * تعریف Session Data
 */
export interface SessionData {
  step?: string;
  tempData?: any;
  
  // Profile Edit
  profileEdit?: {
    step?: string;
    gender?: 'male' | 'female';
    age?: number;
    province_id?: number;
    city_id?: number;
    bio?: string | null;
  };
  
  awaitingPhoto?: boolean;
  
  // Chat Data
  chatData?: {
    currentChatId?: number;
    partnerId?: number;
  };
  
  // Search Filters
  searchFilters?: {
    gender?: 'male' | 'female';
    minAge?: number;
    maxAge?: number;
    province?: string;
  };
}

/**
 * تعریف User State
 */
export interface UserState {
  id: number;
  telegram_id: number;
  username?: string | null;
  first_name?: string;
  last_name?: string | null;
  is_blocked?: boolean;
  block_reason?: string | null;
  referral_count?: number;
  created_at?: Date;
}

/**
 * تعریف Context با Session
 */
export interface MyContext extends Context {
  session: SessionData;
  state: {
    user: UserState;
  };
}
