import axios from 'axios';
import crypto from 'crypto';
import { config } from '../config';
import databaseService from './database.service';
import userService from './user.service';
import logger from '../utils/logger';

/**
 * سرویس مدیریت پرداخت‌ها
 */
class PaymentService {
  private readonly zarinpalApiUrl = 'https://api.zarinpal.com/pg/v4/payment';
  private readonly idpayApiUrl = 'https://api.idpay.ir/v1.1/payment';

  /**
   * ایجاد تراکنش جدید
   */
  async createTransaction(data: {
    userId: number;
    packageId: number;
    amount: number;
    coins: number;
    gateway: 'zarinpal' | 'idpay';
  }) {
    const { userId, packageId, amount, coins, gateway } = data;

    const result = await databaseService.query(
      `INSERT INTO transactions 
       (user_id, package_id, amount, coins, gateway, status) 
       VALUES ($1, $2, $3, $4, $5, 'pending')
       RETURNING *`,
      [userId, packageId, amount, coins, gateway]
    );

    return result.rows[0];
  }

  /**
   * درخواست پرداخت از ZarinPal
   */
  async requestZarinpalPayment(data: {
    userId: number;
    transactionId: number;
    amount: number;
    description: string;
    mobile?: string;
    email?: string;
  }) {
    try {
      const { userId, transactionId, amount, description, mobile, email } = data;

      const callbackUrl = `${config.api.baseUrl}/payment/verify/zarinpal`;

      const response = await axios.post(
        `${this.zarinpalApiUrl}/request.json`,
        {
          merchant_id: config.payment.zarinpal.merchantId,
          amount: amount * 10, // تبدیل به ریال
          callback_url: callbackUrl,
          description,
          metadata: {
            mobile,
            email,
            transaction_id: transactionId,
            user_id: userId,
          },
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.data.code === 100) {
        const authority = response.data.data.authority;

        // ذخیره authority
        await databaseService.query(
          `UPDATE transactions 
           SET authority = $1, updated_at = NOW() 
           WHERE transaction_id = $2`,
          [authority, transactionId]
        );

        return {
          success: true,
          authority,
          paymentUrl: `https://www.zarinpal.com/pg/StartPay/${authority}`,
        };
      }

      throw new Error('خطا در ایجاد درخواست پرداخت');
    } catch (error) {
      logger.error('ZarinPal payment request error:', error);
      throw error;
    }
  }

  /**
   * تایید پرداخت ZarinPal
   */
  async verifyZarinpalPayment(authority: string, status: string) {
    try {
      // دریافت اطلاعات تراکنش
      const transaction = await databaseService.queryOne(
        `SELECT * FROM transactions WHERE authority = $1`,
        [authority]
      );

      if (!transaction) {
        throw new Error('تراکنش یافت نشد');
      }

      if (transaction.status === 'completed') {
        return {
          success: false,
          message: 'این تراکنش قبلاً تایید شده است',
        };
      }

      if (status !== 'OK') {
        await this.updateTransactionStatus(transaction.transaction_id, 'failed');
        return {
          success: false,
          message: 'پرداخت توسط کاربر لغو شد',
        };
      }

      // تایید پرداخت
      const response = await axios.post(
        `${this.zarinpalApiUrl}/verify.json`,
        {
          merchant_id: config.payment.zarinpal.merchantId,
          amount: transaction.amount * 10, // ریال
          authority,
        }
      );

      if (response.data.data.code === 100 || response.data.data.code === 101) {
        const refId = response.data.data.ref_id;

        // تکمیل تراکنش
        await this.completeTransaction(
          transaction.transaction_id,
          refId,
          response.data.data
        );

        // اضافه کردن سکه به کاربر
        await userService.addCoins(
          transaction.user_id,
          transaction.coins,
          `خرید پکیج - تراکنش #${transaction.transaction_id}`
        );

        logger.info('Payment verified successfully:', {
          transactionId: transaction.transaction_id,
          refId,
        });

        return {
          success: true,
          refId,
          transaction,
        };
      }

      throw new Error('خطا در تایید پرداخت');
    } catch (error) {
      logger.error('ZarinPal verification error:', error);
      throw error;
    }
  }

  /**
   * درخواست پرداخت از IDPay
   */
  async requestIdpayPayment(data: {
    userId: number;
    transactionId: number;
    amount: number;
    description: string;
    mobile?: string;
    email?: string;
  }) {
    try {
      const { userId, transactionId, amount, description, mobile, email } = data;

      const callbackUrl = `${config.api.baseUrl}/payment/verify/idpay`;

      const response = await axios.post(
        this.idpayApiUrl,
        {
          order_id: transactionId.toString(),
          amount: amount * 10, // تبدیل به ریال
          name: `کاربر ${userId}`,
          phone: mobile,
          mail: email,
          desc: description,
          callback: callbackUrl,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-API-KEY': config.payment.idpay.apiKey,
          },
        }
      );

      if (response.data.id) {
        const paymentId = response.data.id;

        // ذخیره payment ID
        await databaseService.query(
          `UPDATE transactions 
           SET authority = $1, updated_at = NOW() 
           WHERE transaction_id = $2`,
          [paymentId, transactionId]
        );

        return {
          success: true,
          paymentId,
          paymentUrl: response.data.link,
        };
      }

      throw new Error('خطا در ایجاد درخواست پرداخت');
    } catch (error) {
      logger.error('IDPay payment request error:', error);
      throw error;
    }
  }

  /**
   * تایید پرداخت IDPay
   */
  async verifyIdpayPayment(data: {
    id: string;
    order_id: string;
    amount: number;
    status: number;
    track_id: string;
  }) {
    try {
      const { id, order_id, amount, status, track_id } = data;

      const transactionId = parseInt(order_id);

      // دریافت اطلاعات تراکنش
      const transaction = await databaseService.queryOne(
        `SELECT * FROM transactions WHERE transaction_id = $1`,
        [transactionId]
      );

      if (!transaction) {
        throw new Error('تراکنش یافت نشد');
      }

      if (transaction.status === 'completed') {
        return {
          success: false,
          message: 'این تراکنش قبلاً تایید شده است',
        };
      }

      if (status !== 100) {
        await this.updateTransactionStatus(transactionId, 'failed');
        return {
          success: false,
          message: 'پرداخت ناموفق بود',
        };
      }

      // تایید پرداخت
      const response = await axios.post(
        `${this.idpayApiUrl}/verify`,
        {
          id,
          order_id,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-API-KEY': config.payment.idpay.apiKey,
          },
        }
      );

      if (response.data.status === 100) {
        // تکمیل تراکنش
        await this.completeTransaction(transactionId, track_id, response.data);

        // اضافه کردن سکه به کاربر
        await userService.addCoins(
          transaction.user_id,
          transaction.coins,
          `خرید پکیج - تراکنش #${transactionId}`
        );

        logger.info('IDPay payment verified:', {
          transactionId,
          trackId: track_id,
        });

        return {
          success: true,
          trackId: track_id,
          transaction,
        };
      }

      throw new Error('خطا در تایید پرداخت');
    } catch (error) {
      logger.error('IDPay verification error:', error);
      throw error;
    }
  }

  /**
   * تکمیل تراکنش
   */
  private async completeTransaction(
    transactionId: number,
    refId: string,
    paymentData: any
  ) {
    await databaseService.query(
      `UPDATE transactions 
       SET status = 'completed',
           ref_id = $1,
           payment_data = $2,
           completed_at = NOW(),
           updated_at = NOW()
       WHERE transaction_id = $3`,
      [refId, JSON.stringify(paymentData), transactionId]
    );
  }

  /**
   * بروزرسانی وضعیت تراکنش
   */
  async updateTransactionStatus(transactionId: number, status: string) {
    await databaseService.query(
      `UPDATE transactions 
       SET status = $1, updated_at = NOW() 
       WHERE transaction_id = $2`,
      [status, transactionId]
    );
  }

  /**
   * دریافت تراکنش با ID
   */
  async getTransactionById(transactionId: number) {
    return await databaseService.queryOne(
      `SELECT t.*, cp.name as package_name, cp.description as package_description
       FROM transactions t
       LEFT JOIN coin_packages cp ON t.package_id = cp.package_id
       WHERE t.transaction_id = $1`,
      [transactionId]
    );
  }

  /**
   * دریافت تراکنش با Authority
   */
  async getTransactionByAuthority(authority: string) {
    return await databaseService.queryOne(
      `SELECT * FROM transactions WHERE authority = $1`,
      [authority]
    );
  }

  /**
   * لیست تراکنش‌های کاربر
   */
  async getUserTransactions(
    userId: number,
    limit: number = 20,
    offset: number = 0
  ) {
    return await databaseService.queryMany(
      `SELECT t.*, cp.name as package_name
       FROM transactions t
       LEFT JOIN coin_packages cp ON t.package_id = cp.package_id
       WHERE t.user_id = $1
       ORDER BY t.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
  }

  /**
   * آمار تراکنش‌ها
   */
  async getTransactionStats(period: string = 'month') {
    const dateFilter = this.getDateFilter(period);

    const result = await databaseService.queryOne(
      `SELECT 
         COUNT(*) as total_transactions,
         COUNT(*) FILTER (WHERE status = 'completed') as successful,
         COUNT(*) FILTER (WHERE status = 'pending') as pending,
         COUNT(*) FILTER (WHERE status = 'failed') as failed,
         COALESCE(SUM(amount) FILTER (WHERE status = 'completed'), 0) as total_revenue,
         COALESCE(SUM(coins) FILTER (WHERE status = 'completed'), 0) as total_coins_sold
       FROM transactions
       WHERE created_at >= ${dateFilter}`
    );

    return result;
  }

  /**
   * محاسبه درآمد روزانه
   */
  async getDailyRevenue(days: number = 30) {
    return await databaseService.queryMany(
      `SELECT 
         DATE(created_at) as date,
         COUNT(*) as transactions,
         COALESCE(SUM(amount) FILTER (WHERE status = 'completed'), 0) as revenue,
         COALESCE(SUM(coins) FILTER (WHERE status = 'completed'), 0) as coins_sold
       FROM transactions
       WHERE created_at >= NOW() - INTERVAL '${days} days'
       GROUP BY DATE(created_at)
       ORDER BY date DESC`
    );
  }

  /**
   * پرفروش‌ترین پکیج‌ها
   */
  async getTopPackages(limit: number = 10) {
    return await databaseService.queryMany(
      `SELECT 
         cp.package_id,
         cp.name,
         cp.coins,
         cp.price,
         COUNT(*) as purchase_count,
         SUM(t.amount) as total_revenue
       FROM transactions t
       JOIN coin_packages cp ON t.package_id = cp.package_id
       WHERE t.status = 'completed'
       GROUP BY cp.package_id, cp.name, cp.coins, cp.price
       ORDER BY purchase_count DESC
       LIMIT $1`,
      [limit]
    );
  }

  /**
   * فیلتر تاریخ بر اساس دوره
   */
  private getDateFilter(period: string): string {
    const filters: Record<string, string> = {
      day: "NOW() - INTERVAL '1 day'",
      week: "NOW() - INTERVAL '7 days'",
      month: "NOW() - INTERVAL '30 days'",
      year: "NOW() - INTERVAL '365 days'",
    };

    return filters[period] || filters.month;
  }

  /**
   * لغو تراکنش
   */
  async cancelTransaction(transactionId: number) {
    await databaseService.query(
      `UPDATE transactions 
       SET status = 'cancelled', updated_at = NOW() 
       WHERE transaction_id = $1 AND status = 'pending'`,
      [transactionId]
    );
  }

  /**
   * حذف تراکنش‌های قدیمی pending
   */
  async cleanupPendingTransactions(hours: number = 24) {
    const result = await databaseService.query(
      `UPDATE transactions 
       SET status = 'expired', updated_at = NOW()
       WHERE status = 'pending' 
       AND created_at < NOW() - INTERVAL '${hours} hours'
       RETURNING transaction_id`
    );

    logger.info(`Cleaned up ${result.rowCount} expired transactions`);
    return result.rowCount;
  }
}

export default new PaymentService();
