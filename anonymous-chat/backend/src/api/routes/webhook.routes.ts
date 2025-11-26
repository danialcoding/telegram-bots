import { Router } from 'express';
import { body } from 'express-validator';
import crypto from 'crypto';
import { config } from '../../config';
import { asyncHandler } from '../middlewares/error.middleware';
import { validate } from '../middlewares/validator.middleware';
import userService from '../../services/user.service';
import crypto from 'crypto';
import { paymentService } from '../../services/payment.service';
import { pool } from '../../database/db';
import logger from '../../utils/logger';

const router = Router();

/**
 * تست webhook
 * POST /api/webhook/test
 */
router.post(
  '/test',
  asyncHandler(async (req, res) => {
    logger.info('Test webhook received:', req.body);

    res.json({
      success: true,
      message: 'Webhook test successful',
      received: req.body,
    });
  })
);

/**
 * جستجوی userId از Authority
 */
async function getUserIdFromAuthority(authority: string): Promise<number | null> {
  try {
    const result = await pool.query(
      `SELECT user_id FROM transactions 
       WHERE authority = $1 AND status = 'pending'
       LIMIT 1`,
      [authority]
    );

    if (result.rows.length > 0) {
      return result.rows[0].user_id;
    }
    return null;
  } catch (error) {
    logger.error('Error getting userId from authority', { authority, error });
    return null;
  }
}

/**
 * دریافت اطلاعات تراکنش از Authority
 */
async function getTransactionByAuthority(authority: string): Promise<any | null> {
  try {
    const result = await pool.query(
      `SELECT * FROM transactions 
       WHERE authority = $1 
       LIMIT 1`,
      [authority]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    logger.error('Error getting transaction', { authority, error });
    return null;
  }
}

/**
 * تأیید امضای IDPay
 */
function verifyIDPaySignature(payload: any, apiKey: string): boolean {
  try {
    // IDPay از X-API-KEY برای احراز هویت استفاده می‌کند
    // باید با API Key تنظیم شده در config مطابقت داشته باشد
    return apiKey === config.payment.idpay.apiKey;
  } catch (error) {
    logger.error('Error verifying IDPay signature', { error });
    return false;
  }
}

/**
 * Webhook برای پرداخت‌های ZarinPal
 * POST /api/webhook/zarinpal
 */
router.post(
  '/zarinpal',
  asyncHandler(async (req: Request, res: Response) => {
    const { Authority, Status } = req.body;

    logger.info('ZarinPal webhook received', { Authority, Status });

    if (!Authority) {
      return res.status(400).json({
        success: false,
        message: 'Authority is required',
      });
    }

    // دریافت اطلاعات تراکنش
    const transaction = await getTransactionByAuthority(Authority);
    if (!transaction) {
      logger.warn('Transaction not found for authority', { Authority });
      return res.status(404).json({
        success: false,
        message: 'Transaction not found',
      });
    }

    if (Status === 'OK') {
      try {
        // تأیید پرداخت از ZarinPal
        const verifyResult = await paymentService.verifyPayment(
          transaction.id,
          Authority,
          'zarinpal'
        );

        if (verifyResult) {
          // دریافت اطلاعات پکیج
          const packageResult = await pool.query(
            'SELECT coins FROM packages WHERE id = $1',
            [transaction.package_id]
          );

          if (packageResult.rows.length > 0) {
            const coinsToAdd = packageResult.rows[0].coins;

            // افزودن سکه به حساب کاربر
            await pool.query(
              'UPDATE users SET coins = coins + $1, updated_at = NOW() WHERE id = $2',
              [coinsToAdd, transaction.user_id]
            );

            // ثبت تراکنش سکه
            await pool.query(
              `INSERT INTO coin_transactions 
               (user_id, amount, type, reason, transaction_id, created_at)
               VALUES ($1, $2, 'credit', 'خرید سکه', $3, NOW())`,
              [transaction.user_id, coinsToAdd, transaction.id]
            );

            logger.info('ZarinPal payment verified and coins added', {
              userId: transaction.user_id,
              coinsAdded: coinsToAdd,
              transactionId: transaction.id,
            });
          }
        }
      } catch (error) {
        logger.error('Error verifying ZarinPal payment', { Authority, error });
      }
    } else {
      // پرداخت ناموفق
      await pool.query(
        `UPDATE transactions SET status = 'failed', updated_at = NOW() WHERE authority = $1`,
        [Authority]
      );

      logger.info('ZarinPal payment failed', { Authority, Status });
    }

    res.json({
      success: true,
      message: 'Payment processed',
    });
  })
);

/**
 * Webhook برای پرداخت‌های IDPay
 * POST /api/webhook/idpay
 */
router.post(
  '/idpay',
  asyncHandler(async (req: Request, res: Response) => {
    const { id, status, track_id, order_id, amount } = req.body;

    logger.info('IDPay webhook received', { id, status, order_id });

    // بررسی امضا
    const apiKey = req.headers['x-api-key'] as string;
    if (!verifyIDPaySignature(req.body, apiKey)) {
      logger.warn('Invalid IDPay signature', { order_id });
      return res.status(401).json({
        success: false,
        message: 'Invalid signature',
      });
    }

    // دریافت تراکنش
    const transactionResult = await pool.query(
      'SELECT * FROM transactions WHERE id = $1',
      [order_id]
    );

    if (transactionResult.rows.length === 0) {
      logger.warn('Transaction not found', { order_id });
      return res.status(404).json({
        success: false,
        message: 'Transaction not found',
      });
    }

    const transaction = transactionResult.rows[0];

    // status 100 = پرداخت موفق و تأیید شده
    // status 101 = پرداخت موفق اما قبلاً تأیید شده
    if (status === 100 || status === 101) {
      try {
        // به‌روزرسانی تراکنش
        await pool.query(
          `UPDATE transactions 
           SET status = 'completed', 
               ref_id = $1, 
               track_id = $2,
               updated_at = NOW() 
           WHERE id = $3`,
          [id, track_id, order_id]
        );

        // فقط اگر قبلاً پردازش نشده باشد
        if (status === 100) {
          // دریافت اطلاعات پکیج
          const packageResult = await pool.query(
            'SELECT coins FROM packages WHERE id = $1',
            [transaction.package_id]
          );

          if (packageResult.rows.length > 0) {
            const coinsToAdd = packageResult.rows[0].coins;

            // افزودن سکه
            await pool.query(
              'UPDATE users SET coins = coins + $1, updated_at = NOW() WHERE id = $2',
              [coinsToAdd, transaction.user_id]
            );

            // ثبت تراکنش سکه
            await pool.query(
              `INSERT INTO coin_transactions 
               (user_id, amount, type, reason, transaction_id, created_at)
               VALUES ($1, $2, 'credit', 'خرید سکه', $3, NOW())`,
              [transaction.user_id, coinsToAdd, order_id]
            );

            logger.info('IDPay payment verified and coins added', {
              userId: transaction.user_id,
              coinsAdded: coinsToAdd,
              trackId: track_id,
            });
          }
        }
      } catch (error) {
        logger.error('Error processing IDPay payment', { order_id, error });
      }
    } else {
      // پرداخت ناموفق
      await pool.query(
        `UPDATE transactions SET status = 'failed', updated_at = NOW() WHERE id = $1`,
        [order_id]
      );

      logger.info('IDPay payment failed', { order_id, status });
    }

    res.json({
      success: true,
      message: 'Payment processed',
    });
  })
);

/**
 * Webhook برای Telegram Bot
 * POST /api/webhook/telegram
 */
router.post(
  '/telegram',
  asyncHandler(async (req: Request, res: Response) => {
    const update = req.body;

    // بررسی secret token
    const token = req.headers['x-telegram-bot-api-secret-token'];
    if (token !== config.bot.webhookSecret) {
      logger.warn('Unauthorized telegram webhook request');
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    try {
      // Import bot instance و پردازش update
      const { bot } = await import('../../bot');
      
      // پردازش update توسط Telegraf
      await bot.handleUpdate(update);

      logger.debug('Telegram update processed', {
        updateId: update.update_id,
      });
    } catch (error) {
      logger.error('Error processing telegram update', { error });
    }

    // همیشه 200 برگردان تا Telegram retry نکند
    res.sendStatus(200);
  })
);

/**
 * Health check برای webhooks
 * GET /api/webhook/health
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Webhooks are healthy',
    timestamp: new Date().toISOString(),
  });
});


export default router;
