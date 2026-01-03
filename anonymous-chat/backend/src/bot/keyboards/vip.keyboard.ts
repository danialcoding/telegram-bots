import { Markup } from 'telegraf';
import { VIP_SUBSCRIPTION } from '../../utils/constants';

/**
 * صفحه‌کلید خرید اشتراک VIP
 */
export function vipPurchaseKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        `⭐ 1 ماه - ${VIP_SUBSCRIPTION.PRICES.ONE_MONTH} ستاره`,
        'buy_vip_1_month'
      )
    ],
    [
      Markup.button.callback(
        `⭐ 3 ماه - ${VIP_SUBSCRIPTION.PRICES.THREE_MONTHS} ستاره`,
        'buy_vip_3_months'
      )
    ],
    [
      Markup.button.callback(
        `⭐ 6 ماه - ${VIP_SUBSCRIPTION.PRICES.SIX_MONTHS} ستاره`,
        'buy_vip_6_months'
      )
    ],
    [
      Markup.button.callback(
        `⭐ 12 ماه - ${VIP_SUBSCRIPTION.PRICES.TWELVE_MONTHS} ستاره`,
        'buy_vip_12_months'
      )
    ],
    [
      Markup.button.callback('🔙 بازگشت', 'back_to_main_menu')
    ]
  ]);
}

/**
 * صفحه‌کلید تایید خرید VIP
 */
export function confirmVipPurchaseKeyboard(duration: string, price: number) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ پرداخت و فعال‌سازی', `confirm_vip_${duration}`)
    ],
    [
      Markup.button.callback('❌ انصراف', 'cancel_vip_purchase')
    ]
  ]);
}
