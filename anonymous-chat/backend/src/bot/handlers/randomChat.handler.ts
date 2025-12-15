import { Context, Markup, Telegraf } from 'telegraf';
import { MyContext } from '../types/bot.types';
import { userService } from '../../services/user.service';
import { profileService } from '../../services/profile.service';
import { addCoins, deductCoins } from '../../services/coin.service';
import { randomChatService } from '../../services/randomChat.service';
import { pool } from '../../database/db';
import logger from '../../utils/logger';
import { getProvinceById, getCityById } from '../../utils/locations';
import * as fs from 'fs';
import * as path from 'path';

/**
 * کیبورد چت فعال
 */
export const activeChatKeyboard = (safeModeEnabled: boolean) => Markup.keyboard([
  ['👁️ مشاهده پروفایل'],
  [safeModeEnabled ? '🔓 غیرفعال‌سازی حالت امن' : '🔒 فعال‌سازی حالت امن'],
  ['❌ اتمام چت'],
]).resize();

/**
 * کیبورد منوی اصلی
 */
const mainMenuKeyboard = () => Markup.keyboard([
  ['👤 پروفایل من', '💬 چت با ناشناس'],
  ['💰 سکه‌ها', '🎁 دعوت دوستان'],
  ['🔍 جستجوی کاربران', '⚙️ تنظیمات'],
]).resize();

/**
 * کیبورد مناسب بر اساس وضعیت چت کاربر
 */
const getAppropriateKeyboard = async (userId: number) => {
  try {
    const chat = await randomChatService.getUserActiveChat(userId);
    if (chat) {
      const safeModeEnabled = await randomChatService.isSafeModeEnabled(chat.id, userId);
      return activeChatKeyboard(safeModeEnabled);
    }
  } catch (error) {
    logger.error('Error getting chat status for keyboard:', error);
  }
  return mainMenuKeyboard();
};


/**
 * Random Chat Handlers - چت با ناشناس
 */
class RandomChatHandlers {
  private bot: Telegraf<MyContext> | null = null;

  /**
   * تنظیم bot instance
   */
  setBot(bot: Telegraf<MyContext>) {
    this.bot = bot;
  }

  /**
   * نمایش صفحه چت با ناشناس
   */
  async showRandomChatMenu(ctx: MyContext) {
    try {
      await ctx.reply(
        '💬 به کی وصلت کنم؟   انتخاب کن👇',
        Markup.inlineKeyboard([
          [Markup.button.callback('🎲 جستجوی شانسی', 'random_search_any')],
          [
            Markup.button.callback('🙍‍♂️ جستجوی پسر', 'random_search_male'),
            Markup.button.callback('🙍‍♀️ جستجوی دختر', 'random_search_female')
          ],
          [Markup.button.callback('🔙 بازگشت', 'main_menu')],
        ])
      );
    } catch (error) {
      logger.error('❌ Show random chat menu error:', error);
      await ctx.reply('⚠️ خطا در نمایش منوی چت', mainMenuKeyboard());
    }
  }

  /**
   * جستجوی شانسی (بدون فیلتر جنسیت)
   */
  async searchRandom(ctx: MyContext) {
    const user = ctx.state.user;

    try {
      await ctx.answerCbQuery();
      
      // بررسی چت فعال
      const activeChat = await randomChatService.getUserActiveChat(user.id);
      if (activeChat) {
        return await ctx.reply('⚠️ شما در حال حاضر یک چت فعال دارید!', mainMenuKeyboard());
      }

      // حذف پیام منو
      try {
        await ctx.deleteMessage();
      } catch (e) {
        // اگر حذف نشد، مهم نیست
      }

      // اضافه کردن به صف انتظار
      await randomChatService.addToQueue(user.id, 'any');
      
      // ارسال پیام در حال جستجو
      const searchMsg = await ctx.reply(
        '🔍 در صف انتظار قرار گرفتید...\n\n' +
        'منتظر بمانید تا کاربری دیگر نیز برای چت جستجو کند.',
        Markup.inlineKeyboard([
          [Markup.button.callback('❌ انصراف', 'cancel_search')],
        ])
      );

      // جستجو برای match در صف انتظار
      const match = await randomChatService.findMatchInQueue(user.id, user.gender, 'any');

      if (match) {
        // پیدا شدن match - ایجاد چت
        // showFoundUser خودش به هر دو کاربر پیام می‌فرستد
        await this.showFoundUser(ctx, match, searchMsg.message_id);
      } else {
        // عدم وجود match - باقی ماندن در صف
        logger.info(`✅ User ${user.id} added to queue, waiting for match`);
      }
    } catch (error) {
      logger.error('❌ Random search error:', error);
      await randomChatService.removeFromQueue(user.id);
      await ctx.reply('⚠️ خطا در جستجو', mainMenuKeyboard());
    }
  }

  /**
   * جستجوی با جنسیت خاص (پسر یا دختر)
   */
  async searchByGender(ctx: MyContext, gender: 'male' | 'female') {
    const user = ctx.state.user;
    const SEARCH_COST = 1; // هزینه جستجوی هدفمند

    try {
      await ctx.answerCbQuery();

      // بررسی چت فعال
      const activeChat = await randomChatService.getUserActiveChat(user.id);
      if (activeChat) {
        return await ctx.reply('⚠️ شما در حال حاضر یک چت فعال دارید!', mainMenuKeyboard());
      }

      // چک موجودی سکه
      if (user.coins < SEARCH_COST) {
        return await ctx.reply(
          `⚠️ موجودی شما کافی نیست!\n\n` +
          `برای جستجوی هدفمند به ${SEARCH_COST} سکه نیاز دارید.\n` +
          `موجودی فعلی: ${user.coins} سکه`,
          Markup.inlineKeyboard([
            [Markup.button.callback('💰 خرید سکه', 'buy_coins')],
            [Markup.button.callback('🔙 بازگشت به منو', 'random_chat_menu')],
          ])
        );
      }

      // حذف پیام منو
      try {
        await ctx.deleteMessage();
      } catch (e) {
        // اگر حذف نشد، مهم نیست
      }

      // اضافه کردن به صف انتظار
      await randomChatService.addToQueue(user.id, gender);
      
      // ارسال پیام در حال جستجو
      const genderText = gender === 'male' ? 'پسر' : 'دختر';
      const searchMsg = await ctx.reply(
        `🔍 در صف انتظار قرار گرفتید...\n\n` +
        `به دنبال: ${genderText}\n` +
        'منتظر بمانید تا کاربر مناسبی پیدا شود.',
        Markup.inlineKeyboard([
          [Markup.button.callback('❌ انصراف', 'cancel_search')],
        ])
      );

      // جستجو برای match در صف انتظار
      const match = await randomChatService.findMatchInQueue(user.id, user.gender, gender);

      if (match) {
        // پیدا شدن match - ایجاد چت
        // showFoundUser خودش به هر دو کاربر پیام می‌فرستد
        await this.showFoundUser(ctx, match, searchMsg.message_id);
      } else {
        // عدم وجود match - باقی ماندن در صف
        logger.info(`✅ User ${user.id} added to queue for ${gender}, waiting for match`);
      }
    } catch (error) {
      logger.error('❌ Search by gender error:', error);
      await randomChatService.removeFromQueue(user.id);
      await ctx.reply('⚠️ خطا در جستجو', mainMenuKeyboard());
    }
  }

  /**
   * اطلاع به کاربر منتظر در صف
   */
  private async notifyMatchFound(waitingUserId: number, newUser: any, waitingUserTelegramId: number) {
    if (!this.bot) return;

    try {
      const genderIcon = newUser.gender === 'male' ? '🙍‍♂️' : '🙍‍♀️';
      const age = newUser.age || '❓';
      const name = newUser.name || newUser.first_name || 'بدون نام';

      // بررسی چت فعال برای گرفتن حالت امن
      const chat = await randomChatService.getUserActiveChat(waitingUserId);
      const safeMode = chat ? await randomChatService.isSafeModeEnabled(chat.id, waitingUserId) : false;

      await this.bot.telegram.sendMessage(
        waitingUserTelegramId,
        `✅ کاربر پیدا شد!\n\n` +
        `${genderIcon} ${name}\n` +
        `🎂 سن: ${age}\n\n` +
        `💬 چت شروع شد! می‌توانید پیام‌های خود را ارسال کنید.`,
        activeChatKeyboard(safeMode)
      );

      logger.info(`✅ Notified user ${waitingUserId} about match`);
    } catch (error) {
      logger.error('❌ Error notifying waiting user:', error);
    }
  }

  /**
   * لغو جستجو و خروج از صف
   */
  async cancelSearch(ctx: MyContext) {
    const user = ctx.state.user;

    try {
      await ctx.answerCbQuery();
      
      // حذف از صف
      await randomChatService.removeFromQueue(user.id);
      
      await ctx.editMessageText(
        '❌ جستجو لغو شد.',
        Markup.inlineKeyboard([
          [Markup.button.callback('🔄 جستجوی مجدد', 'random_chat_menu')],
          [Markup.button.callback('🔙 منوی اصلی', 'main_menu')],
        ])
      );
    } catch (error) {
      logger.error('❌ Cancel search error:', error);
      await ctx.reply('⚠️ خطا در لغو جستجو', mainMenuKeyboard());
    }
  }

  /**
   * نمایش اطلاعات کاربر پیدا شده و شروع چت
   */
  private async showFoundUser(ctx: MyContext, foundUser: any, messageId: number) {
    const user = ctx.state.user;
    const genderIcon = foundUser.gender === 'male' ? '🙍‍♂️' : '🙍‍♀️';
    const age = foundUser.age || '❓';
    const name = foundUser.name || foundUser.first_name || 'بدون نام';

    try {
      // ایجاد چت
      const chat = await randomChatService.createChat(user.id, foundUser.id);

      // کسر سکه برای کاربری که جستجوی هدفمند کرده است
      const queueEntry = await pool.query(
        'SELECT search_type FROM random_chat_queue WHERE user_id = $1',
        [user.id]
      );
      
      if (queueEntry.rows[0] && queueEntry.rows[0].search_type !== 'any') {
        await deductCoins(user.id, 1, 'spend', 'جستجوی هدفمند');
      }

      // کسر سکه برای کاربر مقابل اگر جستجوی هدفمند کرده
      const partnerQueueEntry = await pool.query(
        'SELECT search_type FROM random_chat_queue WHERE user_id = $1',
        [foundUser.id]
      );
      
      if (partnerQueueEntry.rows[0] && partnerQueueEntry.rows[0].search_type !== 'any') {
        await deductCoins(foundUser.id, 1, 'spend', 'جستجوی هدفمند');
      }

      const userInfo = 
        `✅ کاربر پیدا شد!\n\n` +
        `${genderIcon} ${name}\n` +
        `🎂 سن: ${age}\n\n` +
        `💬 چت شروع شد! می‌توانید پیام‌های خود را ارسال کنید.`;

      // بررسی حالت امن کاربر
      const userSafeMode = await randomChatService.isSafeModeEnabled(chat.id, user.id);

      // حذف پیام جستجو و ارسال پیام جدید با کیبورد
      try {
        await ctx.telegram.deleteMessage(ctx.chat!.id, messageId);
      } catch (e) {
        // اگر حذف نشد، مهم نیست
      }
      
      await ctx.reply(userInfo, activeChatKeyboard(userSafeMode));

      // ارسال پیام به کاربر پیدا شده
      const partnerGenderIcon = ctx.state.user.gender === 'male' ? '🙍‍♂️' : '🙍‍♀️';
      const partnerAge = ctx.state.user.age || '❓';
      const partnerName = ctx.state.user.name || ctx.state.user.first_name || 'بدون نام';

      // بررسی حالت امن کاربر مقابل
      const partnerSafeMode = await randomChatService.isSafeModeEnabled(chat.id, foundUser.id);

      await ctx.telegram.sendMessage(
        foundUser.telegram_id,
        `✅ یک نفر شما را پیدا کرد!\n\n` +
        `${partnerGenderIcon} ${partnerName}\n` +
        `🎂 سن: ${partnerAge}\n\n` +
        `💬 چت شروع شد! می‌توانید پیام‌های خود را ارسال کنید.`,
        activeChatKeyboard(partnerSafeMode)
      );

      logger.info(`✅ Chat ${chat.id} started between ${user.id} and ${foundUser.id}`);
    } catch (error) {
      logger.error('❌ Error starting chat:', error);
      await ctx.reply('⚠️ خطا در شروع چت', mainMenuKeyboard());
    }
  }

  /**
   * مشاهده پروفایل کاربر مقابل (استفاده از showUserProfile)
   */
  async viewPartnerProfile(ctx: MyContext) {
    const user = ctx.state.user;

    try {
      const chat = await randomChatService.getUserActiveChat(user.id);

      if (!chat) {
        return await ctx.reply('⚠️ شما در چت فعالی نیستید.', mainMenuKeyboard());
      }

      const partnerId = randomChatService.getPartnerUserId(chat, user.id);
      
      // استفاده از تابع showUserProfile
      const { profileHandlers } = await import('./profile.handler');
      await profileHandlers.showUserProfile(ctx, partnerId);
      
      // اطلاع به کاربر مقابل
      const partnerData = await userService.findById(partnerId);
      if (partnerData) {
        await ctx.telegram.sendMessage(
          partnerData.telegram_id,
          `👁️ کاربر مقابل پروفایل شما را مشاهده کرد.`
        );
      }

    } catch (error) {
      logger.error('❌ Error viewing partner profile:', error);
      const keyboard = await getAppropriateKeyboard(user.id);
      await ctx.reply('⚠️ خطا در نمایش پروفایل', keyboard);
    }
  }

  /**
   * فعال/غیرفعال کردن حالت امن
   */
  async toggleSafeMode(ctx: MyContext) {
    const user = ctx.state.user;

    try {
      const chat = await randomChatService.getUserActiveChat(user.id);

      if (!chat) {
        return await ctx.reply('⚠️ شما در چت فعالی نیستید.', mainMenuKeyboard());
      }

      const currentSafeMode = await randomChatService.isSafeModeEnabled(chat.id, user.id);
      const newSafeMode = !currentSafeMode;

      // تغییر حالت امن برای هر دو کاربر
      await randomChatService.toggleSafeMode(chat.id, user.id, newSafeMode);
      await randomChatService.toggleSafeMode(chat.id, randomChatService.getPartnerUserId(chat, user.id), newSafeMode);

      const partnerId = randomChatService.getPartnerUserId(chat, user.id);
      const partnerData = await userService.findByIdWithProfile(partnerId);

      if (newSafeMode) {
        // فعال‌سازی حالت امن برای هر دو کاربر
        await ctx.reply(
          '🔒 حالت امن فعال شد.\n\n' +
          'هیچ‌یک از طرفین نمی‌توانند عکس و ویدیوها را ذخیره یا اسکرین‌شات بگیرند.',
          activeChatKeyboard(true)
        );

        await ctx.telegram.sendMessage(
          partnerData!.telegram_id,
          '🔒 کاربر مقابل حالت امن را فعال کرد.\n\n' +
          'هیچ‌یک از طرفین نمی‌توانند عکس و ویدیوها را ذخیره یا اسکرین‌شات بگیرند.',
          activeChatKeyboard(true)
        );
      } else {
        // غیرفعال‌سازی حالت امن برای هر دو کاربر
        await ctx.reply(
          '🔓 حالت امن غیرفعال شد.',
          activeChatKeyboard(false)
        );

        await ctx.telegram.sendMessage(
          partnerData!.telegram_id,
          '🔓 کاربر مقابل حالت امن را غیرفعال کرد.',
          activeChatKeyboard(false)
        );
      }
    } catch (error) {
      logger.error('❌ Error toggling safe mode:', error);
      const keyboard = await getAppropriateKeyboard(user.id);
      await ctx.reply('⚠️ خطا در تغییر حالت امن', keyboard);
    }
  }

  /**
   * درخواست تایید برای اتمام چت
   */
  async requestEndChat(ctx: MyContext) {
    await ctx.reply(
      '❓ آیا از اتمام چت مطمئن هستید؟',
      Markup.inlineKeyboard([
        [Markup.button.callback('✅ اتمام چت', 'confirm_end_chat')],
        [Markup.button.callback('🔙 ادامه چت', 'cancel_end_chat')],
      ])
    );
  }

  /**
   * تایید اتمام چت
   */
  async confirmEndChat(ctx: MyContext) {
    const user = ctx.state.user;

    try {
      await ctx.answerCbQuery();

      const chat = await randomChatService.getUserActiveChat(user.id);

      if (!chat) {
        await ctx.editMessageText('⚠️ شما در چت فعالی نیستید.');
        return await ctx.reply('🏠 منوی اصلی', mainMenuKeyboard());
      }

      // پایان چت
      await randomChatService.endChat(chat.id, user.id);

      // بررسی تعداد پیام‌ها برای بازگشت سکه
      const messages = await randomChatService.getChatMessages(chat.id);
      const totalMessages = messages.length;

      if (totalMessages < 30) {
        // چت ناموفق - بازگشت سکه
        
        // چک کنیم آیا کاربر فعلی پرداخت کرده (از transaction ها)
        const userTransaction = await pool.query(
          `SELECT * FROM coin_transactions 
           WHERE user_id = $1 
           AND type = 'spend' 
           AND description = 'جستجوی هدفمند'
           AND created_at >= (SELECT started_at FROM random_chats WHERE id = $2)
           LIMIT 1`,
          [user.id, chat.id]
        );

        if (userTransaction.rows.length > 0) {
          await addCoins(user.id, 1, 'earn', 'بازگشت سکه - چت ناموفق (کمتر از 30 پیام)');
        }
      }

      const partnerId = randomChatService.getPartnerUserId(chat, user.id);
      const partnerData = await userService.findByIdWithProfile(partnerId);

      // ✅ دریافت custom_id برای نمایش به جای نام
      const userProfile = await profileService.getProfile(user.id);
      const partnerProfile = await profileService.getProfile(partnerId);

      // بررسی بازگشت سکه برای کاربر مقابل (از همان متغیر messages استفاده می‌کنیم)
      let refundMessage = '';

      if (totalMessages < 30) {
        refundMessage = '\n\n💰 چت با کمتر از 30 پیام به پایان رسید. سکه شما بازگردانده شد.';
        
        // بررسی نوع جستجوی کاربر مقابل
        const partnerTransaction = await pool.query(
          `SELECT * FROM coin_transactions 
           WHERE user_id = $1 
           AND type = 'spend' 
           AND description = 'جستجوی هدفمند'
           AND created_at >= (SELECT started_at FROM random_chats WHERE id = $2)
           LIMIT 1`,
          [partnerId, chat.id]
        );

        if (partnerTransaction.rows.length > 0) {
          await addCoins(partnerId, 1, 'earn', 'بازگشت سکه - چت ناموفق (کمتر از 30 پیام)');
        }
      }

      // پیام به کاربر فعلی با ID کاربر مقابل
      await ctx.editMessageText(
        `❌ چت به پایان رسید.\n\n` +
        `شما چت با ${partnerProfile?.custom_id ? `/user_${partnerProfile.custom_id}` : 'کاربر'} را به پایان رساندید.${refundMessage}\n\n` +
        `🗑️ برای پاک کردن تمام پیام‌های این چت از دستور /delete_${chat.id} استفاده کنید.`,
        Markup.inlineKeyboard([
          [Markup.button.callback('🔙 بازگشت به منو', 'main_menu')],
        ])
      );

      // بازگشت به کیبورد اصلی
      await ctx.reply('🏠 منوی اصلی', mainMenuKeyboard());

      // پیام به کاربر مقابل با ID کلیک‌شدنی
      await ctx.telegram.sendMessage(
        partnerData!.telegram_id,
        `❌ چت به پایان رسید.\n\n` +
        `${userProfile?.custom_id ? `/user_${userProfile.custom_id}` : 'کاربر'} چت را تمام کرد.${refundMessage}\n\n` +
        `🗑️ برای پاک کردن تمام پیام‌های این چت از دستور /delete_${chat.id} استفاده کنید.`,
        Markup.inlineKeyboard([
          [Markup.button.callback('🔙 بازگشت به منو', 'main_menu')],
        ])
      );

      // بازگشت به کیبورد اصلی برای کاربر مقابل
      await ctx.telegram.sendMessage(
        partnerData!.telegram_id,
        '🏠 منوی اصلی',
        mainMenuKeyboard()
      );

      logger.info(`✅ Chat ${chat.id} ended by user ${user.id}`);
    } catch (error) {
      logger.error('❌ Error ending chat:', error);
      await ctx.reply('⚠️ خطا در اتمام چت', mainMenuKeyboard());
    }
  }

  /**
   * لغو اتمام چت
   */
  async cancelEndChat(ctx: MyContext) {
    try {
      await ctx.answerCbQuery();
      await ctx.deleteMessage();
    } catch (error) {
      logger.error('❌ Error canceling end chat:', error);
    }
  }

  /**
   * پاک کردن پیام‌های چت برای هر دو کاربر (فقط در تلگرام، نه در دیتابیس)
   */
  async deleteChatMessages(ctx: MyContext, chatId: number) {
    const user = ctx.state.user;

    try {
      const messages = await randomChatService.getChatMessages(chatId);
      const chatData = await pool.query('SELECT * FROM random_chats WHERE id = $1', [chatId]);

      if (!chatData.rows[0]) {
        return await ctx.reply('⚠️ چت یافت نشد.', mainMenuKeyboard());
      }

      const chat = chatData.rows[0];
      const user1Data = await userService.findById(chat.user1_id);
      const user2Data = await userService.findById(chat.user2_id);

      if (!user1Data || !user2Data) {
        return await ctx.reply('⚠️ خطا در یافتن کاربران.', mainMenuKeyboard());
      }

      let deletedCountUser1 = 0;
      let deletedCountUser2 = 0;

      // حذف پیام‌ها برای هر دو کاربر
      for (const msg of messages) {
        try {
          // حذف برای کاربر 1
          if (msg.telegram_message_id_user1) {
            await ctx.telegram.deleteMessage(user1Data.telegram_id, msg.telegram_message_id_user1);
            deletedCountUser1++;
          }
        } catch (error) {
          logger.debug(`Could not delete message ${msg.id} for user1`);
        }

        try {
          // حذف برای کاربر 2
          if (msg.telegram_message_id_user2) {
            await ctx.telegram.deleteMessage(user2Data.telegram_id, msg.telegram_message_id_user2);
            deletedCountUser2++;
          }
        } catch (error) {
          logger.debug(`Could not delete message ${msg.id} for user2`);
        }
      }

      const userName = user.name || user.first_name || 'کاربر';
      const isUser1 = chat.user1_id === user.id;
      const partnerId = isUser1 ? chat.user2_id : chat.user1_id;
      const partnerData = await userService.findById(partnerId);

      // اطلاع به کاربر فعلی
      await ctx.reply(
        `🗑️ ${isUser1 ? deletedCountUser1 : deletedCountUser2} پیام از چت ${chatId} برای شما پاک شد.`,
        mainMenuKeyboard()
      );

      // اطلاع به کاربر مقابل
      if (partnerData) {
        try {
          await ctx.telegram.sendMessage(
            partnerData.telegram_id,
            `🗑️ ${isUser1 ? deletedCountUser2 : deletedCountUser1} پیام از چت ${chatId} توسط ${userName} پاک شد.`,
            mainMenuKeyboard()
          );
        } catch (error) {
          logger.error('Could not notify partner about deletion:', error);
        }
      }

      logger.info(`✅ User ${user.id} deleted messages from chat ${chatId} for both users`);
    } catch (error) {
      logger.error('❌ Error deleting chat messages:', error);
      await ctx.reply('⚠️ خطا در پاک کردن پیام‌ها', mainMenuKeyboard());
    }
  }

  /**
   * ارسال پیام در چت فعال با حالت امن
   */
  async handleChatMessage(ctx: MyContext, messageType: 'text' | 'photo' | 'video' | 'voice' | 'document') {
    const user = ctx.state.user;

    try {
      const chat = await randomChatService.getUserActiveChat(user.id);

      if (!chat) {
        return; // کاربر در چت فعالی نیست
      }

      const partnerId = randomChatService.getPartnerUserId(chat, user.id);
      const partnerData = await userService.findByIdWithProfile(partnerId);

      if (!partnerData) {
        const keyboard = await getAppropriateKeyboard(user.id);
        return await ctx.reply('⚠️ خطا در ارسال پیام', keyboard);
      }

      // بررسی حالت امن - هر دو طرف
      const userSafeMode = await randomChatService.isSafeModeEnabled(chat.id, user.id);
      const partnerSafeMode = await randomChatService.isSafeModeEnabled(chat.id, partnerId);
      const protectContent = userSafeMode || partnerSafeMode;

      // ✅ بررسی reply - پیدا کردن message_id مقابل
      let replyToMessageId = null;
      let replyToDbId = null;
      if (ctx.message && 'reply_to_message' in ctx.message && ctx.message.reply_to_message) {
        const originalMessageId = ctx.message.reply_to_message.message_id;
        
        // پیدا کردن پیام در دیتابیس
        const replyResult = await pool.query(
          `SELECT id, telegram_message_id_user1, telegram_message_id_user2 
           FROM random_chat_messages 
           WHERE chat_id = $1 
           AND (telegram_message_id_user1 = $2 OR telegram_message_id_user2 = $2)`,
          [chat.id, originalMessageId]
        );

        if (replyResult.rows.length > 0) {
          const replyMsg = replyResult.rows[0];
          replyToDbId = replyMsg.id;
          
          // تعیین message_id مقابل
          if (chat.user1_id === user.id) {
            replyToMessageId = replyMsg.telegram_message_id_user2;
          } else {
            replyToMessageId = replyMsg.telegram_message_id_user1;
          }
        }
      }

      // ارسال پیام به کاربر مقابل با حالت امن و reply
      let sentMessage;
      const sendOptions: any = { 
        protect_content: protectContent,
        ...(replyToMessageId && { reply_to_message_id: replyToMessageId })
      };

      if (messageType === 'text' && ctx.message && 'text' in ctx.message) {
        sentMessage = await ctx.telegram.sendMessage(
          partnerData.telegram_id,
          ctx.message.text,
          sendOptions
        );
      } else if (messageType === 'photo' && ctx.message && 'photo' in ctx.message) {
        const photo = ctx.message.photo[ctx.message.photo.length - 1];
        sentMessage = await ctx.telegram.sendPhoto(
          partnerData.telegram_id,
          photo.file_id,
          { 
            ...sendOptions,
            caption: ctx.message.caption
          }
        );
      } else if (messageType === 'video' && ctx.message && 'video' in ctx.message) {
        sentMessage = await ctx.telegram.sendVideo(
          partnerData.telegram_id,
          ctx.message.video.file_id,
          { 
            ...sendOptions,
            caption: ctx.message.caption
          }
        );
      } else if (messageType === 'voice' && ctx.message && 'voice' in ctx.message) {
        sentMessage = await ctx.telegram.sendVoice(
          partnerData.telegram_id,
          ctx.message.voice.file_id,
          sendOptions
        );
      } else if (messageType === 'document' && ctx.message && 'document' in ctx.message) {
        sentMessage = await ctx.telegram.sendDocument(
          partnerData.telegram_id,
          ctx.message.document.file_id,
          { 
            ...sendOptions,
            caption: ctx.message.caption
          }
        );
      }

      // ذخیره پیام در دیتابیس
      if (sentMessage && ctx.message) {
        let messageText = null;
        let fileId = null;

        if (messageType === 'text' && 'text' in ctx.message) {
          messageText = ctx.message.text;
        } else if (messageType === 'photo' && 'photo' in ctx.message) {
          fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
          messageText = ctx.message.caption || null;
        } else if (messageType === 'video' && 'video' in ctx.message) {
          fileId = ctx.message.video.file_id;
          messageText = ctx.message.caption || null;
        } else if (messageType === 'voice' && 'voice' in ctx.message) {
          fileId = ctx.message.voice.file_id;
        } else if (messageType === 'document' && 'document' in ctx.message) {
          fileId = ctx.message.document.file_id;
          messageText = ctx.message.caption || null;
        }

        await pool.query(
          `INSERT INTO random_chat_messages (chat_id, sender_id, message_type, message_text, file_id, telegram_message_id_user1, telegram_message_id_user2, reply_to_message_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            chat.id,
            user.id,
            messageType,
            messageText,
            fileId,
            chat.user1_id === user.id ? ctx.message.message_id : sentMessage.message_id,
            chat.user2_id === user.id ? ctx.message.message_id : sentMessage.message_id,
            replyToDbId,
          ]
        );
      }

      logger.info(`📨 Message sent in chat ${chat.id} from ${user.id} to ${partnerId} (protected: ${protectContent})`);
    } catch (error) {
      logger.error('❌ Error handling chat message:', error);
      const keyboard = await getAppropriateKeyboard(user.id);
      await ctx.reply('⚠️ خطا در ارسال پیام', keyboard);
    }
  }

  /**
   * ✅ مدیریت reaction روی پیام
   */
  async handleMessageReaction(ctx: any) {
    const user = ctx.state.user;

    try {
      const chat = await randomChatService.getUserActiveChat(user.id);
      if (!chat) return;

      const partnerId = randomChatService.getPartnerUserId(chat, user.id);
      const partnerData = await userService.findById(partnerId);
      if (!partnerData) return;

      const messageId = ctx.messageReaction.message_id;
      const newReaction = ctx.messageReaction.new_reaction;

      // پیدا کردن message_id مقابل
      const msgResult = await pool.query(
        `SELECT telegram_message_id_user1, telegram_message_id_user2 
         FROM random_chat_messages 
         WHERE chat_id = $1 
         AND (telegram_message_id_user1 = $2 OR telegram_message_id_user2 = $2)`,
        [chat.id, messageId]
      );

      if (msgResult.rows.length > 0) {
        const msg = msgResult.rows[0];
        let partnerMessageId;

        if (chat.user1_id === user.id) {
          partnerMessageId = msg.telegram_message_id_user2;
        } else {
          partnerMessageId = msg.telegram_message_id_user1;
        }

        // ارسال reaction به کاربر مقابل
        if (partnerMessageId && newReaction && newReaction.length > 0) {
          await ctx.telegram.setMessageReaction(
            partnerData.telegram_id,
            partnerMessageId,
            newReaction
          );
          logger.info(`👍 Reaction forwarded in chat ${chat.id}`);
        }
      }
    } catch (error) {
      logger.error('❌ Error handling message reaction:', error);
    }
  }

  /**
   * ✅ مدیریت ویرایش پیام
   */
  async handleEditedMessage(ctx: MyContext) {
    const user = ctx.state.user;

    try {
      const chat = await randomChatService.getUserActiveChat(user.id);
      if (!chat) return;

      const partnerId = randomChatService.getPartnerUserId(chat, user.id);
      const partnerData = await userService.findById(partnerId);
      if (!partnerData) return;

      if (!ctx.editedMessage || !('message_id' in ctx.editedMessage)) return;

      const messageId = ctx.editedMessage.message_id;
      let newText = '';

      if ('text' in ctx.editedMessage) {
        newText = ctx.editedMessage.text;
      } else if ('caption' in ctx.editedMessage) {
        newText = ctx.editedMessage.caption || '';
      }

      // پیدا کردن message_id مقابل
      const msgResult = await pool.query(
        `SELECT id, telegram_message_id_user1, telegram_message_id_user2, message_type
         FROM random_chat_messages 
         WHERE chat_id = $1 
         AND (telegram_message_id_user1 = $2 OR telegram_message_id_user2 = $2)`,
        [chat.id, messageId]
      );

      if (msgResult.rows.length > 0) {
        const msg = msgResult.rows[0];
        let partnerMessageId;

        if (chat.user1_id === user.id) {
          partnerMessageId = msg.telegram_message_id_user2;
        } else {
          partnerMessageId = msg.telegram_message_id_user1;
        }

        // به‌روزرسانی پیام برای کاربر مقابل
        if (partnerMessageId) {
          const editedText = `${newText}\n\n✏️ <i>کاربر مقابل این پیام را ویرایش کرد</i>`;

          try {
            if (msg.message_type === 'text') {
              await ctx.telegram.editMessageText(
                partnerData.telegram_id,
                partnerMessageId,
                undefined,
                editedText,
                { parse_mode: 'HTML' }
              );
            } else {
              // برای عکس، ویدیو و غیره فقط caption را ویرایش می‌کنیم
              await ctx.telegram.editMessageCaption(
                partnerData.telegram_id,
                partnerMessageId,
                undefined,
                editedText,
                { parse_mode: 'HTML' }
              );
            }

            // به‌روزرسانی دیتابیس
            await pool.query(
              `UPDATE random_chat_messages 
               SET is_edited = true, edited_at = NOW(), message_text = $1
               WHERE id = $2`,
              [newText, msg.id]
            );

            logger.info(`✏️ Message edited in chat ${chat.id}`);
          } catch (editError) {
            logger.error('❌ Error editing message for partner:', editError);
          }
        }
      }
    } catch (error) {
      logger.error('❌ Error handling edited message:', error);
    }
  }
}

export default new RandomChatHandlers();
