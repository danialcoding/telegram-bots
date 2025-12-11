import { Markup } from "telegraf";
import { isUserOnline } from "../../utils/helpers";

/**
 * کیبورد Inline منوی جستجوی کاربران
 */
export const userSearchMenuKeyboard = () => Markup.inlineKeyboard([
  [Markup.button.callback('📞 به مخاطب خاص وصلم کن', 'search_specific')],
  [
    Markup.button.callback('🏙️ هم استانی ها', 'search_same_province'),
    Markup.button.callback('🎂 هم سن ها', 'search_same_age'),
  ],
  [
    Markup.button.callback('🔎 جستجوی پیشرفته', 'search_advanced'),
    Markup.button.callback('کاربران جدید🆕 ', 'search_new_users'),
  ],
  [
    Markup.button.callback('💬 چت های اخیر من', 'search_recent_chats'),
    Markup.button.callback('🚫 بدون چت ها', 'search_no_chats'),
  ],
  [Markup.button.callback('⭐ کاربران محبوب', 'search_popular')],
]);

/**
 * کیبورد انتخاب جنسیت برای جستجوی پیشرفته
 */
export const genderSelectionKeyboard = (searchType: string) => Markup.inlineKeyboard([
  [
    Markup.button.callback('🙍‍♀️ فقط دختر', `${searchType}_gender_female`),
    Markup.button.callback('🙍‍♂️ فقط پسر', `${searchType}_gender_male`)
  ],
  [Markup.button.callback('👥 همه رو نمایش بده', `${searchType}_gender_all`)],
  [Markup.button.callback('🔙 بازگشت', 'back_to_search_menu')],
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

  // دکمه‌های کاربران (هر کاربر یک ردیف)
  users.forEach(user => {
    const displayName = user.display_name || user.first_name;
    const age = user.age || '?';
    const city = user.city || user.province || 'نامشخص';
    const likes = user.likes_count || 0;
    // بررسی آنلاین بودن بر اساس last_activity (نه is_online دیتابیس)
    const onlineStatus = isUserOnline(user.last_activity) ? '👀' : '💤';
    
    buttons.push([
      Markup.button.callback(
        `${onlineStatus} ${displayName} | ${age} سال | ${city} | ❤️${likes}`,
        `view_profile_${user.id}`
      )
    ]);
  });

  // دکمه‌های ناوبری
  const navigationButtons = [];
  const genderParam = gender ? `_${gender}` : '';
  
  if (currentPage > 1) {
    navigationButtons.push(Markup.button.callback('➡️ قبلی', `${searchType}_page_${currentPage - 1}${genderParam}`));
  }
  if (currentPage < totalPages) {
    navigationButtons.push(Markup.button.callback('⬅️ بعدی', `${searchType}_page_${currentPage + 1}${genderParam}`));
  }
  if (navigationButtons.length > 0) {
    buttons.push(navigationButtons);
  }

  // دکمه مشاهده کشویی
  buttons.push([
    Markup.button.switchToCurrentChat('👁 مشاهده به صورت کشویی', `${searchCode}`)
  ]);

  // دکمه بازگشت
  buttons.push([Markup.button.callback('🔙 بازگشت به منوی جستجو', 'back_to_search_menu')]);

  return Markup.inlineKeyboard(buttons);
};

/**
 * کیبورد بازگشت به منوی جستجو
 */
export const backToSearchMenuKeyboard = () => Markup.inlineKeyboard([
  [Markup.button.callback('🔙 بازگشت به منوی جستجو', 'back_to_search_menu')],
]);
