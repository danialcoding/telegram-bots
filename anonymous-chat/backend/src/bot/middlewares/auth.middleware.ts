import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../config';
import { adminService } from '../../services/admin.service';
import { userService } from '../../services/user.service';
import { Context } from 'telegraf';
import logger from '../../utils/logger';

/**
 * Interface برای JWT Payload
 */
interface JwtPayload {
  userId: number;
  role: 'admin' | 'user';
  iat?: number;
  exp?: number;
}

/**
 * تایید توکن JWT
 */
export async function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'توکن احراز هویت یافت نشد',
      });
    }

    // تایید توکن
    const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;

    // ذخیره اطلاعات کاربر در request
    req.user = {
      id: decoded.userId,
      role: decoded.role,
    };

    next();
  } catch (error) {
    logger.error('❌ Authentication error:', error);
    return res.status(403).json({
      success: false,
      message: 'توکن نامعتبر است',
    });
  }
}

/**
 * چک کردن دسترسی ادمین
 */
export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'احراز هویت نشده',
      });
    }

    // بررسی دسترسی ادمین
    const admin = await adminService.findById(userId);

    if (!admin || !admin.is_active) {
      return res.status(403).json({
        success: false,
        message: 'دسترسی غیرمجاز',
      });
    }

    req.admin = admin;
    next();
  } catch (error) {
    logger.error('❌ Admin check error:', error);
    return res.status(500).json({
      success: false,
      message: 'خطا در بررسی دسترسی',
    });
  }
}

/**
 * بررسی دسترسی Super Admin
 */
export function requireSuperAdmin(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const admin = req.admin;

  if (!admin || admin.role !== 'superadmin') {
    return res.status(403).json({
      success: false,
      message: 'نیاز به دسترسی سوپر ادمین',
    });
  }

  next();
}

/**
 * ✅ Middleware احراز هویت برای ربات تلگرام
 */
export const authMiddleware = async (ctx: Context, next: () => Promise<void>) => {
  const telegramId = ctx.from?.id;
  const username = ctx.from?.username;
  const firstName = ctx.from?.first_name;
  const lastName = ctx.from?.last_name;

  logger.debug('⚠️ Auth Middleware triggered for user:', { telegramId, username });

  if (!telegramId) {
    await ctx.reply('❌ خطا در شناسایی کاربر');
    return;
  }

  try {
    // ✅ 1. پیدا کردن کاربر
    let user = await userService.findByTelegramId(telegramId);

    // ✅ 2. اگر کاربر وجود نداشت، ایجاد کن
    if (!user) {
      logger.info(`👤 New user detected: ${telegramId}`);

      let referrerId: number | undefined;
      
      // ✅ استخراج کد معرف از /start command به صورت دستی
      if (ctx.message && 'text' in ctx.message) {
        const text = ctx.message.text;
        const match = text.match(/^\/start\s+(.+)$/);
        
        if (match && match[1]) {
          const referralCode = match[1];
          logger.debug(`🔗 Referral code detected: ${referralCode}`);

          try {
            const referrer = await userService.findUserByReferralCode(referralCode);
            
            if (referrer && referrer.telegram_id !== telegramId) {
              referrerId = referrer.id;
              logger.info(`✅ Valid referrer found: ${referrerId}`);
            } else {
              logger.warn(`⚠️ Invalid referral code: ${referralCode}`);
            }
          } catch (error) {
            logger.error('❌ Error checking referral code:', error);
          }
        }
      }

      // ✅ ساخت کاربر جدید با فیلدهای صحیح
      user = await userService.create({
        telegram_id: telegramId,           // ✅ با underscore
        username: username || null,
        first_name: firstName || 'کاربر',  // ✅ مقدار پیش‌فرض
        last_name: lastName || null,
      });

      logger.info(`✅ New user created: ${user.id}`, {
        telegramId,
        username,
        hasReferrer: !!referrerId,
      });

      // ✅ ثبت رفرال در صورت وجود معرف
      if (referrerId) {
        try {
          const processed = await userService.processReferral(user.id, referrerId);
          if (processed) {
            logger.info(`✅ Referral processed: ${user.id} referred by ${referrerId}`);
          }
        } catch (error) {
          logger.error('❌ Error processing referral:', error);
        }
      }
    } else {
      // ✅ 3. به‌روزرسانی اطلاعات در صورت تغییر
      if (
        user.username !== username ||
        user.first_name !== firstName ||
        user.last_name !== lastName
      ) {
        try {
          await userService.updateUserInfo(user.id, username, firstName);
          logger.debug(`🔄 User info updated: ${user.id}`);
        } catch (error) {
          logger.error('❌ Error updating user info:', error);
        }
      }

      // ✅ به‌روزرسانی آخرین فعالیت
      try {
        await userService.updateLastActivity(user.id);
      } catch (error) {
        logger.error('❌ Error updating last activity:', error);
      }
    }

    // ✅ 4. چک کردن بلاک بودن
    if (user.is_blocked) {
      const blockDate = user.blocked_at 
        ? new Date(user.blocked_at).toLocaleDateString('fa-IR')
        : 'نامشخص';

      await ctx.reply(
        `🚫 حساب شما مسدود شده است.\n\n` +
        `📋 دلیل: ${user.block_reason || 'نامشخص'}\n` +
        `📅 تاریخ: ${blockDate}\n\n` +
        `💰 جریمه رفع مسدودیت: ${user.unblock_fine || 50} سکه`
      );
      return;
    }

    // ✅ 5. ذخیره اطلاعات کاربر در context
    // دریافت اطلاعات پروفایل برای داشتن gender
    const userWithProfile = await userService.findByIdWithProfile(user.id);
    
    if (userWithProfile) {
      // ترکیب اطلاعات user با profile
      ctx.state.user = {
        ...user,
        gender: userWithProfile.gender,
        age: userWithProfile.age,
        name: userWithProfile.display_name,
        custom_id: userWithProfile.custom_id,
      };
    } else {
      ctx.state.user = user;
    }

    logger.debug(`✅ User authenticated: ${user.id}`, {
      telegramId,
      username,
      hasProfile: await userService.hasProfile(user.id),
    });

    return next();
    
  } catch (error) {
    logger.error('❌ Auth middleware error:', error);
    
    // ✅ نمایش پیام خطای دقیق‌تر
    if (error instanceof Error) {
      logger.error('Error details:', {
        message: error.message,
        stack: error.stack,
      });
    }
    
    await ctx.reply(
      '❌ خطایی در احراز هویت رخ داد.\n' +
      'لطفاً چند لحظه صبر کنید و دوباره تلاش کنید.'
    );
    return;
  }
};

// تعریف Types برای Express
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        role: 'admin' | 'user';
      };
      admin?: any;
    }
  }
}
