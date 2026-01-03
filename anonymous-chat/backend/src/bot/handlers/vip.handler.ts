import { Context } from 'telegraf';
import { vipPurchaseKeyboard, confirmVipPurchaseKeyboard } from '../keyboards/vip.keyboard';
import { userService } from '../../services/user.service';
import { VIP_SUBSCRIPTION } from '../../utils/constants';
import logger from '../../utils/logger';

/**
 * نمایش منوی خرید اشتراک VIP
 */
export async function showVipPurchaseMenu(ctx: Context) {
  try {
    if (!ctx.from) return;

    const user = (ctx as any).state.user;
    if (!user) return;

    // بررسی وضعیت VIP فعلی
    const vipStatus = await userService.checkVipStatus(user.id);

    let message = `👑 *خرید اشتراک VIP*\n\n`;

    if (vipStatus.isVip && vipStatus.expiresAt) {
      const expiresDate = new Date(vipStatus.expiresAt);
      const persianDate = toPersianDate(expiresDate);
      message += `✅ شما در حال حاضر عضو VIP هستید\n`;
      message += `📅 اشتراک تا ${persianDate} فعال است\n\n`;
      message += `🔄 برای تمدید یا افزایش اشتراک، یکی از گزینه‌های زیر را انتخاب کنید:\n\n`;
    } else {
      message += `با خرید اشتراک VIP از امکانات ویژه زیر لذت ببرید:\n\n`;
      message += `🎮 دسترسی به بازی‌های VIP\n`;
      message += `👤 نشان VIP در پروفایل\n`;
      message += `🎯 امکانات ویژه در آینده\n\n`;
    }

    message += `پکیج مورد نظر خود را انتخاب کنید:`;

    if (ctx.callbackQuery) {
      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...vipPurchaseKeyboard()
      });
    } else {
      await ctx.reply(message, {
        parse_mode: 'Markdown',
        ...vipPurchaseKeyboard()
      });
    }
  } catch (error) {
    logger.error('❌ Error showing VIP purchase menu:', error);
    await ctx.reply('❌ خطا در نمایش منوی خرید VIP');
  }
}

/**
 * مدیریت انتخاب پکیج VIP
 */
export async function selectVipPackage(ctx: Context, duration: string) {
  try {
    if (!ctx.from || !ctx.callbackQuery) return;

    let price = 0;
    let durationText = '';

    switch (duration) {
      case '1_month':
        price = VIP_SUBSCRIPTION.PRICES.ONE_MONTH;
        durationText = '1 ماه';
        break;
      case '3_months':
        price = VIP_SUBSCRIPTION.PRICES.THREE_MONTHS;
        durationText = '3 ماه';
        break;
      case '6_months':
        price = VIP_SUBSCRIPTION.PRICES.SIX_MONTHS;
        durationText = '6 ماه';
        break;
      case '12_months':
        price = VIP_SUBSCRIPTION.PRICES.TWELVE_MONTHS;
        durationText = '12 ماه';
        break;
      default:
        await ctx.answerCbQuery('❌ پکیج نامعتبر', { show_alert: true });
        return;
    }

    const message =
      `👑 *تایید خرید اشتراک VIP*\n\n` +
      `⏱️ مدت: ${durationText}\n` +
      `⭐ قیمت: ${price} ستاره تلگرام\n\n` +
      `آیا می‌خواهید این اشتراک را خریداری کنید؟`;

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      ...confirmVipPurchaseKeyboard(duration, price)
    });
  } catch (error) {
    logger.error('❌ Error selecting VIP package:', error);
  }
}

/**
 * تایید و پرداخت اشتراک VIP
 */
export async function confirmVipPurchase(ctx: Context, duration: string) {
  try {
    if (!ctx.from || !ctx.callbackQuery) return;

    let price = 0;
    let durationDays = 0;
    let durationText = '';

    switch (duration) {
      case '1_month':
        price = VIP_SUBSCRIPTION.PRICES.ONE_MONTH;
        durationDays = VIP_SUBSCRIPTION.DURATIONS.ONE_MONTH;
        durationText = '1 ماه';
        break;
      case '3_months':
        price = VIP_SUBSCRIPTION.PRICES.THREE_MONTHS;
        durationDays = VIP_SUBSCRIPTION.DURATIONS.THREE_MONTHS;
        durationText = '3 ماه';
        break;
      case '6_months':
        price = VIP_SUBSCRIPTION.PRICES.SIX_MONTHS;
        durationDays = VIP_SUBSCRIPTION.DURATIONS.SIX_MONTHS;
        durationText = '6 ماه';
        break;
      case '12_months':
        price = VIP_SUBSCRIPTION.PRICES.TWELVE_MONTHS;
        durationDays = VIP_SUBSCRIPTION.DURATIONS.TWELVE_MONTHS;
        durationText = '12 ماه';
        break;
      default:
        await ctx.answerCbQuery('❌ پکیج نامعتبر', { show_alert: true });
        return;
    }

    const user = (ctx as any).state.user;
    if (!user) return;

    // بررسی حالت تست
    const isTestMode = process.env.PAYMENT_TEST_MODE === 'true';

    if (isTestMode) {
      // حالت تست: مستقیم فعال می‌کنیم
      await userService.activateVipSubscription(user.id, durationDays);

      const vipStatus = await userService.checkVipStatus(user.id);
      const expiresDate = vipStatus.expiresAt ? new Date(vipStatus.expiresAt) : new Date();
      const persianDate = toPersianDate(expiresDate);

      await ctx.editMessageText(
        `✅ *اشتراک VIP فعال شد!*\n\n` +
        `⏱️ مدت: ${durationText}\n` +
        `📅 اعتبار تا: ${persianDate}\n\n` +
        `⚠️ حالت تست: این خرید واقعی نیست`,
        { parse_mode: 'Markdown' }
      );
    } else {
      // حالت واقعی: ارسال invoice با Telegram Stars
      try {
        await ctx.replyWithInvoice({
          title: `اشتراک VIP ${durationText}`,
          description: `خرید اشتراک VIP به مدت ${durationText}`,
          payload: `vip_${duration}_${user.id}`,
          provider_token: '', // برای Telegram Stars خالی است
          currency: 'XTR', // Telegram Stars currency
          prices: [
            {
              label: `اشتراک VIP ${durationText}`,
              amount: price
            }
          ]
        });

        await ctx.answerCbQuery('لطفا invoice را پرداخت کنید');
      } catch (error) {
        logger.error('❌ Error sending invoice:', error);
        await ctx.answerCbQuery('❌ خطا در ارسال فاکتور پرداخت', { show_alert: true });
      }
    }
  } catch (error) {
    logger.error('❌ Error confirming VIP purchase:', error);
    await ctx.answerCbQuery('❌ خطا در پردازش خرید', { show_alert: true });
  }
}

/**
 * مدیریت موفقیت پرداخت (Pre-checkout query)
 */
export async function handlePreCheckoutQuery(ctx: Context) {
  try {
    if (!ctx.preCheckoutQuery) return;

    // تایید پرداخت
    await ctx.answerPreCheckoutQuery(true);
  } catch (error) {
    logger.error('❌ Error handling pre-checkout query:', error);
    await ctx.answerPreCheckoutQuery(false, 'خطا در پردازش پرداخت');
  }
}

/**
 * مدیریت پرداخت موفق
 */
export async function handleSuccessfulPayment(ctx: Context) {
  try {
    if (!ctx.message || !('successful_payment' in ctx.message)) return;
    if (!ctx.from) return;

    const payment = ctx.message.successful_payment;
    const payload = payment.invoice_payload;

    // پارس کردن payload: vip_1_month_123
    const parts = payload.split('_');
    if (parts[0] !== 'vip' || parts.length < 4) {
      logger.error('Invalid payment payload:', payload);
      return;
    }

    const userId = parseInt(parts[3]);
    if (isNaN(userId)) {
      logger.error('Invalid user ID in payload:', payload);
      return;
    }

    const duration = `${parts[1]}_${parts[2]}`; // مثل: 1_month

    let durationDays = 0;
    let durationText = '';

    switch (duration) {
      case '1_month':
        durationDays = VIP_SUBSCRIPTION.DURATIONS.ONE_MONTH;
        durationText = '1 ماه';
        break;
      case '3_months':
        durationDays = VIP_SUBSCRIPTION.DURATIONS.THREE_MONTHS;
        durationText = '3 ماه';
        break;
      case '6_months':
        durationDays = VIP_SUBSCRIPTION.DURATIONS.SIX_MONTHS;
        durationText = '6 ماه';
        break;
      case '12_months':
        durationDays = VIP_SUBSCRIPTION.DURATIONS.TWELVE_MONTHS;
        durationText = '12 ماه';
        break;
      default:
        logger.error('Invalid duration in payload:', duration);
        return;
    }

    // فعال‌سازی اشتراک VIP
    await userService.activateVipSubscription(userId, durationDays);

    const vipStatus = await userService.checkVipStatus(userId);
    const expiresDate = vipStatus.expiresAt ? new Date(vipStatus.expiresAt) : new Date();
    const persianDate = toPersianDate(expiresDate);

    await ctx.reply(
      `✅ *پرداخت موفق!*\n\n` +
      `👑 اشتراک VIP شما با موفقیت فعال شد\n\n` +
      `⏱️ مدت: ${durationText}\n` +
      `📅 اعتبار تا: ${persianDate}\n\n` +
      `از خرید شما متشکریم! 🎉`,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    logger.error('❌ Error handling successful payment:', error);
    await ctx.reply('❌ خطا در فعال‌سازی اشتراک. لطفا با پشتیبانی تماس بگیرید');
  }
}

/**
 * انصراف از خرید VIP
 */
export async function cancelVipPurchase(ctx: Context) {
  try {
    if (!ctx.callbackQuery) return;

    await showVipPurchaseMenu(ctx);
  } catch (error) {
    logger.error('❌ Error canceling VIP purchase:', error);
  }
}

/**
 * بازگشت به منوی اصلی
 */
export async function backToMainMenu(ctx: Context) {
  try {
    if (!ctx.callbackQuery) return;

    await ctx.deleteMessage();
    await ctx.answerCbQuery('بازگشت به منوی اصلی');
  } catch (error) {
    logger.error('❌ Error going back to main menu:', error);
  }
}

/**
 * تبدیل تاریخ میلادی به شمسی
 */
function toPersianDate(date: Date): string {
  try {
    const jalaali = require('jalaali-js');
    const gregorian = {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate()
    };
    const jalali = jalaali.toJalaali(gregorian.year, gregorian.month, gregorian.day);
    
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    
    return `${jalali.jy}/${String(jalali.jm).padStart(2, '0')}/${String(jalali.jd).padStart(2, '0')} ساعت ${hour}:${minute}`;
  } catch (error) {
    logger.error('❌ Error converting to Persian date:', error);
    return date.toLocaleString('fa-IR');
  }
}

export const vipHandlers = {
  showVipPurchaseMenu,
  selectVipPackage,
  confirmVipPurchase,
  handlePreCheckoutQuery,
  handleSuccessfulPayment,
  cancelVipPurchase,
  backToMainMenu,
};
