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
    latitude?: number | null;
    longitude?: number | null;
  };
  
  awaitingPhoto?: boolean;
  awaitingLocation?: boolean;
  
  // Direct Message
  awaitingDirectMessage?: {
    targetUserId: number;
    targetName: string;
  };
  
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
  
  // User Search State
  searchState?: {
    type?: 'specific_contact' | 'advanced';
    filters?: any;
  };
  
  // Advanced Search State
  advancedSearch?: {
    searchType: 'search_advanced' | 'search_specific';
    gender?: 'male' | 'female' | 'all';
    provinces: number[];
    minAge: number | null;
    maxAge: number | null;
    lastActivity?: '1h' | '6h' | '1d' | '2d' | '3d' | 'all';
  };
  
  // Chat Filter State
  chatFilter?: {
    gender?: 'male' | 'female' | 'all';
    distance?: 'same_province' | 'not_same_province' | '100km' | '10km' | 'all';
    minAge?: number | null;
    maxAge?: number | null;
  };
  
  // Report Data
  reportData?: {
    targetUserId: number;
    step: 'select_reason' | 'enter_description';
    reason?: string;
    reasonKey?: string;
  };
  
  // Last Ended Chat (for delete command)
  lastEndedChatId?: number;
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
  referral_code?: string;
  referral_count?: number;
  successful_referrals?: number;
  referred_by?: number | null;
  created_at?: Date;
  
  // Profile fields
  name?: string | null;
  gender?: 'male' | 'female' | null;
  age?: number | null;
  custom_id?: number;
  coins?: number;
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
