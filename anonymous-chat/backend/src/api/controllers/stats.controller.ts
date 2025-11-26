import { Response } from 'express';
import { statsService } from '../../services/stats.service';
import { AuthRequest } from '../middlewares/auth';

export class StatsController {
  /**
   * دریافت آمار کلی سیستم
   */
  static async getSystemStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      const stats = await statsService.getSystemStats();

      res.json({
        success: true,
        data: { stats },
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * دریافت آمار روزانه
   */
  static async getDailyStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { date } = req.query;

      const stats = await statsService.getDailyStats(date as string);

      res.json({
        success: true,
        data: { stats },
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * دریافت آمار هفتگی
   */
  static async getWeeklyStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      const stats = await statsService.getWeeklyStats();

      res.json({
        success: true,
        data: { stats },
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * دریافت آمار ماهانه
   */
  static async getMonthlyStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { month, year } = req.query;

      const stats = await statsService.getMonthlyStats(
        month as string,
        year as string
      );

      res.json({
        success: true,
        data: { stats },
      });
    } catch (error) {
      throw error;
    }
  }
}
