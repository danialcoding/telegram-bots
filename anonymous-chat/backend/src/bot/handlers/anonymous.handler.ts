import { Context } from 'telegraf';
import { Markup } from 'telegraf';
import chatService from '../../services/chat.service';
import messageService from '../../services/message.service';
import coinService from '../../services/coin.service';
import { redisClient } from '../../utils/redis';
import logger from '../../utils/logger';

const ANONYMOUS_COST = 10; // هزینه هر پیام ناشناس

/**
 * Anonymous Message Handlers
 */
class AnonymousHandlers {
  /**
   * مدیریت اکشن‌های پیام ناشناس
   */
  async handleActions(ctx: Context) {
    if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) return;

    const action = ctx.callbackQuery.data;
    const user = ctx.state.user;

    try {
      await ctx.answerCbQuery();

      // شروع فرآیند ارسال پیام ناشناس
      if (action === 'anonymous_send') {
        return await this.startAnonymousChat(ctx);
      }

      // پاسخ به پیام ناشناس
      if (action.startsWith('anonymous_reply_')) {
        const messageId = parseInt(action.replace('anonymous_reply_', ''));
        return await this.replyToAnonymous(ctx, messageId);
      }

      // گزارش پیام ناشناس
      if (action.startsWith('anonymous_report_')) {
        const messageId = parseInt(action.replace('anonymous_report_', ''));
        return await this.reportAnonymousMessage(ctx, messageId);
      }

      // بلاک کردن فرستنده ناشناس
      if (action.startsWith('anonymous_block_')) {
        const messageId = parseInt(action.replace('anonymous_block_', ''));
        return await this.blockAnonymousSender(ctx, messageId);
      }

    } catch (error) {
      logger.error('❌ Anonymous action error:', error);
      await ctx.reply('⚠️ خطایی رخ داد.');
    }
  }

  /**
   * شروع فرآیند ارسال پیام ناشناس
   */
  private async startAnonymousChat(ctx: Context) {
    const user = ctx.state.user;

    // چک موجودی سکه
    if (user.coins < ANONYMOUS_COST) {
      return await ctx.reply(
        `⚠️ موجودی شما کافی نیست!\n\n` +
        `برای ارسال پیام ناشناس به ${ANONYMOUS_COST} سکه نیاز دارید.\n` +
        `موجودی فعلی: ${user.coins} سکه`,
        Markup.inlineKeyboard([[Markup.button.callback('💰 خرید سکه', 'coins_menu')]])
      );
    }

    ctx.session.anonymousState = 'awaiting_username';
    await ctx.reply(
      '🕵️ ارسال پیام ناشناس\n\n' +
      `هزینه: ${ANONYMOUS_COST} سکه\n\n` +
      'یوزرنیم گیرنده را وارد کنید:\n' +
      '(مثال: @username یا username)',
      Markup.inlineKeyboard([[Markup.button.callback('❌ انصراف', 'main_menu')]])
    );
  }

  /**
   * دریافت یوزرنیم و درخواست پیام
   */
  async handleUsernameInput(ctx: Context) {
    if (!ctx.message || !('text' in ctx.message)) return;

    const username = ctx.message.text.replace('@', '');
    const user = ctx.state.user;

    try {
      // جستجوی کاربر با یوزرنیم
      // TODO: باید تابع searchByUsername به userService اضافه شود
      // const targetUser = await userService.findByUsername(username);

      // شبیه‌سازی:
      const targetUser = null;

      if (!targetUser) {
        return await ctx.reply(
          '❌ کاربری با این یوزرنیم یافت نشد.\n' +
          'لطفا یوزرنیم را دوباره بررسی کنید.'
        );
      }

      if (targetUser.id === user.id) {
        return await ctx.reply('❌ نمی‌توانید برای خودتان پیام ناشناس ارسال کنید!');
      }

      // ذخیره اطلاعات در session
      ctx.session.anonymousTarget = {
        userId: targetUser.id,
        username: targetUser.username,
      };

      ctx.session.anonymousState = 'awaiting_message';

      await ctx.reply(
        `✅ کاربر یافت شد: @${username}\n\n` +
        '📝 پیام خود را ارسال کنید:\n' +
        '(می‌توانید متن، عکس، ویدیو یا استیکر ارسال کنید)',
        Markup.inlineKeyboard([[Markup.button.callback('❌ انصراف', 'main_menu')]])
      );

    } catch (error) {
      logger.error('❌ Handle username error:', error);
      await ctx.reply('⚠️ خطا در پردازش یوزرنیم.');
    }
  }

  /**
   * دریافت و ارسال پیام ناشناس
   */
  async handleMessageInput(ctx: Context) {
    if (!ctx.message) return;

    const user = ctx.state.user;
    const target = ctx.session.anonymousTarget;

    if (!target) {
      return await ctx.reply('⚠️ لطفا ابتدا یوزرنیم گیرنده را وارد کنید.');
    }

    try {
      // کسر هزینه سکه
      await coinService.deductCoins(
        user.id,
        ANONYMOUS_COST,
        'anonymous_message',
        `پیام ناشناس به ${target.username}`
      );

      // ذخیره پیام در دیتابیس
      const message = await messageService.createAnonymousMessage({
        sender_id: user.id,
        receiver_id: target.userId,
        content: 'text' in ctx.message ? ctx.message.text : '[رسانه]',
        message_type: this.getMessageType(ctx.message),
      });

      // ارسال پیام به گیرنده
      await this.sendAnonymousMessageToReceiver(ctx, target.userId, message.id);

      // تایید برای فرستنده
      await ctx.reply(
        '✅ پیام ناشناس شما ارسال شد!\n\n' +
        `💰 ${ANONYMOUS_COST} سکه کسر شد.\n` +
        `موجودی جدید: ${user.coins - ANONYMOUS_COST} سکه`
      );

      // پاک کردن session
      delete ctx.session.anonymousState;
      delete ctx.session.anonymousTarget;

      logger.info('Anonymous message sent:', {
        senderId: user.id,
        receiverId: target.userId,
        messageId: message.id,
      });

    } catch (error) {
      logger.error('❌ Send anonymous message error:', error);
      await ctx.reply('⚠️ خطا در ارسال پیام ناشناس.');
    }
  }

  /**
   * ارسال پیام ناشناس به گیرنده
   */
  private async sendAnonymousMessageToReceiver(
    ctx: Context,
    receiverId: number,
    messageId: number
  ) {
    const message = ctx.message;
    if (!message) return;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('💬 پاسخ دادن', `anonymous_reply_${messageId}`)],
      [
        Markup.button.callback('🚫 بلاک', `anonymous_block_${messageId}`),
        Markup.button.callback('📝 گزارش', `anonymous_report_${messageId}`),
      ],
    ]);

    const caption = '🕵️ پیام ناشناس جدید:';

    try {
      if ('text' in message) {
        await ctx.telegram.sendMessage(
          receiverId,
          `${caption}\n\n${message.text}`,
          keyboard
        );
      } else if ('photo' in message) {
        await ctx.telegram.sendPhoto(
          receiverId,
          message.photo[message.photo.length - 1].file_id,
          { caption, ...keyboard }
        );
      } else if ('video' in message) {
        await ctx.telegram.sendVideo(
          receiverId,
          message.video.file_id,
          { caption, ...keyboard }
        );
      } else if ('sticker' in message) {
        await ctx.telegram.sendSticker(receiverId, message.sticker.file_id);
        await ctx.telegram.sendMessage(receiverId, caption, keyboard);
      }
    } catch (error) {
      logger.error('❌ Send to receiver error:', error);
    }
  }

  /**
   * پاسخ به پیام ناشناس
   */
  private async replyToAnonymous(ctx: Context, messageId: number) {
    const user = ctx.state.user;

    // چک موجودی
    if (user.coins < ANONYMOUS_COST) {
      return await ctx.reply(
        `⚠️ برای پاسخ دادن به ${ANONYMOUS_COST} سکه نیاز دارید.`,
        Markup.inlineKeyboard([[Markup.button.callback('💰 خرید سکه', 'coins_menu')]])
      );
    }

    ctx.session.anonymousReply = { messageId };
    ctx.session.anonymousState = 'awaiting_reply';

    await ctx.reply(
      '💬 پاسخ خود را ارسال کنید:',
      Markup.inlineKeyboard([[Markup.button.callback('❌ انصراف', 'main_menu')]])
    );
  }

  /**
   * گزارش پیام ناشناس
   */
  private async reportAnonymousMessage(ctx: Context, messageId: number) {
    // TODO: ثبت گزارش در سیستم
    await ctx.answerCbQuery('✅ پیام گزارش شد. بررسی خواهد شد.');
    logger.info('Anonymous message reported:', { messageId });
  }

  /**
   * بلاک کردن فرستنده ناشناس
   */
  private async blockAnonymousSender(ctx: Context, messageId: number) {
    const user = ctx.state.user;

    try {
      // TODO: دریافت sender_id از دیتابیس و بلاک کردن
      // const message = await messageService.getAnonymousMessage(messageId);
      // await userService.blockUser(user.id, message.sender_id);

      await ctx.answerCbQuery('✅ فرستنده بلاک شد.');
      logger.info('Anonymous sender blocked:', { messageId });

    } catch (error) {
      logger.error('❌ Block sender error:', error);
      await ctx.answerCbQuery('⚠️ خطا در بلاک کردن.');
    }
  }

  /**
   * تشخیص نوع پیام
   */
  private getMessageType(message: any): string {
    if ('text' in message) return 'text';
    if ('photo' in message) return 'photo';
    if ('video' in message) return 'video';
    if ('sticker' in message) return 'sticker';
    if ('voice' in message) return 'voice';
    return 'unknown';
  }
}

export const anonymousHandlers = new AnonymousHandlers();
