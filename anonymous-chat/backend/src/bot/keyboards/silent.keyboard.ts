import { Markup } from "telegraf";

/**
 * کیبورد حالت سایلنت
 */
export const silentModeKeyboard = (isSilent: boolean, silentUntil: Date | null) => {
  const buttons: any[] = [];

  if (!isSilent || (silentUntil && new Date(silentUntil) <= new Date())) {
    // حالت غیرفعال - نمایش گزینه‌های فعال‌سازی
    buttons.push([
      Markup.button.callback("⏰ سایلنت تا ۳۰ دقیقه", "silent_enable_30min"),
    ]);
    buttons.push([
      Markup.button.callback("⏰ سایلنت تا ۱ ساعت", "silent_enable_1hour"),
    ]);
    buttons.push([
      Markup.button.callback("🔕 همیشه سایلنت", "silent_enable_forever"),
    ]);
  } else {
    // حالت فعال - نمایش گزینه‌های تغییر و غیرفعال‌سازی
    buttons.push([
      Markup.button.callback("⏰ سایلنت تا ۳۰ دقیقه", "silent_enable_30min"),
    ]);
    buttons.push([
      Markup.button.callback("⏰ سایلنت تا ۱ ساعت", "silent_enable_1hour"),
    ]);
    buttons.push([
      Markup.button.callback("🔕 همیشه سایلنت", "silent_enable_forever"),
    ]);
    buttons.push([
      Markup.button.callback("🔔 غیرفعال کردن حالت سایلنت", "silent_disable"),
    ]);
  }

  return Markup.inlineKeyboard(buttons);
};
