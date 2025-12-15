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

// ✅ محدودیت زمانی برای ارسال مجدد درخواست چت به یک کاربر (5 دقیقه)
export const CHAT_REQUEST_COOLDOWN_MINUTES = parseInt(process.env.CHAT_REQUEST_COOLDOWN_MINUTES || '5');