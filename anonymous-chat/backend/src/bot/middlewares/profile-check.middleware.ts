import { Markup } from 'telegraf';
import { MyContext } from '../types';
import { userService } from '../../services/user.service';
import logger from '../../utils/logger';

/**
 * Middleware برای چک کردن تکمیل پروفایل
 * اگر کاربر پروفایل کامل نداشته باشد، به او اخطار داده می‌شود
 */
export const requireCompleteProfile = async (ctx: MyContext, next: () => Promise<void>) => {
  const user = ctx.state.user;

  if (!user) {
    return;
  }

  try {
    // چک کردن وجود پروفایل کامل
    const hasProfile = await userService.hasProfile(user.id);

    if (!hasProfile) {
      logger.info(`⚠️ User ${user.id} tried to access feature without complete profile`);
      
      await ctx.reply(
        '⚠️ برای استفاده از این بخش، ابتدا باید پروفایل خود را تکمیل کنید.\n\n' +
        '👤 لطفاً ابتدا به بخش "پروفایل من" بروید و اطلاعات خود را وارد کنید.',
        Markup.keyboard([
          ['👤 پروفایل من'],
        ]).resize()
      );
      return;
    }

    // اگر پروفایل کامل بود، ادامه بده
    return next();
    
  } catch (error) {
    logger.error('❌ Profile check middleware error:', error);
    await ctx.reply('⚠️ خطا در بررسی پروفایل');
    return;
  }
};

