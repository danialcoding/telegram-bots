// src/bot/handlers/profile.handler.ts
import { profileService } from "../../services/profile.service";
import { likeService } from "../../services/like.service";
import { contactService } from "../../services/contact.service";
import { blockService } from "../../services/block.service";
import logger from "../../utils/logger";
import { profileKeyboards } from "../keyboards/profile.keyboard";
import { mainMenuKeyboard } from "../keyboards/main.keyboard";
import { MyContext } from "../../types/bot.types";
import { getProvinceById, getCityById } from "../../utils/locations";
import { Markup } from "telegraf";
import path from "path";
import fs from "fs";

const DEFAULT_PHOTO_PATH = path.join(
  __dirname,
  "../../../public/images/user.jpg"
);

class ProfileHandlers {
  /**
   * ✅ نمایش منوی اصلی پروفایل (پروفایل خود کاربر)
   */
  async showProfileMenu(ctx: MyContext) {
    const user = ctx.state.user;

    try {
      const profile = await profileService.getFullProfile(user.id);

      if (!profile) {
        ctx.session.profileEdit = { step: "gender" };
        return await ctx.reply(
          "📝 بیایید پروفایل شما را تکمیل کنیم!\n\n" +
            "👤 جنسیت خود را انتخاب کنید:",
          profileKeyboards.gender()
        );
      }

      // ✅ دریافت تعداد لایک‌ها
      const likesCount = await likeService.getLikesCount(profile.id);

      console.log("mylog ----------------------------- : ", profile);

      // ✅ متن پروفایل با فرمت دقیق
      const profileText =
        `👤 **پروفایل شما**\n\n` +
        `• نام: ${profile.display_name || profile.first_name}\n` +
        `• توضیحات: ${profile.bio || profile.first_name}\n` +
        `• جنسیت: ${profile.gender === "male" ? "پسر" : "دختر"}\n` +
        `• استان: ${getProvinceById(profile.province)?.name || "نامشخص"}\n` +
        `• شهر: ${
          getCityById(profile.city, profile.province)?.name || "نامشخص"
        }\n` +
        `• سن: ${profile.age}\n\n` +
        `• تعداد لایک‌ها: ${likesCount}\n` +
        `وضعیت هم‌اکنون 👀 ${
          profile.is_online ? "آنلایـــن (🗣)" : "آفلایـــن"
        }\n\n` +
        `🆔 آیدی: /user_${profile.custom_id}\n\n` +
        `تنظیم حالت سایلنت: /silent\n` +
        `حذف اکانت ربات: /deleted_account`;

      // ✅ ارسال تصویر + متن با کیبورد جدید
      if (profile.photo_file_id) {
        await ctx.replyWithPhoto(profile.photo_file_id, {
          caption: profileText,
          parse_mode: "Markdown",
          ...profileKeyboards.main(likesCount, profile.show_likes || false),
        });
      } else {
        await ctx.reply(profileText, {
          parse_mode: "Markdown",
          ...profileKeyboards.main(likesCount, profile.show_likes || false),
        });
      }

      logger.info(`✅ User ${user.id} opened profile menu`);
    } catch (error) {
      logger.error("❌ Show profile menu error:", error);
      await ctx.reply("⚠️ خطا در نمایش پروفایل");
    }
  }

  /**
   * ✅ مشاهده پروفایل (اصلاح شده)
   */
  private async viewProfile(ctx: MyContext) {
    const user = ctx.state.user;

    try {
      const profile = await profileService.getFullProfile(user.id);

      if (!profile) {
        return await ctx.editMessageText(
          "❌ شما هنوز پروفایل ندارید.\n" + 'روی "✏️ ویرایش پروفایل" کلیک کنید.'
        );
      }

      const likesCount = await likeService.getLikesCount(profile.id);

      console.log(
        "Target profile ----------------------------------------------------------:",
        profile
      );
      logger.warn(
        `Target profile ----------------------------------------------------------: ${JSON.stringify(
          profile
        )}`
      );

      const profileText =
        `👤 **پروفایل شما**\n\n` +
        `• نام: ${profile.display_name || profile.first_name}\n` +
        `• توضیحات: ${profile.bio || profile.first_name}\n` +
        `• جنسیت: ${profile.gender === "male" ? "پسر" : "دختر"}\n` +
        `• استان: ${getProvinceById(profile.province)?.name || "نامشخص"}\n` +
        `• شهر: ${
          getCityById(profile.city, profile.province)?.name || "نامشخص"
        }\n` +
        `• سن: ${profile.age}\n\n` +
        `• تعداد لایک‌ها: ${likesCount}\n` +
        `وضعیت هم‌اکنون 👀 ${
          profile.is_online ? "آنلایـــن (🗣)" : "آفلایـــن"
        }\n\n` +
        `🆔 آیدی: /user_${profile.custom_id}\n\n` +
        `تنظیم حالت سایلنت: /silent\n` +
        `حذف اکانت ربات: /deleted_account`;

      try {
        await ctx.deleteMessage();
      } catch {}

      if (profile.photo_file_id) {
        await ctx.replyWithPhoto(profile.photo_file_id, {
          caption: profileText,
          parse_mode: "Markdown",
          ...profileKeyboards.main(likesCount, profile.show_likes || false),
        });
      } else {
        await ctx.reply(profileText, {
          parse_mode: "Markdown",
          ...profileKeyboards.main(likesCount, profile.show_likes || false),
        });
      }
    } catch (error) {
      logger.error("❌ View profile error:", error);
      console.error("Full error:", error);
      await ctx.reply("⚠️ خطا در نمایش پروفایل");
    }
  }

  /**
   * ✅ شروع ویرایش پروفایل
   * این متد پیام قبلی را Edit می‌کند (تصویر و متن را حفظ می‌کند)
   */
  private async startEdit(ctx: MyContext) {
    const user = ctx.state.user;
    const profile = await profileService.getProfile(user.id);

    if (!profile) {
      return await ctx.editMessageText("❌ پروفایل یافت نشد.");
    }

    const likesCount = await likeService.getLikesCount(profile.id);

    console.log(
      "Target profile ----------------------------------------------------------:",
      profile
    );
    logger.warn(
      `Target profile ----------------------------------------------------------: ${JSON.stringify(
        profile
      )}`
    );

    const profileText =
      `<b>👤 پروفایل شما</b>\n\n` +
      `• نام: ${profile.display_name || profile.first_name}\n` +
      `• توضیحات: ${profile.bio || profile.first_name}\n` +
      `• جنسیت: ${profile.gender === "male" ? "پسر" : "دختر"}\n` +
      `• استان: ${getProvinceById(profile.province)?.name || "نامشخص"}\n` +
      `• شهر: ${
        getCityById(profile.city, profile.province)?.name || "نامشخص"
      }\n` +
      `• سن: ${profile.age}\n\n` +
      `• تعداد لایک‌ها: ${likesCount}\n` +
      `وضعیت هم‌اکنون 👀 ${
        profile.is_online ? "آنلایـــن (🗣)" : "آفلایـــن"
      }\n\n` +
      `🆔 آیدی: /user_${profile.custom_id}\n\n` +
      `<b>✏️ کدام بخش را می‌خواهید ویرایش کنید؟</b>`;

    // تغییر parse_mode
    await ctx.editMessageText(profileText, {
      parse_mode: "HTML", // ✅ تغییر از Markdown به HTML
      ...profileKeyboards.edit(),
    });

    try {
      // ✅ اگر پیام عکس دارد
      if (ctx.callbackQuery && "message" in ctx.callbackQuery) {
        const message = ctx.callbackQuery.message;
        if (message && "photo" in message) {
          // ✅ Edit کردن Caption عکس
          await ctx.editMessageCaption(profileText, {
            parse_mode: "Markdown",
            ...profileKeyboards.edit(),
          });
        } else {
          // ✅ Edit کردن متن پیام
          await ctx.editMessageText(profileText, {
            parse_mode: "Markdown",
            ...profileKeyboards.edit(),
          });
        }
      }
    } catch (error) {
      logger.error("❌ Edit profile error:", error);
      await ctx.reply("⚠️ خطا در ویرایش پروفایل");
    }
  }

  /**
   * ✅ مدیریت اکشن‌های پروفایل
   */
  async handleActions(ctx: MyContext) {
    if (!ctx.callbackQuery || !("data" in ctx.callbackQuery)) return;

    const action = ctx.callbackQuery.data;
    const user = ctx.state.user;

    try {
      await ctx.answerCbQuery();

      // ✅ مشاهده پروفایل
      if (action === "profile_view") {
        return await this.viewProfile(ctx);
      }

      // ✅ ویرایش پروفایل
      if (action === "profile_edit") {
        return await this.startEdit(ctx);
      }

      // ✅ تغییر عکس پروفایل
      if (action === "profile_change_photo") {
        return await this.requestPhoto(ctx);
      }

      // ✅ فعال/غیرفعال کردن لایک
      if (action === "profile_toggle_likes") {
        const profile = await profileService.getFullProfile(user.id);
        const newStatus = !profile.show_likes;

        await profileService.updatePrivacySettings(user.id, {
          show_likes: newStatus,
        });

        await ctx.answerCbQuery(
          newStatus ? "✅ نمایش لایک‌ها فعال شد" : "❌ نمایش لایک‌ها غیرفعال شد"
        );

        return await this.viewProfile(ctx);
      }

      // ✅ مشاهده لایک کننده‌ها
      if (action === "profile_view_likers") {
        return await this.showLikers(ctx);
      }

      // ✅ انتخاب جنسیت
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

      // ✅ انتخاب استان
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

      // ✅ رد شدن بیو
      if (action === "profile_skip_bio") {
        if (ctx.session.profileEdit) {
          ctx.session.profileEdit.bio = null;
        }
        await ctx.deleteMessage();
        return await this.requestPhoto(ctx);
      }

      // ✅ رد شدن عکس
      if (action === "profile_skip_photo") {
        if (!ctx.session.profileEdit) {
          return await ctx.reply("⚠️ خطا در پردازش اطلاعات");
        }

        try {
          if (fs.existsSync(DEFAULT_PHOTO_PATH)) {
            const photoMessage = await ctx.replyWithPhoto({
              source: DEFAULT_PHOTO_PATH,
            });

            const defaultFileId =
              photoMessage.photo[photoMessage.photo.length - 1].file_id;

            await profileService.updateProfilePhoto(user.id, defaultFileId);
          }

          delete ctx.session.awaitingPhoto;
          await ctx.deleteMessage();

          return await this.finishEdit(ctx);
        } catch (error) {
          logger.error("❌ Skip photo error:", error);
          await ctx.reply("⚠️ خطا در ثبت تصویر پیش‌فرض");
        }
      }

      // ✅ انصراف
      if (action === "profile_cancel") {
        delete ctx.session.profileEdit;
        delete ctx.session.awaitingPhoto;
        await ctx.editMessageText("❌ عملیات لغو شد.");
        return;
      }
    } catch (error) {
      logger.error("❌ Profile action error:", error);
      await ctx.reply("⚠️ خطایی رخ داد.");
    }
  }

  /**
   * ✅ نمایش لیست مخاطبین (اصلاح شده)
   */
  async showContacts(ctx: MyContext) {
    const user = ctx.state.user;

    try {
      const contacts = await contactService.getContacts(user.id);

      if (contacts.length === 0) {
        return await ctx.editMessageText(
          "📭 شما هیچ مخاطبی ندارید.",
          profileKeyboards.contactsList([])
        );
      }

      const contactsText =
        `👥 **لیست مخاطبین شما** (${contacts.length})\n\n` +
        contacts
          .slice(0, 10)
          .map(
            (c, i) =>
              `${i + 1}. ${c.is_favorite ? "⭐" : "👤"} ${
                c.display_name || c.first_name
              }`
          )
          .join("\n");

      await ctx.editMessageText(contactsText, {
        parse_mode: "Markdown",
        ...profileKeyboards.contactsList(contacts),
      });
    } catch (error) {
      logger.error("❌ Show contacts error:", error);
      console.error("Full error:", error);
      await ctx.reply("⚠️ خطا در نمایش مخاطبین");
    }
  }

  /**
   * ✅ نمایش فقط علاقه‌مندی‌ها
   */
  async showFavorites(ctx: MyContext) {
    const user = ctx.state.user;

    try {
      const favorites = await contactService.getContacts(user.id, true);

      if (favorites.length === 0) {
        return await ctx.editMessageText(
          "⭐ شما هیچ علاقه‌مندی ثبت نکرده‌اید.",
          Markup.inlineKeyboard([
            [Markup.button.callback("🔙 بازگشت", "show_contacts")],
          ])
        );
      }

      const favoritesText =
        `⭐ **علاقه‌مندی‌های شما** (${favorites.length})\n\n` +
        favorites
          .slice(0, 10)
          .map(
            (f, i) =>
              `${i + 1}. ⭐ ${f.display_name || f.first_name} - /user_${
                f.custom_id
              }`
          )
          .join("\n");

      await ctx.editMessageText(favoritesText, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
          [Markup.button.callback("👥 همه مخاطبین", "show_contacts")],
          [Markup.button.callback("🔙 بازگشت", "profile_view")],
        ]),
      });
    } catch (error) {
      logger.error("❌ Show favorites error:", error);
      await ctx.reply("⚠️ خطا در نمایش علاقه‌مندی‌ها");
    }
  }

  /**
   * ✅ نمایش لیست بلاک شده‌ها
   */
  async showBlockedUsers(ctx: MyContext) {
    const user = ctx.state.user;

    try {
      const blockedUsers = await blockService.getBlockedUsers(user.id);

      if (blockedUsers.length === 0) {
        return await ctx.editMessageText(
          "📭 شما کسی را بلاک نکرده‌اید.",
          profileKeyboards.blockedUsersList([])
        );
      }

      const blockedText =
        `🚫 **لیست افراد بلاک شده** (${blockedUsers.length})\n\n` +
        blockedUsers
          .slice(0, 10)
          .map(
            (u, i) =>
              `${i + 1}. ${u.display_name || u.first_name} - /user_${
                u.custom_id
              }`
          )
          .join("\n");

      await ctx.editMessageText(blockedText, {
        parse_mode: "Markdown",
        ...profileKeyboards.blockedUsersList(blockedUsers),
      });
    } catch (error) {
      logger.error("❌ Show blocked users error:", error);
      await ctx.reply("⚠️ خطا در نمایش لیست");
    }
  }

  /**
   * ✅ نمایش لایک کننده‌ها
   */
  async showLikers(ctx: MyContext) {
    const user = ctx.state.user;

    try {
      const profile = await profileService.getFullProfile(user.id);
      if (!profile) {
        return await ctx.editMessageText("❌ پروفایل یافت نشد.");
      }

      const likers = await likeService.getProfileLikers(profile.id);

      if (likers.length === 0) {
        return await ctx.editMessageText(
          "📭 هنوز کسی شما را لایک نکرده است.",
          Markup.inlineKeyboard([
            [Markup.button.callback("🔙 بازگشت", "profile_view")],
          ])
        );
      }

      const likersText =
        `❤️ **افرادی که شما را لایک کرده‌اند** (${likers.length})\n\n` +
        likers
          .slice(0, 10)
          .map(
            (l, i) =>
              `${i + 1}. ${l.display_name || l.first_name} - /user_${
                l.custom_id
              }`
          )
          .join("\n");

      await ctx.editMessageText(likersText, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
          [Markup.button.callback("🔙 بازگشت", "profile_view")],
        ]),
      });
    } catch (error) {
      logger.error("❌ Show likers error:", error);
      await ctx.reply("⚠️ خطا در نمایش لایک کننده‌ها");
    }
  }

  /**
   * ✅ تاگل لایک
   */
  async handleLikeToggle(ctx: MyContext) {
    if (!ctx.callbackQuery || !("data" in ctx.callbackQuery)) return;

    const targetUserId = parseInt(
      ctx.callbackQuery.data.replace("like_toggle_", "")
    );
    const user = ctx.state.user;

    try {
      const targetProfile = await profileService.getPublicProfile(
        { userId: targetUserId },
        user.id
      );

      if (!targetProfile) {
        return await ctx.answerCbQuery("❌ کاربر یافت نشد");
      }

      const result = await likeService.toggleLike(user.id, targetUserId);

      await ctx.answerCbQuery(result ? "❤️ لایک شد" : "💔 لایک حذف شد");

      // ✅ رفرش پروفایل
      await this.showUserProfile(ctx, targetUserId);
    } catch (error) {
      logger.error("❌ Like toggle error:", error);
      await ctx.answerCbQuery("⚠️ خطا در لایک");
    }
  }

  /**
   * ✅ تاگل مخاطب
   */
  async handleContactToggle(ctx: MyContext) {
    if (!ctx.callbackQuery || !("data" in ctx.callbackQuery)) return;

    const targetUserId = parseInt(
      ctx.callbackQuery.data.replace("contact_toggle_", "")
    );
    const user = ctx.state.user;

    try {
      const result = await contactService.toggleFavorite(user.id, targetUserId);

      await ctx.answerCbQuery(
        result === true ? "✅ به مخاطبین اضافه شد" : "❌ از مخاطبین حذف شد"
      );

      // ✅ رفرش پروفایل
      await this.showUserProfile(ctx, targetUserId);
    } catch (error) {
      logger.error("❌ Contact toggle error:", error);
      await ctx.answerCbQuery("⚠️ خطا در مدیریت مخاطب");
    }
  }

  /**
   * ✅ تاگل علاقه‌مندی
   */
  async handleFavoriteToggle(ctx: MyContext) {
    if (!ctx.callbackQuery || !("data" in ctx.callbackQuery)) return;

    const targetUserId = parseInt(
      ctx.callbackQuery.data.replace("toggle_favorite_", "")
    );
    const user = ctx.state.user;

    try {
      const result = await contactService.toggleFavorite(user.id, targetUserId);

      await ctx.answerCbQuery(
        result === true
          ? "⭐ به علاقه‌مندی‌ها اضافه شد"
          : "❌ از علاقه‌مندی‌ها حذف شد"
      );

      // ✅ رفرش لیست
      await this.showContacts(ctx);
    } catch (error) {
      logger.error("❌ Favorite toggle error:", error);
      await ctx.answerCbQuery("⚠️ خطا در مدیریت علاقه‌مندی");
    }
  }

  /**
   * ✅ حذف از علاقه‌مندی‌ها
   */
  async handleRemoveFavorite(ctx: MyContext) {
    if (!ctx.callbackQuery || !("data" in ctx.callbackQuery)) return;

    const targetUserId = parseInt(
      ctx.callbackQuery.data.replace("remove_favorite_", "")
    );
    const user = ctx.state.user;

    try {
      await contactService.toggleFavorite(user.id, targetUserId);
      await ctx.answerCbQuery("❌ از علاقه‌مندی‌ها حذف شد");

      // ✅ رفرش لیست
      await this.showFavorites(ctx);
    } catch (error) {
      logger.error("❌ Remove favorite error:", error);
      await ctx.answerCbQuery("⚠️ خطا در حذف");
    }
  }

  /**
   * ✅ بلاک کردن کاربر
   */
  async handleBlockUser(ctx: MyContext, targetUserId: number) {
    const user = ctx.state.user;

    try {
      await blockService.blockUser(user.id, targetUserId);
      await ctx.answerCbQuery("🚫 کاربر بلاک شد");

      // ✅ رفرش پروفایل
      await this.showUserProfile(ctx, targetUserId);
    } catch (error) {
      logger.error("❌ Block user error:", error);
      await ctx.answerCbQuery("⚠️ خطا در بلاک کردن");
    }
  }

  /**
   * ✅ آنبلاک کردن کاربر
   */
  async handleUnblockUser(ctx: MyContext, targetUserId: number) {
    const user = ctx.state.user;

    try {
      await blockService.unblockUser(user.id, targetUserId);
      await ctx.answerCbQuery("✅ کاربر آنبلاک شد");

      // ✅ رفرش پروفایل
      await this.showUserProfile(ctx, targetUserId);
    } catch (error) {
      logger.error("❌ Unblock user error:", error);
      await ctx.answerCbQuery("⚠️ خطا در آنبلاک کردن");
    }
  }

  /**
   * ✅ نمایش پروفایل کاربر دیگر
   */
  async showUserProfile(ctx: MyContext, targetUserId: number) {
    const user = ctx.state.user;

    try {
      const profile = await profileService.getPublicProfile(
        { userId: targetUserId },
        user.id
      );

      if (!profile) {
        return await ctx.answerCbQuery("❌ کاربر یافت نشد");
      }

      const profileText =
        `👤 **پروفایل کاربر**\n\n` +
        `• نام: ${profile.display_name || "نامشخص"}\n` +
        `• توضیحات: ${profile.bio || profile.first_name}\n` +
        `• جنسیت: ${profile.gender === "male" ? "پسر" : "دختر"}\n` +
        `• استان: ${getProvinceById(profile.province)?.name || "نامشخص"}\n` +
        `• شهر: ${
          getCityById(profile.city, profile.province)?.name || "نامشخص"
        }\n` +
        `• سن: ${profile.age}\n\n` +
        `${profile.bio ? `📝 ${profile.bio}\n\n` : ""}` +
        `وضعیت: ${profile.is_online ? "👀 آنلایـــن" : "⏸ آفلایـــن"}`;

      // ✅ بررسی وضعیت بلاک
      const blockStatus = await blockService.getBlockStatus(
        user.id,
        targetUserId
      );

      let keyboard;

      if (blockStatus.user1BlockedUser2) {
        // ✅ من طرف مقابل را بلاک کرده‌ام
        keyboard = profileKeyboards.profileBlockedByMe(targetUserId);
      } else if (blockStatus.user2BlockedUser1) {
        // ✅ طرف مقابل من را بلاک کرده
        keyboard = profileKeyboards.profileBlockedByThem(
          targetUserId,
          profile.is_liked_by_viewer || false
        );
      } else {
        // ✅ هیچ بلاکی وجود ندارد
        keyboard = profileKeyboards.publicProfile(targetUserId, {
          isLiked: profile.is_liked_by_viewer || false,
          isInContacts: profile.is_in_contacts || false,
          hasChatHistory: profile.has_chat_history || false,
        });
      }

      // ✅ حذف پیام قبلی
      try {
        await ctx.deleteMessage();
      } catch {}

      // ✅ ارسال پروفایل
      if (profile.photo_file_id) {
        await ctx.replyWithPhoto(profile.photo_file_id, {
          caption: profileText,
          parse_mode: "Markdown",
          ...keyboard,
        });
      } else {
        await ctx.reply(profileText, {
          parse_mode: "Markdown",
          ...keyboard,
        });
      }
    } catch (error) {
      logger.error("❌ Show user profile error:", error);
      await ctx.reply("⚠️ خطا در نمایش پروفایل");
    }
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

    await ctx.editMessageText(
      "📝 یک توضیح کوتاه درباره خودتان بنویسید:\n" +
        "(حداکثر 500 کاراکتر)\n\n" +
        'یا روی "رد شدن" کلیک کنید.',
      profileKeyboards.bioInput()
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
        'یا روی "رد شدن" کلیک کنید.',
      profileKeyboards.photoInput()
    );
  }

  /**
   * ✅ مدیریت آپلود عکس
   */
  async handlePhoto(ctx: MyContext) {
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

        ctx.session.profileEdit.bio = text;

        try {
          if (
            ctx.callbackQuery &&
            "message" in ctx.callbackQuery &&
            ctx.callbackQuery.message
          ) {
            await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
          }
        } catch (e) {
          // اگه پیام قبلی حذف نشد مشکلی نیست
        }

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

    // ✅ بررسی وجود فیلدهای ضروری
    if (!data.gender || !data.age || !data.province_id || !data.city_id) {
      return await ctx.reply("⚠️ لطفاً تمام اطلاعات پروفایل را تکمیل کنید.");
    }

    try {
      // ✅ ایجاد یا به‌روزرسانی پروفایل
      await profileService.updateProfile(user.id, {
        gender: data.gender,
        age: data.age,
        province: data.province_id,
        city: data.city_id,
        bio: data.bio || null,
      });

      delete ctx.session.profileEdit;
      delete ctx.session.awaitingPhoto;

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
