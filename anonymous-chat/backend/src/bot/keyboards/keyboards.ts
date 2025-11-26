import { Markup } from 'telegraf';

/**
 * کیبورد اصلی منو
 */
export const mainMenuKeyboard = () => {
  return Markup.keyboard([
    ['👤 پروفایل من', '💬 شروع چت'],
    ['🎁 امتیازات', '⚙️ تنظیمات'],
    ['📊 آمار', '📞 پشتیبانی'],
  ])
    .resize()
    .persistent();
};

/**
 * کیبورد انتخاب نوع چت
 */
export const chatTypeKeyboard = () => {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('🎲 چت تصادفی', 'chat_random'),
    ],
    [
      Markup.button.callback('👨 با پسران', 'chat_male'),
      Markup.button.callback('👩 با دختران', 'chat_female'),
    ],
    [
      Markup.button.callback('🔙 بازگشت', 'main_menu'),
    ],
  ]);
};

/**
 * کیبورد در حال چت
 */
export const activeChatKeyboard = () => {
  return Markup.keyboard([
    ['⏭ چت بعدی', '❌ پایان چت'],
    ['🔙 منوی اصلی'],
  ])
    .resize()
    .oneTime();
};

/**
 * کیبورد گزارش کاربر
 */
export const reportKeyboard = (reportedUserId: number) => {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('😡 محتوای نامناسب', `report_inappropriate_${reportedUserId}`),
    ],
    [
      Markup.button.callback('🤖 رفتار بات‌گونه', `report_spam_${reportedUserId}`),
      Markup.button.callback('🚫 هرزنگاری', `report_harassment_${reportedUserId}`),
    ],
    [
      Markup.button.callback('❌ انصراف', 'report_cancel'),
    ],
  ]);
};
