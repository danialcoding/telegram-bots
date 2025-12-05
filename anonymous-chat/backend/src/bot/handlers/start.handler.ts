import { Context } from 'telegraf';
import { mainMenuKeyboard } from '../keyboards/main.keyboard';
import { userService } from '../../services/user.service';
import logger from '../../utils/logger';

/**
 * Handler دستور /start
 */
export const startHandler = async (ctx: Context) => {
  try {
    const telegramId = ctx.from?.id;
    const username = ctx.from?.username;
    const firstName = ctx.from?.first_name;
    const lastName = ctx.from?.last_name;

    if (!telegramId) {
      return ctx.reply('❌ خطا در شناسایی کاربر');
    }

    // ✅ 1. پیدا کردن کاربر
    let user = await userService.findByTelegramId(telegramId);

    // ✅ 2. اگر کاربر جدیده، ایجاد کن
    if (!user) {
      logger.info(`📝 Creating new user: ${telegramId}`);

      // بررسی کد رفرال
      let referrerId: number | undefined;
      const startParam = ctx.message && 'text' in ctx.message
        ? ctx.message.text.split(' ')[1]
        : null;

      if (startParam) {
        // حذف پیشوند ref_ اگر وجود داشت
        const referralCode = startParam.startsWith('ref_') 
          ? startParam.replace('ref_', '') 
          : startParam;
        
        try {
          const referrer = await userService.findByReferralCode(referralCode);
          
          if (referrer && referrer.telegram_id !== telegramId) {
            referrerId = referrer.id;
            logger.info(`✅ Valid referrer found: ${referrerId} (code: ${referralCode})`);
          }
        } catch (error) {
          logger.error('❌ Error checking referral code:', error);
        }
      }

      // ✅ ایجاد کاربر با Interface صحیح
      user = await userService.create({
        telegramId,      // ✅ camelCase
        username,
        firstName,       // ✅ camelCase
        lastName,        // ✅ camelCase
        referrerId,
      });

      // ✅ پیام خوش‌آمدگویی برای کاربر جدید (بدون ذکر لینک دعوت)
      const welcomeText = 
        `🎊 ${firstName} عزیز، خوش آمدید!\n\n` +
        '📝 لطفاً ابتدا پروفایل خود را تکمیل کنید:\n' +
        '• روی "👤 پروفایل من" کلیک کنید\n' +
        '• اطلاعات خود را وارد کنید\n' +
        '• عکس پروفایل آپلود کنید\n\n' +
        '🎁 با تکمیل پروفایل 10 سکه هدیه دریافت می‌کنید!';
      
      await ctx.reply(welcomeText, mainMenuKeyboard());
    } else {
      // ✅ 3. به‌روزرسانی اطلاعات کاربر
      if (
        user.username !== username ||
        user.first_name !== firstName ||
        user.last_name !== lastName
      ) {
        await userService.updateProfile(user.id, {
          username,
          firstName,
          lastName,
        });
      }
    }

    if (!user) {
      logger.error('❌ Failed to create/find user');
      return ctx.reply('❌ خطا در ایجاد حساب کاربری');
    }

    // ✅ 4. چک کردن وجود پروفایل
    const hasProfile = await userService.hasProfile(user.id);

    // پیام خوش‌آمدگویی
    if (hasProfile) {
      // کاربر قدیمی با پروفایل
      const welcomeMessage = `سلام ${firstName} عزیز! 👋\n\n` +
        '🎉 به ربات چت تصادفی خوش آمدید.\n' +
        'از منوی زیر گزینه مورد نظرتان را انتخاب کنید.';
      
      await ctx.reply(welcomeMessage, mainMenuKeyboard());
    } else {
      // کاربر قدیمی بدون پروفایل
      const welcomeText = 
        `سلام ${firstName} عزیز! 👋\n\n` +
        '📝 لطفاً ابتدا پروفایل خود را تکمیل کنید:\n' +
        '• روی "👤 پروفایل من" کلیک کنید\n' +
        '• اطلاعات خود را وارد کنید\n' +
        '• عکس پروفایل آپلود کنید\n\n' +
        '🎁 با تکمیل پروفایل 10 سکه هدیه دریافت می‌کنید!';
      
      await ctx.reply(welcomeText, mainMenuKeyboard());
    }

    logger.info('User opened bot:', { 
      userId: user.id, 
      hasProfile 
    });

  } catch (error) {
    logger.error('❌ Start handler error:', error);
    await ctx.reply('⚠️ خطایی رخ داد. لطفا دوباره تلاش کنید.');
  }
};
