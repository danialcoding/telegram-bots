import { pool } from '../../database/db';
import { GameSession, GameType, GameStatus } from '../../types/game.types';
import logger from '../../utils/logger';

/**
 * سرویس مدیریت جلسات بازی
 */
export class GameService {
  /**
   * ایجاد جلسه بازی جدید
   */
  async createGameSession(
    chatId: number,
    gameType: GameType,
    player1Id: number,
    player2Id: number,
    initialGameData: any = {}
  ): Promise<GameSession> {
    try {
      const result = await pool.query(
        `INSERT INTO game_sessions 
         (chat_id, game_type, status, player1_id, player2_id, game_data, started_at) 
         VALUES ($1, $2, $3, $4, $5, $6, NOW()) 
         RETURNING *`,
        [chatId, gameType, GameStatus.IN_PROGRESS, player1Id, player2Id, JSON.stringify(initialGameData)]
      );

      logger.info(`✅ Game session created: ${result.rows[0].id} (${gameType})`);
      return result.rows[0];
    } catch (error) {
      logger.error('❌ Error creating game session:', error);
      throw error;
    }
  }

  /**
   * دریافت جلسه بازی با ID
   */
  async getGameSession(gameId: number): Promise<GameSession | null> {
    try {
      const result = await pool.query(
        `SELECT * FROM game_sessions WHERE id = $1`,
        [gameId]
      );

      return result.rows[0] || null;
    } catch (error) {
      logger.error('❌ Error getting game session:', error);
      throw error;
    }
  }

  /**
   * دریافت بازی فعال برای یک چت
   */
  async getActiveGameByChat(chatId: number, gameType?: GameType): Promise<GameSession | null> {
    try {
      let query = `
        SELECT * FROM game_sessions 
        WHERE chat_id = $1 
        AND status = $2
      `;
      const params: any[] = [chatId, GameStatus.IN_PROGRESS];

      if (gameType) {
        query += ` AND game_type = $3`;
        params.push(gameType);
      }

      query += ` ORDER BY created_at DESC LIMIT 1`;

      const result = await pool.query(query, params);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('❌ Error getting active game:', error);
      throw error;
    }
  }

  /**
   * به‌روزرسانی داده‌های بازی
   */
  async updateGameData(gameId: number, gameData: any): Promise<void> {
    try {
      await pool.query(
        `UPDATE game_sessions SET game_data = $1 WHERE id = $2`,
        [JSON.stringify(gameData), gameId]
      );
    } catch (error) {
      logger.error('❌ Error updating game data:', error);
      throw error;
    }
  }

  /**
   * تکمیل بازی
   */
  async completeGame(gameId: number, winnerId: number | null): Promise<void> {
    try {
      await pool.query(
        `UPDATE game_sessions 
         SET status = $1, winner_id = $2, completed_at = NOW() 
         WHERE id = $3`,
        [GameStatus.COMPLETED, winnerId, gameId]
      );

      logger.info(`✅ Game ${gameId} completed. Winner: ${winnerId || 'Draw'}`);
    } catch (error) {
      logger.error('❌ Error completing game:', error);
      throw error;
    }
  }

  /**
   * لغو بازی
   */
  async cancelGame(gameId: number): Promise<void> {
    try {
      await pool.query(
        `UPDATE game_sessions 
         SET status = $1, completed_at = NOW() 
         WHERE id = $2`,
        [GameStatus.CANCELLED, gameId]
      );

      logger.info(`✅ Game ${gameId} cancelled`);
    } catch (error) {
      logger.error('❌ Error cancelling game:', error);
      throw error;
    }
  }

  /**
   * حذف بازی‌های قدیمی (بیش از 24 ساعت)
   */
  async cleanupOldGames(): Promise<void> {
    try {
      await pool.query(
        `UPDATE game_sessions 
         SET status = $1 
         WHERE status = $2 
         AND created_at < NOW() - INTERVAL '24 hours'`,
        [GameStatus.CANCELLED, GameStatus.IN_PROGRESS]
      );

      logger.info('✅ Old games cleaned up');
    } catch (error) {
      logger.error('❌ Error cleaning up old games:', error);
    }
  }

  /**
   * دریافت آمار بازی‌های کاربر
   */
  async getUserGameStats(userId: number) {
    try {
      const result = await pool.query(
        `SELECT 
          COUNT(*) as total_games,
          COUNT(CASE WHEN winner_id = $1 THEN 1 END) as wins,
          COUNT(CASE WHEN winner_id IS NULL AND status = $2 THEN 1 END) as draws,
          COUNT(CASE WHEN winner_id != $1 AND winner_id IS NOT NULL THEN 1 END) as losses
         FROM game_sessions 
         WHERE (player1_id = $1 OR player2_id = $1) 
         AND status = $2`,
        [userId, GameStatus.COMPLETED]
      );

      return result.rows[0];
    } catch (error) {
      logger.error('❌ Error getting user game stats:', error);
      throw error;
    }
  }
}

export const gameService = new GameService();
