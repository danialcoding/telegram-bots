import { Response } from 'express';
import { userService } from '../../services/user.service';
import { AuthRequest } from '../middlewares/auth';
import { ValidationError } from '../../utils/errors';

export class UserController {
  /**
   * دریافت اطلاعات کاربر
   */
  static async getUserInfo(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        throw new ValidationError('کاربر شناخته نشد');
      }

      const user = await userService.getUserById(req.userId);

      res.json({
        success: true,
        data: { user },
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * بلاک کردن کاربر
   */
  static async blockUser(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        throw new ValidationError('کاربر شناخته نشد');
      }

      const { blockUserId } = req.body;

      await userService.blockUser(req.userId, blockUserId);

      res.json({
        success: true,
        message: 'کاربر با موفقیت بلاک شد',
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * آنبلاک کردن کاربر
   */
  static async unblockUser(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        throw new ValidationError('کاربر شناخته نشد');
      }

      const { blockUserId } = req.body;

      await userService.unblockUser(req.userId, blockUserId);

      res.json({
        success: true,
        message: 'کاربر با موفقیت آنبلاک شد',
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * دریافت لیست بلاک شده‌ها
   */
  static async getBlockedUsers(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        throw new ValidationError('کاربر شناخته نشد');
      }

      const blocked = await userService.getBlockedUsers(req.userId);

      res.json({
        success: true,
        data: { blocked },
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * دریافت آمار کاربر
   */
  static async getUserStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        throw new ValidationError('کاربر شناخته نشد');
      }

      const stats = await userService.getUserStats(req.userId);

      res.json({
        success: true,
        data: { stats },
      });
    } catch (error) {
      throw error;
    }
  }
}
