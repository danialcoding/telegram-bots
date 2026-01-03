import { Markup } from 'telegraf';

/**
 * صفحه‌کلید اولیه حذف اکانت با دکمه پرداخت
 */
export function deleteAccountInitialKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('💳 پرداخت و حذف اکانت', 'delete_account_payment')],
    [Markup.button.callback('🔙 بازگشت', 'back_to_profile')],
  ]);
}

/**
 * صفحه‌کلید تایید نهایی حذف اکانت
 */
export function deleteAccountConfirmKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('✅ تایید حذف', 'delete_account_confirm')],
    [Markup.button.callback('🔙 برگشت', 'delete_account_cancel')],
  ]);
}
