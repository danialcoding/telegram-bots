import { Bot } from 'grammy';
import { config } from '../config';
import databaseService from './database.service';
import logger from '../utils/logger';

/**
 * سرویس مدیریت اعلان‌ها
 */
class NotificationService {
  private bot: Bot;

  constructor() {
    this.bot = new Bot(config.bot.token);
  }

  /**
   * ارسال اعلان به کاربر
   */
  async sendNotification(
    userId: number,
    message: string,
    options?: {
      parseMode?: 'HTML' | 'Markdown';
      replyMarkup?: any;
      disableNotification?: boolean;
    }
  ): Promise<boolean> {
    try {
      // بررسی تنظیمات اعلان کاربر
      const settings = await this.getUserNotificationSettings(userId);
      
      if (!settings?.notifications_enabled) {
        return false;
      }

      await this.bot.api.sendMessage(userId, message, {
        parse_mode: options?.parseMode,
        reply_markup: options?.replyMarkup,
        disable_notification: options?.disableNotification,
      });

      // ذخیره لاگ اعلان
      await this.logNotification(userId, 'sent', message);

      return true;
    } catch (error: any) {
      logger.error('Failed to send notification:', {
        userId,
        error: error.message,
      });

      // اگر کاربر ربات را بلاک کرده
      if (error.error_code === 403) {
        await this.handleBlockedUser(userId);
      }

      await this.logNotification(userId, 'failed', message, error.message);
      return false;
    }
  }

  /**
   * ارسال اعلان پیدا شدن چت
   */
  async notifyChatFound(userId: number, chatType: string) {
    const message =
      chatType === 'random'
        ? '🎉 <b>چت پیدا شد!</b>\n\nهمین الان شروع کن و لذت ببر!'
        : `🎉 <b>چت ${chatType === 'male' ? 'پسر' : 'دختر'} پیدا شد!</b>\n\nهمین الان شروع کن و لذت ببر!`;

    await this.sendNotification(userId, message, {
      parseMode: 'HTML',
    });
  }

  /**
   * اعلان پایان چت
   */
  async notifyChatEnded(userId: number, reason: string = 'ended_by_partner') {
    const messages: Record<string, string> = {
      ended_by_partner: '💔 <b>چت پایان یافت</b>\n\nطرف مقابل چت را پایان داد.',
      ended_by_user: '✅ <b>چت پایان یافت</b>\n\nشما چت را پایان دادید.',
      ended_by_admin: '⚠️ <b>چت توسط ادمین پایان یافت</b>',
      partner_blocked:
        '🚫 <b>چت پایان یافت</b>\n\nطرف مقابل شما را بلاک کرد.',
    };

    const message = messages[reason] || messages.ended_by_partner;

    await this.sendNotification(userId, message, {
      parseMode: 'HTML',
    });
  }

  /**
   * اعلان درخواست چت مستقیم
   */
  async notifyDirectChatRequest(userId: number, fromUsername: string) {
    const message = `💌 <b>درخواست چت مستقیم</b>\n\n<b>${fromUsername}</b> می‌خواهد با شما چت کند.\n\nآیا قبول می‌کنید؟`;

    await this.sendNotification(userId, message, {
      parseMode: 'HTML',
      replyMarkup: {
        inline_keyboard: [
          [
            { text: '✅ قبول', callback_data: 'accept_direct_chat' },
            { text: '❌ رد', callback_data: 'reject_direct_chat' },
          ],
        ],
      },
    });
  }

  /**
   * اعلان پیام ناشناس
   */
  async notifyAnonymousMessage(userId: number) {
    const message =
      '💌 <b>پیام ناشناس جدید</b>\n\nیک نفر برای شما پیام ناشناس فرستاده!';

    await this.sendNotification(userId, message, {
      parseMode: 'HTML',
    });
  }

  /**
   * اعلان افزایش سکه
   */
  async notifyCoinsAdded(userId: number, amount: number, reason: string) {
    const message = `💰 <b>سکه اضافه شد</b>\n\n<b>مقدار:</b> ${amount} سکه\n<b>دلیل:</b> ${reason}`;

    await this.sendNotification(userId, message, {
      parseMode: 'HTML',
    });
  }

  /**
   * اعلان کسر سکه
   */
  async notifyCoinsDeducted(userId: number, amount: number, reason: string) {
    const message = `💸 <b>سکه کسر شد</b>\n\n<b>مقدار:</b> ${amount} سکه\n<b>دلیل:</b> ${reason}`;

    await this.sendNotification(userId, message, {
      parseMode: 'HTML',
    });
  }

  /**
   * اعلان پرداخت موفق
   */
  async notifyPaymentSuccess(
    userId: number,
    amount: number,
    coins: number,
    refId: string
  ) {
    const message = `✅ <b>پرداخت موفق</b>\n\n<b>مبلغ:</b> ${amount.toLocaleString()} تومان\n<b>سکه دریافتی:</b> ${coins}\n<b>شماره پیگیری:</b> ${refId}`;

    await this.sendNotification(userId, message, {
      parseMode: 'HTML',
    });
  }

  /**
   * اعلان پرداخت ناموفق
   */
  async notifyPaymentFailed(userId: number) {
    const message =
      '❌ <b>پرداخت ناموفق</b>\n\nپرداخت شما با موفقیت انجام نشد. لطفاً دوباره تلاش کنید.';

    await this.sendNotification(userId, message, {
      parseMode: 'HTML',
    });
  }

  /**
   * اعلان گزارش دریافتی
   */
  async notifyReportReceived(userId: number) {
    const message =
      '⚠️ <b>گزارش دریافت شد</b>\n\nگزارش شما دریافت شد و در حال بررسی است.';

    await this.sendNotification(userId, message, {
      parseMode: 'HTML',
    });
  }

  /**
   * اعلان بلاک شدن
   */
  async notifyUserBlocked(userId: number, reason: string) {
    const message = `🚫 <b>حساب کاربری مسدود شد</b>\n\n<b>دلیل:</b> ${reason}\n\nبرای اطلاعات بیشتر با پشتیبانی تماس بگیرید.`;

    await this.sendNotification(userId, message, {
      parseMode: 'HTML',
    });
  }

  /**
   * اعلان رفع بلاک
   */
  async notifyUserUnblocked(userId: number) {
    const message =
      '✅ <b>حساب کاربری فعال شد</b>\n\nحساب کاربری شما مجدداً فعال شد.';

    await this.sendNotification(userId, message, {
      parseMode: 'HTML',
    });
  }

  /**
   * ارسال پیام broadcast به همه کاربران
   */
  async sendBroadcast(
    message: string,
    options?: {
      parseMode?: 'HTML' | 'Markdown';
      targetGender?: 'male' | 'female';
      minAge?: number;
      maxAge?: number;
    }
  ): Promise<{ sent: number; failed: number }> {
    try {
      // دریافت لیست کاربران
      let query = `
        SELECT u.user_id, u.telegram_id 
        FROM users u
        JOIN user_profiles p ON u.user_id = p.user_id
        WHERE u.status = 'active'
      `;

      const params: any[] = [];
      let paramIndex = 1;

      if (options?.targetGender) {
        query += ` AND p.gender = $${paramIndex++}`;
        params.push(options.targetGender);
      }

      if (options?.minAge) {
        query += ` AND p.age >= $${paramIndex++}`;
        params.push(options.minAge);
      }

      if (options?.maxAge) {
        query += ` AND p.age <= $${paramIndex++}`;
        params.push(options.maxAge);
      }

      const users = await databaseService.queryMany(query, params);

      let sent = 0;
      let failed = 0;

      // ارسال به صورت batch
      const batchSize = 30;
      for (let i = 0; i < users.length; i += batchSize) {
        const batch = users.slice(i, i + batchSize);

        await Promise.all(
          batch.map(async (user) => {
            const success = await this.sendNotification(
              user.telegram_id,
              message,
              {
                parseMode: options?.parseMode,
                disableNotification: true,
              }
            );

            if (success) sent++;
            else failed++;
          })
        );

        // تاخیر برای جلوگیری از rate limit
        if (i + batchSize < users.length) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      logger.info('Broadcast completed:', { sent, failed });

      return { sent, failed };
    } catch (error) {
      logger.error('Broadcast failed:', error);
      throw error;
    }
  }

  /**
   * دریافت تنظیمات اعلان کاربر
   */
  private async getUserNotificationSettings(userId: number) {
    return await databaseService.queryOne(
      `SELECT notifications_enabled 
       FROM user_settings 
       WHERE user_id = $1`,
      [userId]
    );
  }

  /**
   * مدیریت کاربر بلاک‌کننده
   */
  private async handleBlockedUser(userId: number) {
    await databaseService.query(
      `UPDATE users 
       SET bot_blocked = true, updated_at = NOW() 
       WHERE telegram_id = $1`,
      [userId]
    );
  }

  /**
   * ذخیره لاگ اعلان
   */
  private async logNotification(
    userId: number,
    status: 'sent' | 'failed',
    message: string,
    error?: string
  ) {
    try {
      await databaseService.query(
        `INSERT INTO notification_logs 
         (user_id, status, message, error, created_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [userId, status, message.substring(0, 500), error || null]
      );
    } catch (err) {
      logger.error('Failed to log notification:', err);
    }
  }

  /**
   * دریافت آمار اعلان‌ها
   */
  async getNotificationStats(days: number = 7) {
    return await databaseService.queryOne(
      `SELECT 
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE status = 'sent') as sent,
         COUNT(*) FILTER (WHERE status = 'failed') as failed
       FROM notification_logs
       WHERE created_at >= NOW() - INTERVAL '${days} days'`
    );
  }
}

export default new NotificationService();
