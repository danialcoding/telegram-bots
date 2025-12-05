// src/bot/index.ts
import { Telegraf, session } from "telegraf";
import { message } from "telegraf/filters";
import { config } from "../config/index";
import logger from "../utils/logger";
import db from "../services/database.service";
import redisService from "../services/redis.service";

// Types
import { MyContext, SessionData } from "../types/bot.types";

// Handlers
import { startHandler } from "./handlers/start.handler";
import { profileHandlers } from "./handlers/profile.handler";
import { coinHandler } from "./handlers/coin.handler";

// Middlewares
import { authMiddleware } from "./middlewares/auth.middleware";
import { rateLimitMiddleware } from "./middlewares/rate-limit.middleware";

class TelegramBot {
  public bot: Telegraf<MyContext>;

  constructor() {
    this.bot = new Telegraf<MyContext>(config.bot.token);
    this.setupMiddlewares();
    this.setupHandlers();
    this.setupErrorHandling();
  }

  private setupMiddlewares(): void {
    this.bot.use(
      session<SessionData, MyContext>({
        defaultSession: () => ({}),
      })
    );

    this.bot.use(rateLimitMiddleware);
    this.bot.use(authMiddleware);

    logger.info("✅ Bot middlewares loaded");
  }

  private setupHandlers(): void {
    // ===================================
    // 🎯 COMMANDS
    // ===================================
    this.bot.command("start", startHandler);

    // ===================================
    // 🔘 MAIN KEYBOARD BUTTONS
    // ===================================
    this.bot.hears("👤 پروفایل من", async (ctx) => {
      logger.info(`📱 User ${ctx.from?.id} clicked Profile button`);
      return profileHandlers.showProfileMenu(ctx);
    });

    this.bot.hears("🔍 جستجو", async (ctx) => {
      await ctx.reply("🔍 بخش جستجو به زودی فعال می‌شود...");
    });

    this.bot.hears("💰 سکه‌ها", async (ctx) => {
      return coinHandler.showCoinsPage(ctx);
    });

    this.bot.hears("🎁 دعوت دوستان", async (ctx) => {
      return coinHandler.showInvitePage(ctx);
    });

    this.bot.hears("💬 چت‌های من", async (ctx) => {
      await ctx.reply("💬 بخش چت‌ها به زودی فعال می‌شود...");
    });

    this.bot.hears("⚙️ تنظیمات", async (ctx) => {
      await ctx.reply("⚙️ بخش تنظیمات به زودی فعال می‌شود...");
    });

    // ===================================
    // 📋 PROFILE ACTIONS
    // ===================================
    
    // ✅ Profile callback actions (عمومی - مانند gender, province, city, bio, photo)
    this.bot.action(/^profile_.*/, (ctx) =>
      profileHandlers.handleActions(ctx)
    );

    // ✅ مشاهده پروفایل کاربر
    this.bot.action(/^view_profile_(\d+)$/, async (ctx) => {
      const targetUserId = parseInt(ctx.match[1]);
      await ctx.answerCbQuery();
      await profileHandlers.showUserProfile(ctx, targetUserId);
    });

    // ===================================
    // 🚫 BLOCK ACTIONS
    // ===================================
    
    // ✅ بلاک کردن کاربر
    this.bot.action(/^block_user_(\d+)$/, async (ctx) => {
      const targetUserId = parseInt(ctx.match[1]);
      await profileHandlers.handleBlockUser(ctx, targetUserId);
    });

    // ✅ آنبلاک کردن کاربر
    this.bot.action(/^unblock_user_(\d+)$/, async (ctx) => {
      const targetUserId = parseInt(ctx.match[1]);
      await profileHandlers.handleUnblockUser(ctx, targetUserId);
    });

    // ✅ نمایش لیست بلاک شده‌ها
    this.bot.action("show_blocked_users", async (ctx) => {
      await ctx.answerCbQuery();
      await profileHandlers.showBlockedUsers(ctx, 1);
    });

    // ✅ صفحه‌بندی بلاک شده‌ها
    this.bot.action(/^blocked_page_(\d+)$/, async (ctx) => {
      const page = parseInt(ctx.match[1]);
      await ctx.answerCbQuery();
      await profileHandlers.showBlockedUsers(ctx, page);
    });

    // ===================================
    // 💖 LIKE ACTIONS
    // ===================================
    
    // ✅ تاگل لایک
    this.bot.action(/^like_toggle_(\d+)$/, async (ctx) => {
      await profileHandlers.handleLikeToggle(ctx);
    });

    // ✅ نمایش لایک کننده‌ها
    this.bot.action("profile_view_likers", async (ctx) => {
      await ctx.answerCbQuery();
      await profileHandlers.showLikers(ctx, 1);
    });

    // ✅ صفحه‌بندی لایک کننده‌ها
    this.bot.action(/^likers_page_(\d+)$/, async (ctx) => {
      const page = parseInt(ctx.match[1]);
      await ctx.answerCbQuery();
      await profileHandlers.showLikers(ctx, page);
    });

    // ===================================
    // 👥 CONTACT ACTIONS
    // ===================================
    
    // ✅ تاگل مخاطب (افزودن/حذف)
    this.bot.action(/^contact_toggle_(\d+)$/, async (ctx) => {
      await profileHandlers.handleContactToggle(ctx);
    });

    // ✅ نمایش لیست مخاطبین
    this.bot.action("show_contacts", async (ctx) => {
      await ctx.answerCbQuery();
      await profileHandlers.showContacts(ctx, 1);
    });
    
    // ✅ نمایش لیست مخاطبین (alias)
    this.bot.action("contacts_list", async (ctx) => {
      await ctx.answerCbQuery();
      await profileHandlers.showContacts(ctx, 1);
    });

    // ✅ صفحه‌بندی مخاطبین
    this.bot.action(/^contacts_page_(\d+)$/, async (ctx) => {
      const page = parseInt(ctx.match[1]);
      await ctx.answerCbQuery();
      await profileHandlers.showContacts(ctx, page);
    });

    // ✅ نمایش فقط علاقه‌مندی‌ها
    this.bot.action("show_favorites", async (ctx) => {
      await ctx.answerCbQuery();
      await profileHandlers.showFavorites(ctx);
    });

    // ✅ تاگل علاقه‌مندی (ستاره)
    this.bot.action(/^toggle_favorite_(\d+)$/, async (ctx) => {
      await profileHandlers.handleFavoriteToggle(ctx);
    });

    // ✅ حذف از علاقه‌مندی‌ها
    this.bot.action(/^remove_favorite_(\d+)$/, async (ctx) => {
      await profileHandlers.handleRemoveFavorite(ctx);
    });

    // ✅ رفرش لیست مخاطبین
    this.bot.action("contacts_refresh", async (ctx) => {
      await ctx.answerCbQuery("🔄 در حال به‌روزرسانی...");
      await profileHandlers.showContacts(ctx);
    });

    // ===================================
    // 💬 CHAT & DIRECT ACTIONS
    // ===================================
    
    // ✅ درخواست چت
    this.bot.action(/^start_chat_(\d+)$/, async (ctx) => {
      const targetUserId = parseInt(ctx.match[1]);
      await ctx.answerCbQuery("💬 بخش چت به زودی فعال می‌شود...");
    });

    // ✅ ارسال دایرکت
    this.bot.action(/^send_direct_(\d+)$/, async (ctx) => {
      const targetUserId = parseInt(ctx.match[1]);
      await profileHandlers.handleSendDirectMessage(ctx, targetUserId);
    });

    // ✅ انصراف از ارسال پیام دایرکت
    this.bot.action("cancel_direct_message", async (ctx) => {
      await profileHandlers.handleCancelDirectMessage(ctx);
    });

    // ✅ پاسخ به پیام دایرکت
    this.bot.action(/^reply_direct_(\d+)$/, async (ctx) => {
      const targetUserId = parseInt(ctx.match[1]);
      await profileHandlers.handleSendDirectMessage(ctx, targetUserId);
    });

    // ✅ نمایش پیام‌های دریافتی
    this.bot.action("view_direct_messages", async (ctx) => {
      await ctx.answerCbQuery();
      await profileHandlers.showReceivedMessages(ctx, 1, 'DESC');
    });

    this.bot.action(/^received_messages_page_(\d+)_(DESC|ASC)$/, async (ctx) => {
      const page = parseInt(ctx.match[1]);
      const sortOrder = ctx.match[2] as 'DESC' | 'ASC';
      await ctx.answerCbQuery();
      await profileHandlers.showReceivedMessages(ctx, page, sortOrder);
    });

    // ✅ نمایش پیام‌های ارسالی
    this.bot.action(/^sent_messages_page_(\d+)_(DESC|ASC)$/, async (ctx) => {
      const page = parseInt(ctx.match[1]);
      const sortOrder = ctx.match[2] as 'DESC' | 'ASC';
      await ctx.answerCbQuery();
      await profileHandlers.showSentMessages(ctx, page, sortOrder);
    });

    // ===================================
    // 🚨 REPORT ACTION (موقتاً غیرفعال)
    // ===================================
    
    // ✅ گزارش کاربر
    this.bot.action(/^report_user_(\d+)$/, async (ctx) => {
      const targetUserId = parseInt(ctx.match[1]);
      await ctx.answerCbQuery("🚨 بخش گزارش به زودی فعال می‌شود...");
    });

    // ===================================
    // 💰 COIN & INVITE ACTIONS
    // ===================================
    
    // ✅ مشاهده صفحه سکه‌ها
    this.bot.action("view_coins", async (ctx) => {
      await ctx.answerCbQuery();
      await coinHandler.showCoinsPage(ctx);
    });

    // ✅ خرید سکه
    this.bot.action("buy_coins", async (ctx) => {
      await coinHandler.showBuyCoinsPage(ctx, true);
    });

    // ✅ دعوت دوستان
    this.bot.action("invite_friends", async (ctx) => {
      await ctx.answerCbQuery();
      await coinHandler.showInvitePage(ctx, true);
    });

    // ✅ انتخاب پکیج خرید سکه
    this.bot.action(/^buy_package_(bronze|silver|gold|diamond)$/, async (ctx) => {
      const packageType = ctx.match[1];
      await coinHandler.showPackageConfirmation(ctx, packageType);
    });

    // ✅ پرداخت پکیج
    this.bot.action(/^pay_package_(bronze|silver|gold|diamond)$/, async (ctx) => {
      const packageType = ctx.match[1];
      await coinHandler.processPayment(ctx, packageType);
    });

    // ===================================
    // 💳 PAYMENT HANDLERS (Telegram Stars)
    // ===================================

    // ✅ تأیید pre-checkout query
    this.bot.on('pre_checkout_query', async (ctx) => {
      try {
        await ctx.answerPreCheckoutQuery(true);
        logger.info(`✅ Pre-checkout approved for user ${ctx.from?.id}`);
      } catch (error) {
        logger.error('❌ Pre-checkout error:', error);
        await ctx.answerPreCheckoutQuery(false, 'خطا در پردازش پرداخت');
      }
    });

    // ✅ پردازش پرداخت موفق
    this.bot.on('successful_payment', async (ctx) => {
      try {
        const payment = ctx.message?.successful_payment;
        if (!payment) return;

        const payload = payment.invoice_payload;
        const match = payload.match(/coin_package_(bronze|silver|gold|diamond)_(\d+)/);
        
        if (!match) {
          logger.error('Invalid payment payload:', payload);
          return;
        }

        const [, packageType, userId] = match;
        
        // خواندن پکیج از env
        const parsePackage = (envValue: string | undefined) => {
          if (!envValue) return null;
          const [coins] = envValue.split(':').map(Number);
          return coins;
        };

        const packageMap: Record<string, number | null> = {
          'bronze': parsePackage(process.env.COIN_PACKAGE_BRONZE),
          'silver': parsePackage(process.env.COIN_PACKAGE_SILVER),
          'gold': parsePackage(process.env.COIN_PACKAGE_GOLD),
          'diamond': parsePackage(process.env.COIN_PACKAGE_DIAMOND),
        };

        const coins = packageMap[packageType];
        if (!coins) {
          logger.error('Invalid package type:', packageType);
          return;
        }

        // اضافه کردن سکه به حساب کاربر
        const { addCoins } = await import('../services/coin.service');
        await addCoins(
          parseInt(userId),
          coins,
          'purchase',
          `خرید ${coins} سکه با ${payment.total_amount} ستاره`,
          null
        );

        await ctx.reply(
          `✅ پرداخت موفق!\n\n` +
          `💰 ${coins} سکه به حساب شما اضافه شد.\n` +
          `⭐ مبلغ پرداختی: ${payment.total_amount} ستاره\n\n` +
          `از خرید شما متشکریم! 🎉`
        );

        logger.info(`💰 Successful payment: ${coins} coins added to user ${userId}`);
      } catch (error) {
        logger.error('❌ Successful payment handler error:', error);
        await ctx.reply('⚠️ خطا در ثبت پرداخت. لطفاً با پشتیبانی تماس بگیرید.');
      }
    });

    // ===================================
    // 💬 CHAT REQUEST ACTIONS
    // ===================================
    
    // ✅ ارسال درخواست چت
    this.bot.action(/^request_chat_(\d+)$/, async (ctx) => {
      await profileHandlers.handleChatRequest(ctx);
    });

    // ✅ قبول درخواست چت
    this.bot.action(/^accept_chat_(\d+)$/, async (ctx) => {
      await profileHandlers.acceptChatRequest(ctx);
    });

    // ✅ رد درخواست چت
    this.bot.action(/^reject_chat_(\d+)$/, async (ctx) => {
      await profileHandlers.rejectChatRequest(ctx);
    });

    // ✅ مشاهده پروفایل از طریق درخواست چت
    this.bot.action(/^view_user_(\d+)$/, async (ctx) => {
      const targetUserId = parseInt(ctx.match[1]);
      await ctx.answerCbQuery();
      await profileHandlers.showUserProfile(ctx, targetUserId);
    });

    // ===================================
    // 🔙 NAVIGATION ACTIONS
    // ===================================
    
    // ✅ بازگشت به منوی اصلی
    this.bot.action("main_menu", async (ctx) => {
      await ctx.answerCbQuery();
      try {
        await ctx.deleteMessage();
      } catch {}
      await ctx.reply("🏠 منوی اصلی");
    });

    // ✅ بازگشت به منوی پروفایل
    this.bot.action("profile_menu", async (ctx) => {
      await ctx.answerCbQuery();
      await profileHandlers.showProfileMenu(ctx);
    });

    // ===================================
    // 📸 PHOTO & TEXT HANDLERS
    // ===================================
    
    // ✅ دریافت custom ID به شکل /user_ID_XXXXX یا ID_XXXXX
    this.bot.hears(/^\/user_(ID_[A-Z0-9]{6})$/i, async (ctx) => {
      const customId = ctx.match[1];
      await profileHandlers.showProfileByCustomId(ctx, customId);
    });

    this.bot.hears(/^(ID_[A-Z0-9]{6})$/i, async (ctx) => {
      const customId = ctx.match[1];
      await profileHandlers.showProfileByCustomId(ctx, customId);
    });
    
    // ✅ دریافت عکس (فقط برای پروفایل)
    this.bot.on(message("photo"), (ctx) => {
      if (ctx.session?.awaitingPhoto || ctx.session?.profileEdit) {
        return profileHandlers.handlePhoto(ctx);
      }
    });

    // ✅ دریافت متن (فقط برای پروفایل)
    this.bot.on(message("text"), (ctx) => {
      // پیام دایرکت
      if (ctx.session?.awaitingDirectMessage) {
        const text = ctx.message.text;
        return profileHandlers.processDirectMessageText(ctx, text);
      }
      
      // ویرایش پروفایل
      if (ctx.session?.profileEdit) {
        return profileHandlers.handleTextInput(ctx);
      }
    });

    logger.info("✅ Bot handlers loaded");
  }

  private setupErrorHandling(): void {
    this.bot.catch((err: any, ctx: MyContext) => {
      logger.error("❌ Bot error:", {
        error: {
          message: err?.message || "Unknown error",
          stack: err?.stack,
          name: err?.name,
          code: err?.code,
        },
        updateType: ctx.updateType,
        userId: ctx.from?.id,
        chatId: ctx.chat?.id,
      });

      ctx.reply("⚠️ خطایی رخ داد. لطفاً دوباره تلاش کنید.").catch((e) => {
        logger.error("Failed to send error message:", e);
      });
    });

    logger.info("✅ Bot error handling configured");
  }

  async launch(): Promise<void> {
    try {
      await db.connect();
      await redisService.connect();

      await this.bot.telegram.deleteWebhook({ drop_pending_updates: true });
      logger.info("🗑️ Webhook deleted");

      await this.bot.launch();
      logger.info("✅ Bot launched successfully");

      process.once("SIGINT", () => this.stop("SIGINT"));
      process.once("SIGTERM", () => this.stop("SIGTERM"));
    } catch (error) {
      logger.error("❌ Failed to launch bot:", error);
      throw error;
    }
  }

  async stop(signal?: string): Promise<void> {
    logger.info(`🛑 Received ${signal || "EXIT"}, stopping bot...`);
    this.bot.stop(signal);
    await db.disconnect();
    await redisService.disconnect();
    logger.info("👋 Bot stopped gracefully");
  }
}

export const telegramBot = new TelegramBot();
export default telegramBot;
