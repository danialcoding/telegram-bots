import { Context } from 'telegraf';
import { RPSChoice, GameStatus } from '../../../types/game.types';
import { rpsService } from '../../../services/games/rps.service';
import { gameService } from '../../../services/games/game.service';
import { randomChatService } from '../../../services/randomChat.service';
import { userService } from '../../../services/user.service';
import {
  rpsChoiceKeyboard,
  rpsNextGameKeyboard,
  rpsConfirmStartKeyboard,
  rpsLockedKeyboard
} from '../../keyboards/games/rps.keyboard';
import logger from '../../../utils/logger';

// ذخیره message ID برای هر بازیکن
const gameMessages = new Map<string, { player1MessageId: number; player2MessageId: number }>();

/**
 * شروع بازی سنگ کاغذ قیچی
 */
export async function startRPSGame(ctx: Context) {
  try {
    if (!ctx.callbackQuery || !ctx.from) return;

    const user = (ctx as any).state.user;
    if (!user) return;

    // استخراج chat_id از callback data
    const callbackData = (ctx.callbackQuery as any).data;
    const chatId = parseInt(callbackData.split('_')[2]);

    if (!chatId || isNaN(chatId)) {
      await ctx.answerCbQuery('❌ خطا در شناسایی چت', { show_alert: true });
      return;
    }

    // بررسی چت فعال
    const activeChat = await randomChatService.getUserActiveChat(user.id);
    if (!activeChat || activeChat.id !== chatId) {
      await ctx.answerCbQuery('❌ شما در حال حاضر چت فعالی ندارید', { show_alert: true });
      return;
    }

    // بررسی بازی فعال
    const existingGame = await gameService.getActiveGameByChat(chatId);
    if (existingGame && existingGame.status === GameStatus.IN_PROGRESS) {
      await ctx.answerCbQuery('⚠️ یک بازی در حال انجام است', { show_alert: true });
      return;
    }

    // شروع بازی
    const partnerId = activeChat.user1_id === user.id ? activeChat.user2_id : activeChat.user1_id;
    const gameSession = await rpsService.startGame(chatId, user.id, partnerId);

    // دریافت نام کاربران
    const player1 = await userService.findById(gameSession.player1_id);
    const player2 = await userService.findById(gameSession.player2_id);
    const player1Name = player1?.first_name || 'بازیکن 1';
    const player2Name = player2?.first_name || 'بازیکن 2';

    // ارسال پیام به هر دو بازیکن
    const gameMessage = 
      `🎮 *بازی سنگ کاغذ قیچی شروع شد!*\n\n` +
      `👥 بازیکنان: ${player1Name} 🆚 ${player2Name}\n\n` +
      `📋 قوانین:\n` +
      `• اولین نفری که 3 امتیاز بگیرد برنده است\n` +
      `• برنده هر راند یک امتیاز می‌گیرد\n\n` +
      `✊ سنگ > ✌️ قیچی\n` +
      `✋ کاغذ > ✊ سنگ\n` +
      `✌️ قیچی > ✋ کاغذ\n\n` +
      `━━━━━━━━━━━━━━━\n` +
      `🎯 *راند 1*\n` +
      `📊 ${player1Name}: 0 | ${player2Name}: 0\n\n` +
      `انتخاب خود را انجام دهید:`;

    // پیام به بازیکن فعلی
    const player1Message = await ctx.editMessageText(gameMessage, {
      parse_mode: 'Markdown',
      ...rpsChoiceKeyboard(gameSession.id)
    });

    // پیام به طرف مقابل
    const partnerTelegramId = await getUserTelegramId(partnerId);
    let player2MessageId = 0;
    if (partnerTelegramId) {
      const player2Message = await ctx.telegram.sendMessage(partnerTelegramId, gameMessage, {
        parse_mode: 'Markdown',
        ...rpsChoiceKeyboard(gameSession.id)
      });
      player2MessageId = player2Message.message_id;
    }

    // ذخیره message IDs
    const isPlayer1 = gameSession.player1_id === user.id;
    gameMessages.set(`${gameSession.id}`, {
      player1MessageId: isPlayer1 ? (player1Message as any).message_id : player2MessageId,
      player2MessageId: isPlayer1 ? player2MessageId : (player1Message as any).message_id
    });

    await ctx.answerCbQuery('🎮 بازی شروع شد!');
  } catch (error) {
    logger.error('❌ Error starting RPS game:', error);
    await ctx.answerCbQuery('❌ خطا در شروع بازی', { show_alert: true });
  }
}

/**
 * انتخاب حرکت در بازی
 */
export async function makeRPSChoice(ctx: Context) {
  try {
    if (!ctx.callbackQuery || !ctx.from) return;

    const user = (ctx as any).state.user;
    if (!user) return;

    // استخراج اطلاعات از callback data: rps_choice_GAMEID_CHOICE
    const callbackData = (ctx.callbackQuery as any).data;
    const parts = callbackData.split('_');
    const gameId = parseInt(parts[2]);
    const choice = parts[3] as RPSChoice;

    if (!gameId || isNaN(gameId) || !choice) {
      await ctx.answerCbQuery('❌ خطا در پردازش انتخاب', { show_alert: true });
      return;
    }

    // ثبت انتخاب
    const result = await rpsService.makeChoice(gameId, user.id, choice);

    if (!result.success) {
      await ctx.answerCbQuery(result.message, { show_alert: true });
      return;
    }

    const gameData = result.gameData!;
    const currentRound = gameData.rounds[gameData.current_round - 1];
    const game = await gameService.getGameSession(gameId);
    if (!game) return;

    const isPlayer1 = game.player1_id === user.id;

    // اگر هر دو بازیکن انتخاب کردند
    if (currentRound.player1_choice && currentRound.player2_choice) {
      await ctx.answerCbQuery('✅ انتخاب ثبت شد');
      await showRoundResult(ctx, gameId);
    } else {
      // دریافت نام کاربران
      const player1 = await userService.findById(game.player1_id);
      const player2 = await userService.findById(game.player2_id);
      const player1Name = player1?.first_name || 'بازیکن 1';
      const player2Name = player2?.first_name || 'بازیکن 2';

      // در انتظار طرف مقابل - نمایش دکمه‌های غیرفعال
      const choiceEmoji = rpsService.getChoiceEmoji(choice);
      const choiceText = rpsService.getChoiceText(choice);

      const waitingMessage =
        `🎮 *بازی سنگ کاغذ قیچی*\n\n` +
        `🎯 *راند ${currentRound.round_number}*\n` +
        `📊 ${player1Name}: ${gameData.scores.player1} | ${player2Name}: ${gameData.scores.player2}\n\n` +
        `━━━━━━━━━━━━━━━\n` +
        `✅ شما انتخاب کردید: ${choiceEmoji} ${choiceText}\n` +
        `⏳ در انتظار انتخاب طرف مقابل...`;

      await ctx.editMessageText(waitingMessage, {
        parse_mode: 'Markdown',
        ...rpsLockedKeyboard(gameId, choice)
      });

      await ctx.answerCbQuery('✅ انتخاب شما ثبت شد - منتظر طرف مقابل باشید');

      // بروزرسانی پیام طرف مقابل - اگر هنوز انتخاب نکرده
      await updateOpponentMessage(ctx, game, gameId, currentRound, gameData, isPlayer1);
    }
  } catch (error) {
    logger.error('❌ Error making RPS choice:', error);
    await ctx.answerCbQuery('❌ خطا در ثبت انتخاب', { show_alert: true });
  }
}

/**
 * نمایش نتیجه راند
 */
async function showRoundResult(ctx: Context, gameId: number) {
  try {
    const game = await gameService.getGameSession(gameId);
    if (!game) return;

    const gameData = game.game_data;
    const currentRound = gameData.rounds[gameData.current_round - 1];

    const messageIds = gameMessages.get(`${gameId}`);
    if (!messageIds) return;

    // نمایش نتیجه به هر دو بازیکن به صورت جداگانه
    await showResultToPlayer(ctx, game, gameId, currentRound, gameData, true, messageIds.player1MessageId);
    await showResultToPlayer(ctx, game, gameId, currentRound, gameData, false, messageIds.player2MessageId);

    // اگر بازی تمام شد، message IDs را پاک کن
    if (game.status === GameStatus.COMPLETED) {
      gameMessages.delete(`${gameId}`);
    }
  } catch (error) {
    logger.error('❌ Error showing round result:', error);
  }
}

/**
 * نمایش نتیجه به یک بازیکن
 */
async function showResultToPlayer(
  ctx: Context,
  game: any, 
  gameId: number, 
  currentRound: any, 
  gameData: any, 
  isPlayer1: boolean,
  messageId: number
) {
  try {
    const playerId = isPlayer1 ? game.player1_id : game.player2_id;
    const opponentId = isPlayer1 ? game.player2_id : game.player1_id;
    
    const playerTelegramId = await getUserTelegramId(playerId);
    if (!playerTelegramId) return;

    // دریافت نام کاربران
    const player = await userService.findById(playerId);
    const opponent = await userService.findById(opponentId);
    
    const myName = player?.first_name || 'شما';
    const opponentName = opponent?.first_name || 'طرف مقابل';

    // تعیین انتخاب‌ها از دید این بازیکن
    const myChoice = isPlayer1 ? currentRound.player1_choice! : currentRound.player2_choice!;
    const opponentChoice = isPlayer1 ? currentRound.player2_choice! : currentRound.player1_choice!;

    const myChoiceEmoji = rpsService.getChoiceEmoji(myChoice);
    const myChoiceText = rpsService.getChoiceText(myChoice);
    const opponentChoiceEmoji = rpsService.getChoiceEmoji(opponentChoice);
    const opponentChoiceText = rpsService.getChoiceText(opponentChoice);

    // تعیین برنده این راند
    let resultText = '';
    let winnerName = '';
    
    if (currentRound.result === 'draw') {
      resultText = '🤝 مساوی!';
    } else {
      const didWin = (isPlayer1 && currentRound.result === 'player1_win') || 
                     (!isPlayer1 && currentRound.result === 'player2_win');
      winnerName = didWin ? myName : opponentName;
      resultText = `🏆 برنده: *${winnerName}*`;
    }

    const myScore = isPlayer1 ? gameData.scores.player1 : gameData.scores.player2;
    const opponentScore = isPlayer1 ? gameData.scores.player2 : gameData.scores.player1;

    let message = 
      `🎮 *بازی سنگ کاغذ قیچی*\n\n` +
      `━━━━━━━━━━━━━━━\n` +
      `📋 *نتیجه راند ${currentRound.round_number}*\n\n` +
      `${myChoiceEmoji} *${myName}* - ${opponentChoiceEmoji} *${opponentName}*\n\n` +
      `${resultText}\n\n` +
      `📊 *امتیازات:* ${myName}: ${myScore} | ${opponentName}: ${opponentScore}\n`;

    let keyboard;

    // بررسی پایان بازی
    if (game.status === GameStatus.COMPLETED) {
      const isWinner = game.winner_id === playerId;
      const isDraw = game.winner_id === null;

      message += `\n━━━━━━━━━━━━━━━\n`;
      message += isDraw 
        ? '🤝 *بازی مساوی شد!*'
        : isWinner 
          ? '🏆 *تبریک! شما برنده بازی شدید!*'
          : '😔 *طرف مقابل برنده بازی شد!*';

      keyboard = rpsNextGameKeyboard(game.chat_id);
    } else {
      // راند بعدی - نمایش دکمه‌های انتخاب
      message += `\n━━━━━━━━━━━━━━━\n` +
                `🎯 *راند ${gameData.current_round}*\n` +
                `🎯 برای رسیدن به 3 امتیاز\n\n` +
                `انتخاب خود را برای راند بعدی انجام دهید:`;

      keyboard = rpsChoiceKeyboard(gameId);
    }

    // بروزرسانی پیام این بازیکن
    await ctx.telegram.editMessageText(
      playerTelegramId,
      messageId,
      undefined,
      message,
      {
        parse_mode: 'Markdown',
        ...keyboard
      }
    ).catch(() => {});

  } catch (error) {
    logger.error('❌ Error showing result to player:', error);
  }
}

/**
 * بروزرسانی پیام طرف مقابل
 */
async function updateOpponentMessage(ctx: Context, game: any, gameId: number, currentRound: any, gameData: any, isPlayer1: boolean) {
  try {
    const partnerId = isPlayer1 ? game.player2_id : game.player1_id;
    const partnerTelegramId = await getUserTelegramId(partnerId);
    
    if (!partnerTelegramId) return;

    const messageIds = gameMessages.get(`${gameId}`);
    if (!messageIds) return;

    const partnerMessageId = isPlayer1 ? messageIds.player2MessageId : messageIds.player1MessageId;

    // دریافت نام کاربران
    const player1 = await userService.findById(game.player1_id);
    const player2 = await userService.findById(game.player2_id);
    const player1Name = player1?.first_name || 'بازیکن 1';
    const player2Name = player2?.first_name || 'بازیکن 2';

    // بررسی اینکه طرف مقابل قبلا انتخاب کرده یا نه
    const partnerChoice = isPlayer1 ? currentRound.player2_choice : currentRound.player1_choice;

    if (partnerChoice) {
      // طرف مقابل قبلا انتخاب کرده - فقط پیام را بروز کنیم
      const choiceEmoji = rpsService.getChoiceEmoji(partnerChoice);
      const choiceText = rpsService.getChoiceText(partnerChoice);

      const opponentMessage =
        `🎮 *بازی سنگ کاغذ قیچی*\n\n` +
        `🎯 *راند ${currentRound.round_number}*\n` +
        `📊 ${player1Name}: ${gameData.scores.player1} | ${player2Name}: ${gameData.scores.player2}\n\n` +
        `━━━━━━━━━━━━━━━\n` +
        `✅ شما انتخاب کردید: ${choiceEmoji} ${choiceText}\n` +
        `⚡ طرف مقابل هم انتخاب کرد!\n` +
        `⏳ در حال محاسبه نتیجه...`;

      await ctx.telegram.editMessageText(
        partnerTelegramId,
        partnerMessageId,
        undefined,
        opponentMessage,
        {
          parse_mode: 'Markdown',
          ...rpsLockedKeyboard(gameId, partnerChoice)
        }
      ).catch(() => {});
    } else {
      // طرف مقابل هنوز انتخاب نکرده - اعلان بدهیم
      const opponentMessage =
        `🎮 *بازی سنگ کاغذ قیچی*\n\n` +
        `🎯 *راند ${currentRound.round_number}*\n` +
        `📊 ${player1Name}: ${gameData.scores.player1} | ${player2Name}: ${gameData.scores.player2}\n\n` +
        `━━━━━━━━━━━━━━━\n` +
        `⚡ طرف مقابل انتخاب کرد!\n` +
        `⏰ انتخاب خود را انجام دهید:`;

      await ctx.telegram.editMessageText(
        partnerTelegramId,
        partnerMessageId,
        undefined,
        opponentMessage,
        {
          parse_mode: 'Markdown',
          ...rpsChoiceKeyboard(gameId)
        }
      ).catch(() => {});
    }
  } catch (error) {
    logger.error('❌ Error updating opponent message:', error);
  }
}

/**
 * بروزرسانی پیام هر دو بازیکن
 */
async function updateBothPlayers(ctx: Context, game: any, message: string, keyboard: any, messageIds: any) {
  try {
    const player1TelegramId = await getUserTelegramId(game.player1_id);
    const player2TelegramId = await getUserTelegramId(game.player2_id);

    if (messageIds && player1TelegramId && player2TelegramId) {
      // بروزرسانی پیام بازیکن 1
      await ctx.telegram.editMessageText(
        player1TelegramId,
        messageIds.player1MessageId,
        undefined,
        message,
        {
          parse_mode: 'Markdown',
          ...keyboard
        }
      ).catch(() => {});

      // بروزرسانی پیام بازیکن 2
      await ctx.telegram.editMessageText(
        player2TelegramId,
        messageIds.player2MessageId,
        undefined,
        message,
        {
          parse_mode: 'Markdown',
          ...keyboard
        }
      ).catch(() => {});
    }
  } catch (error) {
    logger.error('❌ Error updating both players:', error);
  }
}

/**
 * شروع راند بعدی
 */
export async function startNextRound(ctx: Context) {
  try {
    if (!ctx.callbackQuery) return;

    const callbackData = (ctx.callbackQuery as any).data;
    const gameId = parseInt(callbackData.split('_')[3]);

    const game = await gameService.getGameSession(gameId);
    if (!game) return;

    const gameData = game.game_data;
    const currentRound = gameData.rounds[gameData.current_round - 1];
    const messageIds = gameMessages.get(`${gameId}`);

    // دریافت نام کاربران
    const player1 = await userService.findById(game.player1_id);
    const player2 = await userService.findById(game.player2_id);
    const player1Name = player1?.first_name || 'بازیکن 1';
    const player2Name = player2?.first_name || 'بازیکن 2';

    const startMessage =
      `🎮 *بازی سنگ کاغذ قیچی*\n\n` +
      `🎯 *راند ${currentRound.round_number}*\n` +
      `📊 ${player1Name}: ${gameData.scores.player1} | ${player2Name}: ${gameData.scores.player2}\n\n` +
      `━━━━━━━━━━━━━━━\n` +
      `انتخاب خود را انجام دهید:`; +
      `━━━━━━━━━━━━━━━\n` +
      `انتخاب خود را انجام دهید:`;

    await updateBothPlayers(ctx, game, startMessage, rpsChoiceKeyboard(gameId), messageIds);
    await ctx.answerCbQuery('▶️ راند بعدی شروع شد');
  } catch (error) {
    logger.error('❌ Error starting next round:', error);
  }
}

/**
 * بروزرسانی وضعیت بازی (حذف شد - دیگر لازم نیست)
 */
export async function refreshRPSGame(ctx: Context) {
  try {
    await ctx.answerCbQuery('این دکمه دیگر فعال نیست');
  } catch (error) {
    logger.error('❌ Error refreshing RPS game:', error);
  }
}

/**
 * لغو بازی
 */
export async function cancelRPSGame(ctx: Context) {
  try {
    if (!ctx.callbackQuery) return;

    const callbackData = (ctx.callbackQuery as any).data;
    const gameId = parseInt(callbackData.split('_')[2]);

    await gameService.cancelGame(gameId);

    await ctx.editMessageText('❌ بازی لغو شد');
    await ctx.answerCbQuery('بازی لغو شد');
  } catch (error) {
    logger.error('❌ Error cancelling RPS game:', error);
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

/**
 * جلوگیری از تغییر انتخاب بعد از ثبت
 */
export async function handleLockedChoice(ctx: Context) {
  try {
    await ctx.answerCbQuery('⚠️ شما قبلا انتخاب خود را ثبت کرده‌اید و نمی‌توانید آن را تغییر دهید', { show_alert: true });
  } catch (error) {
    logger.error('❌ Error handling locked choice:', error);
  }
}

/**
 * شروع بازی مجدد
 */
export async function startNewRPSGame(ctx: Context) {
  try {
    if (!ctx.callbackQuery || !ctx.from) return;

    const user = (ctx as any).state.user;
    if (!user) return;

    // استخراج chat_id از callback data: rps_new_game_CHATID
    const callbackData = (ctx.callbackQuery as any).data;
    const chatId = parseInt(callbackData.split('_')[3]);

    if (!chatId || isNaN(chatId)) {
      await ctx.answerCbQuery('❌ خطا در شناسایی چت', { show_alert: true });
      return;
    }

    // بررسی چت فعال
    const activeChat = await randomChatService.getUserActiveChat(user.id);
    if (!activeChat || activeChat.id !== chatId) {
      await ctx.answerCbQuery('❌ شما در حال حاضر چت فعالی ندارید', { show_alert: true });
      return;
    }

    // بررسی بازی فعال
    const existingGame = await gameService.getActiveGameByChat(chatId);
    if (existingGame && existingGame.status === GameStatus.IN_PROGRESS) {
      await ctx.answerCbQuery('⚠️ یک بازی در حال انجام است', { show_alert: true });
      return;
    }

    // شروع بازی جدید
    const partnerId = activeChat.user1_id === user.id ? activeChat.user2_id : activeChat.user1_id;
    const gameSession = await rpsService.startGame(chatId, user.id, partnerId);

    // دریافت نام کاربران
    const player1 = await userService.findById(gameSession.player1_id);
    const player2 = await userService.findById(gameSession.player2_id);
    const player1Name = player1?.first_name || 'بازیکن 1';
    const player2Name = player2?.first_name || 'بازیکن 2';

    // ارسال پیام به هر دو بازیکن
    const gameMessage = 
      `🎮 *بازی سنگ کاغذ قیچی شروع شد!*\n\n` +
      `👥 بازیکنان: ${player1Name} 🆚 ${player2Name}\n\n` +
      `📋 قوانین:\n` +
      `• اولین نفری که 3 امتیاز بگیرد برنده است\n` +
      `• برنده هر راند یک امتیاز می‌گیرد\n\n` +
      `✊ سنگ > ✌️ قیچی\n` +
      `✋ کاغذ > ✊ سنگ\n` +
      `✌️ قیچی > ✋ کاغذ\n\n` +
      `━━━━━━━━━━━━━━━\n` +
      `🎯 *راند 1*\n` +
      `📊 ${player1Name}: 0 | ${player2Name}: 0\n\n` +
      `انتخاب خود را انجام دهید:`;

    // ارسال پیام جدید به بازیکن فعلی
    const player1Message = await ctx.reply(gameMessage, {
      parse_mode: 'Markdown',
      ...rpsChoiceKeyboard(gameSession.id)
    });

    // پیام به طرف مقابل
    const partnerTelegramId = await getUserTelegramId(partnerId);
    let player2MessageId = 0;
    if (partnerTelegramId) {
      const player2Message = await ctx.telegram.sendMessage(partnerTelegramId, gameMessage, {
        parse_mode: 'Markdown',
        ...rpsChoiceKeyboard(gameSession.id)
      });
      player2MessageId = player2Message.message_id;
    }

    // ذخیره message IDs
    const isPlayer1 = gameSession.player1_id === user.id;
    gameMessages.set(`${gameSession.id}`, {
      player1MessageId: isPlayer1 ? player1Message.message_id : player2MessageId,
      player2MessageId: isPlayer1 ? player2MessageId : player1Message.message_id
    });

    await ctx.answerCbQuery('🎮 بازی جدید شروع شد!');
  } catch (error) {
    logger.error('❌ Error starting new RPS game:', error);
    await ctx.answerCbQuery('❌ خطا در شروع بازی جدید', { show_alert: true });
  }
}

export const rpsHandlers = {
  startRPSGame,
  makeRPSChoice,
  startNextRound,
  refreshRPSGame,
  cancelRPSGame,
  handleLockedChoice,
  startNewRPSGame
};
