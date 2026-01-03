export const COIN_COSTS = {
  MALE_TO_FEMALE_CONNECTION: 2,
  FEMALE_TO_FEMALE_CONNECTION: 2,
  MALE_TO_MALE_CONNECTION: 1,
  FEMALE_TO_MALE_CONNECTION: 1,
  DIRECT_MESSAGE: parseInt(process.env.COIN_DIRECT_MESSAGE || '1'),
  CHAT_REQUEST: parseInt(process.env.COIN_CHAT_REQUEST || '1'), // ✅ هزینه ارسال درخواست چت
};

export const COIN_REWARDS = {
  REFERRAL: parseInt(process.env.COIN_REFERRAL_REWARD || '10'),
  FEMALE_30_MESSAGES_WITH_MALE: parseInt(process.env.COIN_FEMALE_MESSAGE_REWARD || '1'),
  SIGNUP: parseInt(process.env.COIN_SIGNUP_REWARD || '10'),
};

export const UNBLOCK_FINE_COINS = parseInt(process.env.UNBLOCK_FINE_COINS || '50');


export const UNBLOCK_FINE = parseInt(process.env.UNBLOCK_FINE_COINS || '50');
export const MESSAGE_REWARD_THRESHOLD = parseInt(process.env.MESSAGE_THRESHOLD_FOR_REWARD || '30');
export const DELETE_ACCOUNT_COST = parseInt(process.env.DELETE_ACCOUNT_COST || '100');

// ✅ محدودیت زمانی برای ارسال مجدد درخواست چت به یک کاربر (5 دقیقه)
export const CHAT_REQUEST_COOLDOWN_MINUTES = parseInt(process.env.CHAT_REQUEST_COOLDOWN_MINUTES || '5');

// ✅ تنظیمات اشتراک VIP (قیمت با ستاره تلگرام)
export const VIP_SUBSCRIPTION = {
  PRICES: {
    ONE_MONTH: parseInt(process.env.VIP_ONE_MONTH || '50'),      // 50 ستاره = 1 ماه
    THREE_MONTHS: parseInt(process.env.VIP_THREE_MONTHS || '120'),  // 120 ستاره = 3 ماه
    SIX_MONTHS: parseInt(process.env.VIP_SIX_MONTHS || '200'),    // 200 ستاره = 6 ماه
    TWELVE_MONTHS: parseInt(process.env.VIP_TWELVE_MONTHS || '350'), // 350 ستاره = 12 ماه
  },
  DURATIONS: {
    ONE_MONTH: 30,
    THREE_MONTHS: 90,
    SIX_MONTHS: 180,
    TWELVE_MONTHS: 365,
  }
};

// ✅ تنظیمات بازی‌های چت
export const CHAT_GAMES = {
  TIC_TAC_TOE: {
    name: 'دوز',
    emoji: '🎯',
    vipOnly: false, // بازی رایگان
  },
  ROCK_PAPER_SCISSORS: {
    name: 'سنگ کاغذ قیچی',
    emoji: '✊',
    vipOnly: false, // بازی رایگان
  },
  TRUTH_OR_DARE: {
    name: 'جرعت یا حقیقت',
    emoji: '🎲',
    vipOnly: true, // فقط VIP
  },
};
