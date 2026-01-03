import { Markup } from "telegraf";
import { isUserOnline } from "../../utils/helpers";

/**
 * کیبورد Inline منوی جستجوی کاربران
 */
export const userSearchMenuKeyboard = () =>
  Markup.inlineKeyboard([
    [Markup.button.callback("📞 به مخاطب خاص وصلم کن", "search_specific")],
    [
      Markup.button.callback("🏙️ هم استانی ها", "search_same_province"),
      Markup.button.callback("🎂 هم سن ها", "search_same_age"),
    ],
    [
      Markup.button.callback("🔎 جستجوی پیشرفته", "search_advanced"),
      Markup.button.callback("کاربران جدید🆕 ", "search_new_users"),
    ],
    [
      Markup.button.callback("💬 چت های اخیر من", "search_recent_chats"),
      Markup.button.callback("🚫 بدون چت ها", "search_no_chats"),
    ],
    [Markup.button.callback("⭐ کاربران محبوب", "search_popular")],
  ]);

/**
 * کیبورد انتخاب جنسیت برای جستجوی پیشرفته
 */
export const genderSelectionKeyboard = (searchType: string) =>
  Markup.inlineKeyboard([
    [
      Markup.button.callback("🙍‍♀️ فقط دختر", `${searchType}_gender_female`),
      Markup.button.callback("🙍‍♂️ فقط پسر", `${searchType}_gender_male`),
    ],
    [Markup.button.callback("👥 همه رو نمایش بده", `${searchType}_gender_all`)],
    [Markup.button.callback("🔙 بازگشت", "back_to_search_menu")],
  ]);

/**
 * کیبورد لیست کاربران با صفحه‌بندی و گزینه کشویی
 */
export const userListKeyboard = (
  users: any[],
  currentPage: number,
  totalPages: number,
  searchCode: string,
  searchType: string,
  gender?: string
) => {
  const buttons: any[] = [];

  // دکمه‌های ناوبری
  const navigationButtons = [];
  const genderParam = gender ? `_${gender}` : "";

  if (currentPage > 1) {
    navigationButtons.push(
      Markup.button.callback(
        "➡️ قبلی",
        `${searchType}_page_${currentPage - 1}${genderParam}`
      )
    );
  }
  if (currentPage < totalPages) {
    navigationButtons.push(
      Markup.button.callback(
        "⬅️ بعدی",
        `${searchType}_page_${currentPage + 1}${genderParam}`
      )
    );
  }
  if (navigationButtons.length > 0) {
    buttons.push(navigationButtons);
  }

  // دکمه مشاهده کشویی
  buttons.push([
    Markup.button.switchToCurrentChat(
      "👁 مشاهده به صورت کشویی",
      `${searchCode}`
    ),
  ]);

  // دکمه بازگشت
  buttons.push([
    Markup.button.callback("🔙 بازگشت به منوی جستجو", "back_to_search_menu"),
  ]);

  return Markup.inlineKeyboard(buttons);
};

/**
 * کیبورد بازگشت به منوی جستجو
 */
export const backToSearchMenuKeyboard = () =>
  Markup.inlineKeyboard([
    [Markup.button.callback("🔙 بازگشت به منوی جستجو", "back_to_search_menu")],
  ]);

/**
 * کیبورد انتخاب چند استان
 */
export const provinceSelectionKeyboard = (selectedProvinces: number[], searchType: string) => {
  const buttons: any[] = [];
  const { PROVINCES } = require("../../utils/locations");
  
  // دکمه‌های استان‌ها (3 استان در هر ردیف)
  for (let i = 0; i < PROVINCES.length; i += 3) {
    const row = [];
    for (let j = i; j < Math.min(i + 3, PROVINCES.length); j++) {
      const province = PROVINCES[j];
      const isSelected = selectedProvinces.includes(province.id);
      const emoji = isSelected ? "✅ " : "";
      row.push(
        Markup.button.callback(
          `${emoji}${province.name}`,
          `${searchType}_province_${province.id}`
        )
      );
    }
    buttons.push(row);
  }

  // دکمه انتخاب همه
  const allSelected = selectedProvinces.length === PROVINCES.length;
  buttons.push([
    Markup.button.callback(
      allSelected ? "✅ انتخاب همه" : "🔘 انتخاب همه",
      `${searchType}_province_all`
    ),
  ]);

  // دکمه مرحله بعدی
  if (selectedProvinces.length > 0) {
    buttons.push([
      Markup.button.callback("➡️ مرحله بعدی", `${searchType}_next_age`),
    ]);
  }

  // دکمه بازگشت
  buttons.push([
    Markup.button.callback("🔙 بازگشت", "back_to_search_menu"),
  ]);

  return Markup.inlineKeyboard(buttons);
};

/**
 * کیبورد انتخاب بازه سنی
 */
export const ageRangeKeyboard = (minAge: number | null, maxAge: number | null, searchType: string) => {
  const buttons: any[] = [];
  // Generate all ages from 13 to 99
  const ages: number[] = [];
  for (let age = 13; age <= 99; age++) {
    ages.push(age);
  }

  // دکمه‌های سن (7 در هر ردیف)
  for (let i = 0; i < ages.length; i += 7) {
    const row = [];
    for (let j = i; j < Math.min(i + 7, ages.length); j++) {
      const age = ages[j];
      const isMinAge = minAge === age;
      const isMaxAge = maxAge === age;
      const emoji = isMinAge || isMaxAge ? "✅ " : "";
      row.push(
        Markup.button.callback(
          `${emoji}${age}`,
          `${searchType}_age_${age}`
        )
      );
    }
    buttons.push(row);
  }

  // دکمه انتخاب همه سنین
  buttons.push([
    Markup.button.callback(
      minAge === 13 && maxAge === 99 ? "✅ همه سنین" : "👥 همه سنین",
      `${searchType}_age_all`
    ),
  ]);

  // دکمه بازگشت
  buttons.push([
    Markup.button.callback("🔙 بازگشت", `${searchType}_back_province`),
  ]);

  return Markup.inlineKeyboard(buttons);
};

/**
 * کیبورد انتخاب آخرین حضور
 */
export const lastActivityKeyboard = (searchType: string) => {
  return Markup.inlineKeyboard([
    [Markup.button.callback("⏰ تا یک ساعت قبل", `${searchType}_activity_1h`)],
    [Markup.button.callback("⏰ تا ۶ ساعت قبل", `${searchType}_activity_6h`)],
    [Markup.button.callback("📅 تا یک روز قبل", `${searchType}_activity_1d`)],
    [Markup.button.callback("📅 تا دو روز قبل", `${searchType}_activity_2d`)],
    [Markup.button.callback("📅 تا سه روز قبل", `${searchType}_activity_3d`)],
    [Markup.button.callback("👥 همه", `${searchType}_activity_all`)],
    [Markup.button.callback("🔙 بازگشت", `${searchType}_back_age`)],
  ]);
};
