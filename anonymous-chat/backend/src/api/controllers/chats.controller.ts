import { Response } from 'express';
import { chatService } from '../../services/chat.service';
import { queueService } from '../../services/queue.service';
import { AuthRequest } from '../middlewares/auth';
import { ValidationError, NotFoundError } from '../../utils/errors';

export class ChatController {
  /**
   * شروع چت تصادفی
   */
  static async startRandomChat(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        throw new ValidationError('کاربر شناخته نشد');
      }

      const chat = await queueService.joinRandomQueue(req.userId);

      res.status(201).json({
        success: true,
        data: { chat },
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * شروع چت جنسیتی
   */
  static async startGenderChat(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        throw new ValidationError('کاربر شناخته نشد');
      }

      const { targetGender } = req.body;

      const chat = await queueService.joinGenderQueue(
        req.userId,
        targetGender
      );

      res.status(201).json({
        success: true,
        data: { chat },
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * پایان چت
   */
  static async endChat(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        throw new ValidationError('کاربر شناخته نشد');
      }

      const { chatId } = req.params;

      await chatService.endChat(parseInt(chatId), req.userId);

      res.json({
        success: true,
        message: 'چت به پایان رسید',
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * دریافت پیام‌های چت
   */
  static async getMessages(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { chatId } = req.params;
      const { limit = 50, offset = 0 } = req.query;

      const messages = await chatService.getMessages(
        parseInt(chatId),
        parseInt(limit as string),
        parseInt(offset as string)
      );

      res.json({
        success: true,
        data: { messages },
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * دریافت چت‌های فعال
   */
  static async getActiveChats(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        throw new ValidationError('کاربر شناخته نشد');
      }

      const chats = await chatService.getUserChats(req.userId);

      res.json({
        success: true,
        data: { chats },
      });
    } catch (error) {
      throw error;
    }
  }
}
