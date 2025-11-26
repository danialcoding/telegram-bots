import { Context } from 'telegraf';
import { Markup } from 'telegraf';
import chatService from '../../services/chat.service';
import queueService from '../../services/queue.service';
import { chatTypeKeyboard, activeChatKeyboard, reportKeyboard } from '../keyboards/keyboards';
import logger from '../../utils/logger';

/**
 * Chat Handlers
 */
class ChatHandlers {
  /**
   * مدیریت اکشن‌های چت
   */
  async handleActions(ctx: Context) {
    if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) return;

    const action = ctx.callbackQuery.data;
    const user = ctx.state.user;

    try {
      await ctx.answerCbQuery();

      // انتخاب نوع چت
      if (action === 'chat_start') {
        return await this.showChatTypes(ctx);
      }

      // چت تصادفی
      if (action === 'chat_random') {
        return await this.joinRandomChat(ctx);
      }

      // چت جنسیتی
      if (action === 'chat_male' || action === 'chat_female') {
        const targetGender = action.replace('chat_', '') as 'male' | 'female';
        return await this.joinGenderChat(ctx, targetGender);
      }

      // پایان چت
      if (action === 'chat_end') {
        return await this.endChat(ctx);
      }

      // چت بعدی
      if (action === 'chat_next') {
        await this.endChat(ctx);
        return await this.showChatTypes(ctx);
      }

      // گزارش کاربر
      if (action.startsWith('report_')) {
        return await this.handleReport(ctx, action);
      }

    } catch (error) {
      logger.error('❌ Chat action error:', error);
      await ctx.reply('⚠️ خطایی رخ داد.');
    }
  }

  /**
   * نمایش انواع چت
   */
  private async showChatTypes(ctx: Context) {
    const user = ctx.state.user;

    if (!user.has_profile) {
      return await ctx.reply(
        '❌ ابتدا باید پروفایل خود را تکمیل کنید.\n' +
        'روی "👤 پروفایل من" کلیک کنید.'
      );
    }

    await ctx.reply(
      '💬 نوع چت را انتخاب کنید:\n\n' +
      '🎲 چت تصادفی: رایگان\n' +
      '👨 با پسران: 1 سکه (پسر) / 2 سکه (دختر)\n' +
      '👩 با دختران: 1 سکه (دختر) / 2 سکه (پسر)',
      chatTypeKeyboard()
    );
  }

  /**
   * ورود به چت تصادفی
   */
  private async joinRandomChat(ctx: Context) {
    const user = ctx.state.user;

    await ctx.editMessageText('🔍 در حال جستجوی فرد مناسب...');

    try {
      const result = await queueService.joinRandomQueue(user.id);

      if (result.matched) {
        // پیدا شد!
        const partner = result.partnerId;
        
        await ctx.reply(
          '✅ یک نفر پیدا شد!\n' +
          'شروع چت کنید... 💬',
          activeChatKeyboard()
        );

        // اطلاع به طرف مقابل
        await ctx.telegram.sendMessage(
          partner,
          '✅ یک نفر پیدا شد!\nشروع چت کنید... 💬',
          activeChatKeyboard()
        );

      } else {
        await ctx.reply(
          '⏳ در صف انتظار قرار گرفتید.\n' +
          'به محض پیدا شدن کسی به شما اطلاع می‌دهیم.',
          Markup.inlineKeyboard([
            [Markup.button.callback('❌ لغو', 'queue_cancel')],
          ])
        );
      }

    } catch (error: any) {
      logger.error('❌ Join random error:', error);
      await ctx.reply(`⚠️ ${error.message || 'خطا در ورود به چت'}`);
    }
  }

  /**
   * ورود به چت جنسیتی
   */
  private async joinGenderChat(ctx: Context, targetGender: 'male' | 'female') {
    const user = ctx.state.user;

    await ctx.editMessageText('🔍 در حال جستجوی فرد مناسب...');

    try {
      const result = await queueService.joinGenderQueue(user.id, targetGender);

      if (result.matched) {
        const partner = result.partnerId;
        
        await ctx.reply(
          `✅ یک ${targetGender === 'male' ? 'پسر' : 'دختر'} پیدا شد!\n` +
          `💰 ${result.cost} سکه کسر شد.\n` +
          'شروع چت کنید... 💬',
          activeChatKeyboard()
        );

        await ctx.telegram.sendMessage(
          partner,
          `✅ یک ${user.gender === 'male' ? 'پسر' : 'دختر'} پیدا شد!\n` +
          `💰 ${result.partnerCost} سکه کسر شد.\n` +
          'شروع چت کنید... 💬',
          activeChatKeyboard()
        );

      } else {
        await ctx.reply(
          `⏳ در صف ${targetGender === 'male' ? 'پسران' : 'دختران'} قرار گرفتید.\n` +
          `💰 ${result.cost} سکه کسر شد.\n` +
          'به محض پیدا شدن کسی اطلاع می‌دهیم.',
          Markup.inlineKeyboard([
            [Markup.button.callback('❌ لغو', 'queue_cancel')],
          ])
        );
      }

    } catch (error: any) {
      logger.error('❌ Join gender chat error:', error);
      await ctx.reply(`⚠️ ${error.message || 'خطا در ورود به چت'}`);
    }
  }

  /**
   * مدیریت پیام‌های چت
   */
  async handleMessage(ctx: Context) {
    const user = ctx.state.user;
    const text = 'text' in ctx.message ? ctx.message.text : '';

    // اگر در حال چت نباشد
    const activeChat = await chatService.getActiveChat(user.id);
    if (!activeChat) {
      return; // پیام عادی - توسط هندلرهای دیگر پردازش می‌شود
    }

    try {
      // ارسال پیام به طرف مقابل
      const partnerId = activeChat.user1_id === user.id 
        ? activeChat.user2_id 
        : activeChat.user1_id;

      await chatService.saveMessage({
        chat_id: activeChat.id,
        sender_id: user.id,
        receiver_id: partnerId,
        message_type: 'text',
        content: text,
      });

      // ارسال به طرف مقابل
      await ctx.telegram.sendMessage(partnerId, text);

      logger.debug('Message sent in chat:', {
        chatId: activeChat.id,
        from: user.id,
        to: partnerId,
      });

    } catch (error) {
      logger.error('❌ Message send error:', error);
      await ctx.reply('⚠️ خطا در ارسال پیام.');
    }
  }

  /**
   * پایان چت
   */
  private async endChat(ctx: Context) {
    const user = ctx.state.user;

    try {
      const activeChat = await chatService.getActiveChat(user.id);
      
      if (!activeChat) {
        return await ctx.reply('❌ شما در حال حاضر در چت نیستید.');
      }

      const partnerId = activeChat.user1_id === user.id 
        ? activeChat.user2_id 
        : activeChat.user1_id;

      await chatService.endChat(activeChat.id);

      await ctx.reply(
        '👋 چت به پایان رسید.\n' +
        'آیا می‌خواهید این کاربر را گزارش دهید؟',
        reportKeyboard(partnerId)
      );

      await ctx.telegram.sendMessage(
        partnerId,
        '👋 طرف مقابل چت را پایان داد.'
      );

    } catch (error) {
      logger.error('❌ End chat error:', error);
      await ctx.reply('⚠️ خطا در پایان چت.');
    }
  }

  /**
   * مدیریت گزارش کاربر
   */
  private async handleReport(ctx: Context, action: string) {
    // پیاده‌سازی در قسمت report.handler
    await ctx.answerCbQuery('در حال ثبت گزارش...');
  }

  /**
   * مدیریت صف انتظار
   */
  async handleQueue(ctx: Context) {
    if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) return;

    const action = ctx.callbackQuery.data;

    if (action === 'queue_cancel') {
      const user = ctx.state.user;
      
      await queueService.removeFromAllQueues(user.id);
      await ctx.editMessageText('❌ از صف انتظار خارج شدید.');
    }
  }
}

export const chatHandlers = new ChatHandlers();
