import { MyContext } from "../../types/bot.types";
import { getBalance, getCoinInfo } from "../../services/coin.service";
import { COIN_REWARDS } from "../../utils/constants";
import { Markup } from "telegraf";
import logger from "../../utils/logger";
import path from "path";
import fs from "fs";

const COIN_BANNER_PATH = path.join(
  __dirname,
  "../../../public/images/coins-banner.jpg"
);

const INVITE_BANNER_PATH = path.join(
  __dirname,
  "../../../public/images/invite-banner.jpg"
);

// ✅ خواندن پکیج‌ها از .env
const parsePackage = (envValue: string | undefined, defaultCoins: number, defaultStars: number) => {
  if (!envValue) return { coins: defaultCoins, stars: defaultStars };
  const [coins, stars] = envValue.split(':').map(Number);
  return { coins: coins || defaultCoins, stars: stars || defaultStars };
};

const PACKAGES = {
  bronze: parsePackage(process.env.COIN_PACKAGE_BRONZE, 50, 10),
  silver: parsePackage(process.env.COIN_PACKAGE_SILVER, 120, 20),
  gold: parsePackage(process.env.COIN_PACKAGE_GOLD, 300, 40),
  diamond: parsePackage(process.env.COIN_PACKAGE_DIAMOND, 750, 80),
};

const PAYMENT_TEST_MODE = process.env.PAYMENT_TEST_MODE === 'true';

export class CoinHandler {
  /**
   * ✅ نمایش صفحه سکه‌ها
   */
  async showCoinsPage(ctx: MyContext) {
    const user = ctx.state.user;

    try {
      const balance = await getBalance(user.id);
      const coinInfo = await getCoinInfo(user.id);

      const coinsText =
        `💰 سکه‌های شما\n\n` +
        `💎 موجودی فعلی: ${balance} سکه\n\n` +
        `📊 آمار:\n` +
        `• کل سکه‌های دریافتی: ${coinInfo.total_earned}\n` +
        `• کل سکه‌های خرج شده: ${coinInfo.total_spent}\n` +
        `• کل سکه‌های خریداری شده: ${coinInfo.total_purchased}\n\n` +
        `💡 راه‌های کسب سکه:\n` +
        `🎁 دعوت دوستان: 20 سکه\n` +
        `💳 خرید سکه: مبالغ مختلف\n` +
        `🎉 هدیه ثبت نام: 50 سکه`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback("💳 خرید سکه", "buy_coins")],
        [Markup.button.callback("🎁 دعوت دوستان", "invite_friends")],
        [Markup.button.callback("🔙 بازگشت به منو", "main_menu")],
      ]);

      // ارسال با بنر اگر وجود دارد
      if (fs.existsSync(COIN_BANNER_PATH)) {
        await ctx.replyWithPhoto(
          { source: COIN_BANNER_PATH },
          {
            caption: coinsText,
            ...keyboard,
          }
        );
      } else {
        await ctx.reply(coinsText, keyboard);
      }

      logger.info(`✅ Coins page shown to user ${user.id}`);
    } catch (error) {
      logger.error("❌ Show coins page error:", error);
      await ctx.reply("⚠️ خطا در نمایش صفحه سکه‌ها");
    }
  }

  /**
   * ✅ نمایش صفحه دعوت دوستان
   */
  async showInvitePage(ctx: MyContext, deleteMessage: boolean = false) {
    const user = ctx.state.user;

    try {
      // حذف پیام قبلی اگر درخواست شده باشد
      if (deleteMessage && ctx.callbackQuery) {
        try {
          await ctx.deleteMessage();
        } catch (error) {
          logger.debug('Could not delete message:', error);
        }
      }

      // لینک دعوت با referral code
      const botUsername = ctx.botInfo?.username || "your_bot";
      const inviteLink = `https://t.me/${botUsername}?start=${user.referral_code}`;

      const inviteText =
        `🎁 دعوت دوستان\n\n` +
        `به ازای هر دوست که از طریق لینک شما وارد ربات شود و پروفایل خود را تکمیل کند، ` +
        `هم شما و هم دوست شما ${COIN_REWARDS.REFERRAL} سکه هدیه دریافت می‌کنید! 🎉\n\n` +
        `📱 درباره ربات:\n` +
        `• چت ناشناس با افراد جدید\n` +
        `• پروفایل شخصی و جذاب\n` +
        `• سیستم لایک و مخاطبین\n` +
        `• پیام‌های دایرکت\n` +
        `• امکانات متنوع و جذاب\n\n` +
        `👥 تعداد دعوت‌های موفق شما: ${user.successful_referrals || 0}\n` +
        `💰 سکه‌های کسب شده: ${(user.successful_referrals || 0) * 10}\n\n` +
        `🔗 لینک دعوت شما:\n` +
        `${inviteLink}`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.url("📤 اشتراک‌گذاری لینک", `https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent('به ربات چت ناشناس بپیوند! 🎉')}`)],
        [Markup.button.callback("🔙 بازگشت", "view_coins")],
      ]);

      // ارسال با بنر اگر وجود دارد
      if (fs.existsSync(INVITE_BANNER_PATH)) {
        await ctx.replyWithPhoto(
          { source: INVITE_BANNER_PATH },
          {
            caption: inviteText,
            ...keyboard,
          }
        );
      } else {
        await ctx.reply(inviteText, keyboard);
      }

      logger.info(`✅ Invite page shown to user ${user.id}`);
    } catch (error) {
      logger.error("❌ Show invite page error:", error);
      await ctx.reply("⚠️ خطا در نمایش صفحه دعوت");
    }
  }

  /**
   * ✅ نمایش صفحه خرید سکه با پکیج‌ها
   */
  async showBuyCoinsPage(ctx: MyContext, deleteMessage: boolean = false) {
    try {
      await ctx.answerCbQuery();

      // حذف پیام قبلی اگر درخواست شده باشد
      if (deleteMessage && ctx.callbackQuery) {
        try {
          await ctx.deleteMessage();
        } catch (error) {
          logger.debug('Could not delete message:', error);
        }
      }

      const testModeNotice = PAYMENT_TEST_MODE 
        ? `\n⚠️ حالت تست: سکه‌ها بدون پرداخت اضافه می‌شوند\n` 
        : '';
      
      const buyText =
        `💳 خرید سکه با Telegram Stars\n\n` +
        `⭐ پکیج‌های موجود:\n\n` +
        `🥉 پکیج برنزی\n` +
        `${PACKAGES.bronze.coins} سکه - ${PACKAGES.bronze.stars} ستاره ⭐\n\n` +
        `🥈 پکیج نقره‌ای\n` +
        `${PACKAGES.silver.coins} سکه - ${PACKAGES.silver.stars} ستاره ⭐\n` +
        `🎁 ${Math.round((1 - (PACKAGES.silver.stars / PACKAGES.silver.coins) / (PACKAGES.bronze.stars / PACKAGES.bronze.coins)) * 100)}% تخفیف!\n\n` +
        `🥇 پکیج طلایی\n` +
        `${PACKAGES.gold.coins} سکه - ${PACKAGES.gold.stars} ستاره ⭐\n` +
        `🎁 ${Math.round((1 - (PACKAGES.gold.stars / PACKAGES.gold.coins) / (PACKAGES.bronze.stars / PACKAGES.bronze.coins)) * 100)}% تخفیف!\n\n` +
        `💎 پکیج الماس\n` +
        `${PACKAGES.diamond.coins} سکه - ${PACKAGES.diamond.stars} ستاره ⭐\n` +
        `🎁 ${Math.round((1 - (PACKAGES.diamond.stars / PACKAGES.diamond.coins) / (PACKAGES.bronze.stars / PACKAGES.bronze.coins)) * 100)}% تخفیف!\n` +
        testModeNotice + `\n` +
        `لطفاً پکیج مورد نظر خود را انتخاب کنید:`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback(`🥉 ${PACKAGES.bronze.coins} سکه - ${PACKAGES.bronze.stars}⭐`, "buy_package_bronze")],
        [Markup.button.callback(`🥈 ${PACKAGES.silver.coins} سکه - ${PACKAGES.silver.stars}⭐`, "buy_package_silver")],
        [Markup.button.callback(`🥇 ${PACKAGES.gold.coins} سکه - ${PACKAGES.gold.stars}⭐`, "buy_package_gold")],
        [Markup.button.callback(`💎 ${PACKAGES.diamond.coins} سکه - ${PACKAGES.diamond.stars}⭐`, "buy_package_diamond")],
        [Markup.button.callback("🔙 بازگشت", "view_coins")],
      ]);

      await ctx.reply(buyText, keyboard);
    } catch (error) {
      logger.error("❌ Show buy coins page error:", error);
    }
  }

  /**
   * ✅ نمایش تأیید خرید پکیج
   */
  async showPackageConfirmation(ctx: MyContext, packageType: string) {
    try {
      await ctx.answerCbQuery();

      const packageMap: Record<string, { coins: number; stars: number; emoji: string }> = {
        'bronze': { ...PACKAGES.bronze, emoji: '🥉' },
        'silver': { ...PACKAGES.silver, emoji: '🥈' },
        'gold': { ...PACKAGES.gold, emoji: '🥇' },
        'diamond': { ...PACKAGES.diamond, emoji: '💎' },
      };

      const pkg = packageMap[packageType];
      if (!pkg) return;

      const testModeNotice = PAYMENT_TEST_MODE 
        ? `\n\n⚠️ حالت تست فعال است - سکه بدون پرداخت اضافه می‌شود` 
        : '';

      const confirmText =
        `${pkg.emoji} تأیید خرید\n\n` +
        `💰 تعداد سکه: ${pkg.coins}\n` +
        `⭐ مبلغ پرداختی: ${pkg.stars} ستاره\n` +
        testModeNotice + `\n\n` +
        `آیا از خرید این پکیج اطمینان دارید؟`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback(PAYMENT_TEST_MODE ? "✅ دریافت (تست)" : "✅ پرداخت", `pay_package_${packageType}`)],
        [Markup.button.callback("🔙 بازگشت", "buy_coins")],
      ]);

      try {
        await ctx.deleteMessage();
      } catch (error) {
        logger.debug('Could not delete message:', error);
      }

      await ctx.reply(confirmText, keyboard);
    } catch (error) {
      logger.error("❌ Show package confirmation error:", error);
    }
  }

  /**
   * ✅ پردازش پرداخت با Telegram Stars
   */
  async processPayment(ctx: MyContext, packageType: string) {
    try {
      await ctx.answerCbQuery();

      const packageMap: Record<string, { coins: number; stars: number; title: string; description: string }> = {
        'bronze': { 
          ...PACKAGES.bronze,
          title: '🥉 پکیج برنزی',
          description: `${PACKAGES.bronze.coins} سکه برای چت و امکانات ربات`
        },
        'silver': { 
          ...PACKAGES.silver,
          title: '🥈 پکیج نقره‌ای',
          description: `${PACKAGES.silver.coins} سکه با تخفیف ویژه`
        },
        'gold': { 
          ...PACKAGES.gold,
          title: '🥇 پکیج طلایی',
          description: `${PACKAGES.gold.coins} سکه با تخفیف عالی`
        },
        'diamond': { 
          ...PACKAGES.diamond,
          title: '💎 پکیج الماس',
          description: `${PACKAGES.diamond.coins} سکه با بیشترین تخفیف`
        },
      };

      const pkg = packageMap[packageType];
      if (!pkg) {
        await ctx.reply('⚠️ پکیج انتخابی نامعتبر است.');
        return;
      }

      // حالت تست: مستقیماً سکه اضافه می‌کنیم
      if (PAYMENT_TEST_MODE) {
        const user = ctx.state.user;
        const { addCoins } = await import('../../services/coin.service');
        await addCoins(
          user.id, // استفاده از user.id به جای ctx.from.id
          pkg.coins,
          'purchase',
          `خرید تستی ${pkg.coins} سکه (${pkg.stars} ستاره)`,
          null
        );

        await ctx.reply(
          `✅ خرید تستی موفق!\n\n` +
          `💰 ${pkg.coins} سکه به حساب شما اضافه شد.\n` +
          `⭐ مبلغ شبیه‌سازی شده: ${pkg.stars} ستاره\n\n` +
          `⚠️ این یک تراکنش تستی بود و هیچ پرداختی انجام نشده است.`
        );

        logger.info(`💰 Test purchase: ${pkg.coins} coins added to user ${user.id}`);
        return;
      }

      // حالت واقعی: ارسال invoice برای پرداخت با Stars
      await ctx.replyWithInvoice({
        title: pkg.title,
        description: pkg.description,
        payload: `coin_package_${packageType}_${ctx.from?.id}`,
        provider_token: process.env.PAYMENT_PROVIDER_TOKEN || '',
        currency: 'XTR', // Telegram Stars currency
        prices: [{ label: pkg.title, amount: pkg.stars }],
      });

      logger.info(`💳 Payment invoice sent to user ${ctx.from?.id} for package ${packageType}`);
    } catch (error) {
      logger.error("❌ Process payment error:", error);
      await ctx.reply('⚠️ خطا در ایجاد فاکتور پرداخت. لطفاً دوباره تلاش کنید.');
    }
  }

  /**
   * ✅ نمایش کیبورد سکه هنگام کمبود موجودی
   */
  async showInsufficientCoinsMessage(ctx: MyContext, requiredCoins: number) {
    const user = ctx.state.user;

    try {
      const balance = await getBalance(user.id);

      const insufficientText =
        `⚠️ موجودی سکه کافی نیست!\n\n` +
        `💰 موجودی فعلی: ${balance} سکه\n` +
        `💎 مورد نیاز: ${requiredCoins} سکه\n` +
        `❌ کمبود: ${requiredCoins - balance} سکه\n\n` +
        `💡 برای دریافت سکه:\n` +
        `🎁 دعوت دوستان: 20 سکه رایگان\n` +
        `💳 خرید سکه: مبالغ مختلف`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback("💳 خرید سکه", "buy_coins")],
        [Markup.button.callback("🎁 دعوت دوستان", "invite_friends")],
        [Markup.button.callback("🔙 بازگشت", "main_menu")],
      ]);

      await ctx.reply(insufficientText, keyboard);
    } catch (error) {
      logger.error("❌ Show insufficient coins error:", error);
    }
  }
}

export const coinHandler = new CoinHandler();
