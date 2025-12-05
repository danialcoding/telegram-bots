// src/bot/handlers/profile.handler.ts
import { profileService } from "../../services/profile.service";
import { likeService } from "../../services/like.service";
import { contactService } from "../../services/contact.service";
import { blockService } from "../../services/block.service";
import { directMessageService } from "../../services/directMessage.service";
import { getBalance, deductCoins, hasEnoughCoins, rewardReferral, rewardSignup } from "../../services/coin.service";
import { coinHandler } from "./coin.handler";
import logger from "../../utils/logger";
import { profileKeyboards } from "../keyboards/profile.keyboard";
import { mainMenuKeyboard } from "../keyboards/main.keyboard";
import { MyContext } from "../../types/bot.types";
import { getProvinceById, getCityById } from "../../utils/locations";
import { Markup } from "telegraf";
import path from "path";
import fs from "fs";
import { pool } from "../../database/db";

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

      // ✅ بررسی وضعیت آنلاین و چت فعال
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      let isOnline = false;
      
      if (profile.is_online && profile.last_seen) {
        const lastSeenDate = new Date(profile.last_seen);
        isOnline = lastSeenDate > fiveMinutesAgo;
      }

      // ✅ تشخیص وضعیت: اگر چت فعال دارد فقط 🗣 نمایش بده
      let statusText = '';
      if (profile.has_active_chat) {
        statusText = 'وضعیت هم‌اکنون 👀 🗣';
      } else if (isOnline) {
        statusText = 'وضعیت هم‌اکنون 👀 آنلایـــن';
      } else {
        statusText = 'وضعیت هم‌اکنون 👀 آفلایـــن';
      }

      // ✅ متن پروفایل با فرمت دقیق (بدون Markdown خاص)
      const profileText =
        `👤 پروفایل شما\n\n` +
        `• نام: ${profile.display_name || profile.first_name}\n` +
        `• توضیحات: ${profile.bio || profile.first_name}\n` +
        `• جنسیت: ${profile.gender === "male" ? "پسر" : "دختر"}\n` +
        `• استان: ${getProvinceById(profile.province)?.name || "نامشخص"}\n` +
        `• شهر: ${
          getCityById(profile.city, profile.province)?.name || "نامشخص"
        }\n` +
        `• سن: ${profile.age}\n\n` +
        `• تعداد لایک‌ها: ${likesCount}\n` +
        `${statusText}\n\n` +
        `🆔 آیدی: /user_${profile.custom_id}\n\n` +
        `تنظیم حالت سایلنت: /silent\n` +
        `حذف اکانت ربات: /deleted_account`;

      // ✅ ارسال تصویر + متن با کیبورد جدید
      if (profile.photo_file_id) {
        // اگر کاربر عکس دارد، از عکس پروفایلش استفاده کن
        await ctx.replyWithPhoto(profile.photo_file_id, {
          caption: profileText,
          ...profileKeyboards.main(likesCount, profile.show_likes || false),
        });
      } else {
        // اگر کاربر عکس ندارد، از عکس پیش‌فرض استفاده کن
        try {
          if (fs.existsSync(DEFAULT_PHOTO_PATH)) {
            await ctx.replyWithPhoto(
              { source: DEFAULT_PHOTO_PATH },
              {
                caption: profileText,
                ...profileKeyboards.main(likesCount, profile.show_likes || false),
              }
            );
          } else {
            // اگر عکس پیش‌فرض هم وجود ندارد، فقط متن بفرست
            await ctx.reply(profileText, {
              ...profileKeyboards.main(likesCount, profile.show_likes || false),
            });
          }
        } catch (error) {
          logger.error("❌ Error sending default photo:", error);
          // در صورت خطا، فقط متن بفرست
          await ctx.reply(profileText, {
            ...profileKeyboards.main(likesCount, profile.show_likes || false),
          });
        }
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

      // ✅ بررسی وضعیت آنلاین و چت فعال
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      let isOnline = false;
      
      if (profile.is_online && profile.last_seen) {
        const lastSeenDate = new Date(profile.last_seen);
        isOnline = lastSeenDate > fiveMinutesAgo;
      }

      // ✅ تشخیص وضعیت: اگر چت فعال دارد فقط 🗣 نمایش بده
      let statusText = '';
      if (profile.has_active_chat) {
        statusText = 'وضعیت هم‌اکنون 👀 🗣';
      } else if (isOnline) {
        statusText = 'وضعیت هم‌اکنون 👀 آنلایـــن';
      } else {
        statusText = 'وضعیت هم‌اکنون 👀 آفلایـــن';
      }

      const profileText =
        `👤 پروفایل شما\n\n` +
        `• نام: ${profile.display_name || profile.first_name}\n` +
        `• توضیحات: ${profile.bio || profile.first_name}\n` +
        `• جنسیت: ${profile.gender === "male" ? "پسر" : "دختر"}\n` +
        `• استان: ${getProvinceById(profile.province)?.name || "نامشخص"}\n` +
        `• شهر: ${
          getCityById(profile.city, profile.province)?.name || "نامشخص"
        }\n` +
        `• سن: ${profile.age}\n\n` +
        `• تعداد لایک‌ها: ${likesCount}\n` +
        `${statusText}\n\n` +
        `🆔 آیدی: /user_${profile.custom_id}\n\n` +
        `تنظیم حالت سایلنت: /silent\n` +
        `حذف اکانت ربات: /deleted_account`;

      try {
        await ctx.deleteMessage();
      } catch {}

      if (profile.photo_file_id) {
        // اگر کاربر عکس دارد، از عکس پروفایلش استفاده کن
        await ctx.replyWithPhoto(profile.photo_file_id, {
          caption: profileText,
          ...profileKeyboards.main(likesCount, profile.show_likes || false),
        });
      } else {
        // اگر کاربر عکس ندارد، از عکس پیش‌فرض استفاده کن
        try {
          if (fs.existsSync(DEFAULT_PHOTO_PATH)) {
            await ctx.replyWithPhoto(
              { source: DEFAULT_PHOTO_PATH },
              {
                caption: profileText,
                ...profileKeyboards.main(likesCount, profile.show_likes || false),
              }
            );
          } else {
            // اگر عکس پیش‌فرض هم وجود ندارد، فقط متن بفرست
            await ctx.reply(profileText, {
              ...profileKeyboards.main(likesCount, profile.show_likes || false),
            });
          }
        } catch (photoError) {
          logger.error("❌ Error sending default photo in viewProfile:", photoError);
          // در صورت خطا، فقط متن بفرست
          await ctx.reply(profileText, {
            ...profileKeyboards.main(likesCount, profile.show_likes || false),
          });
        }
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
      try {
        await ctx.deleteMessage();
      } catch {}
      return await ctx.reply("❌ پروفایل یافت نشد.");
    }

    const likesCount = await likeService.getLikesCount(profile.id);

    // ✅ دریافت وضعیت آنلاین و چت فعال
    const fullProfile = await profileService.getFullProfile(user.id);
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    let isOnline = false;
    
    if (fullProfile?.is_online && fullProfile?.last_seen) {
      const lastSeenDate = new Date(fullProfile.last_seen);
      isOnline = lastSeenDate > fiveMinutesAgo;
    }

    let statusText = '';
    if (fullProfile?.has_active_chat) {
      statusText = 'وضعیت هم‌اکنون 👀 🗣';
    } else if (isOnline) {
      statusText = 'وضعیت هم‌اکنون 👀 آنلایـــن';
    } else {
      statusText = 'وضعیت هم‌اکنون 👀 آفلایـــن';
    }

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
      `${statusText}\n\n` +
      `🆔 آیدی: /user_${profile.custom_id}\n\n` +
      `<b>✏️ کدام بخش را می‌خواهید ویرایش کنید؟</b>`;

    try {
      // ✅ بررسی نوع پیام قبلی
      if (ctx.callbackQuery && "message" in ctx.callbackQuery) {
        const message = ctx.callbackQuery.message;
        if (message && "photo" in message) {
          // ✅ اگر پیام عکس دارد، Caption را Edit کن
          await ctx.editMessageCaption(profileText, {
            parse_mode: "HTML",
            ...profileKeyboards.edit(),
          });
        } else if (message && "text" in message) {
          // ✅ اگر پیام متنی است، متن را Edit کن
          await ctx.editMessageText(profileText, {
            parse_mode: "HTML",
            ...profileKeyboards.edit(),
          });
        } else {
          // ✅ در غیر این صورت، پیام قبلی را حذف و پیام جدید بفرست
          await ctx.deleteMessage();
          await ctx.reply(profileText, {
            parse_mode: "HTML",
            ...profileKeyboards.edit(),
          });
        }
      } else {
        // ✅ اگر callback query نیست، پیام جدید بفرست
        await ctx.reply(profileText, {
          parse_mode: "HTML",
          ...profileKeyboards.edit(),
        });
      }
    } catch (error) {
      logger.error("❌ Edit profile error:", error);
      console.error("Full error:", error);
      // در صورت خطا، پیام قبلی را حذف و پیام جدید بفرست
      try {
        await ctx.deleteMessage();
        await ctx.reply(profileText, {
          parse_mode: "HTML",
          ...profileKeyboards.edit(),
        });
      } catch (retryError) {
        await ctx.reply("⚠️ خطا در ویرایش پروفایل");
      }
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

      // ==================== نمایش و ویرایش ====================
      
      // مشاهده پروفایل
      if (action === "profile_view") {
        return await this.viewProfile(ctx);
      }

      // شروع ویرایش پروفایل
      if (action === "profile_edit") {
        return await this.startEdit(ctx);
      }

      // ==================== ویرایش فیلدهای پروفایل ====================
      
      // ویرایش نام
      if (action === "profile_edit_name") {
        ctx.session.profileEdit = { step: "name" };
        try {
          await ctx.deleteMessage();
        } catch {}
        return await ctx.reply(
          "👤 نام جدید خود را وارد کنید:\n(حداکثر 50 کاراکتر)",
          Markup.inlineKeyboard([
            [Markup.button.callback("❌ انصراف", "profile_cancel")]
          ])
        );
      }

      // ویرایش سن
      if (action === "profile_edit_age") {
        ctx.session.profileEdit = { step: "age" };
        try {
          await ctx.deleteMessage();
        } catch {}
        return await ctx.reply(
          "🎂 سن خود را وارد کنید:\n(عدد بین 13 تا 100)",
          Markup.inlineKeyboard([
            [Markup.button.callback("❌ انصراف", "profile_cancel")]
          ])
        );
      }

      // ویرایش جنسیت
      if (action === "profile_edit_gender") {
        ctx.session.profileEdit = { step: "gender" };
        try {
          await ctx.deleteMessage();
        } catch {}
        return await ctx.reply(
          "🚻 جنسیت خود را انتخاب کنید:",
          profileKeyboards.gender()
        );
      }

      // ویرایش بیوگرافی
      if (action === "profile_edit_bio") {
        ctx.session.profileEdit = { step: "bio" };
        try {
          await ctx.deleteMessage();
        } catch {}
        return await ctx.reply(
          "📝 بیوگرافی جدید خود را وارد کنید:\n(حداکثر 500 کاراکتر)",
          Markup.inlineKeyboard([
            [Markup.button.callback("🗑 حذف بیوگرافی", "profile_delete_bio")],
            [Markup.button.callback("❌ انصراف", "profile_cancel")]
          ])
        );
      }

      // حذف بیوگرافی
      if (action === "profile_delete_bio") {
        await profileService.updateProfile(user.id, { bio: null });
        return await ctx.reply(
          "✅ بیوگرافی شما حذف شد.",
          Markup.inlineKeyboard([
            [Markup.button.callback("🔙 بازگشت به پروفایل", "profile_view")]
          ])
        );
      }

      // ویرایش شهر (باید ابتدا استان انتخاب شود)
      if (action === "profile_edit_city") {
        return await ctx.reply(
          "⚠️ برای تغییر شهر، ابتدا استان جدید را انتخاب کنید.",
          Markup.inlineKeyboard([
            [Markup.button.callback("📍 انتخاب استان", "profile_select_province")],
            [Markup.button.callback("🔙 بازگشت", "profile_view")]
          ])
        );
      }

      // تغییر عکس پروفایل
      if (action === "profile_change_photo") {
        return await this.requestPhoto(ctx);
      }

      // ==================== حریم خصوصی ====================
      
      // فعال/غیرفعال کردن نمایش لایک
      if (action === "profile_toggle_likes") {
        const profile = await profileService.getFullProfile(user.id);
        if (!profile) {
          return await ctx.answerCbQuery("❌ پروفایل یافت نشد");
        }
        
        const newStatus = !profile.show_likes;
        await profileService.updatePrivacySettings(user.id, {
          show_likes: newStatus,
        });

        await ctx.answerCbQuery(
          newStatus ? "✅ نمایش لایک‌ها فعال شد" : "❌ نمایش لایک‌ها غیرفعال شد"
        );

        return await this.viewProfile(ctx);
      }

      // مشاهده لایک کننده‌ها
      if (action === "profile_view_likers") {
        return await this.showLikers(ctx);
      }

      // ==================== مخاطبین ====================
      
      // نمایش لیست مخاطبین
      if (action === "show_contacts") {
        return await this.showContacts(ctx);
      }

      // ==================== ثبت نام / تکمیل پروفایل ====================
      
      // انتخاب جنسیت در ثبت نام
      if (action.startsWith("profile_gender_")) {
        const gender = action.replace("profile_gender_", "") as "male" | "female";

        if (!ctx.session.profileEdit) {
          ctx.session.profileEdit = {};
        }

        // بررسی وجود پروفایل
        const existingProfile = await profileService.getProfile(user.id);

        // اگر پروفایل وجود دارد و در حال ویرایش است
        if (existingProfile && ctx.session.profileEdit.step === "gender") {
          await profileService.updateProfile(user.id, { gender });
          delete ctx.session.profileEdit;
          return await ctx.reply(
            "✅ جنسیت شما به‌روزرسانی شد.",
            Markup.inlineKeyboard([
              [Markup.button.callback("🔙 بازگشت به پروفایل", "profile_view")]
            ])
          );
        }

        // اگر در حال ثبت نام است (پروفایل وجود ندارد)
        ctx.session.profileEdit.gender = gender;
        return await this.requestAge(ctx);
      }

      // انتخاب استان
      if (action === "profile_select_province") {
        ctx.session.profileEdit = ctx.session.profileEdit || {};
        ctx.session.profileEdit.step = "province";
        
        try {
          await ctx.deleteMessage();
        } catch {}
        
        return await ctx.reply(
          "📍 استان خود را انتخاب کنید:",
          profileKeyboards.province()
        );
      }

      // انتخاب استان خاص
      if (action.startsWith("profile_province_")) {
        const provinceId = parseInt(action.replace("profile_province_", ""));

        if (!ctx.session.profileEdit) {
          ctx.session.profileEdit = {};
        }
        ctx.session.profileEdit.province_id = provinceId;
        ctx.session.profileEdit.step = "city";

        try {
          await ctx.deleteMessage();
        } catch {}

        return await ctx.reply(
          "🏙 شهر خود را انتخاب کنید:",
          profileKeyboards.city(provinceId)
        );
      }

      // انتخاب شهر
      if (action.startsWith("profile_city_")) {
        const cityId = parseInt(action.replace("profile_city_", ""));

        if (!ctx.session.profileEdit) {
          ctx.session.profileEdit = {};
        }
        ctx.session.profileEdit.city_id = cityId;

        // بررسی وجود پروفایل
        const existingProfile = await profileService.getProfile(user.id);

        // اگر پروفایل وجود دارد و در حال ویرایش است
        if (existingProfile && ctx.session.profileEdit.province_id) {
          await profileService.updateProfile(user.id, {
            province: ctx.session.profileEdit.province_id,
            city: cityId
          });
          delete ctx.session.profileEdit;
          
          return await ctx.reply(
            "✅ استان و شهر شما به‌روزرسانی شد.",
            Markup.inlineKeyboard([
              [Markup.button.callback("🔙 بازگشت به پروفایل", "profile_view")]
            ])
          );
        }

        // اگر در حال ثبت نام است
        return await this.requestBio(ctx);
      }

      // ==================== مراحل ثبت نام ====================
      
      // رد شدن بیو در ثبت نام
      if (action === "profile_skip_bio") {
        if (ctx.session.profileEdit) {
          ctx.session.profileEdit.bio = null;
        }
        try {
          await ctx.deleteMessage();
        } catch {}
        return await this.requestPhoto(ctx);
      }

      // رد شدن عکس در ثبت نام
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
          try {
            await ctx.deleteMessage();
          } catch {}

          return await this.finishEdit(ctx);
        } catch (error) {
          logger.error("❌ Skip photo error:", error);
          await ctx.reply("⚠️ خطا در ثبت تصویر پیش‌فرض");
        }
      }

      // انصراف از عملیات
      if (action === "profile_cancel") {
        delete ctx.session.profileEdit;
        delete ctx.session.awaitingPhoto;
        
        try {
          await ctx.deleteMessage();
        } catch {}
        
        return await ctx.reply(
          "❌ عملیات لغو شد.",
          Markup.inlineKeyboard([
            [Markup.button.callback("🔙 بازگشت به پروفایل", "profile_view")]
          ])
        );
      }
      
    } catch (error) {
      logger.error("❌ Profile action error:", error);
      console.error("Full error:", error);
      await ctx.reply("⚠️ خطایی رخ داد.");
    }
  }

  /**
   * ✅ نمایش لیست مخاطبین (اصلاح شده)
   */
  // async showContacts(ctx: MyContext) {
  //   const user = ctx.state.user;

  //   try {
  //     const contacts = await contactService.getContacts(user.id);

  //     if (contacts.length === 0) {
  //       return await ctx.editMessageText(
  //         "📭 شما هیچ مخاطبی ندارید.",
  //         profileKeyboards.contactsList([])
  //       );
  //     }

  //     const contactsText =
  //       `👥 **لیست مخاطبین شما** (${contacts.length})\n\n` +
  //       contacts
  //         .slice(0, 10)
  //         .map(
  //           (c, i) =>
  //             `${i + 1}. ${c.is_favorite ? "⭐" : "👤"} ${
  //               c.display_name || c.first_name
  //             }`
  //         )
  //         .join("\n");

  //     await ctx.editMessageText(contactsText, {
  //       parse_mode: "Markdown",
  //       ...profileKeyboards.contactsList(contacts),
  //     });
  //   } catch (error) {
  //     logger.error("❌ Show contacts error:", error);
  //     console.error("Full error:", error);
  //     await ctx.reply("⚠️ خطا در نمایش مخاطبین");
  //   }
  // }

  /**
   * ✅ نمایش لیست مخاطبین با pagination
   */
  async showContacts(ctx: MyContext, page: number = 1) {
    const user = ctx.state.user;

    try {
      const result = await contactService.getContacts(user.id, page, 10);
      const { contacts, totalCount, currentPage, hasNext, hasPrev } = result;

      // حذف پیام قبلی
      try {
        await ctx.deleteMessage();
      } catch (deleteError) {
        // نادیده گرفته شود
      }

      if (totalCount === 0) {
        return await ctx.reply(
          "📭 شما هیچ مخاطبی ندارید.",
          Markup.inlineKeyboard([
            [Markup.button.callback("🔙 بازگشت", "profile_view")],
          ])
        );
      }

      // ✅ ساخت متن لیست مخاطبین
      const contactsText =
        `👥 لیست مخاطبین شما (${totalCount})\n` +
        `📄 صفحه ${currentPage}\n\n` +
        contacts
          .map((contact, i) => {
            const name = contact.display_name || contact.first_name || "بدون نام";
            const genderIcon = contact.gender === "male" ? "🙍" : "🙍‍♀️";
            const age = contact.age || "❓";
            
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
            const lastActivity = contact.last_activity ? new Date(contact.last_activity) : null;
            const isOnline = contact.is_online && lastActivity && lastActivity > fiveMinutesAgo;
            
            const hasActiveChat = contact.has_active_chat || false;
            const chatIcon = hasActiveChat ? " (🗣)" : "";
            const onlineStatus = isOnline ? `👀 آنلایـــن${chatIcon}` : "⏸ آفلایـــن";
            
            const province = getProvinceById(contact.province)?.name || "نامشخص";
            const city = getCityById(contact.city, contact.province)?.name || "نامشخص";
            const likesCount = contact.likes_count || 0;
            
            return (
              `${(currentPage - 1) * 10 + i + 1}. ${genderIcon}${age} ${name} /user_${contact.custom_id}\n` +
              `   ${province}(${city}) (🤍️${likesCount})\n` +
              `   هم‌اکنون ${onlineStatus}`
            );
          })
          .join("\n\n");

      // دکمه‌های pagination
      const buttons = [];
      const navButtons = [];
      
      if (hasPrev) {
        navButtons.push(Markup.button.callback("⬅️ قبلی", `contacts_page_${currentPage - 1}`));
      }
      if (hasNext) {
        navButtons.push(Markup.button.callback("➡️ بعدی", `contacts_page_${currentPage + 1}`));
      }
      
      if (navButtons.length > 0) {
        buttons.push(navButtons);
      }
      
      buttons.push([Markup.button.callback("🔄 بارگزاری مجدد", `contacts_page_${currentPage}`)]);
      buttons.push([Markup.button.callback("🔙 بازگشت", "profile_view")]);

      await ctx.reply(contactsText, Markup.inlineKeyboard(buttons));

      logger.info(`✅ Contacts list sent (page ${currentPage}/${result.totalPages})`);
    } catch (error) {
      logger.error("❌ Show contacts error:", error);
      await ctx.reply("⚠️ خطا در نمایش لیست مخاطبین");
    }
  }

  /**
   * ✅ نمایش فقط علاقه‌مندی‌ها
   */
  async showFavorites(ctx: MyContext) {
    const user = ctx.state.user;

    try {
      const favorites = await contactService.getContacts(user.id, true);

      // حذف پیام قبلی
      try {
        await ctx.deleteMessage();
      } catch {}

      if (favorites.length === 0) {
        return await ctx.reply(
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

      await ctx.reply(favoritesText, {
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
   * ✅ نمایش لیست بلاک شده‌ها با pagination
   */
  async showBlockedUsers(ctx: MyContext, page: number = 1) {
    const user = ctx.state.user;

    try {
      const result = await blockService.getBlockedUsers(user.id, page, 10);
      const { blockedUsers, totalCount, currentPage, hasNext, hasPrev } = result;

      // حذف پیام قبلی
      try {
        await ctx.deleteMessage();
      } catch {}

      if (totalCount === 0) {
        return await ctx.reply(
          "📭 شما کسی را بلاک نکرده‌اید.",
          Markup.inlineKeyboard([
            [Markup.button.callback("🔙 بازگشت", "profile_view")],
          ])
        );
      }

      const blockedText =
        `🚫 لیست افراد بلاک شده (${totalCount})\n` +
        `📄 صفحه ${currentPage}\n\n` +
        blockedUsers
          .map((u, i) => {
            const name = u.display_name || u.first_name || "بدون نام";
            const genderIcon = u.gender === "male" ? "🙍" : "🙍‍♀️";
            const age = u.age || "❓";
            
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
            const lastActivity = u.last_activity ? new Date(u.last_activity) : null;
            const isOnline = u.is_online && lastActivity && lastActivity > fiveMinutesAgo;
            
            const hasActiveChat = u.has_active_chat || false;
            const chatIcon = hasActiveChat ? " (🗣)" : "";
            const onlineStatus = isOnline ? `👀 آنلایـــن${chatIcon}` : "⏸ آفلایـــن";
            
            const province = getProvinceById(u.province)?.name || "نامشخص";
            const city = getCityById(u.city, u.province)?.name || "نامشخص";
            const likesCount = u.likes_count || 0;
            
            return (
              `${(currentPage - 1) * 10 + i + 1}. ${genderIcon}${age} ${name} /user_${u.custom_id}\n` +
              `   ${province}(${city}) (🤍️${likesCount})\n` +
              `   هم‌اکنون ${onlineStatus}`
            );
          })
          .join("\n\n");

      // دکمه‌های pagination
      const buttons = [];
      const navButtons = [];
      
      if (hasPrev) {
        navButtons.push(Markup.button.callback("⬅️ قبلی", `blocked_page_${currentPage - 1}`));
      }
      if (hasNext) {
        navButtons.push(Markup.button.callback("➡️ بعدی", `blocked_page_${currentPage + 1}`));
      }
      
      if (navButtons.length > 0) {
        buttons.push(navButtons);
      }
      
      buttons.push([Markup.button.callback("🔄 بارگزاری مجدد", `blocked_page_${currentPage}`)]);
      buttons.push([Markup.button.callback("🔙 بازگشت", "profile_view")]);

      await ctx.reply(blockedText, Markup.inlineKeyboard(buttons));
    } catch (error) {
      logger.error("❌ Show blocked users error:", error);
      await ctx.reply("⚠️ خطا در نمایش لیست");
    }
  }

  /**
   * ✅ نمایش لایک کننده‌ها با pagination
   */
  async showLikers(ctx: MyContext, page: number = 1) {
    const user = ctx.state.user;

    try {
      const profile = await profileService.getFullProfile(user.id);
      if (!profile) {
        try {
          await ctx.deleteMessage();
        } catch {}
        return await ctx.reply("❌ پروفایل یافت نشد.");
      }

      const result = await likeService.getProfileLikers(profile.id, page, 10);
      const { likers, totalCount, currentPage, hasNext, hasPrev } = result;

      // حذف پیام قبلی
      try {
        await ctx.deleteMessage();
      } catch {}

      if (totalCount === 0) {
        return await ctx.reply(
          "📭 هنوز کسی شما را لایک نکرده است.",
          Markup.inlineKeyboard([
            [Markup.button.callback("🔙 بازگشت", "profile_view")],
          ])
        );
      }

      const likersText =
        `❤️ افرادی که شما را لایک کرده‌اند (${totalCount})\n` +
        `📄 صفحه ${currentPage}\n\n` +
        likers
          .map((l, i) => {
            const name = l.display_name || l.first_name || "بدون نام";
            const genderIcon = l.gender === "male" ? "🙍" : "🙍‍♀️";
            const age = l.age || "❓";
            
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
            const lastActivity = l.last_activity ? new Date(l.last_activity) : null;
            const isOnline = l.is_online && lastActivity && lastActivity > fiveMinutesAgo;
            
            const hasActiveChat = l.has_active_chat || false;
            const chatIcon = hasActiveChat ? " (🗣)" : "";
            const onlineStatus = isOnline ? `👀 آنلایـــن${chatIcon}` : "⏸ آفلایـــن";
            
            const province = getProvinceById(l.province)?.name || "نامشخص";
            const city = getCityById(l.city, l.province)?.name || "نامشخص";
            const likesCount = l.likes_count || 0;
            
            return (
              `${(currentPage - 1) * 10 + i + 1}. ${genderIcon}${age} ${name} /user_${l.custom_id}\n` +
              `   ${province}(${city}) (🤍️${likesCount})\n` +
              `   هم‌اکنون ${onlineStatus}`
            );
          })
          .join("\n\n");

      // دکمه‌های pagination
      const buttons = [];
      const navButtons = [];
      
      if (hasPrev) {
        navButtons.push(Markup.button.callback("⬅️ قبلی", `likers_page_${currentPage - 1}`));
      }
      if (hasNext) {
        navButtons.push(Markup.button.callback("➡️ بعدی", `likers_page_${currentPage + 1}`));
      }
      
      if (navButtons.length > 0) {
        buttons.push(navButtons);
      }
      
      buttons.push([Markup.button.callback("🔄 بارگزاری مجدد", `likers_page_${currentPage}`)]);
      buttons.push([Markup.button.callback("🔙 بازگشت", "profile_view")]);

      await ctx.reply(likersText, Markup.inlineKeyboard(buttons));
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
      // ✅ دریافت پروفایل کاربر جاری
      const myProfile = await profileService.getProfile(user.id);
      if (!myProfile) {
        return await ctx.answerCbQuery("❌ ابتدا پروفایل خود را تکمیل کنید");
      }

      // ✅ دریافت پروفایل کاربر مقصد
      const targetProfile = await profileService.getPublicProfile(
        { userId: targetUserId },
        user.id
      );

      if (!targetProfile) {
        return await ctx.answerCbQuery("❌ کاربر یافت نشد");
      }

      // ✅ استفاده از profile.id برای هر دو
      const result = await likeService.toggleLike(myProfile.id, targetProfile.id);

      await ctx.answerCbQuery(result ? "❤️ لایک شد" : "💔 لایک برداشته شد");

      // ✅ به‌روزرسانی دکمه‌ها بدون ارسال مجدد پروفایل
      const likesCount = await likeService.getLikesCount(targetProfile.id);
      const showLikes = targetProfile.show_likes !== false;

      // ✅ بررسی وضعیت بلاک
      const blockStatus = await blockService.getBlockStatus(
        user.id,
        targetUserId
      );

      let keyboard;

      if (blockStatus.user1BlockedUser2) {
        keyboard = profileKeyboards.profileBlockedByMe(targetUserId, {
          isLiked: result,
          likesCount: likesCount,
          showLikes: showLikes,
        });
      } else if (blockStatus.user2BlockedUser1) {
        keyboard = profileKeyboards.profileBlockedByThem(
          targetUserId,
          result // وضعیت جدید لایک
        );
      } else {
        keyboard = profileKeyboards.publicProfile(targetUserId, {
          isLiked: result, // وضعیت جدید لایک
          isInContacts: targetProfile.is_in_contacts || false,
          hasChatHistory: targetProfile.has_chat_history || false,
          likesCount: likesCount,
          showLikes: showLikes,
        });
      }

      // ✅ ویرایش کیبورد بدون ارسال مجدد
      await ctx.editMessageReplyMarkup(keyboard.reply_markup);
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
      // استفاده از toggleContact به جای toggleFavorite
      const result = await contactService.toggleContact(user.id, targetUserId);

      await ctx.answerCbQuery(
        result === true ? "➕ به مخاطبین اضافه شد" : "➖ از مخاطبین حذف شد"
      );

      // ✅ به‌روزرسانی کیبورد بدون ارسال مجدد
      const profile = await profileService.getPublicProfile(
        { userId: targetUserId },
        user.id
      );

      if (profile) {
        const likesCount = profile.likes_count || 0;
        const showLikes = profile.show_likes !== false;

        // بررسی وضعیت بلاک
        const blockStatus = await blockService.getBlockStatus(
          user.id,
          targetUserId
        );

        let keyboard;

        if (blockStatus.user1BlockedUser2) {
          keyboard = profileKeyboards.profileBlockedByMe(targetUserId, {
            isLiked: profile.is_liked_by_viewer || false,
            likesCount: likesCount,
            showLikes: showLikes,
          });
        } else if (blockStatus.user2BlockedUser1) {
          keyboard = profileKeyboards.profileBlockedByThem(
            targetUserId,
            profile.is_liked_by_viewer || false
          );
        } else {
          keyboard = profileKeyboards.publicProfile(targetUserId, {
            isLiked: profile.is_liked_by_viewer || false,
            isInContacts: result, // وضعیت جدید مخاطب
            hasChatHistory: profile.has_chat_history || false,
            likesCount: likesCount,
            showLikes: showLikes,
          });
        }

        await ctx.editMessageReplyMarkup(keyboard.reply_markup);
      }
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

      // ✅ به‌روزرسانی کیبورد بدون ارسال مجدد
      const profile = await profileService.getPublicProfile(
        { userId: targetUserId },
        user.id
      );

      if (profile) {
        const likesCount = profile.likes_count || 0;
        const showLikes = profile.show_likes !== false;

        // کیبورد بلاک شده توسط من
        const keyboard = profileKeyboards.profileBlockedByMe(targetUserId, {
          isLiked: profile.is_liked_by_viewer || false,
          likesCount: likesCount,
          showLikes: showLikes,
        });

        await ctx.editMessageReplyMarkup(keyboard.reply_markup);
      }
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

      // ✅ به‌روزرسانی کیبورد بدون ارسال مجدد
      const profile = await profileService.getPublicProfile(
        { userId: targetUserId },
        user.id
      );

      if (profile) {
        const likesCount = profile.likes_count || 0;
        const showLikes = profile.show_likes !== false;

        // کیبورد عادی (بدون بلاک)
        const keyboard = profileKeyboards.publicProfile(targetUserId, {
          isLiked: profile.is_liked_by_viewer || false,
          isInContacts: profile.is_in_contacts || false,
          hasChatHistory: profile.has_chat_history || false,
          likesCount: likesCount,
          showLikes: showLikes,
        });

        await ctx.editMessageReplyMarkup(keyboard.reply_markup);
      }
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

      // ✅ دریافت تعداد لایک‌ها
      const likesCount = profile.likes_count || 0;
      const showLikes = profile.show_likes !== false;

      // ✅ بررسی وضعیت آنلاین واقعی (5 دقیقه)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      let isOnline = false;
      
      if (profile.is_online && profile.last_activity) {
        const lastActivityDate = new Date(profile.last_activity);
        isOnline = lastActivityDate > fiveMinutesAgo;
      }

      const profileText =
        `👤 پروفایل کاربر\n\n` +
        `• نام: ${profile.display_name || "نامشخص"}\n` +
        `• جنسیت: ${profile.gender === "male" ? "پسر" : "دختر"}\n` +
        `• استان: ${getProvinceById(profile.province)?.name || "نامشخص"}\n` +
        `• شهر: ${
          getCityById(profile.city, profile.province)?.name || "نامشخص"
        }\n` +
        `• سن: ${profile.age}\n` +
        `${profile.bio ? `\n📝 ${profile.bio}\n` : ""}` +
        `\n🆔 آیدی: /user_${profile.custom_id}\n` +
        `وضعیت: ${isOnline ? "👀 آنلایـــن" : "⏸ آفلایـــن"}`;

      // ✅ بررسی وضعیت بلاک
      const blockStatus = await blockService.getBlockStatus(
        user.id,
        targetUserId
      );

      let keyboard;

      if (blockStatus.user1BlockedUser2) {
        // ✅ من طرف مقابل را بلاک کرده‌ام
        keyboard = profileKeyboards.profileBlockedByMe(targetUserId, {
          isLiked: profile.is_liked_by_viewer || false,
          likesCount: likesCount,
          showLikes: showLikes,
        });
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
          likesCount: likesCount,
          showLikes: showLikes,
        });
      }

      // ✅ ارسال پروفایل (بدون حذف پیام قبلی)
      if (profile.photo_file_id) {
        logger.info(`Sending photo for user ${targetUserId}: ${profile.photo_file_id}`);
        await ctx.replyWithPhoto(profile.photo_file_id, {
          caption: profileText,
          ...keyboard,
        });
      } else {
        // اگر کاربر عکس ندارد، از عکس پیش‌فرض استفاده کن
        logger.info(`No photo for user ${targetUserId}, sending default photo`);
        try {
          if (fs.existsSync(DEFAULT_PHOTO_PATH)) {
            await ctx.replyWithPhoto(
              { source: DEFAULT_PHOTO_PATH },
              {
                caption: profileText,
                ...keyboard,
              }
            );
          } else {
            // اگر عکس پیش‌فرض هم وجود ندارد، فقط متن بفرست
            await ctx.reply(profileText, {
              ...keyboard,
            });
          }
        } catch (error) {
          logger.error("❌ Error sending default photo:", error);
          // در صورت خطا، فقط متن بفرست
          await ctx.reply(profileText, {
            ...keyboard,
          });
        }
      }
    } catch (error) {
      logger.error("❌ Show user profile error:", error);
      await ctx.reply("⚠️ خطا در نمایش پروفایل");
    }
  }

  /**
   * ✅ نمایش پروفایل با Custom ID
   */
  async showProfileByCustomId(ctx: MyContext, customId: string) {
    const user = ctx.state.user;

    try {
      const profile = await profileService.getPublicProfile(
        { customId },
        user.id
      );

      if (!profile) {
        return await ctx.reply(
          `❌ کاربری با آیدی \`${customId}\` یافت نشد.`,
          { parse_mode: "Markdown" }
        );
      }

      // بررسی اینکه پروفایل خود کاربر نباشد
      if (profile.user_id === user.id) {
        return await this.showProfileMenu(ctx);
      }

      return await this.showUserProfile(ctx, profile.user_id);
    } catch (error) {
      logger.error("❌ Show profile by custom ID error:", error);
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
    const user = ctx.state.user;

    try {
      // ==================== ویرایش نام ====================
      if (step === "name") {
        // اعتبارسنجی نام
        if (text.length < 2) {
          return await ctx.reply("⚠️ نام باید حداقل 2 کاراکتر باشد.");
        }
        if (text.length > 50) {
          return await ctx.reply("⚠️ نام باید حداکثر 50 کاراکتر باشد.");
        }

        // بررسی وجود پروفایل
        const existingProfile = await profileService.getProfile(user.id);
        if (!existingProfile) {
          delete ctx.session.profileEdit;
          return await ctx.reply("⚠️ ابتدا باید پروفایل خود را تکمیل کنید.");
        }

        // به‌روزرسانی نام
        await profileService.updateProfile(user.id, { 
          display_name: text 
        });

        delete ctx.session.profileEdit;

        return await ctx.reply(
          `✅ نام شما به "${text}" تغییر یافت.`,
          Markup.inlineKeyboard([
            [Markup.button.callback("🔙 بازگشت به پروفایل", "profile_view")]
          ])
        );
      }

      // ==================== ویرایش سن ====================
      if (step === "age") {
        const age = parseInt(text);

        // اعتبارسنجی سن
        if (isNaN(age)) {
          return await ctx.reply("⚠️ لطفا یک عدد معتبر وارد کنید.");
        }
        if (age < 13 || age > 100) {
          return await ctx.reply("⚠️ سن باید بین 13 تا 100 سال باشد.");
        }

        // اگر در حال ویرایش است (نه ثبت نام)
        if (ctx.session.profileEdit.step === "age" && !ctx.session.profileEdit.gender) {
          const existingProfile = await profileService.getProfile(user.id);
          if (!existingProfile) {
            delete ctx.session.profileEdit;
            return await ctx.reply("⚠️ ابتدا باید پروفایل خود را تکمیل کنید.");
          }

          await profileService.updateProfile(user.id, { age });
          delete ctx.session.profileEdit;

          return await ctx.reply(
            `✅ سن شما به ${age} سال تغییر یافت.`,
            Markup.inlineKeyboard([
              [Markup.button.callback("🔙 بازگشت به پروفایل", "profile_view")]
            ])
          );
        }

        // اگر در حال ثبت نام است
        ctx.session.profileEdit.age = age;
        return await ctx.reply(
          "📍 استان خود را انتخاب کنید:",
          profileKeyboards.province()
        );
      }

      // ==================== ویرایش بیو ====================
      if (step === "bio") {
        // اعتبارسنجی بیو
        if (text.length > 500) {
          return await ctx.reply("⚠️ بیوگرافی باید حداکثر 500 کاراکتر باشد.");
        }

        // اگر در حال ویرایش است (نه ثبت نام)
        if (ctx.session.profileEdit.step === "bio" && !ctx.session.profileEdit.gender) {
          const existingProfile = await profileService.getProfile(user.id);
          if (!existingProfile) {
            delete ctx.session.profileEdit;
            return await ctx.reply("⚠️ ابتدا باید پروفایل خود را تکمیل کنید.");
          }

          await profileService.updateProfile(user.id, { bio: text });
          delete ctx.session.profileEdit;

          return await ctx.reply(
            "✅ بیوگرافی شما به‌روزرسانی شد.",
            Markup.inlineKeyboard([
              [Markup.button.callback("🔙 بازگشت به پروفایل", "profile_view")]
            ])
          );
        }

        // اگر در حال ثبت نام است
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
      await ctx.reply("⚠️ خطایی رخ داد. لطفا دوباره تلاش کنید.");
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
      // ✅ بررسی اینکه آیا پروفایل قبلاً وجود داشته یا نه (برای تشخیص ثبت نام جدید)
      const existingProfile = await profileService.getProfile(user.id);
      const isNewProfile = !existingProfile;

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

      // ✅ پیام اصلی تکمیل پروفایل
      await ctx.reply(
        "✅ پروفایل شما با موفقیت ثبت شد!\n\n" +
          "🎉 حالا می‌توانید:\n" +
          "• با افراد جدید چت کنید\n" +
          "• دوستان خود را دعوت کنید\n" +
          "• از امکانات ربات استفاده کنید",
        mainMenuKeyboard()
      );

      // ✅ اگر پروفایل جدید است، پاداش ثبت نام (10 سکه) بده
      if (isNewProfile) {
        try {
          await rewardSignup(user.id);
          await ctx.reply('🎁 شما 10 سکه بابت تکمیل پروفایل دریافت کردید!');
          logger.info(`🎁 Signup reward granted to user ${user.id}`);
        } catch (error) {
          logger.error('❌ Error granting signup reward:', error);
        }
      }

      // ✅ اگر پروفایل جدید است و referrer دارد، پاداش referral (10+10 سکه) بده
      if (isNewProfile && user.referred_by) {
        try {
          await rewardReferral(user.referred_by, user.id);
          
          // پیام برای کاربر جدید
          await ctx.reply('💰 شما 10 سکه اضافی بابت دعوت دوست دریافت کردید!');
          
          // پیام برای معرف (referrer)
          try {
            const referrerUser = await pool.query(
              'SELECT telegram_id FROM users WHERE id = $1',
              [user.referred_by]
            );
            
            if (referrerUser.rows.length > 0) {
              await ctx.telegram.sendMessage(
                referrerUser.rows[0].telegram_id,
                '🎉 یکی از دوستان شما پروفایل خود را تکمیل کرد!\n💰 شما 10 سکه پاداش دریافت کردید!'
              );
            }
          } catch (error) {
            logger.error('❌ Error sending referral notification to referrer:', error);
          }
          
          logger.info(`🎁 Referral reward granted: referrer=${user.referred_by}, new_user=${user.id}`);
        } catch (error) {
          logger.error('❌ Error granting referral reward:', error);
        }
      }

      logger.info(`✅ Profile completed for user ${user.id}`);
    } catch (error) {
      logger.error("❌ Finish edit error:", error);
      await ctx.reply("⚠️ خطا در ذخیره پروفایل.");
    }
  }

  /**
   * ✅ ارسال درخواست چت
   */
  async handleChatRequest(ctx: MyContext) {
    if (!ctx.callbackQuery || !("data" in ctx.callbackQuery)) return;

    const targetUserId = parseInt(
      ctx.callbackQuery.data.replace("request_chat_", "")
    );
    const user = ctx.state.user;

    try {
      // ✅ بررسی سکه کاربر
      const balance = await getBalance(user.id);
      if (balance < 1) {
        return await ctx.answerCbQuery(
          "❌ برای ارسال درخواست چت باید حداقل 1 سکه داشته باشید.",
          { show_alert: true }
        );
      }

      // ✅ بررسی بلاک بودن
      const blockStatus = await blockService.getBlockStatus(user.id, targetUserId);
      if (blockStatus.user1BlockedUser2 || blockStatus.user2BlockedUser1) {
        return await ctx.answerCbQuery(
          "❌ امکان ارسال درخواست چت وجود ندارد.",
          { show_alert: true }
        );
      }

      // ✅ دریافت اطلاعات پروفایل فرستنده
      const senderProfile = await profileService.getFullProfile(user.id);
      if (!senderProfile) {
        return await ctx.answerCbQuery("❌ خطا در دریافت اطلاعات", { show_alert: true });
      }

      // ✅ ارسال درخواست به گیرنده
      await ctx.telegram.sendMessage(
        (await profileService.getProfile(targetUserId))?.user_id || targetUserId,
        `💬 **درخواست چت جدید**\n\n` +
        `از: ${senderProfile.display_name || senderProfile.first_name}\n` +
        `آیدی: \`${senderProfile.custom_id}\`\n\n` +
        `آیا می‌خواهید این درخواست را قبول کنید؟`,
        {
          parse_mode: "Markdown",
          ...profileKeyboards.chatRequest(user.id, senderProfile.custom_id),
        }
      );

      await ctx.answerCbQuery("✅ درخواست چت ارسال شد!", { show_alert: true });
      await ctx.reply("✅ درخواست چت شما ارسال شد. منتظر پاسخ باشید...");

    } catch (error) {
      logger.error("❌ Chat request error:", error);
      await ctx.answerCbQuery("⚠️ خطا در ارسال درخواست", { show_alert: true });
    }
  }

  /**
   * ✅ قبول درخواست چت
   */
  async acceptChatRequest(ctx: MyContext) {
    if (!ctx.callbackQuery || !("data" in ctx.callbackQuery)) return;

    const senderId = parseInt(
      ctx.callbackQuery.data.replace("accept_chat_", "")
    );
    const user = ctx.state.user;

    try {
      await ctx.answerCbQuery("✅ درخواست پذیرفته شد!");
      await ctx.editMessageText(
        "✅ شما این درخواست چت را پذیرفتید.\n" +
        "چت به زودی شروع خواهد شد..."
      );

      // TODO: شروع چت با استفاده از chat.service
      // await chatService.startChat(senderId, user.id);

      logger.info(`✅ Chat request accepted: ${senderId} -> ${user.id}`);
    } catch (error) {
      logger.error("❌ Accept chat error:", error);
      await ctx.answerCbQuery("⚠️ خطا در پذیرش درخواست");
    }
  }

  /**
   * ✅ رد درخواست چت
   */
  async rejectChatRequest(ctx: MyContext) {
    if (!ctx.callbackQuery || !("data" in ctx.callbackQuery)) return;

    const senderId = parseInt(
      ctx.callbackQuery.data.replace("reject_chat_", "")
    );

    try {
      await ctx.answerCbQuery("❌ درخواست رد شد");
      await ctx.editMessageText("❌ شما این درخواست چت را رد کردید.");

      // TODO: اطلاع رسانی به فرستنده
      // await ctx.telegram.sendMessage(senderTelegramId, "❌ درخواست چت شما رد شد.");

      logger.info(`❌ Chat request rejected: ${senderId}`);
    } catch (error) {
      logger.error("❌ Reject chat error:", error);
      await ctx.answerCbQuery("⚠️ خطا در رد درخواست");
    }
  }

  /**
   * ✅ ارسال پیام دایرکت
   */
  async handleSendDirectMessage(ctx: MyContext, targetUserId: number) {
    const user = ctx.state.user;

    try {
      // بررسی بلاک
      const blockStatus = await blockService.getBlockStatus(user.id, targetUserId);
      
      if (blockStatus.user1BlockedUser2 || blockStatus.user2BlockedUser1) {
        return await ctx.answerCbQuery("⚠️ امکان ارسال پیام وجود ندارد");
      }

      // دریافت اطلاعات کاربر مقصد
      const targetProfile = await profileService.getPublicProfile(
        { userId: targetUserId },
        user.id
      );

      if (!targetProfile) {
        return await ctx.answerCbQuery("❌ کاربر یافت نشد");
      }

      await ctx.answerCbQuery("✉️ پیام خود را بنویسید");

      // ذخیره targetUserId در session
      ctx.session.awaitingDirectMessage = {
        targetUserId: targetUserId,
        targetName: targetProfile.display_name || "کاربر",
      };

      await ctx.reply(
        `✉️ پیام دایرکت به: ${targetProfile.display_name || "کاربر"}\n\n` +
        `📝 پیام خود را بنویسید:\n` +
        `(حداکثر 600 کاراکتر)`,
        Markup.inlineKeyboard([
          [Markup.button.callback("❌ انصراف", "cancel_direct_message")],
        ])
      );

      logger.info(`User ${user.id} started composing direct message to ${targetUserId}`);
    } catch (error) {
      logger.error("❌ Send direct message error:", error);
      await ctx.answerCbQuery("⚠️ خطا در ارسال پیام");
    }
  }

  /**
   * ✅ انصراف از ارسال پیام دایرکت
   */
  async handleCancelDirectMessage(ctx: MyContext) {
    try {
      delete ctx.session.awaitingDirectMessage;
      await ctx.answerCbQuery("❌ ارسال پیام لغو شد");
      await ctx.deleteMessage();
    } catch (error) {
      logger.error("❌ Cancel direct message error:", error);
    }
  }

  /**
   * ✅ پردازش متن پیام دایرکت
   */
  async processDirectMessageText(ctx: MyContext, text: string) {
    const user = ctx.state.user;

    try {
      const awaitingData = ctx.session.awaitingDirectMessage;
      
      if (!awaitingData) return;

      const { targetUserId, targetName } = awaitingData;

      // اعتبارسنجی طول پیام
      if (text.length > 600) {
        return await ctx.reply("⚠️ پیام شما بیش از 600 کاراکتر است. لطفاً کوتاه‌تر بنویسید.");
      }

      if (text.length < 1) {
        return await ctx.reply("⚠️ پیام نمی‌تواند خالی باشد.");
      }

      // ✅ بررسی موجودی سکه
      const hasCoins = await hasEnoughCoins(user.id, 1);
      if (!hasCoins) {
        delete ctx.session.awaitingDirectMessage;
        return await coinHandler.showInsufficientCoinsMessage(ctx, 1);
      }

      // ✅ کسر 1 سکه
      await deductCoins(user.id, 1, "spend", `پیام دایرکت به ${targetName}`);

      // ارسال پیام
      await directMessageService.sendMessage(user.id, targetUserId, text);

      // ارسال اطلاعیه به گیرنده
      try {
        const senderProfile = await profileService.getProfile(user.id);
        const targetUser = await pool.query('SELECT telegram_id FROM users WHERE id = $1', [targetUserId]);
        
        if (targetUser.rows.length > 0) {
          const receiverTelegramId = targetUser.rows[0].telegram_id;
          
          await ctx.telegram.sendMessage(
            receiverTelegramId,
            `📬 پیام جدید از: ${senderProfile?.display_name || senderProfile?.first_name}\n\n` +
            `💬 ${text}\n\n` +
            `🆔 /user_${senderProfile?.custom_id}`,
            Markup.inlineKeyboard([
              [Markup.button.callback("💬 پاسخ", `reply_direct_${user.id}`)],
              [Markup.button.callback("👤 مشاهده پروفایل", `view_user_${user.id}`)],
              [Markup.button.callback("📬 پیام‌های من", "view_direct_messages")],
            ])
          );
        }
      } catch (notifyError) {
        logger.error("❌ Error notifying receiver:", notifyError);
      }

      // پاک کردن session
      delete ctx.session.awaitingDirectMessage;

      // دریافت موجودی جدید
      const newBalance = await getBalance(user.id);

      await ctx.reply(
        `✅ پیام شما به ${targetName} ارسال شد!\n\n` +
        `💰 موجودی شما: ${newBalance} سکه`,
        Markup.inlineKeyboard([
          [Markup.button.callback("👤 بازگشت به پروفایل", `view_user_${targetUserId}`)],
          [Markup.button.callback("🔙 منوی اصلی", "main_menu")],
        ])
      );

      logger.info(`✅ Direct message sent from ${user.id} to ${targetUserId}`);
    } catch (error) {
      logger.error("❌ Process direct message error:", error);
      await ctx.reply("⚠️ خطا در ارسال پیام. لطفاً دوباره تلاش کنید.");
    }
  }

  /**
   * ✅ نمایش پیام‌های دریافتی با pagination
   */
  async showReceivedMessages(ctx: MyContext, page: number = 1, sortOrder: 'DESC' | 'ASC' = 'DESC') {
    const user = ctx.state.user;

    try {
      const result = await directMessageService.getReceivedMessages(user.id, page, 10, sortOrder);
      const { messages, totalCount, currentPage, hasNext, hasPrev } = result;

      // حذف پیام قبلی
      try {
        await ctx.deleteMessage();
      } catch {}

      if (totalCount === 0) {
        return await ctx.reply(
          "📭 شما هیچ پیام دریافتی ندارید.",
          Markup.inlineKeyboard([
            [Markup.button.callback("📤 پیام‌های ارسالی", "sent_messages_page_1_DESC")],
            [Markup.button.callback("🔙 بازگشت", "profile_view")],
          ])
        );
      }

      const sortText = sortOrder === 'DESC' ? '🔽 قدیم به جدید' : '🔼 جدید به قدیم';
      
      const messagesText =
        `📬 پیام‌های دریافتی (${totalCount})\n` +
        `📄 صفحه ${currentPage}\n\n` +
        messages
          .map((msg, i) => {
            const name = msg.sender_name || msg.sender_first_name || "بدون نام";
            const genderIcon = msg.sender_gender === "male" ? "🙍" : "🙍‍♀️";
            const age = msg.sender_age || "❓";
            
            const province = getProvinceById(msg.sender_province)?.name || "نامشخص";
            const city = getCityById(msg.sender_city, msg.sender_province)?.name || "نامشخص";
            
            const messagePreview = msg.message.length > 50 
              ? msg.message.substring(0, 50) + "..." 
              : msg.message;
            
            const date = new Date(msg.created_at);
            const dateStr = `${date.getDate()}/${date.getMonth() + 1}`;
            const readIcon = msg.is_read ? "✅" : "🆕";
            
            return (
              `${(currentPage - 1) * 10 + i + 1}. ${readIcon} از ${genderIcon}${age} ${name} /user_${msg.sender_custom_id}\n` +
              `   ${province}(${city})\n` +
              `   💬 ${messagePreview}\n` +
              `   📅 ${dateStr}`
            );
          })
          .join("\n\n");

      // دکمه‌های pagination
      const buttons = [];
      const navButtons = [];
      
      if (hasPrev) {
        navButtons.push(Markup.button.callback("⬅️ قبلی", `received_messages_page_${currentPage - 1}_${sortOrder}`));
      }
      if (hasNext) {
        navButtons.push(Markup.button.callback("➡️ بعدی", `received_messages_page_${currentPage + 1}_${sortOrder}`));
      }
      
      if (navButtons.length > 0) {
        buttons.push(navButtons);
      }
      
      const newSortOrder = sortOrder === 'DESC' ? 'ASC' : 'DESC';
      buttons.push([Markup.button.callback(sortText, `received_messages_page_${currentPage}_${newSortOrder}`)]);
      buttons.push([Markup.button.callback("📤 پیام‌های ارسالی", "sent_messages_page_1_DESC")]);
      buttons.push([Markup.button.callback("🔄 بارگزاری مجدد", `received_messages_page_${currentPage}_${sortOrder}`)]);
      buttons.push([Markup.button.callback("🔙 بازگشت", "profile_view")]);

      await ctx.reply(messagesText, Markup.inlineKeyboard(buttons));
    } catch (error) {
      logger.error("❌ Show received messages error:", error);
      await ctx.reply("⚠️ خطا در نمایش پیام‌ها");
    }
  }

  /**
   * ✅ نمایش پیام‌های ارسالی با pagination
   */
  async showSentMessages(ctx: MyContext, page: number = 1, sortOrder: 'DESC' | 'ASC' = 'DESC') {
    const user = ctx.state.user;

    try {
      const result = await directMessageService.getSentMessages(user.id, page, 10, sortOrder);
      const { messages, totalCount, currentPage, hasNext, hasPrev } = result;

      // حذف پیام قبلی
      try {
        await ctx.deleteMessage();
      } catch {}

      if (totalCount === 0) {
        return await ctx.reply(
          "📭 شما هیچ پیام ارسالی ندارید.",
          Markup.inlineKeyboard([
            [Markup.button.callback("📬 پیام‌های دریافتی", "received_messages_page_1_DESC")],
            [Markup.button.callback("🔙 بازگشت", "profile_view")],
          ])
        );
      }

      const sortText = sortOrder === 'DESC' ? '🔽 قدیم به جدید' : '🔼 جدید به قدیم';

      const messagesText =
        `📤 پیام‌های ارسالی (${totalCount})\n` +
        `📄 صفحه ${currentPage}\n\n` +
        messages
          .map((msg, i) => {
            const name = msg.receiver_name || msg.receiver_first_name || "بدون نام";
            const genderIcon = msg.receiver_gender === "male" ? "🙍" : "🙍‍♀️";
            const age = msg.receiver_age || "❓";
            
            const province = getProvinceById(msg.receiver_province)?.name || "نامشخص";
            const city = getCityById(msg.receiver_city, msg.receiver_province)?.name || "نامشخص";
            
            const messagePreview = msg.message.length > 50 
              ? msg.message.substring(0, 50) + "..." 
              : msg.message;
            
            const date = new Date(msg.created_at);
            const dateStr = `${date.getDate()}/${date.getMonth() + 1}`;
            const readIcon = msg.is_read ? "✅" : "⏳";
            
            return (
              `${(currentPage - 1) * 10 + i + 1}. ${readIcon} به ${genderIcon}${age} ${name} /user_${msg.receiver_custom_id}\n` +
              `   ${province}(${city})\n` +
              `   💬 ${messagePreview}\n` +
              `   📅 ${dateStr}`
            );
          })
          .join("\n\n");

      // دکمه‌های pagination
      const buttons = [];
      const navButtons = [];
      
      if (hasPrev) {
        navButtons.push(Markup.button.callback("⬅️ قبلی", `sent_messages_page_${currentPage - 1}_${sortOrder}`));
      }
      if (hasNext) {
        navButtons.push(Markup.button.callback("➡️ بعدی", `sent_messages_page_${currentPage + 1}_${sortOrder}`));
      }
      
      if (navButtons.length > 0) {
        buttons.push(navButtons);
      }
      
      const newSortOrder = sortOrder === 'DESC' ? 'ASC' : 'DESC';
      buttons.push([Markup.button.callback(sortText, `sent_messages_page_${currentPage}_${newSortOrder}`)]);
      buttons.push([Markup.button.callback("📬 پیام‌های دریافتی", "received_messages_page_1_DESC")]);
      buttons.push([Markup.button.callback("🔄 بارگزاری مجدد", `sent_messages_page_${currentPage}_${sortOrder}`)]);
      buttons.push([Markup.button.callback("🔙 بازگشت", "profile_view")]);

      await ctx.reply(messagesText, Markup.inlineKeyboard(buttons));
    } catch (error) {
      logger.error("❌ Show sent messages error:", error);
      await ctx.reply("⚠️ خطا در نمایش پیام‌ها");
    }
  }
}

export const profileHandlers = new ProfileHandlers();
