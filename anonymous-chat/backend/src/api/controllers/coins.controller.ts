import { Response } from 'express';
import { userService } from '../../services/user.service';
import { AuthRequest } from '../middlewares/auth';
import { ValidationError, NotFoundError } from '../../utils/errors';
import logger from '../../utils/logger';
import { pool } from '../../database/db';

export class CoinsController {
  /**
   * دریافت موجودی سکه کاربر
   */
  static async getBalance(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        throw new ValidationError('کاربر شناخته نشد');
      }

      const user = await userService.getUserById(req.userId);
      if (!user) {
        throw new NotFoundError('کاربر یافت نشد');
      }

      res.json({
        success: true,
        data: {
          coins: user.coins,
        },
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * اضافه/کسر سکه توسط ادمین
   */
  static async modifyCoins(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = parseInt(req.params.id);
      const { amount, reason } = req.body;

      if (isNaN(userId)) {
        throw new ValidationError('شناسه کاربر نامعتبر است');
      }

      const user = await userService.getUserById(userId);
      if (!user) {
        throw new NotFoundError('کاربر یافت نشد');
      }

      // بررسی اینکه سکه کافی برای کسر وجود دارد
      if (amount < 0 && user.coins + amount < 0) {
        throw new ValidationError('موجودی سکه کاربر کافی نیست');
      }

      // به‌روزرسانی سکه
      const newBalance = user.coins + amount;
      await pool.query(
        'UPDATE users SET coins = $1, updated_at = NOW() WHERE id = $2',
        [newBalance, userId]
      );

      // ثبت لاگ تراکنش سکه
      await pool.query(
        `INSERT INTO coin_transactions 
         (user_id, amount, type, reason, admin_id, created_at) 
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [
          userId,
          Math.abs(amount),
          amount > 0 ? 'credit' : 'debit',
          reason,
          req.userId,
        ]
      );

      logger.info('Admin modified user coins', {
        adminId: req.userId,
        targetUserId: userId,
        amount,
        reason,
        newBalance,
      });

      res.json({
        success: true,
        message: `${Math.abs(amount)} سکه با موفقیت ${amount > 0 ? 'اضافه' : 'کسر'} شد`,
        data: {
          userId,
          previousBalance: user.coins,
          newBalance,
          change: amount,
        },
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * دریافت تاریخچه تراکنش‌های سکه
   */
  static async getTransactionHistory(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        throw new ValidationError('کاربر شناخته نشد');
      }

      const { limit = 50, offset = 0 } = req.query;

      const result = await pool.query(
        `SELECT * FROM coin_transactions 
         WHERE user_id = $1 
         ORDER BY created_at DESC 
         LIMIT $2 OFFSET $3`,
        [req.userId, limit, offset]
      );

      res.json({
        success: true,
        data: {
          transactions: result.rows,
        },
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * دریافت تاریخچه تراکنش‌های کاربر خاص (برای ادمین)
   */
  static async getUserTransactionHistory(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = parseInt(req.params.id);
      const { limit = 50, offset = 0 } = req.query;

      if (isNaN(userId)) {
        throw new ValidationError('شناسه کاربر نامعتبر است');
      }

      const result = await pool.query(
        `SELECT ct.*, u.username as admin_username 
         FROM coin_transactions ct
         LEFT JOIN users u ON ct.admin_id = u.id
         WHERE ct.user_id = $1 
         ORDER BY ct.created_at DESC 
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      );

      res.json({
        success: true,
        data: {
          transactions: result.rows,
        },
      });
    } catch (error) {
      throw error;
    }
  }
}
