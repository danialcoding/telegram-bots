import { MyContext } from "../types/bot.types";
import { silentModeKeyboard } from "../keyboards/silent.keyboard";
import logger from "../../utils/logger";
import pool from "../../database/db";
import * as jalaali from 'jalaali-js';

class SilentModeHandler {
  /**
   * نمایش منوی حالت سایلنت
   */
  async showSilentMenu(ctx: MyContext, editMessage: boolean = false) {
    try {
      const user = ctx.state.user;

      // دریافت وضعیت فعلی حالت سایلنت
      const result = await pool.query(
        `SELECT is_silent, silent_until FROM users WHERE id = $1`,
        [user.id]
      );

      const userData = result.rows[0];
      const isSilent = userData.is_silent;
      const silentUntil = userData.silent_until;

      let messageText = '';
      let statusIcon = '';
      let statusText = '';

      if (isSilent && silentUntil) {
        const now = new Date();
        const untilDate = new Date(silentUntil);

        if (untilDate > now) {
          // حالت سایلنت فعال است
          statusIcon = '🔕';
          const persianDate = this.toPersianDate(untilDate);
          statusText = `فعال تا (${persianDate})`;
        } else {
          // زمان سایلنت گذشته است
          await this.disableSilentMode(user.id);
          statusIcon = '🔔';
          statusText = 'غیر فعال';
        }
      } else if (isSilent && !silentUntil) {
        // حالت همیشه سایلنت
        statusIcon = '🔕';
        statusText = 'فعال (همیشه)';
      } else {
        // غیر فعال
        statusIcon = '🔔';
        statusText = 'غیر فعال';
      }

      messageText = `🔻 حالت سایلنت : ${statusIcon} ${statusText}\n\n_____________________\n💡با فعال شدن حالت سایلنت ، درخواست چت دریافت نخواهید کرد.`;

      if (editMessage && ctx.callbackQuery) {
        await ctx.editMessageText(messageText, silentModeKeyboard(isSilent, silentUntil));
      } else {
        await ctx.reply(messageText, silentModeKeyboard(isSilent, silentUntil));
      }
    } catch (error) {
      logger.error('Error showing silent menu:', error);
      await ctx.reply('⚠️ خطا در نمایش منو');
    }
  }

  /**
   * فعال کردن حالت سایلنت
   */
  async enableSilentMode(ctx: MyContext, duration: '30min' | '1hour' | 'forever') {
    try {
      const user = ctx.state.user;
      let silentUntil: Date | null = null;

      if (duration === '30min') {
        silentUntil = new Date(Date.now() + 30 * 60 * 1000);
      } else if (duration === '1hour') {
        silentUntil = new Date(Date.now() + 60 * 60 * 1000);
      }

      await pool.query(
        `UPDATE users 
         SET is_silent = true, silent_until = $1, updated_at = NOW()
         WHERE id = $2`,
        [silentUntil, user.id]
      );

      await ctx.answerCbQuery('✅ حالت سایلنت فعال شد');
      await this.showSilentMenu(ctx, true);
    } catch (error) {
      logger.error('Error enabling silent mode:', error);
      await ctx.answerCbQuery('⚠️ خطا در فعال‌سازی');
    }
  }

  /**
   * غیرفعال کردن حالت سایلنت
   */
  async disableSilentMode(userId: number) {
    try {
      await pool.query(
        `UPDATE users 
         SET is_silent = false, silent_until = NULL, updated_at = NOW()
         WHERE id = $1`,
        [userId]
      );
    } catch (error) {
      logger.error('Error disabling silent mode:', error);
      throw error;
    }
  }

  /**
   * غیرفعال کردن حالت سایلنت از طریق callback
   */
  async handleDisableSilent(ctx: MyContext) {
    try {
      const user = ctx.state.user;
      await this.disableSilentMode(user.id);
      await ctx.answerCbQuery('✅ حالت سایلنت غیرفعال شد');
      await this.showSilentMenu(ctx, true);
    } catch (error) {
      logger.error('Error handling disable silent:', error);
      await ctx.answerCbQuery('⚠️ خطا در غیرفعال‌سازی');
    }
  }

  /**
   * تبدیل تاریخ میلادی به شمسی با ساعت تهران
   */
  private toPersianDate(date: Date): string {
    // تبدیل UTC به ساعت تهران (UTC+3:30)
    const tehranOffset = 3.5 * 60 * 60 * 1000; // 3.5 ساعت به میلی‌ثانیه
    const tehranTime = new Date(date.getTime() + tehranOffset);
    
    const year = tehranTime.getUTCFullYear();
    const month = tehranTime.getUTCMonth() + 1;
    const day = tehranTime.getUTCDate();
    const hours = tehranTime.getUTCHours().toString().padStart(2, '0');
    const minutes = tehranTime.getUTCMinutes().toString().padStart(2, '0');
    const seconds = tehranTime.getUTCSeconds().toString().padStart(2, '0');

    // تبدیل به تاریخ شمسی
    const jDate = jalaali.toJalaali(year, month, day);

    return `${jDate.jy}/${jDate.jm}/${jDate.jd} ${hours}:${minutes}:${seconds}`;
  }

  /**
   * بررسی اینکه آیا کاربر در حالت سایلنت است
   */
  async isUserSilent(userId: number): Promise<boolean> {
    try {
      const result = await pool.query(
        `SELECT is_silent, silent_until FROM users WHERE id = $1`,
        [userId]
      );

      const userData = result.rows[0];
      if (!userData.is_silent) {
        return false;
      }

      // اگر silent_until تنظیم نشده (همیشه سایلنت)
      if (!userData.silent_until) {
        return true;
      }

      const now = new Date();
      const untilDate = new Date(userData.silent_until);

      // اگر زمان گذشته، غیرفعال کن
      if (untilDate <= now) {
        await this.disableSilentMode(userId);
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Error checking silent status:', error);
      return false;
    }
  }
}

export const silentModeHandler = new SilentModeHandler();
