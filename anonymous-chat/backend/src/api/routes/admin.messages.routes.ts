// src/api/routes/admin.messages.routes.ts
import { Router } from 'express';
import { AdminMessagesController } from '../controllers/admin.messages.controller';

const router = Router();

/**
 * @route   GET /api/admin/messages/deleted
 * @desc    دریافت تمام پیام‌های پاک شده
 * @access  Admin
 * @query   page, limit, chatId
 */
router.get('/deleted', AdminMessagesController.getDeletedMessages);

/**
 * @route   GET /api/admin/messages/deleted/stats
 * @desc    دریافت آمار پیام‌های پاک شده
 * @access  Admin
 */
router.get('/deleted/stats', AdminMessagesController.getDeletedMessagesStats);

/**
 * @route   GET /api/admin/messages/chat/:chatId
 * @desc    دریافت تمام پیام‌های یک چت (شامل پاک شده‌ها)
 * @access  Admin
 * @param   chatId - شناسه چت
 * @query   includeDeleted (true/false)
 */
router.get('/chat/:chatId', AdminMessagesController.getChatMessages);

/**
 * @route   GET /api/admin/messages/user/:userId
 * @desc    دریافت پیام‌های یک کاربر خاص
 * @access  Admin
 * @param   userId - شناسه کاربر
 * @query   includeDeleted (true/false), page, limit
 */
router.get('/user/:userId', AdminMessagesController.getUserMessages);

/**
 * @route   POST /api/admin/messages/restore/:messageId
 * @desc    بازگردانی پیام پاک شده
 * @access  Admin
 * @param   messageId - شناسه پیام
 * @body    userId - شناسه کاربری که می‌خواهیم برایش بازگردانی کنیم
 */
router.post('/restore/:messageId', AdminMessagesController.restoreDeletedMessage);

export default router;
