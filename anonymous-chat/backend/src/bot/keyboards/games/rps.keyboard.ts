import { Markup } from 'telegraf';
import { RPSChoice } from '../../../types/game.types';

/**
 * صفحه‌کلید انتخاب حرکت سنگ کاغذ قیچی
 */
export function rpsChoiceKeyboard(gameId: number) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('✊ سنگ', `rps_choice_${gameId}_rock`),
      Markup.button.callback('✋ کاغذ', `rps_choice_${gameId}_paper`),
      Markup.button.callback('✌️ قیچی', `rps_choice_${gameId}_scissors`),
    ],
    [
      Markup.button.callback('❌ انصراف', `rps_cancel_${gameId}`),
    ]
  ]);
}

/**
 * صفحه‌کلید بعد از انتخاب (دکمه‌های غیرفعال)
 */
export function rpsLockedKeyboard(gameId: number, myChoice: RPSChoice) {
  const choices = [
    { emoji: '✊', text: 'سنگ', value: 'rock' as RPSChoice },
    { emoji: '✋', text: 'کاغذ', value: 'paper' as RPSChoice },
    { emoji: '✌️', text: 'قیچی', value: 'scissors' as RPSChoice },
  ];

  return Markup.inlineKeyboard([
    choices.map(c => 
      c.value === myChoice 
        ? Markup.button.callback(`${c.emoji} ${c.text} ✅`, `rps_locked_${gameId}`)
        : Markup.button.callback(`${c.emoji} ${c.text}`, `rps_locked_${gameId}`)
    ),
    [
      Markup.button.callback('❌ انصراف', `rps_cancel_${gameId}`),
    ]
  ]);
}

/**
 * صفحه‌کلید در انتظار طرف مقابل (فقط انصراف)
 */
export function rpsWaitingKeyboard(gameId: number) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('❌ انصراف', `rps_cancel_${gameId}`),
    ]
  ]);
}

/**
 * صفحه‌کلید شروع راند بعدی
 */
export function rpsNextRoundKeyboard(gameId: number) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('▶️ راند بعدی', `rps_next_round_${gameId}`),
    ]
  ]);
}

/**
 * صفحه‌کلید بازی بعدی
 */
export function rpsNextGameKeyboard(chatId: number) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('🎮 بازی مجدد', `rps_new_game_${chatId}`),
      Markup.button.callback('🔙 بازگشت به چت', 'back_to_chat'),
    ]
  ]);
}

/**
 * صفحه‌کلید تایید شروع بازی
 */
export function rpsConfirmStartKeyboard(chatId: number) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ بله، شروع کنیم!', `rps_start_${chatId}`),
      Markup.button.callback('❌ خیر', 'cancel_send_game'),
    ]
  ]);
}
