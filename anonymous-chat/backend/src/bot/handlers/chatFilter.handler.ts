import { MyContext } from "../../types/bot.types";
import {
  chatFilterGenderKeyboard,
  chatFilterDistanceKeyboard,
  chatFilterAgeKeyboard,
  chatFilterConfirmKeyboard,
} from "../keyboards/chatFilter.keyboard";
import logger from "../../utils/logger";
import pool from "../../database/db";

class ChatFilterHandler {
  /**
   * نمایش منوی اولیه فیلتر درخواست چت - انتخاب جنسیت
   */
  async showGenderSelection(ctx: MyContext) {
    try {
      const messageText = `با فیلتر درخواست چت میتونی تو سه مرحله مشخص کنی کاربران با چه جنسیتی تو چه فاصله ازت و چه رده سنی بتونن بهت درخواست چت بدن

مرحله اول (فیلتر جنسیت):
چه کسانی بتونن بهت درخواست چت بدن؟`;

      if (ctx.callbackQuery) {
        await ctx.editMessageText(messageText, chatFilterGenderKeyboard());
      } else {
        await ctx.reply(messageText, chatFilterGenderKeyboard());
      }
    } catch (error) {
      logger.error("Error showing gender selection:", error);
      await ctx.reply("⚠️ خطا در نمایش منو");
    }
  }

  /**
   * انتخاب جنسیت و نمایش انتخاب فاصله
   */
  async selectGender(ctx: MyContext, gender: string) {
    try {
      if (!ctx.session.chatFilter) {
        ctx.session.chatFilter = {};
      }
      ctx.session.chatFilter.gender = gender;

      const messageText = `با فیلتر درخواست چت میتونی تو سه مرحله مشخص کنی کاربران با چه جنسیتی تو چه فاصله ازت و چه رده سنی بتونن بهت درخواست چت بدن

مرحله دوم (فیلتر فاصله):
کاربران تا چه فاصله‌ای ازت میتونن بهت درخواست چت بدن؟`;

      await ctx.editMessageText(messageText, chatFilterDistanceKeyboard());
      await ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error selecting gender:", error);
      await ctx.answerCbQuery("⚠️ خطا در پردازش");
    }
  }

  /**
   * انتخاب فاصله و نمایش انتخاب سن
   */
  async selectDistance(ctx: MyContext, distance: string) {
    try {
      const user = ctx.state.user;

      // بررسی لوکیشن برای فیلترهای مبتنی بر فاصله
      if (distance === "100km" || distance === "10km") {
        const result = await pool.query(
          "SELECT latitude, longitude FROM profiles WHERE user_id = $1",
          [user.id]
        );

        if (!result.rows[0]?.latitude || !result.rows[0]?.longitude) {
          await ctx.answerCbQuery(
            "⚠️ برای استفاده از فیلتر فاصله، ابتدا باید لوکیشن خود را از بخش پروفایل ثبت کنید",
            { show_alert: true }
          );
          return;
        }
      }

      if (!ctx.session.chatFilter) {
        ctx.session.chatFilter = {};
      }
      ctx.session.chatFilter.distance = distance;

      const messageText = `با فیلتر درخواست چت میتونی تو سه مرحله مشخص کنی کاربران با چه جنسیتی تو چه فاصله ازت و چه رده سنی بتونن بهت درخواست چت بدن

مرحله سوم (فیلتر سنی):
کاربران از چه سنی میتونن بهت درخواست چت بدن؟

⚠️ لطفاً ابتدا حداقل سن را انتخاب کنید:`;

      await ctx.editMessageText(messageText, chatFilterAgeKeyboard());
      await ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error selecting distance:", error);
      await ctx.answerCbQuery("⚠️ خطا در پردازش");
    }
  }

  /**
   * انتخاب سن
   */
  async selectAge(ctx: MyContext, age: number | "all") {
    try {
      if (!ctx.session.chatFilter) {
        ctx.session.chatFilter = {};
      }

      if (age === "all") {
        ctx.session.chatFilter.minAge = null;
        ctx.session.chatFilter.maxAge = null;
        await this.showConfirmation(ctx);
        return;
      }

      // اگر هنوز minAge انتخاب نشده
      if (!ctx.session.chatFilter.minAge) {
        ctx.session.chatFilter.minAge = age;
        await ctx.answerCbQuery(`حداقل سن: ${age} - حالا حداکثر سن را انتخاب کنید`);
        
        const messageText = `با فیلتر درخواست چت میتونی تو سه مرحله مشخص کنی کاربران با چه جنسیتی تو چه فاصله ازت و چه رده سنی بتونن بهت درخواست چت بدن

مرحله سوم (فیلتر سنی):
کاربران از چه سنی میتونن بهت درخواست چت بدن؟

✅ حداقل سن: ${age}
⚠️ حالا حداکثر سن را انتخاب کنید:`;

        await ctx.editMessageText(messageText, chatFilterAgeKeyboard());
      } else {
        // انتخاب maxAge
        ctx.session.chatFilter.maxAge = age;

        // بررسی صحت بازه
        if (ctx.session.chatFilter.minAge > age) {
          await ctx.answerCbQuery("⚠️ حداکثر سن باید بزرگتر از حداقل سن باشد", {
            show_alert: true,
          });
          return;
        }

        await this.showConfirmation(ctx);
      }
    } catch (error) {
      logger.error("Error selecting age:", error);
      await ctx.answerCbQuery("⚠️ خطا در پردازش");
    }
  }

  /**
   * نمایش تایید نهایی
   */
  private async showConfirmation(ctx: MyContext) {
    try {
      const filter = ctx.session.chatFilter!;

      const genderText =
        filter.gender === "male"
          ? "فقط پسران"
          : filter.gender === "female"
          ? "فقط دختران"
          : "همه";

      const distanceText =
        filter.distance === "same_province"
          ? "هم استانی"
          : filter.distance === "not_same_province"
          ? "غیر هم استانی"
          : filter.distance === "100km"
          ? "تا فاصله 100 کیلومتری"
          : filter.distance === "10km"
          ? "تا فاصله 10 کیلومتری"
          : "از هر فاصله‌ای";

      const ageText =
        filter.minAge && filter.maxAge
          ? `از ${filter.minAge} تا ${filter.maxAge} سال`
          : "از هر سنی";

      const filterText = `${genderText} ${distanceText} ${ageText} می‌توانند به این کاربر درخواست چت بدهند.`;

      const messageText = `با فیلتر درخواست چت میتونی تو سه مرحله مشخص کنی کاربران با چه جنسیتی تو چه فاصله ازت و چه رده سنی بتونن بهت درخواست چت بدن

مرحله نهایی (نمایش فیلتر):
دوست داری این متن رو زیر پروفایلت به کاربرا نشون بدم؟

📋 ${filterText}`;

      await ctx.editMessageText(messageText, chatFilterConfirmKeyboard(filterText));
      await ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error showing confirmation:", error);
      await ctx.answerCbQuery("⚠️ خطا در نمایش");
    }
  }

  /**
   * تایید و ذخیره فیلتر
   */
  async confirmFilter(ctx: MyContext, visible: boolean) {
    try {
      const user = ctx.state.user;
      const filter = ctx.session.chatFilter!;

      await pool.query(
        `UPDATE users 
         SET filter_gender = $1, filter_distance = $2, filter_min_age = $3, filter_max_age = $4, filter_visible = $5
         WHERE id = $6`,
        [filter.gender, filter.distance, filter.minAge, filter.maxAge, visible, user.id]
      );

      // پاک کردن session
      delete ctx.session.chatFilter;

      await ctx.editMessageText(
        `✅ فیلتر درخواست چت شما با موفقیت ذخیره شد!\n\n${
          visible
            ? "✅ فیلتر شما در پروفایل نمایش داده می‌شود."
            : "🔒 فیلتر شما در پروفایل مخفی است."
        }`
      );
      await ctx.answerCbQuery("✅ فیلتر ذخیره شد");
    } catch (error) {
      logger.error("Error confirming filter:", error);
      await ctx.answerCbQuery("⚠️ خطا در ذخیره فیلتر");
    }
  }

  /**
   * بازگشت به مرحله قبل
   */
  async goBack(ctx: MyContext, step: "gender" | "distance" | "age") {
    try {
      if (step === "gender") {
        await this.showGenderSelection(ctx);
      } else if (step === "distance") {
        await this.showGenderSelection(ctx);
      } else if (step === "age") {
        await this.selectGender(ctx, ctx.session.chatFilter?.gender || "all");
      }
      await ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error going back:", error);
      await ctx.answerCbQuery("⚠️ خطا");
    }
  }

  /**
   * بررسی اینکه آیا کاربر می‌تواند درخواست چت بدهد
   */
  async canSendChatRequest(
    senderId: number,
    receiverId: number
  ): Promise<{ allowed: boolean; message?: string }> {
    try {
      // دریافت اطلاعات فرستنده و گیرنده
      const result = await pool.query(
        `SELECT 
          u.id, u.filter_gender, u.filter_distance, u.filter_min_age, u.filter_max_age,
          p.gender, p.age, p.province, p.latitude, p.longitude
         FROM users u
         LEFT JOIN profiles p ON u.id = p.user_id
         WHERE u.id IN ($1, $2)`,
        [senderId, receiverId]
      );

      const sender = result.rows.find((r: any) => r.id === senderId);
      const receiver = result.rows.find((r: any) => r.id === receiverId);

      if (!receiver) {
        return { allowed: false, message: "کاربر یافت نشد" };
      }

      // اگر فیلتری تنظیم نشده، همه می‌توانند درخواست بدهند
      if (!receiver.filter_gender && !receiver.filter_distance && !receiver.filter_min_age) {
        return { allowed: true };
      }

      // بررسی فیلتر جنسیت
      if (receiver.filter_gender && receiver.filter_gender !== "all") {
        if (sender.gender !== receiver.filter_gender) {
          return {
            allowed: false,
            message: "⚠️ این کاربر درخواست‌های خود را محدود کرده است.",
          };
        }
      }

      // بررسی فیلتر فاصله
      if (receiver.filter_distance && receiver.filter_distance !== "all") {
        if (receiver.filter_distance === "same_province") {
          if (sender.province !== receiver.province) {
            return {
              allowed: false,
              message: "⚠️ این کاربر فقط از هم استانی‌ها درخواست چت قبول می‌کند.",
            };
          }
        } else if (receiver.filter_distance === "not_same_province") {
          if (sender.province === receiver.province) {
            return {
              allowed: false,
              message: "⚠️ این کاربر از هم استانی‌ها درخواست چت قبول نمی‌کند.",
            };
          }
        } else if (receiver.filter_distance === "100km" || receiver.filter_distance === "10km") {
          if (!sender.latitude || !sender.longitude) {
            return {
              allowed: false,
              message:
                "⚠️ این کاربر درخواست‌های خود را محدود کرده است. ابتدا باید لوکیشن خود را از بخش پروفایل ثبت کنید.",
            };
          }

          if (!receiver.latitude || !receiver.longitude) {
            return { allowed: true }; // اگر گیرنده لوکیشن نداشت، فیلتر را نادیده بگیر
          }

          const distance = this.calculateDistance(
            sender.latitude,
            sender.longitude,
            receiver.latitude,
            receiver.longitude
          );

          const maxDistance = receiver.filter_distance === "10km" ? 10 : 100;
          if (distance > maxDistance) {
            return {
              allowed: false,
              message: `⚠️ این کاربر فقط از کاربران در شعاع ${maxDistance} کیلومتری درخواست چت قبول می‌کند.`,
            };
          }
        }
      }

      // بررسی فیلتر سنی
      if (receiver.filter_min_age && receiver.filter_max_age) {
        if (sender.age < receiver.filter_min_age || sender.age > receiver.filter_max_age) {
          return {
            allowed: false,
            message: `⚠️ این کاربر فقط از بازه سنی ${receiver.filter_min_age} تا ${receiver.filter_max_age} سال درخواست چت قبول می‌کند.`,
          };
        }
      }

      return { allowed: true };
    } catch (error) {
      logger.error("Error checking chat request permission:", error);
      return { allowed: true }; // در صورت خطا، اجازه بده
    }
  }

  /**
   * محاسبه فاصله بین دو نقطه جغرافیایی (کیلومتر)
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // شعاع زمین به کیلومتر
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) *
        Math.cos(this.deg2rad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  /**
   * دریافت متن فیلتر برای نمایش در پروفایل
   */
  async getFilterText(userId: number): Promise<string | null> {
    try {
      const result = await pool.query(
        `SELECT filter_gender, filter_distance, filter_min_age, filter_max_age, filter_visible
         FROM users WHERE id = $1`,
        [userId]
      );

      const filter = result.rows[0];
      if (!filter || !filter.filter_visible) {
        return null;
      }

      const genderText =
        filter.filter_gender === "male"
          ? "فقط پسران"
          : filter.filter_gender === "female"
          ? "فقط دختران"
          : "همه";

      const distanceText =
        filter.filter_distance === "same_province"
          ? "هم استانی"
          : filter.filter_distance === "not_same_province"
          ? "غیر هم استانی"
          : filter.filter_distance === "100km"
          ? "تا فاصله 100 کیلومتری"
          : filter.filter_distance === "10km"
          ? "تا فاصله 10 کیلومتری"
          : "از هر فاصله‌ای";

      const ageText =
        filter.filter_min_age && filter.filter_max_age
          ? `از ${filter.filter_min_age} تا ${filter.filter_max_age} سال`
          : "از هر سنی";

      return `📋 ${genderText} ${distanceText} ${ageText} می‌توانند به این کاربر درخواست چت بدهند.`;
    } catch (error) {
      logger.error("Error getting filter text:", error);
      return null;
    }
  }
}

export const chatFilterHandler = new ChatFilterHandler();
