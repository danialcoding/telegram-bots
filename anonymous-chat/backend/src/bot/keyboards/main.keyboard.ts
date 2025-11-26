import { Markup } from "telegraf";

/**
 * کیبورد منوی اصلی (اگه نداری)
 */
export const mainMenuKeyboard = () => Markup.keyboard([
  ['👤 پروفایل من', '🔍 جستجو'],
  ['💬 چت‌های من', '⚙️ تنظیمات'],
]).resize();
