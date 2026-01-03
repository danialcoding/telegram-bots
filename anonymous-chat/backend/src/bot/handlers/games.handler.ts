import { Context } from 'telegraf';
import { gamesKeyboard, confirmSendGameKeyboard } from '../keyboards/games.keyboard';
import { rpsConfirmStartKeyboard } from '../keyboards/games/rps.keyboard';
import { userService } from '../../services/user.service';
import { randomChatService } from '../../services/randomChat.service';
import { CHAT_GAMES } from '../../utils/constants';
import logger from '../../utils/logger';

/**
 * نمایش منوی انتخاب بازی
 */
export async function showGamesMenu(ctx: Context) {
  try {
    if (!ctx.from) return;

    const user = (ctx as any).state.user;
    if (!user) return;

    // بررسی وضعیت VIP
    const vipStatus = await userService.checkVipStatus(user.id);

    const message = `🎮 *انتخاب بازی*\n\nیکی از بازی‌های زیر را انتخاب کنید:`;

    if (ctx.callbackQuery) {
      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...gamesKeyboard(vipStatus.isVip)
      });
    } else {
      await ctx.reply(message, {
        parse_mode: 'Markdown',
        ...gamesKeyboard(vipStatus.isVip)
      });
    }
  } catch (error) {
    logger.error('❌ Error showing games menu:', error);
    await ctx.reply('❌ خطا در نمایش منوی بازی‌ها');
  }
}

/**
 * انتخاب بازی دوز
 */
export async function selectTicTacToe(ctx: Context) {
  try {
    if (!ctx.from || !ctx.callbackQuery) return;

    await ctx.editMessageText(
      `${CHAT_GAMES.TIC_TAC_TOE.emoji} *بازی ${CHAT_GAMES.TIC_TAC_TOE.name}*\n\n` +
      `آیا می‌خواهید این بازی را برای طرف مقابل ارسال کنید؟`,
      {
        parse_mode: 'Markdown',
        ...confirmSendGameKeyboard('tic_tac_toe')
      }
    );
  } catch (error) {
    logger.error('❌ Error selecting Tic-Tac-Toe:', error);
  }
}

/**
 * انتخاب بازی سنگ کاغذ قیچی
 */
export async function selectRockPaperScissors(ctx: Context) {
  try {
    if (!ctx.from || !ctx.callbackQuery) return;

    const user = (ctx as any).state.user;
    if (!user) return;

    // بررسی چت فعال
    const activeChat = await randomChatService.getUserActiveChat(user.id);
    if (!activeChat) {
      await ctx.answerCbQuery('❌ شما در حال حاضر چت فعالی ندارید', { show_alert: true });
      return;
    }

    await ctx.editMessageText(
      `${CHAT_GAMES.ROCK_PAPER_SCISSORS.emoji} *بازی ${CHAT_GAMES.ROCK_PAPER_SCISSORS.name}*\n\n` +
      `📋 قوانین:\n` +
      `• بازی شامل 3 راند است\n` +
      `• برنده هر راند یک امتیاز می‌گیرد\n` +
      `• اولین نفری که 2 امتیاز بگیرد برنده است\n\n` +
      `آیا می‌خواهید بازی را شروع کنید؟`,
      {
        parse_mode: 'Markdown',
        ...rpsConfirmStartKeyboard(activeChat.id)
      }
    );
  } catch (error) {
    logger.error('❌ Error selecting Rock-Paper-Scissors:', error);
  }
}

/**
 * انتخاب بازی جرعت یا حقیقت
 */
export async function selectTruthOrDare(ctx: Context) {
  try {
    if (!ctx.from || !ctx.callbackQuery) return;

    await ctx.editMessageText(
      `${CHAT_GAMES.TRUTH_OR_DARE.emoji} *بازی ${CHAT_GAMES.TRUTH_OR_DARE.name}*\n\n` +
      `آیا می‌خواهید این بازی را برای طرف مقابل ارسال کنید؟`,
      {
        parse_mode: 'Markdown',
        ...confirmSendGameKeyboard('truth_or_dare')
      }
    );
  } catch (error) {
    logger.error('❌ Error selecting Truth or Dare:', error);
  }
}

/**
 * نمایش پیام نیاز به VIP
 */
export async function showVipRequired(ctx: Context) {
  try {
    if (!ctx.callbackQuery) return;

    await ctx.answerCbQuery('🔒 این بازی فقط برای کاربران VIP در دسترس است', {
      show_alert: true
    });
  } catch (error) {
    logger.error('❌ Error showing VIP required:', error);
  }
}

/**
 * ارسال بازی به چت
 */
export async function sendGameToChat(ctx: Context, gameType: string) {
  try {
    if (!ctx.from || !ctx.callbackQuery) return;

    const user = (ctx as any).state.user;
    if (!user) return;

    // بررسی چت فعال
    const activeChat = await randomChatService.getUserActiveChat(user.id);
    if (!activeChat) {
      await ctx.answerCbQuery('❌ شما در حال حاضر چت فعالی ندارید', { show_alert: true });
      return;
    }

    // بررسی VIP برای بازی‌های محدود
    if (gameType === 'truth_or_dare') {
      const vipStatus = await userService.checkVipStatus(user.id);
      if (!vipStatus.isVip) {
        await ctx.answerCbQuery('🔒 این بازی فقط برای کاربران VIP در دسترس است', {
          show_alert: true
        });
        return;
      }
    }

    // ارسال بازی به طرف مقابل
    const partnerId = activeChat.user1_id === user.id ? activeChat.user2_id : activeChat.user1_id;
    const partnerTelegramId = await getUserTelegramId(partnerId);

    if (!partnerTelegramId) {
      await ctx.answerCbQuery('❌ خطا در ارسال بازی', { show_alert: true });
      return;
    }

    let gameMessage = '';
    switch (gameType) {
      case 'tic_tac_toe':
        gameMessage = `${CHAT_GAMES.TIC_TAC_TOE.emoji} *بازی ${CHAT_GAMES.TIC_TAC_TOE.name}*\n\nطرف مقابل شما بازی دوز را ارسال کرده است!\n\nبرای شروع بازی از دکمه زیر استفاده کنید:`;
        await ctx.telegram.sendDice(partnerTelegramId, { emoji: '🎯' });
        break;
      case 'rock_paper_scissors':
        gameMessage = `${CHAT_GAMES.ROCK_PAPER_SCISSORS.emoji} *بازی ${CHAT_GAMES.ROCK_PAPER_SCISSORS.name}*\n\nطرف مقابل شما بازی سنگ کاغذ قیچی را ارسال کرده است!`;
        await ctx.telegram.sendDice(partnerTelegramId, { emoji: '✊' });
        break;
      case 'truth_or_dare':
        gameMessage = `${CHAT_GAMES.TRUTH_OR_DARE.emoji} *بازی ${CHAT_GAMES.TRUTH_OR_DARE.name}*\n\nطرف مقابل شما بازی جرعت یا حقیقت را ارسال کرده است!`;
        await ctx.telegram.sendDice(partnerTelegramId, { emoji: '🎲' });
        break;
    }

    if (gameMessage) {
      await ctx.telegram.sendMessage(partnerTelegramId, gameMessage, { parse_mode: 'Markdown' });
    }

    await ctx.answerCbQuery('✅ بازی با موفقیت ارسال شد');
    await ctx.editMessageText('✅ بازی برای طرف مقابل ارسال شد');
  } catch (error) {
    logger.error('❌ Error sending game to chat:', error);
    await ctx.answerCbQuery('❌ خطا در ارسال بازی', { show_alert: true });
  }
}

/**
 * انصراف از ارسال بازی
 */
export async function cancelSendGame(ctx: Context) {
  try {
    if (!ctx.from || !ctx.callbackQuery) return;

    await showGamesMenu(ctx);
  } catch (error) {
    logger.error('❌ Error canceling send game:', error);
  }
}

/**
 * بازگشت به چت
 */
export async function backToChat(ctx: Context) {
  try {
    if (!ctx.callbackQuery) return;

    await ctx.deleteMessage();
    await ctx.answerCbQuery('بازگشت به چت');
  } catch (error) {
    logger.error('❌ Error going back to chat:', error);
  }
}

/**
 * دریافت Telegram ID از User ID
 */
async function getUserTelegramId(userId: number): Promise<number | null> {
  try {
    const user = await userService.findById(userId);
    return user?.telegram_id || null;
  } catch (error) {
    logger.error('❌ Error getting telegram ID:', error);
    return null;
  }
}

export const gamesHandlers = {
  showGamesMenu,
  selectTicTacToe,
  selectRockPaperScissors,
  selectTruthOrDare,
  showVipRequired,
  sendGameToChat,
  cancelSendGame,
  backToChat,
};
