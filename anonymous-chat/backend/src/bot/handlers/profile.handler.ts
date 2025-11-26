// src/bot/handlers/profile.handler.ts
import { Markup } from "telegraf";
import { profileService } from "../../services/profile.service";
import { PROVINCES, CITIES_BY_PROVINCE } from "../../utils/locations";
import logger from "../../utils/logger";
import { profileKeyboards } from "../keyboards/profile.keyboard";
import { mainMenuKeyboard } from "../keyboards/main.keyboard";
import { MyContext } from "../../types/bot.types";

/**
 * کیبوردهای پروفایل
 */
// const profileKeyboards = {
//   main: () =>
//     Markup.inlineKeyboard([
//       [Markup.button.callback("✏️ ویرایش پروفایل", "profile_edit")],
//       [Markup.button.callback("🖼 تغییر عکس", "profile_change_photo")],
//       [Markup.button.callback("👁 مشاهده پروفایل", "profile_view")],
//       [Markup.button.callback("🔙 بازگشت", "main_menu")],
//     ]),

//   gender: () =>
//     Markup.inlineKeyboard([
//       [
//         Markup.button.callback("👨 مرد", "profile_gender_male"),
//         Markup.button.callback("👩 زن", "profile_gender_female"),
//       ],
//       [Markup.button.callback("❌ انصراف", "profile_cancel")],
//     ]),

//   province: () => {
//     const buttons = PROVINCES.map((p) => [
//       Markup.button.callback(p.name, `profile_province_${p.id}`),
//     ]);
//     buttons.push([Markup.button.callback("❌ انصراف", "profile_cancel")]);
//     return Markup.inlineKeyboard(buttons);
//   },

//   city: (provinceId: number) => {
//     const cities = CITIES_BY_PROVINCE[provinceId] || [];
//     const buttons = cities.map((c) => [
//       Markup.button.callback(c.name, `profile_city_${c.id}`),
//     ]);
//     buttons.push([
//       Markup.button.callback("🔙 بازگشت", "profile_select_province"),
//     ]);
//     return Markup.inlineKeyboard(buttons);
//   },
// };

/**
 * Profile Handlers
 */
class ProfileHandlers {
  /**
   * نمایش منوی اصلی پروفایل
   */
  async showProfileMenu(ctx: MyContext) {
    const user = ctx.state.user;

    try {
      const profile = await profileService.getProfile(user.id);

      if (!profile) {
        // اگر پروفایل نداره، شروع ویرایش
        ctx.session.profileEdit = { step: "gender" };
        return await ctx.reply(
          "📝 بیایید پروفایل شما را تکمیل کنیم!\n\n" +
            "👤 جنسیت خود را انتخاب کنید:",
          profileKeyboards.gender()
        );
      }

      // اگر پروفایل داره، منوی اصلی
      await ctx.reply(
        "👤 منوی پروفایل\n\n" + "از گزینه‌های زیر انتخاب کنید:",
        profileKeyboards.main()
      );

      logger.info(`✅ User ${user.id} opened profile menu`);
    } catch (error) {
      logger.error("❌ Show profile menu error:", error);
      await ctx.reply("⚠️ خطا در نمایش منوی پروفایل");
    }
  }
  /**
   * مدیریت اکشن‌های پروفایل
   */
  async handleActions(ctx: MyContext) {
    if (!ctx.callbackQuery || !("data" in ctx.callbackQuery)) return;

    const action = ctx.callbackQuery.data;
    const user = ctx.state.user;

    try {
      await ctx.answerCbQuery();

      if (action === "profile_view") {
        return await this.viewProfile(ctx);
      }

      if (action === "profile_edit") {
        return await this.startEdit(ctx);
      }

      if (action === "profile_change_photo") {
        return await this.requestPhoto(ctx);
      }

      if (action.startsWith("profile_gender_")) {
        const gender = action.replace("profile_gender_", "") as
          | "male"
          | "female";

        if (!ctx.session.profileEdit) {
          ctx.session.profileEdit = {};
        }
        ctx.session.profileEdit.gender = gender;

        return await this.requestAge(ctx);
      }

      if (action === "profile_select_province") {
        return await ctx.editMessageText(
          "📍 استان خود را انتخاب کنید:",
          profileKeyboards.province()
        );
      }

      if (action.startsWith("profile_province_")) {
        const provinceId = parseInt(action.replace("profile_province_", ""));

        if (!ctx.session.profileEdit) {
          ctx.session.profileEdit = {};
        }
        ctx.session.profileEdit.province_id = provinceId;

        return await ctx.editMessageText(
          "🏙 شهر خود را انتخاب کنید:",
          profileKeyboards.city(provinceId)
        );
      }

      if (action.startsWith("profile_city_")) {
        const cityId = parseInt(action.replace("profile_city_", ""));

        if (!ctx.session.profileEdit) {
          ctx.session.profileEdit = {};
        }
        ctx.session.profileEdit.city_id = cityId;

        return await this.requestBio(ctx);
      }

      if (action === "profile_cancel") {
        delete ctx.session.profileEdit;
        await ctx.editMessageText("❌ عملیات لغو شد.");
        return;
      }
    } catch (error) {
      logger.error("❌ Profile action error:", error);
      await ctx.reply("⚠️ خطایی رخ داد.");
    }
  }

/**
 * مشاهده پروفایل
 */
private async viewProfile(ctx: MyContext) {
  const user = ctx.state.user;
  const profile = await profileService.getProfile(user.id);

  if (!profile) {
    return await ctx.editMessageText(
      "❌ شما هنوز پروفایل ندارید.\n" + 'روی "✏️ ویرایش پروفایل" کلیک کنید.',
      profileKeyboards.main()
    );
  }

  const profileText =
    `👤 پروفایل شما:\n\n` +
    `📛 نام: ${profile.display_name}\n` +
    `👤 جنسیت: ${profile.gender === "male" ? "👨 مرد" : "👩 زن"}\n` +
    `🎂 سن: ${profile.age} سال\n` +
    `📍 موقعیت: ${profile.province?.name || 'نامشخص'}, ${profile.city?.name || 'نامشخص'}\n` +
    `📝 بیو: ${profile.bio || "ندارد"}\n\n` +
    `💬 تعداد چت‌ها: ${user.total_chats}\n` +
    `⭐️ امتیاز: ${user.rating?.toFixed(1) || 0}`;

  // ✅ استفاده از photo_file_id به جای photo_url
  if (profile.photo_file_id) {
    await ctx.replyWithPhoto(profile.photo_file_id, {
      caption: profileText,
      ...profileKeyboards.main(),
    });
  } else {
    await ctx.reply(profileText, {
      ...profileKeyboards.main(),
    });
  }
}


  /**
   * شروع ویرایش پروفایل
   */
  private async startEdit(ctx: MyContext) {
    ctx.session.profileEdit = { step: "gender" };

    await ctx.editMessageText(
      "✏️ بیایید پروفایل شما را تکمیل کنیم!\n\n" +
        "👤 جنسیت خود را انتخاب کنید:",
      profileKeyboards.gender()
    );
  }

  /**
   * درخواست سن
   */
  private async requestAge(ctx: MyContext) {
    if (!ctx.session.profileEdit) {
      ctx.session.profileEdit = {};
    }
    ctx.session.profileEdit.step = "age";

    await ctx.editMessageText(
      "🎂 سن خود را وارد کنید:\n" + "(عدد بین 13 تا 100)"
    );
  }

  /**
   * درخواست بیو
   */
  private async requestBio(ctx: MyContext) {
    if (!ctx.session.profileEdit) {
      ctx.session.profileEdit = {};
    }
    ctx.session.profileEdit.step = "bio";

    await ctx.reply(
      "📝 یک توضیح کوتاه درباره خودتان بنویسید:\n" +
        "(حداکثر 500 کاراکتر)\n\n" +
        'یا "رد شدن" بزنید تا این مرحله را رد کنید.'
    );
  }

  /**
   * درخواست عکس
   */
  private async requestPhoto(ctx: MyContext) {
    ctx.session.awaitingPhoto = true;

    await ctx.reply(
      "📸 عکس پروفایل خود را ارسال کنید:\n\n" +
        "• عکس باید واضح باشد\n" +
        "• محتوای نامناسب ممنوع است\n\n" +
        'یا "انصراف" بزنید.'
    );
  }

  /**
   * مدیریت آپلود عکس
   */
  async handlePhoto(ctx: MyContext) {
    // ✅ Type Guard برای message
    if (!ctx.message || !("photo" in ctx.message)) {
      return;
    }

    if (!ctx.session.awaitingPhoto && !ctx.session.profileEdit?.step) {
      return;
    }

    try {
      const photo = ctx.message.photo;
      if (!photo || photo.length === 0) return;

      const fileId = photo[photo.length - 1].file_id;
      const user = ctx.state.user;

      // ذخیره در دیتابیس
      await profileService.updateProfilePhoto(user.id, fileId);

      delete ctx.session.awaitingPhoto;

      await ctx.reply(
        "✅ عکس پروفایل با موفقیت ثبت شد!\n" +
          "حالا می‌توانید شروع به چت کنید. 💬"
      );

      // اگر در حال تکمیل پروفایل بود
      if (ctx.session.profileEdit) {
        await this.finishEdit(ctx);
      }
    } catch (error) {
      logger.error("❌ Photo upload error:", error);
      await ctx.reply("⚠️ خطا در آپلود عکس.");
    }
  }

  /**
   * مدیریت پیام‌های متنی (سن، بیو)
   */
  async handleTextInput(ctx: MyContext) {
    // ✅ Type Guard برای message و text
    if (!ctx.message || !("text" in ctx.message)) {
      return;
    }

    if (!ctx.session.profileEdit) return;

    const step = ctx.session.profileEdit.step;
    const text = ctx.message.text;

    try {
      // دریافت سن
      if (step === "age") {
        const age = parseInt(text);

        if (isNaN(age) || age < 13 || age > 100) {
          return await ctx.reply(
            "⚠️ لطفا یک عدد معتبر بین 13 تا 100 وارد کنید."
          );
        }

        ctx.session.profileEdit.age = age;
        return await ctx.reply(
          "📍 استان خود را انتخاب کنید:",
          profileKeyboards.province()
        );
      }

      // دریافت بیو
      if (step === "bio") {
        if (text.length > 500) {
          return await ctx.reply("⚠️ بیو باید کمتر از 500 کاراکتر باشد.");
        }

        ctx.session.profileEdit.bio = text === "رد شدن" ? null : text;
        return await this.requestPhoto(ctx);
      }
    } catch (error) {
      logger.error("❌ Text input error:", error);
    }
  }

  /**
   * اتمام ویرایش پروفایل
   */
  private async finishEdit(ctx: MyContext) {
    const user = ctx.state.user;
    const data = ctx.session.profileEdit;

    if (!data) {
      return await ctx.reply("⚠️ اطلاعات پروفایل یافت نشد.");
    }

    try {
      await profileService.updateProfile(user.id, {
        gender: data.gender,
        age: data.age,
        provinceId: data.province_id,
        cityId: data.city_id,
        bio: data.bio,
      });

      delete ctx.session.profileEdit;

      await ctx.reply(
        "✅ پروفایل شما با موفقیت ثبت شد!\n\n" +
          "🎉 حالا می‌توانید:\n" +
          "• با افراد جدید چت کنید\n" +
          "• دوستان خود را دعوت کنید\n" +
          "• از امکانات ربات استفاده کنید",
        mainMenuKeyboard()
      );

      logger.info(`✅ Profile completed for user ${user.id}`);
    } catch (error) {
      logger.error("❌ Finish edit error:", error);
      await ctx.reply("⚠️ خطا در ذخیره پروفایل.");
    }
  }
}

export const profileHandlers = new ProfileHandlers();
