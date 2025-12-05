import { Markup } from "telegraf";

/**
 * کیبورد منوی اصلی
 */
export const mainMenuKeyboard = () => Markup.keyboard([
  ['👤 پروفایل من', '🔍 جستجو'],
  ['💰 سکه‌ها', '🎁 دعوت دوستان'],
  ['💬 چت‌های من', '⚙️ تنظیمات'],
]).resize();
