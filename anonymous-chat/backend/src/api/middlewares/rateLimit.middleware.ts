import rateLimit from "express-rate-limit";
import { config } from "../../config";
import { MiddlewareFn } from 'telegraf';
import { MyContext } from '../../bot/index';
import redisService from "../../services/redis.service";
import logger from "../../utils/logger";
import { redisConfig } from "../../config/redis.config";

/**
 * محدودیت نرخ درخواست برای APIها
 */
export const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: {
    success: false,
    error: {
      message: "تعداد درخواست‌ها بیش از حد مجاز است",
      code: "TOO_MANY_REQUESTS",
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    error: {
      message: "تلاش‌های ناموفق زیادی انجام شده است. لطفاً بعداً تلاش کنید",
      code: "TOO_MANY_ATTEMPTS",
    },
  },
});

/**
 * Middleware محدودیت نرخ درخواست
 */
export const rateLimitMiddleware: MiddlewareFn<MyContext> = async (
  ctx,
  next
) => {
  try {
    const userId = ctx.from?.id;
    if (!userId) return next();

    const key = `rate_limit:${userId}`;
    const limit = redisConfig.limits.messagePerMinute;
    const ttl = redisConfig.ttl.rateLimit;

    const count = await redisService.get(key);

    if (count && parseInt(count) >= limit) {
      return ctx
        .reply('⚠️ تعداد درخواست‌های شما زیاد است. لطفاً بعداً دوباره تلاش کنید.')
        .catch(() => {});
    }

    // افزایش شمارنده
    await redisService.incr(key);
    await redisService.expire(key, ttl);

    await next();
  } catch (error) {
    logger.error('❌ Rate limit error:', error);
    await next();
  }
};