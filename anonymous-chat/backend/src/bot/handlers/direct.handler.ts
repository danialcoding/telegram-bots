import { Context } from 'telegraf';
import { Markup } from 'telegraf';
import chatService from '../../services/chat.service';
import coinService from '../../services/coin.service';
import userService from '../../services/user.service';
import logger from '../../utils/logger';

const DIRECT_CHAT_COST = 5; // هزینه چت مستقیم

/**
 * Direct Chat Handlers
 */
class DirectHandlers {
  /**
   * شروع چت مستقیم با کاربر
   */
  async initiateChat(ctx: Context, targetUserId: number) {
    const user = ctx.state.user;

    try {
      // بررسی موجودی سکه
      if (user.coins < DIRECT_CHAT_COST) {
        return await ctx.reply(
          `⚠️ موجودی کافی نیست!\n\n` +
          `برای چت مستقیم به ${DIRECT_CHAT_COST} سکه نیاز دارید.\n` +
          `موجودی فعلی: ${user.coins} سکه`,
          Markup.inlineKeyboard([[Markup.button.callback('💰 خرید سکه', 'coins_menu')]])
        );
      }

      // بررسی امکان چت
      const canChat = await chatService.canUsersChat(user.id, targetUserId);
      if (!canChat) {
        return await ctx.reply('❌ امکان چت با این کاربر وجود ندارد.');
      }

      // کسر هزینه
      await coinService.deductCoins(
        user.id,
        DIRECT_CHAT_COST,
        'direct_chat',
        'شروع چت مستقیم'
      );

      // ایجاد چت
      const chat = await chatService.createDirectChat(user.id, targetUserId);

      // ذخیره در session
      ctx.session.activeChat = {
        chatId: chat.id,
        partnerId: targetUserId,
        type: 'direct',
      };

      // اطلاع به طرف مقابل
      const targetUser = await userService.findById(targetUserId);
      await ctx.telegram.sendMessage(
        targetUserId,
        `💬 ${user.first_name} می‌خواهد با شما چت کند!`,
        Markup.inlineKeyboard([
          [
            Markup.button.callback('✅ قبول', `direct_accept_${chat.id}`),
            Markup.button.callback('❌ رد', `direct_reject_${chat.id}`),
          ],
        ])
      );

      await ctx.reply(
        `✅ درخواست چت به ${targetUser?.first_name} ارسال شد.\n\n` +
        'منتظر پاسخ باشید...'
      );

      logger.info('Direct chat initiated:', {
        userId: user.id,
        targetUserId,
        chatId: chat.id,
      });

    } catch (error) {
      logger.error('❌ Initiate direct chat error:', error);
      await ctx.reply('⚠️ خطا در شروع چت مستقیم.');
    }
  }

  /**
   * مدیریت قبول/رد چت مستقیم
   */
  async handleChatResponse(ctx: Context) {
    if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) return;

    const action = ctx.callbackQuery.data;
    const user = ctx.state.user;

    try {
      await ctx.answerCbQuery();

      if (action.startsWith('direct_accept_')) {
        const chatId = parseInt(action.replace('direct_accept_', ''));
        return await this.acceptDirectChat(ctx, chatId);
      }

      if (action.startsWith('direct_reject_')) {
        const chatId = parseInt(action.replace('direct_reject_', ''));
        return await this.rejectDirectChat(ctx, chatId);
      }

    } catch (error) {
      logger.error('❌ Direct chat response error:', error);
      await ctx.reply('⚠️ خطایی رخ داد.');
    }
  }

  /**
   * قبول درخواست چت
   */
  private async acceptDirectChat(ctx: Context, chatId: number) {
    const user = ctx.state.user;

    try {
      const chat = await chatService.findById(chatId);
      if (!chat) return;

      // به‌روزرسانی وضعیت چت
      await chatService.acceptDirectChat(chatId);

      // ذخیره در session
      ctx.session.activeChat = {
        chatId: chat.id,
        partnerId: chat.user1_id === user.id ? chat.user2_id : chat.user1_id,
        type: 'direct',
      };

      // اطلاع به فرستنده درخواست
      const requesterId = chat.user1_id === user.id ? chat.user2_id : chat.user1_id;
      await ctx.telegram.sendMessage(
        requesterId,
        `✅ ${user.first_name} درخواست چت شما را قبول کرد!\n\n` +
        'می‌توانید شروع به گفتگو کنید.'
      );

      await ctx.editMessageText(
        `✅ چت با ${chat.user1_id === user.id ? 'کاربر' : 'کاربر'} شروع شد!\n\n` +
        'پیام خود را ارسال کنید:'
      );

      logger.info('Direct chat accepted:', { chatId, userId: user.id });

    } catch (error) {
      logger.error('❌ Accept direct chat error:', error);
      await ctx.reply('⚠️ خطا در قبول چت.');
    }
  }

  /**
   * رد درخواست چت
   */
  private async rejectDirectChat(ctx: Context, chatId: number) {
    const user = ctx.state.user;

    try {
      const chat = await chatService.findById(chatId);
      if (!chat) return;

      // حذف چت
      await chatService.endChat(chatId, user.id);

      // اطلاع به فرستنده درخواست
      const requesterId = chat.user1_id === user.id ? chat.user2_id : chat.user1_id;
      await ctx.telegram.sendMessage(
        requesterId,
        '❌ کاربر درخواست چت شما را رد کرد.'
      );

      await ctx.editMessageText('❌ درخواست چت رد شد.');

      logger.info('Direct chat rejected:', { chatId, userId: user.id });

    } catch (error) {
      logger.error('❌ Reject direct chat error:', error);
      await ctx.reply('⚠️ خطا در رد چت.');
    }
  }
}

export const directHandlers = new DirectHandlers();
