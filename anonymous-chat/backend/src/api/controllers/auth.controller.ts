import { Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../config';
import { userService } from '../../services/user.service';
import { AuthRequest } from '../middlewares/auth';
import { ValidationError, NotFoundError } from '../../utils/errors';

export class AuthController {
  /**
   * ثبت‌نام کاربر جدید
   */
  static async register(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { telegramId, username, firstName, gender, age } = req.body;

      const existingUser = await userService.getUserByTelegramId(telegramId);
      if (existingUser) {
        throw new ValidationError('این کاربر قبلاً ثبت‌نام کرده است');
      }

      const user = await userService.createUser({
        telegramId,
        username,
        firstName,
        gender,
        age,
      });

      const token = jwt.sign(
        { userId: user.id, role: 'user' },
        config.jwt.secret,
        { expiresIn: config.jwt.expiresIn }
      );

      res.status(201).json({
        success: true,
        data: {
          user,
          token,
        },
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * ورود کاربر
   */
  static async login(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { telegramId } = req.body;

      const user = await userService.getUserByTelegramId(telegramId);
      if (!user) {
        throw new NotFoundError('کاربری با این اطلاعات یافت نشد');
      }

      const token = jwt.sign(
        { userId: user.id, role: 'user' },
        config.jwt.secret,
        { expiresIn: config.jwt.expiresIn }
      );

      res.json({
        success: true,
        data: {
          user,
          token,
        },
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * دریافت پروفایل کاربر
   */
  static async getProfile(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        throw new ValidationError('کاربر شناخته نشد');
      }

      const user = await userService.getUserById(req.userId);
      if (!user) {
        throw new NotFoundError('کاربری یافت نشد');
      }

      res.json({
        success: true,
        data: { user },
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * به‌روزرسانی پروفایل
   */
  static async updateProfile(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        throw new ValidationError('کاربر شناخته نشد');
      }

      const { username, gender, age, bio } = req.body;

      const user = await userService.updateUser(req.userId, {
        username,
        gender,
        age,
        bio,
      });

      res.json({
        success: true,
        data: { user },
      });
    } catch (error) {
      throw error;
    }
  }
}
