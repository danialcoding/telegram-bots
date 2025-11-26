import { Context } from "telegraf";
import { Markup } from "telegraf";
import adminService from "../../services/admin.service";
import reportService from "../../services/report.service";
import userService from "../../services/user.service";
import statsService from "../../services/stats.service";
import logger from "../../utils/logger";

/**
 * کیبوردهای پنل ادمین
 */
const adminKeyboards = {
  main: () =>
    Markup.inlineKeyboard([
      [Markup.button.callback("📊 آمار سیستم", "admin_stats")],
      [Markup.button.callback("📝 مدیریت گزارش‌ها", "admin_reports")],
      [Markup.button.callback("👥 مدیریت کاربران", "admin_users")],
      [Markup.button.callback("📢 ارسال پیام همگانی", "admin_broadcast")],
      [Markup.button.callback("⚙️ تنظیمات سیستم", "admin_settings")],
      [Markup.button.callback("🔙 بازگشت", "main_menu")],
    ]),

  reportActions: (reportId: number) =>
    Markup.inlineKeyboard([
      [
        Markup.button.callback(
          "✅ تایید و بلاک",
          `admin_report_block_${reportId}`
        ),
      ],
      [
        Markup.button.callback(
          "⚠️ هشدار به کاربر",
          `admin_report_warn_${reportId}`
        ),
      ],
      [Markup.button.callback("❌ رد کردن", `admin_report_reject_${reportId}`)],
      [Markup.button.callback("🔙 بازگشت", "admin_reports")],
    ]),

  userActions: (userId: number) =>
    Markup.inlineKeyboard([
      [Markup.button.callback("🚫 بلاک کردن", `admin_user_block_${userId}`)],
      [Markup.button.callback("✅ رفع بلاک", `admin_user_unblock_${userId}`)],
      [
        Markup.button.callback(
          "💰 اضافه کردن سکه",
          `admin_user_addcoins_${userId}`
        ),
      ],
      [Markup.button.callback("📊 مشاهده آمار", `admin_user_stats_${userId}`)],
      [Markup.button.callback("🔙 بازگشت", "admin_users")],
    ]),
};

/**
 * Admin Handlers
 */
class AdminHandlers {
  /**
   * چک کردن دسترسی ادمین
   */
  private async isAdmin(userId: number): Promise<boolean> {
    try {
      const admin = await adminService.findById(userId);
      return admin !== null && admin.is_active;
    } catch {
      return false;
    }
  }

  /**
   * مدیریت اکشن‌های ادمین
   */
  async handleActions(ctx: Context) {
    if (!ctx.callbackQuery || !("data" in ctx.callbackQuery)) return;

    const action = ctx.callbackQuery.data;
    const user = ctx.state.user;

    // چک دسترسی ادمین
    const hasAccess = await this.isAdmin(user.id);
    if (!hasAccess) {
      return await ctx.answerCbQuery("❌ شما دسترسی ادمین ندارید!");
    }

    try {
      await ctx.answerCbQuery();

      if (action === "admin_panel") {
        return await this.showMainPanel(ctx);
      }

      if (action === "admin_stats") {
        return await this.showStats(ctx);
      }

      if (action === "admin_reports") {
        return await this.showReports(ctx);
      }

      if (action === "admin_users") {
        return await this.showUsers(ctx);
      }

      if (action === "admin_broadcast") {
        return await this.initiateBroadcast(ctx);
      }

      if (action === "admin_settings") {
        return await this.showSystemSettings(ctx);
      }

      if (action.startsWith("admin_report_")) {
        return await this.handleReportAction(ctx, action);
      }

      if (action.startsWith("admin_user_")) {
        return await this.handleUserAction(ctx, action);
      }
    } catch (error) {
      logger.error("❌ Admin action error:", error);
      await ctx.reply("⚠️ خطایی رخ داد.");
    }
  }

  /**
   * نمایش پنل اصلی ادمین
   */
  private async showMainPanel(ctx: Context) {
    const panelText = `👨‍💼 پنل مدیریت\n\n` + `از گزینه‌های زیر استفاده کنید:`;

    await ctx.editMessageText(panelText, adminKeyboards.main());
  }

  /**
   * نمایش آمار سیستم
   */
  private async showStats(ctx: Context) {
    try {
      const stats = await statsService.getDashboardStats();

      const statsText =
        `📊 آمار سیستم\n\n` +
        `👥 کاربران:\n` +
        `  • کل: ${stats.users.total}\n` +
        `  • فعال: ${stats.users.active}\n` +
        `  • آنلاین: ${stats.users.online}\n` +
        `  • بلاک شده: ${stats.users.blocked}\n\n` +
        `💬 چت‌ها:\n` +
        `  • کل: ${stats.chats.total}\n` +
        `  • فعال: ${stats.chats.active}\n` +
        `  • امروز: ${stats.chats.today}\n\n` +
        `💰 سکه‌ها:\n` +
        `  • کل خریداری شده: ${stats.coins.totalPurchased}\n` +
        `  • کل مصرف شده: ${stats.coins.totalSpent}\n` +
        `  • درآمد: ${stats.coins.revenue.toLocaleString("fa-IR")} تومان\n\n` +
        `📝 گزارش‌ها:\n` +
        `  • در انتظار: ${stats.reports.pending}\n` +
        `  • حل شده: ${stats.reports.resolved}\n`;

      await ctx.editMessageText(
        statsText,
        Markup.inlineKeyboard([
          [Markup.button.callback("🔙 بازگشت", "admin_panel")],
        ])
      );
    } catch (error) {
      logger.error("❌ Show stats error:", error);
      await ctx.reply("⚠️ خطا در دریافت آمار.");
    }
  }

  /**
   * نمایش گزارش‌های در انتظار
   */
  private async showReports(ctx: Context) {
    try {
      const reports = await reportService.getPendingReports(10);

      if (reports.length === 0) {
        return await ctx.editMessageText(
          "✅ گزارش در انتظاری وجود ندارد.",
          Markup.inlineKeyboard([
            [Markup.button.callback("🔙 بازگشت", "admin_panel")],
          ])
        );
      }

      let reportsText = "📝 گزارش‌های در انتظار:\n\n";
      const buttons: any[] = [];

      reports.forEach((report, index) => {
        reportsText +=
          `${index + 1}. ${report.reason}\n` +
          `   گزارش‌دهنده: ${report.reporter_id}\n` +
          `   گزارش شده: ${report.reported_id}\n\n`;

        buttons.push([
          Markup.button.callback(
            `مشاهده #${report.id}`,
            `admin_report_view_${report.id}`
          ),
        ]);
      });

      buttons.push([Markup.button.callback("🔙 بازگشت", "admin_panel")]);

      await ctx.editMessageText(reportsText, Markup.inlineKeyboard(buttons));
    } catch (error) {
      logger.error("❌ Show reports error:", error);
      await ctx.reply("⚠️ خطا در دریافت گزارش‌ها.");
    }
  }

  /**
   * مدیریت اکشن‌های گزارش
   */
  private async handleReportAction(ctx: Context, action: string) {
    const parts = action.split("_");
    const reportId = parseInt(parts[parts.length - 1]);

    if (action.includes("view")) {
      const report = await reportService.getReportById(reportId);
      if (!report) return;

      const reportText =
        `📝 جزئیات گزارش #${report.id}\n\n` +
        `دلیل: ${report.reason}\n` +
        `گزارش‌دهنده: ${report.reporter_id}\n` +
        `کاربر گزارش شده: ${report.reported_id}\n` +
        `تاریخ: ${new Date(report.created_at).toLocaleDateString("fa-IR")}`;

      return await ctx.editMessageText(
        reportText,
        adminKeyboards.reportActions(reportId)
      );
    }

    if (action.includes("block")) {
      await reportService.resolveReport(reportId, "blocked");
      await userService.blockUser(reportId, "admin", "گزارش تایید شده");
      await ctx.answerCbQuery("✅ کاربر بلاک شد");
      return await this.showReports(ctx);
    }

    if (action.includes("warn")) {
      await reportService.resolveReport(reportId, "warned");
      // TODO: ارسال هشدار به کاربر
      await ctx.answerCbQuery("✅ هشدار ارسال شد");
      return await this.showReports(ctx);
    }

    if (action.includes("reject")) {
      await reportService.resolveReport(reportId, "rejected");
      await ctx.answerCbQuery("✅ گزارش رد شد");
      return await this.showReports(ctx);
    }
  }

  /**
   * نمایش لیست کاربران
   */
  private async showUsers(ctx: Context) {
    await ctx.editMessageText(
      "👥 مدیریت کاربران\n\n" +
        "برای جستجوی کاربر، ID تلگرام او را ارسال کنید:",
      Markup.inlineKeyboard([
        [Markup.button.callback("🔙 بازگشت", "admin_panel")],
      ])
    );

    ctx.session.adminState = "awaiting_user_id";
  }

  /**
   * مدیریت اکشن‌های کاربر
   */
  private async handleUserAction(ctx: Context, action: string) {
    const parts = action.split("_");
    const userId = parseInt(parts[parts.length - 1]);

    if (action.includes("block")) {
      await userService.blockUser(userId, "admin", "بلاک توسط ادمین");
      await ctx.answerCbQuery("✅ کاربر بلاک شد");
      return;
    }

    if (action.includes("unblock")) {
      await userService.unblockUserByAdmin(userId);
      await ctx.answerCbQuery("✅ بلاک کاربر برداشته شد");
      return;
    }

    if (action.includes("addcoins")) {
      ctx.session.adminState = "awaiting_coin_amount";
      ctx.session.targetUserId = userId;
      await ctx.reply("💰 مقدار سکه را وارد کنید:");
      return;
    }

    if (action.includes("stats")) {
      const stats = await userService.getUserStats(userId);
      const statsText =
        `📊 آمار کاربر #${userId}\n\n` +
        `💬 چت‌ها: ${stats.totalChats}\n` +
        `💰 سکه‌ها: ${stats.coins}\n` +
        `📝 گزارش‌ها: ${stats.reports}\n`;

      await ctx.reply(statsText);
      return;
    }
  }

  /**
   * شروع فرآیند ارسال پیام همگانی
   */
  private async initiateBroadcast(ctx: Context) {
    ctx.session.adminState = "awaiting_broadcast_message";
    await ctx.reply(
      "📢 پیام همگانی خود را ارسال کنید:\n" +
        "(می‌توانید متن، عکس یا ویدیو ارسال کنید)"
    );
  }

  /**
   * نمایش پنل ادمین (از طریق کامند /admin)
   */
  async showPanel(ctx: Context) {
    const user = ctx.state.user;

    // چک دسترسی ادمین
    const hasAccess = await this.isAdmin(user.id);
    if (!hasAccess) {
      return await ctx.reply("❌ شما دسترسی ادمین ندارید!");
    }

    const panelText = `👨‍💼 پنل مدیریت\n\n` + `از گزینه‌های زیر استفاده کنید:`;

    await ctx.reply(panelText, adminKeyboards.main());
  }

  /**
   * نمایش تنظیمات سیستم
   */
  private async showSystemSettings(ctx: Context) {
    await ctx.editMessageText(
      "⚙️ تنظیمات سیستم\n\n" + "این بخش در حال توسعه است...",
      Markup.inlineKeyboard([
        [Markup.button.callback("🔙 بازگشت", "admin_panel")],
      ])
    );
  }
}

export const adminHandlers = new AdminHandlers();
