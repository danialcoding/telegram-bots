import { Router } from 'express';
import { param, query } from 'express-validator';
import { authMiddleware, adminMiddleware } from '../middlewares/auth.middleware';
import { asyncHandler } from '../middlewares/error.middleware';
import { validate } from '../middlewares/validator.middleware';
import chatService from '../../services/chat.service';

const router = Router();

// اعمال middleware احراز هویت
router.use(authMiddleware);
router.use(adminMiddleware);

/**
 * لیست چت‌های فعال
 * GET /api/chats/active
 */
router.get(
  '/active',
  validate([
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 }),
  ]),
  asyncHandler(async (req, res) => {
    const { limit = 20, offset = 0 } = req.query;

    const chats = await chatService.getActiveChats(
      Number(limit),
      Number(offset)
    );

    const total = await chatService.getActiveChatsCount();

    res.json({
      success: true,
      data: {
        chats,
        pagination: {
          total,
          limit: Number(limit),
          offset: Number(offset),
        },
      },
    });
  })
);

/**
 * تاریخچه تمام چت‌ها
 * GET /api/chats
 */
router.get(
  '/',
  validate([
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('status').optional().isIn(['active', 'ended']),
    query('type').optional().isIn(['random', 'gendered', 'direct']),
  ]),
  asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = 20,
      status,
      type,
    } = req.query;

    const offset = (Number(page) - 1) * Number(limit);

    const chats = await chatService.getChats({
      limit: Number(limit),
      offset,
      status: status as string,
      type: type as string,
    });

    const total = await chatService.getChatsCount({
      status: status as string,
      type: type as string,
    });

    res.json({
      success: true,
      data: {
        chats,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
      },
    });
  })
);

/**
 * جزئیات چت
 * GET /api/chats/:id
 */
router.get(
  '/:id',
  validate([param('id').isInt()]),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const chat = await chatService.getChatById(Number(id));

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'چت یافت نشد',
      });
    }

    const messages = await chatService.getChatMessages(Number(id));

    res.json({
      success: true,
      data: {
        chat,
        messages,
      },
    });
  })
);

/**
 * پیام‌های چت
 * GET /api/chats/:id/messages
 */
router.get(
  '/:id/messages',
  validate([
    param('id').isInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('before').optional().isInt(),
  ]),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { limit = 50, before } = req.query;

    const messages = await chatService.getChatMessages(
      Number(id),
      Number(limit),
      before ? Number(before) : undefined
    );

    res.json({
      success: true,
      data: messages,
    });
  })
);

/**
 * آمار چت‌ها
 * GET /api/chats/stats/overview
 */
router.get(
  '/stats/overview',
  asyncHandler(async (req, res) => {
    const stats = await chatService.getChatStats();

    res.json({
      success: true,
      data: stats,
    });
  })
);

/**
 * پایان دادن به چت (توسط ادمین)
 * POST /api/chats/:id/end
 */
router.post(
  '/:id/end',
  validate([param('id').isInt()]),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    await chatService.endChatByAdmin(Number(id));

    res.json({
      success: true,
      message: 'چت با موفقیت پایان یافت',
    });
  })
);

export default router;
