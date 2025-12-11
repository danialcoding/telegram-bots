// src/bot/keyboards/profile.keyboard.ts
import { Markup } from "telegraf";
import { PROVINCES, CITIES_BY_PROVINCE } from "../../utils/locations";

export const profileKeyboards = {
  /**
   * ✅ کیبورد اصلی پروفایل (مشاهده پروفایل خود)
   */
  main: (likesCount: number, isLikesEnabled: boolean) =>
    Markup.inlineKeyboard([
      [Markup.button.callback("✏️ ویرایش پروفایل", "profile_edit")],
      [
        Markup.button.callback(
          `❤️ لایک (${isLikesEnabled ? "فعال ✅" : "غیرفعال ❌"})`,
          "profile_toggle_likes"
        ),
      ],
      [
        Markup.button.callback(
          `👁 مشاهده لایک کننده‌ها (${likesCount})`,
          "profile_view_likers"
        ),
      ],
      [
        Markup.button.callback("👥 لیست مخاطبین", "show_contacts"),
        Markup.button.callback("🚫 بلاک شده‌ها", "show_blocked_users"),
      ],
      [Markup.button.callback("📬 پیام‌های دایرکت", "view_direct_messages")],
      [Markup.button.callback("🔙 بازگشت به منو", "main_menu")],
    ]),

  /**
   * ✅ کیبورد ویرایش پروفایل
   */
  edit: () =>
    Markup.inlineKeyboard([
      [Markup.button.callback("ِ۴ڤ نام", "profile_edit_name")],
      [Markup.button.callback("🎂 سن", "profile_edit_age")],
      [Markup.button.callback("🚻 جنسیت", "profile_edit_gender")],
      [Markup.button.callback("📍 استان", "profile_select_province")],
      [Markup.button.callback("🏙 شهر", "profile_edit_city")],
      [Markup.button.callback("📍 موقعیت جغرافیایی", "profile_edit_location")],
      [Markup.button.callback("📝 بیوگرافی", "profile_edit_bio")],
      [Markup.button.callback("📸 تغییر عکس", "profile_change_photo")],
      [Markup.button.callback("🔙 بازگشت", "profile_view")],
    ]),

  /**
   * کیبورد انتخاب جنسیت
   */
  gender: () =>
    Markup.inlineKeyboard([
      [
        Markup.button.callback("🙍‍♂️ مرد", "profile_gender_male"),
        Markup.button.callback("🙍‍♀️ زن", "profile_gender_female"),
      ],
      [Markup.button.callback("❌ انصراف", "profile_cancel")],
    ]),

  /**
   * کیبورد انتخاب استان
   */
  province: () => {
    const buttons = PROVINCES.map((p) => [
      Markup.button.callback(p.name, `profile_province_${p.id}`),
    ]);
    buttons.push([Markup.button.callback("❌ انصراف", "profile_cancel")]);
    return Markup.inlineKeyboard(buttons);
  },

  /**
   * کیبورد انتخاب شهر
   */
  city: (provinceId: number) => {
    const cities = CITIES_BY_PROVINCE[provinceId] || [];
    const buttons = cities.map((c) => [
      Markup.button.callback(c.name, `profile_city_${c.id}`),
    ]);
    buttons.push([
      Markup.button.callback("🔙 بازگشت", "profile_select_province"),
    ]);
    return Markup.inlineKeyboard(buttons);
  },

  /**
   * کیبورد دریافت بیو
   */
  bioInput: () =>
    Markup.inlineKeyboard([
      [Markup.button.callback("⏭ رد شدن", "profile_skip_bio")],
      [Markup.button.callback("❌ انصراف", "profile_cancel")],
    ]),

  /**
   * کیبورد دریافت عکس
   */
  photoInput: () =>
    Markup.inlineKeyboard([
      [Markup.button.callback("⏭ رد شدن", "profile_skip_photo")],
      [Markup.button.callback("❌ انصراف", "profile_cancel")],
    ]),

  /**
   * کیبورد لغو عملیات
   */
  cancel: () =>
    Markup.inlineKeyboard([
      [Markup.button.callback("❌ انصراف", "profile_cancel")],
    ]),

  /**
   * ✅ کیبورد نمایش پروفایل عمومی (بهبود یافته)
   */
  publicProfile: (
    targetUserId: number,
    options: {
      isLiked: boolean;
      isInContacts: boolean;
      hasChatHistory: boolean;
      likesCount: number;
      showLikes: boolean;
    }
  ) => {
    const buttons = [];

    // ردیف اول: لایک (فقط اگر فعال باشد) + تعداد لایک‌ها
    if (options.showLikes) {
      buttons.push([
        Markup.button.callback(
          options.isLiked 
            ? `💔 برداشتن لایک (${options.likesCount})` 
            : `❤️ لایک کردن (${options.likesCount})`,
          `like_toggle_${targetUserId}`
        ),
      ]);
    }

    // ردیف دوم: درخواست چت + پیام دایرکت
    buttons.push([
      Markup.button.callback("💬 درخواست چت", `request_chat_${targetUserId}`),
      Markup.button.callback("✉️ پیام دایرکت", `send_direct_${targetUserId}`),
    ]);

    // ردیف سوم: افزودن به مخاطبین
    buttons.push([
      Markup.button.callback(
        options.isInContacts ? "➖ حذف از مخاطبین" : "➕ افزودن به مخاطبین",
        `contact_toggle_${targetUserId}`
      ),
    ]);

    // ردیف چهارم: گزارش + بلاک
    buttons.push([
      Markup.button.callback("🚨 گزارش", `report_user_${targetUserId}`),
      Markup.button.callback("🚫 بلاک", `block_user_${targetUserId}`),
    ]);

    // ردیف آخر: بازگشت
    buttons.push([Markup.button.callback("🔙 بازگشت", "main_menu")]);

    return Markup.inlineKeyboard(buttons);
  },

  /**
   * ✅ کیبورد درخواست چت (برای گیرنده)
   */
  chatRequest: (senderId: number, senderCustomId: string) =>
    Markup.inlineKeyboard([
      [
        Markup.button.callback("✅ قبول", `accept_chat_${senderId}`),
        Markup.button.callback("❌ رد", `reject_chat_${senderId}`),
      ],
      [Markup.button.callback("👤 مشاهده پروفایل", `view_user_${senderId}`)],
    ]),

  /**
   * ✅ کیبورد پروفایل - وقتی خودم طرف مقابل را بلاک کرده‌ام
   */
  profileBlockedByMe: (
    targetUserId: number,
    options?: { isLiked?: boolean; likesCount?: number; showLikes?: boolean }
  ) => {
    const buttons = [];

    // دکمه لایک (اگر فعال باشد)
    if (options?.showLikes) {
      buttons.push([
        Markup.button.callback(
          options.isLiked
            ? `💔 برداشتن لایک (${options.likesCount || 0})`
            : `❤️ لایک کردن (${options.likesCount || 0})`,
          `like_toggle_${targetUserId}`
        ),
      ]);
    }

    buttons.push(
      [
        Markup.button.callback(
          "🔓 آنبلاک کردن",
          `unblock_user_${targetUserId}`
        ),
      ],
      [
        Markup.button.callback(
          "⚠️ شما این کاربر را بلاک کرده‌اید",
          "blocked_by_me_info"
        ),
      ],
      [Markup.button.callback("🔙 بازگشت", "main_menu")]
    );

    return Markup.inlineKeyboard(buttons);
  },

  /**
   * ✅ کیبورد پروفایل - وقتی طرف مقابل من را بلاک کرده
   */
  profileBlockedByThem: (targetUserId: number, isLiked: boolean) =>
    Markup.inlineKeyboard([
      [
        Markup.button.callback(
          isLiked ? "💔 آن‌لایک" : "❤️ لایک",
          `like_toggle_${targetUserId}`
        ),
      ],
      [
        Markup.button.callback(
          "🚫 این کاربر شما را بلاک کرده است",
          "blocked_by_them_info"
        ),
      ],
      [
        Markup.button.callback("🚨 گزارش", `report_user_${targetUserId}`),
        Markup.button.callback("🚫 بلاک", `block_user_${targetUserId}`),
      ],
      [Markup.button.callback("🔙 بازگشت", "main_menu")],
    ]),

  /**
   * ✅ کیبورد لیست افراد بلاک شده
   */
  blockedUsersList: (
    blockedUsers: Array<{
      id: number;
      display_name: string;
      first_name: string;
    }>
  ) => {
    if (blockedUsers.length === 0) {
      return Markup.inlineKeyboard([
        [Markup.button.callback("🔙 بازگشت", "profile_view")],
      ]);
    }

    const buttons = blockedUsers.slice(0, 10).map((user) => [
      Markup.button.callback(
        `🔓 ${user.display_name || user.first_name}`,
        `unblock_user_${user.id}`
      ),
    ]);

    buttons.push([Markup.button.callback("🔙 بازگشت", "profile_view")]);

    return Markup.inlineKeyboard(buttons);
  },

  /**
   * ✅ کیبورد لیست مخاطبین
   */
  contactsList: (
    contacts: Array<{
      id: number;
      display_name: string;
      first_name: string;
      is_favorite: boolean;
    }>
  ) => {
    if (contacts.length === 0) {
      return Markup.inlineKeyboard([
        [Markup.button.callback("🔙 بازگشت", "profile_view")],
      ]);
    }

    const buttons = contacts.slice(0, 10).map((contact) => [
      Markup.button.callback(
        `${contact.is_favorite ? "⭐" : "👤"} ${
          contact.display_name || contact.first_name
        }`,
        `view_profile_${contact.id}`
      ),
      Markup.button.callback(
        contact.is_favorite ? "❌ حذف از علاقه‌مندی" : "⭐ علاقه‌مندی",
        `toggle_favorite_${contact.id}`
      ),
    ]);

    buttons.push(
      [
        Markup.button.callback("⭐ فقط علاقه‌مندی‌ها", "show_favorites"),
        Markup.button.callback("🔄 رفرش", "contacts_refresh"),
      ],
      [Markup.button.callback("🔙 بازگشت", "profile_view")]
    );

    return Markup.inlineKeyboard(buttons);
  },
};
