// src/services/coin.service.ts
import { pool } from '../database/db';
import { CustomError } from '../utils/errors';
import { COIN_REWARDS as REWARDS_CONFIG } from '../utils/constants';
import logger from '../utils/logger';

// ==================== TYPES ====================

interface CoinTransaction {
  id: number;
  user_id: number;
  amount: number;
  type: 'earn' | 'spend' | 'purchase' | 'referral' | 'reward' | 'fine';
  description: string;
  reference_id: number | null;
  created_at: Date;
}

interface CoinBalance {
  user_id: number;
  balance: number;
  total_earned: number;
  total_spent: number;
  total_purchased: number;
  updated_at: Date;
}

// ==================== COIN REWARDS از .env با fallback به constants ====================

const COIN_REWARDS = {
  REFERRAL: parseInt(process.env.COIN_REFERRAL_REWARD || String(REWARDS_CONFIG.REFERRAL)),
  FEMALE_30_MESSAGES_WITH_MALE: parseInt(process.env.COIN_FEMALE_MESSAGE_REWARD || String(REWARDS_CONFIG.FEMALE_30_MESSAGES_WITH_MALE)),
  SIGNUP: parseInt(process.env.COIN_SIGNUP_REWARD || String(REWARDS_CONFIG.SIGNUP))
};

const UNBLOCK_FINE_COINS = parseInt(process.env.UNBLOCK_FINE_COINS || '50');

// ==================== HELPER FUNCTIONS ====================

/**
 * دریافت موجودی سکه
 */
export const getBalance = async (userId: number): Promise<number> => {
  const result = await pool.query(
    'SELECT balance FROM coins WHERE user_id = $1',
    [userId]
  );

  if (result.rows.length === 0) {
    await initializeCoins(userId);
    return 0;
  }

  return result.rows[0].balance;
};

/**
 * مقداردهی اولیه سکه برای کاربر جدید
 */
export const initializeCoins = async (
  userId: number,
  initialAmount: number = 0
): Promise<void> => {
  await pool.query(
    `INSERT INTO coins (user_id, balance, total_earned, total_spent, total_purchased)
     VALUES ($1, $2, 0, 0, 0)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId, initialAmount]
  );
};

/**
 * بررسی کفایت موجودی
 */
export const hasEnoughCoins = async (
  userId: number,
  amount: number
): Promise<boolean> => {
  const balance = await getBalance(userId);
  return balance >= amount;
};

/**
 * اضافه کردن سکه
 */
export const addCoins = async (
  userId: number,
  amount: number,
  type: 'earn' | 'purchase' | 'referral' | 'reward',
  description: string,
  referenceId: number | null = null
): Promise<CoinTransaction> => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // به‌روزرسانی موجودی
    await client.query(
      `INSERT INTO coins (user_id, balance, total_earned, total_spent, total_purchased)
       VALUES ($1, $2, $3, 0, $4)
       ON CONFLICT (user_id) DO UPDATE SET
         balance = coins.balance + $2,
         total_earned = coins.total_earned + CASE WHEN $5 IN ('earn', 'referral', 'reward') THEN $2 ELSE 0 END,
         total_purchased = coins.total_purchased + CASE WHEN $5 = 'purchase' THEN $2 ELSE 0 END,
         updated_at = NOW()`,
      [userId, amount, amount, type === 'purchase' ? amount : 0, type]
    );

    // ثبت تراکنش
    const transactionResult = await client.query(
      `INSERT INTO coin_transactions 
       (user_id, amount, type, description, reference_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, amount, type, description, referenceId]
    );

    await client.query('COMMIT');
    return transactionResult.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * کسر سکه
 */
export const deductCoins = async (
  userId: number,
  amount: number,
  type: 'spend' | 'fine',
  description: string,
  referenceId: number | null = null
): Promise<CoinTransaction> => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const enough = await hasEnoughCoins(userId, amount);
    if (!enough) {
      throw new CustomError('موجودی سکه کافی نیست.', 400);
    }

    await client.query(
      `UPDATE coins 
       SET balance = balance - $1,
           total_spent = total_spent + $1,
           updated_at = NOW()
       WHERE user_id = $2`,
      [amount, userId]
    );

    const transactionResult = await client.query(
      `INSERT INTO coin_transactions 
       (user_id, amount, type, description, reference_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, -amount, type, description, referenceId]
    );

    await client.query('COMMIT');
    return transactionResult.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * پاداش برای referral - به هر دو طرف
 */
export const rewardReferral = async (
  referrerId: number,
  referredUserId: number
): Promise<void> => {
  // پاداش به معرف (referrer)
  await addCoins(
    referrerId,
    COIN_REWARDS.REFERRAL,
    'referral',
    'پاداش معرفی کاربر جدید',
    referredUserId
  );
  
  // پاداش به کاربر جدید (referred)
  await addCoins(
    referredUserId,
    COIN_REWARDS.REFERRAL,
    'referral_bonus',
    'پاداش ثبت نام از طریق دعوت',
    referrerId
  );

  logger.info(`✅ Referral reward: ${COIN_REWARDS.REFERRAL} coins to both ${referrerId} and ${referredUserId}`);
};

/**
 * پاداش ثبت نام - 10 سکه برای کاربر جدید
 */
export const rewardSignup = async (
  userId: number
): Promise<void> => {
  await addCoins(
    userId,
    COIN_REWARDS.SIGNUP,
    'reward',
    'پاداش تکمیل پروفایل',
    null
  );

  logger.info(`✅ Signup reward: ${COIN_REWARDS.SIGNUP} coins to user ${userId}`);
};

/**
 * پاداش 30 پیام برای دختران
 */
export const rewardFemale30Messages = async (
  userId: number,
  chatId: number
): Promise<void> => {
  await addCoins(
    userId,
    COIN_REWARDS.FEMALE_30_MESSAGES_WITH_MALE,
    'reward',
    'پاداش 30 پیام در چت',
    chatId
  );
};

/**
 * دریافت تاریخچه تراکنش‌ها
 */
export const getTransactions = async (
  userId: number,
  limit: number = 50,
  offset: number = 0
): Promise<CoinTransaction[]> => {
  const result = await pool.query(
    `SELECT * FROM coin_transactions 
     WHERE user_id = $1 
     ORDER BY created_at DESC 
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );

  return result.rows;
};

/**
 * دریافت اطلاعات کامل سکه کاربر
 */
export const getCoinInfo = async (userId: number): Promise<CoinBalance> => {
  const result = await pool.query(
    'SELECT * FROM coins WHERE user_id = $1',
    [userId]
  );

  if (result.rows.length === 0) {
    await initializeCoins(userId);
    return getCoinInfo(userId);
  }

  return result.rows[0];
};

/**
 * افزایش/کاهش دستی سکه توسط ادمین
 */
export const adjustCoins = async (
  userId: number,
  amount: number,
  description: string,
  adminId: number
): Promise<CoinTransaction> => {
  if (amount > 0) {
    return await addCoins(
      userId,
      amount,
      'reward',
      `تنظیم توسط ادمین: ${description}`,
      adminId
    );
  } else {
    return await deductCoins(
      userId,
      Math.abs(amount),
      'fine',
      `تنظیم توسط ادمین: ${description}`,
      adminId
    );
  }
};

/**
 * جریمه رفع مسدودی
 */
export const chargeUnblockFine = async (userId: number): Promise<boolean> => {
  try {
    await deductCoins(
      userId,
      UNBLOCK_FINE_COINS,
      'fine',
      'جریمه رفع مسدودی',
      null
    );
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * آمار کلی سکه‌ها
 */
export const getCoinStats = async (): Promise<{
  totalCoins: number;
  totalEarned: number;
  totalSpent: number;
  totalPurchased: number;
  avgBalance: number;
}> => {
  const result = await pool.query(`
    SELECT 
      COALESCE(SUM(balance), 0) as total_coins,
      COALESCE(SUM(total_earned), 0) as total_earned,
      COALESCE(SUM(total_spent), 0) as total_spent,
      COALESCE(SUM(total_purchased), 0) as total_purchased,
      COALESCE(AVG(balance), 0) as avg_balance
    FROM coins
  `);

  return {
    totalCoins: parseFloat(result.rows[0].total_coins),
    totalEarned: parseFloat(result.rows[0].total_earned),
    totalSpent: parseFloat(result.rows[0].total_spent),
    totalPurchased: parseFloat(result.rows[0].total_purchased),
    avgBalance: parseFloat(result.rows[0].avg_balance)
  };
};

/**
 * بیشترین موجودی‌ها
 */
export const getTopBalances = async (limit: number = 10): Promise<Array<{
  user_id: number;
  balance: number;
  telegram_id: number;
}>> => {
  const result = await pool.query(
    `SELECT c.user_id, c.balance, u.telegram_id
     FROM coins c
     JOIN users u ON c.user_id = u.id
     ORDER BY c.balance DESC
     LIMIT $1`,
    [limit]
  );

  return result.rows;
};
