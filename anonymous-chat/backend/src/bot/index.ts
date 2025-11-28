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

    this.bot.hears("💬 چت فعلی", async (ctx) => {
      await ctx.reply("💬 بخش چت به زودی فعال می‌شود...");
    });

    this.bot.hears("📊 آمار من", async (ctx) => {
      await ctx.reply("📊 بخش آمار به زودی فعال می‌شود...");
    });

    this.bot.hears("🎁 دعوت دوستان", async (ctx) => {
      await ctx.reply("🎁 بخش دعوت به زودی فعال می‌شود...");
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
      await profileHandlers.showBlockedUsers(ctx);
    });

    // ===================================
    // 💖 LIKE ACTIONS
    // ===================================
    
    // ✅ تاگل لایک
    this.bot.action(/^like_toggle_(\d+)$/, async (ctx) => {
      await profileHandlers.handleLikeToggle(ctx);
    });

    // ===================================
    // 👥 CONTACT ACTIONS
    // ===================================
    
    // ✅ تاگل مخاطب (افزودن/حذف)
    this.bot.action(/^contact_toggle_(\d+)$/, async (ctx) => {
      await profileHandlers.handleContactToggle(ctx);
    });

    // ✅ نمایش لیست مخاطبین
    this.bot.action("contacts_list", async (ctx) => {
      await ctx.answerCbQuery();
      await profileHandlers.showContacts(ctx);
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
    // 💬 CHAT & DIRECT ACTIONS (موقتاً غیرفعال)
    // ===================================
    
    // ✅ درخواست چت
    this.bot.action(/^start_chat_(\d+)$/, async (ctx) => {
      const targetUserId = parseInt(ctx.match[1]);
      await ctx.answerCbQuery("💬 بخش چت به زودی فعال می‌شود...");
    });

    // ✅ ارسال دایرکت
    this.bot.action(/^send_direct_(\d+)$/, async (ctx) => {
      const targetUserId = parseInt(ctx.match[1]);
      await ctx.answerCbQuery("✉️ بخش دایرکت به زودی فعال می‌شود...");
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
    
    // ✅ دریافت عکس (فقط برای پروفایل)
    this.bot.on(message("photo"), (ctx) => {
      if (ctx.session?.awaitingPhoto || ctx.session?.profileEdit) {
        return profileHandlers.handlePhoto(ctx);
      }
    });

    // ✅ دریافت متن (فقط برای پروفایل)
    this.bot.on(message("text"), (ctx) => {
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
