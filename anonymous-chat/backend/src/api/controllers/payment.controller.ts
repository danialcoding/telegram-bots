import { Response } from 'express';
import { paymentService } from '../../services/payment.service';
import { AuthRequest } from '../middlewares/auth';
import { ValidationError, NotFoundError } from '../../utils/errors';

export class PaymentController {
  /**
   * درخواست پرداخت
   */
  static async requestPayment(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        throw new ValidationError('کاربر شناخته نشد');
      }

      const { packageId, gateway } = req.body;

      const payment = await paymentService.createTransaction(
        req.userId,
        packageId,
        gateway
      );

      const paymentUrl = await paymentService.requestPayment(
        payment.id,
        payment.amount,
        gateway
      );

      res.status(201).json({
        success: true,
        data: {
          transactionId: payment.id,
          paymentUrl,
        },
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * تأیید پرداخت (Callback)
   */
  static async verifyPayment(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { transactionId, authority, gateway } = req.body;

      const result = await paymentService.verifyPayment(
        transactionId,
        authority,
        gateway
      );

      res.json({
        success: true,
        data: {
          verified: result,
          message: 'پرداخت با موفقیت تأیید شد',
        },
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * دریافت تاریخچه پرداخت‌های کاربر
   */
  static async getTransactions(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        throw new ValidationError('کاربر شناخته نشد');
      }

      const { limit = 50, offset = 0 } = req.query;

      const transactions = await paymentService.getUserTransactions(
        req.userId,
        parseInt(limit as string),
        parseInt(offset as string)
      );

      res.json({
        success: true,
        data: { transactions },
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * دریافت آمار پرداخت‌ها (برای ادمین)
   */
  static async getStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { period = 'daily' } = req.query;

      const stats = await paymentService.getStats(period as string);

      res.json({
        success: true,
        data: { stats },
      });
    } catch (error) {
      throw error;
    }
  }
}
