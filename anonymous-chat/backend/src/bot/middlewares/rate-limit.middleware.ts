import { Context } from 'telegraf';
import redisService from '../../services/redis.service';
import logger from '../../utils/logger';


export const rateLimitMiddleware = async (ctx: Context, next: () => Promise<void>) => {
  const userId = ctx.from?.id;

  if (!userId) {
    return next();
  }

  try {
    // ✅ دریافت اطلاعات کامل
    const result = await redisService.checkRateLimit(userId, 'message');

    if (!result.allowed) {
      // const resetIn = Math.ceil((result.resetAt - Date.now()) / 1000); // ثانیه
      
      logger.warn(`⚠️ Rate limit exceeded for user ${userId}`);
      
      await ctx.reply(
        `⏳ شما تعداد پیام‌های مجاز در دقیقه را رد کردید.\n\n` +
        // `⏰ زمان باقی‌مانده: ${resetIn} ثانیه\n` +
        `📊 پیام‌های باقی‌مانده: ${result.remaining}`
      );
      
      return;
    }

    logger.debug(`✅ Rate limit OK for user ${userId}, remaining: ${result.remaining}`);
    
    return next();
  } catch (error) {
    logger.error('❌ Rate limit check failed:', error);
    return next();
  }
};
