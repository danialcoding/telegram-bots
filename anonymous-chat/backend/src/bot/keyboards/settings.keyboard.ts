import { Markup } from 'telegraf';

/**
 * صفحه‌کلید تنظیمات پیشرفته
 */
export function advancedSettingsKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🔕 حالت سایلنت', 'settings_silent_mode')],
    [Markup.button.callback('🗑 حذف حساب کاربری', 'settings_delete_account')],
    [Markup.button.callback('🎯 فیلتر درخواست چت', 'settings_chat_filter')],
    [Markup.button.callback('🔙 بازگشت به منو اصلی', 'main_menu')],
  ]);
}
