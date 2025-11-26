import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../config';
import { adminService } from '../../services/admin.service';
import { MiddlewareFn } from 'telegraf';
import MyContext from '../index';
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

// export const authMiddleware: MiddlewareFn<MyContext> = async (ctx, next) => {
//   try {
//     const userId = ctx.from?.id;

//     if (!userId) {
//       logger.warn('⚠️ Message received without user ID');
//       return;
//     }

//     // اگر کاربر وجود ندارد، ایجاد کن
//     const user = await userService.findById(userId);
//     if (!user) {
//       await userService.create({
//         telegram_id: userId,
//         username: ctx.from.username || `user_${userId}`,
//         first_name: ctx.from.first_name,
//         last_name: ctx.from.last_name || '',
//       });
//       logger.info(`✅ New user registered: ${userId}`);
//     }

//     // ذخیره اطلاعات کاربر در context
//     ctx.user = {
//       id: userId,
//       username: ctx.from.username || `user_${userId}`,
//       first_name: ctx.from.first_name,
//     };

//     await next();
//   } catch (error) {
//     logger.error('❌ Auth middleware error:', error);
//     await next();
//   }
// };


export const authMiddleware = async (ctx: Context, next: () => Promise<void>) => {
  const telegramId = ctx.from?.id;
  const username = ctx.from?.username;
  const firstName = ctx.from?.first_name;
  const lastName = ctx.from?.last_name;

  if (!telegramId) {
    await ctx.reply('❌ خطا در شناسایی کاربر');
    return;
  }

  try {
    // ✅ 1. ابتدا چک کن که کاربر وجود داره یا نه
    let user = await userService.findByTelegramId(telegramId);

    // ✅ 2. اگر کاربر وجود نداشت، ایجاد کن
    if (!user) {
      logger.info(`👤 New user detected: ${telegramId}`);

      // بررسی کد معرف (اگر وجود داشته باشد)
      let referrerId: number | undefined;
      
      if (ctx.startPayload) {
        const referralCode = ctx.startPayload;
        logger.debug(`🔗 Referral code detected: ${referralCode}`);

        try {
          const referrer = await userService.findUserByReferralCode(referralCode);
          
          if (referrer && referrer.id !== telegramId) {
            referrerId = referrer.id;
            logger.info(`✅ Valid referrer found: ${referrerId}`);
          } else {
            logger.warn(`⚠️ Invalid referral code: ${referralCode}`);
          }
        } catch (error) {
          logger.error('❌ Error checking referral code:', error);
        }
      }

      // ایجاد کاربر جدید
      user = await userService.create({
        telegramId,
        username,
        firstName,
        lastName,
        referrerId,
      });

      logger.info(`✅ New user created: ${user.id}`, {
        telegramId,
        username,
        hasReferrer: !!referrerId,
      });
    } else {
      // ✅ 3. اگر کاربر وجود داشت، اطلاعات رو به‌روز کن
      if (
        user.username !== username ||
        user.first_name !== firstName ||
        user.last_name !== lastName
      ) {
        await userService.updateUserInfo(
          user.id,
          username,
          firstName,
        );

        logger.debug(`🔄 User profile updated: ${user.id}`);
      }
    }

    // ✅ 4. چک کردن وضعیت کاربر
    if (user.is_blocked) {
      await ctx.reply(
        `🚫 حساب شما مسدود شده است.\n\n` +
        `📋 دلیل: ${user.block_reason || 'نامشخص'}\n` +
        `📅 تاریخ: ${user.blocked_at ? new Date(user.blocked_at).toLocaleDateString('fa-IR') : 'نامشخص'}`
      );
      return;
    }

    // ✅ 5. ذخیره اطلاعات کاربر در context
    ctx.state.user = user;

    logger.debug(`✅ User authenticated: ${user.id}`, {
      telegramId,
      username,
      hasProfile: userService.hasProfile(user.id),
    });

    return next();
  } catch (error) {
    logger.error('❌ Auth middleware error:', error);
    await ctx.reply('❌ خطایی رخ داد. لطفاً دوباره تلاش کنید.');
    return;
  }
};

// // تعریف User Interface در Context
// declare global {
//   namespace Express {
//     interface Request {
//       user?: {
//         id: number;
//         username: string;
//         first_name?: string;
//       };
//       admin?: any;
//     }
//   }
// }

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
