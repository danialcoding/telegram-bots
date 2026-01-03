import {
  RPSChoice,
  RoundResult,
  RPSGameData,
  RPSRound,
  GameType,
  GameSession
} from '../../types/game.types';
import { gameService } from './game.service';
import logger from '../../utils/logger';

/**
 * سرویس منطق بازی سنگ کاغذ قیچی
 */
export class RockPaperScissorsService {
  private readonly WINNING_SCORE = 3; // اولین نفری که 3 امتیاز بگیرد برنده است

  /**
   * شروع بازی جدید
   */
  async startGame(chatId: number, player1Id: number, player2Id: number): Promise<GameSession> {
    try {
      const initialGameData: RPSGameData = {
        rounds: [this.createNewRound(1)],
        current_round: 1,
        max_rounds: 99, // تا زمانی که یکی 3 امتیاز بگیرد
        scores: {
          player1: 0,
          player2: 0
        }
      };

      const gameSession = await gameService.createGameSession(
        chatId,
        GameType.ROCK_PAPER_SCISSORS,
        player1Id,
        player2Id,
        initialGameData
      );

      logger.info(`🎮 RPS game started: ${gameSession.id}`);
      return gameSession;
    } catch (error) {
      logger.error('❌ Error starting RPS game:', error);
      throw error;
    }
  }

  /**
   * ثبت انتخاب بازیکن
   */
  async makeChoice(
    gameId: number,
    playerId: number,
    choice: RPSChoice
  ): Promise<{ success: boolean; message: string; gameData?: RPSGameData }> {
    try {
      const game = await gameService.getGameSession(gameId);
      if (!game) {
        return { success: false, message: '❌ بازی یافت نشد' };
      }

      const gameData: RPSGameData = game.game_data;
      const currentRound = gameData.rounds[gameData.current_round - 1];

      // تشخیص اینکه کدام بازیکن است
      const isPlayer1 = game.player1_id === playerId;
      const isPlayer2 = game.player2_id === playerId;

      if (!isPlayer1 && !isPlayer2) {
        return { success: false, message: '❌ شما در این بازی نیستید' };
      }

      // بررسی انتخاب قبلی
      if (isPlayer1 && currentRound.player1_choice !== null) {
        return { success: false, message: '⚠️ شما قبلاً انتخاب خود را انجام داده‌اید' };
      }

      if (isPlayer2 && currentRound.player2_choice !== null) {
        return { success: false, message: '⚠️ شما قبلاً انتخاب خود را انجام داده‌اید' };
      }

      // ثبت انتخاب
      if (isPlayer1) {
        currentRound.player1_choice = choice;
      } else {
        currentRound.player2_choice = choice;
      }

      // بررسی اینکه آیا هر دو بازیکن انتخاب کرده‌اند
      if (currentRound.player1_choice && currentRound.player2_choice) {
        // محاسبه نتیجه راند
        const result = this.calculateRoundResult(
          currentRound.player1_choice,
          currentRound.player2_choice
        );
        currentRound.result = result;
        currentRound.completed_at = new Date();

        // به‌روزرسانی امتیاز
        if (result === RoundResult.PLAYER1_WIN) {
          gameData.scores.player1++;
        } else if (result === RoundResult.PLAYER2_WIN) {
          gameData.scores.player2++;
        }

        // بررسی پایان بازی
        if (this.isGameOver(gameData)) {
          const winnerId = this.determineWinner(game, gameData);
          await gameService.completeGame(gameId, winnerId);
          logger.info(`🏆 RPS game ${gameId} completed. Winner: ${winnerId || 'Draw'}`);
        } else {
          // شروع راند بعدی
          gameData.current_round++;
          gameData.rounds.push(this.createNewRound(gameData.current_round));
        }
      }

      // ذخیره تغییرات
      await gameService.updateGameData(gameId, gameData);

      return {
        success: true,
        message: '✅ انتخاب شما ثبت شد',
        gameData
      };
    } catch (error) {
      logger.error('❌ Error making choice:', error);
      return { success: false, message: '❌ خطا در ثبت انتخاب' };
    }
  }

  /**
   * محاسبه نتیجه یک راند
   */
  private calculateRoundResult(choice1: RPSChoice, choice2: RPSChoice): RoundResult {
    if (choice1 === choice2) {
      return RoundResult.DRAW;
    }

    const winningCombinations: { [key: string]: RPSChoice } = {
      [RPSChoice.ROCK]: RPSChoice.SCISSORS,
      [RPSChoice.SCISSORS]: RPSChoice.PAPER,
      [RPSChoice.PAPER]: RPSChoice.ROCK
    };

    if (winningCombinations[choice1] === choice2) {
      return RoundResult.PLAYER1_WIN;
    }

    return RoundResult.PLAYER2_WIN;
  }

  /**
   * بررسی پایان بازی
   */
  private isGameOver(gameData: RPSGameData): boolean {
    // اگر یک بازیکن به 3 امتیاز رسید
    const player1Wins = gameData.scores.player1;
    const player2Wins = gameData.scores.player2;

    return player1Wins >= this.WINNING_SCORE || player2Wins >= this.WINNING_SCORE;
  }

  /**
   * تعیین برنده
   */
  private determineWinner(game: GameSession, gameData: RPSGameData): number | null {
    if (gameData.scores.player1 > gameData.scores.player2) {
      return game.player1_id;
    } else if (gameData.scores.player2 > gameData.scores.player1) {
      return game.player2_id;
    }
    return null; // مساوی
  }

  /**
   * ایجاد راند جدید
   */
  private createNewRound(roundNumber: number): RPSRound {
    return {
      round_number: roundNumber,
      player1_choice: null,
      player2_choice: null,
      result: null,
      completed_at: null
    };
  }

  /**
   * دریافت وضعیت بازی
   */
  async getGameState(gameId: number, playerId: number) {
    try {
      const game = await gameService.getGameSession(gameId);
      if (!game) {
        return null;
      }

      const gameData: RPSGameData = game.game_data;
      const currentRound = gameData.rounds[gameData.current_round - 1];

      const isPlayer1 = game.player1_id === playerId;

      return {
        game,
        gameData,
        currentRound,
        hasChosen: isPlayer1 ? currentRound.player1_choice !== null : currentRound.player2_choice !== null,
        opponentHasChosen: isPlayer1 ? currentRound.player2_choice !== null : currentRound.player1_choice !== null,
        isMyTurn: isPlayer1 ? currentRound.player1_choice === null : currentRound.player2_choice === null
      };
    } catch (error) {
      logger.error('❌ Error getting game state:', error);
      return null;
    }
  }

  /**
   * دریافت ایموجی انتخاب
   */
  getChoiceEmoji(choice: RPSChoice): string {
    const emojis = {
      [RPSChoice.ROCK]: '✊',
      [RPSChoice.PAPER]: '✋',
      [RPSChoice.SCISSORS]: '✌️'
    };
    return emojis[choice];
  }

  /**
   * دریافت متن انتخاب
   */
  getChoiceText(choice: RPSChoice): string {
    const texts = {
      [RPSChoice.ROCK]: 'سنگ',
      [RPSChoice.PAPER]: 'کاغذ',
      [RPSChoice.SCISSORS]: 'قیچی'
    };
    return texts[choice];
  }
}

export const rpsService = new RockPaperScissorsService();
