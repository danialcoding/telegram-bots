import { Markup } from 'telegraf';
import { CHAT_GAMES } from '../../utils/constants';

/**
 * صفحه‌کلید انتخاب بازی
 */
export function gamesKeyboard(isVip: boolean) {
  const buttons = [];

  // دوز (رایگان)
  buttons.push([
    Markup.button.callback(
      `${CHAT_GAMES.TIC_TAC_TOE.emoji} ${CHAT_GAMES.TIC_TAC_TOE.name}`,
      'game_tic_tac_toe'
    )
  ]);

  // سنگ کاغذ قیچی (رایگان)
  buttons.push([
    Markup.button.callback(
      `${CHAT_GAMES.ROCK_PAPER_SCISSORS.emoji} ${CHAT_GAMES.ROCK_PAPER_SCISSORS.name}`,
      'game_rock_paper_scissors'
    )
  ]);

  // جرعت یا حقیقت (فقط VIP)
  if (isVip) {
    buttons.push([
      Markup.button.callback(
        `${CHAT_GAMES.TRUTH_OR_DARE.emoji} ${CHAT_GAMES.TRUTH_OR_DARE.name}`,
        'game_truth_or_dare'
      )
    ]);
  } else {
    buttons.push([
      Markup.button.callback(
        `🔒 ${CHAT_GAMES.TRUTH_OR_DARE.name} (فقط VIP)`,
        'game_vip_required'
      )
    ]);
  }

  // دکمه بازگشت
  buttons.push([
    Markup.button.callback('🔙 بازگشت', 'back_to_chat')
  ]);

  return Markup.inlineKeyboard(buttons);
}

/**
 * صفحه‌کلید تایید ارسال بازی
 */
export function confirmSendGameKeyboard(gameType: string) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ ارسال بازی', `send_game_${gameType}`),
      Markup.button.callback('❌ انصراف', 'cancel_send_game')
    ]
  ]);
}
