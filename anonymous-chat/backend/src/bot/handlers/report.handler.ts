// src/bot/handlers/report.handler.ts
import { Markup } from "telegraf";
import { MyContext } from "../../types/bot.types";
import { reportService } from "../../services/report.service";
import { profileService } from "../../services/profile.service";
import logger from "../../utils/logger";

// دلایل گزارش
export const REPORT_REASONS = {
  ads: "تبلیغات سایت‌ها و ربات‌ها و کانال‌ها",
  inappropriate_content: "ارسال محتوای غیر اخلاقی",
  harassment: "ایجاد مزاحمت",
  personal_info: "پخش شماره موبایل یا اطلاعات شخصی دیگران",
  profile_inappropriate: "کلمات یا عکس غیر اخلاقی و توهین‌آمیز در پروفایل",
  wrong_gender: "جنسیت اشتباه در پروفایل",
  other: "دیگر موارد",
};

class ReportHandler {
  /**
   * نمایش فرم گزارش با دلایل
   */
  async showReportForm(ctx: MyContext, targetUserId: number) {
    try {
      // دریافت پروفایل کاربر گزارش شونده
      const targetProfile = await profileService.getProfile(targetUserId);
      // فرمت صحیح: /user_ID_XXXXX
      const userLink = targetProfile?.custom_id 
        ? `/user_${targetProfile.custom_id}` 
        : `/user_${targetUserId}`;

      // ذخیره در session
      ctx.session.reportData = {
        targetUserId,
        step: "select_reason",
      };

      const message =
        `⚠️ فرم ارسال گزارش عدم رعایت قوانین\n\n` +
        `چرا میخوای ${userLink} رو گزارش کنی؟\n\n` +
        `- توجه : تمامی گزارشات بررسی خواهند شد و 🔴 ارسال گزارشات اشتباه موجب مسدود شدن شما خواهد شد.\n\n` +
        `انتخاب کن 👇`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback("📢 تبلیغات سایت‌ها و ربات‌ها و کانال‌ها", "report_reason_ads")],
        [Markup.button.callback("🔞 ارسال محتوای غیر اخلاقی", "report_reason_inappropriate_content")],
        [Markup.button.callback("😤 ایجاد مزاحمت", "report_reason_harassment")],
        [Markup.button.callback("📱 پخش شماره موبایل یا اطلاعات شخصی دیگران", "report_reason_personal_info")],
        [Markup.button.callback("🚫 کلمات یا عکس غیر اخلاقی در پروفایل", "report_reason_profile_inappropriate")],
        [Markup.button.callback("⚧️ جنسیت اشتباه در پروفایل", "report_reason_wrong_gender")],
        [Markup.button.callback("📝 دیگر موارد", "report_reason_other")],
        [Markup.button.callback("🔙 بازگشت", "report_cancel")],
      ]);

      try {
        await ctx.editMessageText(message, keyboard);
      } catch {
        await ctx.reply(message, keyboard);
      }
    } catch (error) {
      logger.error("❌ Error showing report form:", error);
      await ctx.reply("⚠️ خطا در نمایش فرم گزارش");
    }
  }

  /**
   * پردازش انتخاب دلیل گزارش
   */
  async handleReasonSelection(ctx: MyContext, reasonKey: string) {
    try {
      await ctx.answerCbQuery();

      if (!ctx.session.reportData?.targetUserId) {
        await ctx.reply("⚠️ خطا در پردازش گزارش. لطفاً دوباره تلاش کنید.");
        return;
      }

      const targetUserId = ctx.session.reportData.targetUserId;
      const reason = REPORT_REASONS[reasonKey as keyof typeof REPORT_REASONS];

      if (!reason) {
        await ctx.reply("⚠️ دلیل نامعتبر");
        return;
      }

      // اگر "دیگر موارد" انتخاب شد، درخواست توضیحات
      if (reasonKey === "other") {
        ctx.session.reportData.step = "enter_description";
        ctx.session.reportData.reason = reason;
        ctx.session.reportData.reasonKey = reasonKey;

        const message =
          `⚠️ فرم ارسال گزارش عدم رعایت قوانین به دلیل دیگر موارد...\n\n` +
          `خب حالا کافیه یه توضیح دقیق و 《کامل》 درباره گزارشت بفرستی تا ثبتش کنم.\n` +
          `- مثلا : داره تبلیغات فلان کانال رو توی چت ( یا پروفایلش ) میکنه.\n\n\n` +
          `برای لغو گزارش 《 🔙 بازگشت 》 را انتخاب کنید`;

        try {
          await ctx.editMessageText(
            message,
            Markup.inlineKeyboard([
              [Markup.button.callback("🔙 بازگشت", `report_user_${targetUserId}`)],
            ])
          );
        } catch {
          await ctx.reply(
            message,
            Markup.inlineKeyboard([
              [Markup.button.callback("🔙 بازگشت", `report_user_${targetUserId}`)],
            ])
          );
        }
        return;
      }

      // برای سایر دلایل، مستقیماً ثبت کن
      await this.submitReport(ctx, reason, null);
    } catch (error) {
      logger.error("❌ Error handling reason selection:", error);
      await ctx.reply("⚠️ خطا در پردازش گزارش");
    }
  }

  /**
   * پردازش توضیحات گزارش (برای "دیگر موارد")
   */
  async handleDescription(ctx: MyContext) {
    const text = ctx.message && "text" in ctx.message ? ctx.message.text : null;

    if (!text) {
      await ctx.reply("⚠️ لطفاً توضیحات را به صورت متن ارسال کنید.");
      return;
    }

    if (!ctx.session.reportData?.targetUserId || ctx.session.reportData.step !== "enter_description") {
      return; // این پیام مربوط به گزارش نیست
    }

    // اعتبارسنجی طول توضیحات
    if (text.length < 10) {
      await ctx.reply(
        "⚠️ توضیحات باید حداقل 10 کاراکتر باشد.\n\nلطفاً توضیحات کامل‌تری ارسال کنید.",
        Markup.inlineKeyboard([
          [Markup.button.callback("🔙 بازگشت", `report_user_${ctx.session.reportData.targetUserId}`)],
        ])
      );
      return;
    }

    if (text.length > 1000) {
      await ctx.reply(
        "⚠️ توضیحات باید حداکثر 1000 کاراکتر باشد.\n\nلطفاً توضیحات خلاصه‌تری ارسال کنید.",
        Markup.inlineKeyboard([
          [Markup.button.callback("🔙 بازگشت", `report_user_${ctx.session.reportData.targetUserId}`)],
        ])
      );
      return;
    }

    const reason = ctx.session.reportData.reason || REPORT_REASONS.other;
    await this.submitReport(ctx, reason, text);
  }

  /**
   * ثبت نهایی گزارش
   */
  private async submitReport(ctx: MyContext, reason: string, description: string | null) {
    const user = ctx.state.user;
    const targetUserId = ctx.session.reportData?.targetUserId;

    if (!targetUserId) {
      await ctx.reply("⚠️ خطا در ثبت گزارش. لطفاً دوباره تلاش کنید.");
      return;
    }

    try {
      // ثبت گزارش
      await reportService.createReport(user.id, targetUserId, reason, description);

      // پاک کردن session
      delete ctx.session.reportData;

      // دریافت پروفایل کاربر گزارش شده
      const targetProfile = await profileService.getProfile(targetUserId);
      const customId = targetProfile?.custom_id || `${targetUserId}`;
      const displayId = 'user_' + customId;

      const successMessage =
        `✅ گزارش شما با موفقیت ثبت شد!\n\n` +
        `📋 کاربر گزارش شده: /${displayId}\n` +
        `📝 دلیل: ${reason}\n` +
        (description ? `💬 توضیحات: ${description.substring(0, 100)}${description.length > 100 ? "..." : ""}\n` : "") +
        `\n` +
        `🔍 گزارش شما توسط تیم پشتیبانی بررسی خواهد شد.\n` +
        `⚠️ از ارسال گزارش‌های نادرست خودداری کنید.`;

      try {
        await ctx.editMessageText(
          successMessage,
          Markup.inlineKeyboard([[Markup.button.callback("🔙 بازگشت به منو", "main_menu")]])
        );
      } catch {
        await ctx.reply(
          successMessage,
          Markup.inlineKeyboard([[Markup.button.callback("🔙 بازگشت به منو", "main_menu")]])
        );
      }

      logger.info(`✅ Report submitted: user ${user.id} reported user ${targetUserId} for "${reason}"`);
    } catch (error: any) {
      logger.error("❌ Error submitting report:", error);

      const errorMessage = error.message || "خطا در ثبت گزارش";
      await ctx.reply(
        `⚠️ ${errorMessage}`,
        Markup.inlineKeyboard([[Markup.button.callback("🔙 بازگشت به منو", "main_menu")]])
      );

      // پاک کردن session
      delete ctx.session.reportData;
    }
  }

  /**
   * لغو گزارش
   */
  async cancelReport(ctx: MyContext) {
    try {
      await ctx.answerCbQuery("❌ گزارش لغو شد");

      // پاک کردن session
      delete ctx.session.reportData;

      try {
        await ctx.editMessageText(
          "❌ گزارش لغو شد.",
          Markup.inlineKeyboard([[Markup.button.callback("🔙 بازگشت به منو", "main_menu")]])
        );
      } catch {
        await ctx.reply(
          "❌ گزارش لغو شد.",
          Markup.inlineKeyboard([[Markup.button.callback("🔙 بازگشت به منو", "main_menu")]])
        );
      }
    } catch (error) {
      logger.error("❌ Error canceling report:", error);
    }
  }
}

export const reportHandler = new ReportHandler();
