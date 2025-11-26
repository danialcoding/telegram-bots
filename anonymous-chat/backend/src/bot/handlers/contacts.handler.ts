import { Context } from 'telegraf';
import { Markup } from 'telegraf';
import chatService from '../../services/chat.service';
import userService from '../../services/user.service';
import logger from '../../utils/logger';

/**
 * Contacts & Favorites Handlers
 */
class ContactsHandlers {
  /**
   * مدیریت اکشن‌های مخاطبین
   */
  async handleActions(ctx: Context) {
    if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) return;

    const action = ctx.callbackQuery.data;
    const user = ctx.state.user;

    try {
      await ctx.answerCbQuery();

      // نمایش لیست مخاطبین
      if (action === 'contacts_list') {
        return await this.showContacts(ctx);
      }

      // نمایش علاقه‌مندی‌ها
      if (action === 'contacts_favorites') {
        return await this.showFavorites(ctx);
      }

      // نمایش تاریخچه چت‌ها
      if (action === 'contacts_history') {
        return await this.showChatHistory(ctx);
      }

      // اضافه کردن به علاقه‌مندی‌ها
      if (action.startsWith('contacts_add_fav_')) {
        const contactId = parseInt(action.replace('contacts_add_fav_', ''));
        return await this.addToFavorites(ctx, contactId);
      }

      // حذف از علاقه‌مندی‌ها
      if (action.startsWith('contacts_remove_fav_')) {
        const contactId = parseInt(action.replace('contacts_remove_fav_', ''));
        return await this.removeFromFavorites(ctx, contactId);
      }

      // شروع چت مستقیم
      if (action.startsWith('contacts_chat_')) {
        const contactId = parseInt(action.replace('contacts_chat_', ''));
        return await this.startDirectChat(ctx, contactId);
      }

      // حذف مخاطب
      if (action.startsWith('contacts_delete_')) {
        const contactId = parseInt(action.replace('contacts_delete_', ''));
        return await this.deleteContact(ctx, contactId);
      }

    } catch (error) {
      logger.error('❌ Contacts action error:', error);
      await ctx.reply('⚠️ خطایی رخ داد.');
    }
  }

  /**
   * نمایش لیست مخاطبین
   */
  private async showContacts(ctx: Context) {
    const user = ctx.state.user;

    try {
      // دریافت لیست مخاطبین (کسانی که با آن‌ها چت کرده)
      const contacts = await chatService.getUserContacts(user.id);

      if (contacts.length === 0) {
        return await ctx.editMessageText(
          '📝 لیست مخاطبین شما خالی است.\n\n' +
          'برای اضافه شدن مخاطب، با کاربران چت کنید!',
          Markup.inlineKeyboard([[Markup.button.callback('🔙 بازگشت', 'main_menu')]])
        );
      }

      let contactsText = '👥 مخاطبین شما:\n\n';
      const buttons: any[] = [];

      for (const contact of contacts) {
        const isFavorite = contact.is_favorite;
        const emoji = isFavorite ? '⭐' : '👤';

        contactsText +=
          `${emoji} ${contact.first_name}\n` +
          `   آخرین چت: ${new Date(contact.last_message_at).toLocaleDateString('fa-IR')}\n\n`;

        buttons.push([
          Markup.button.callback(
            `💬 ${contact.first_name}`,
            `contacts_chat_${contact.id}`
          ),
          Markup.button.callback(
            isFavorite ? '💔' : '⭐',
            isFavorite
              ? `contacts_remove_fav_${contact.id}`
              : `contacts_add_fav_${contact.id}`
          ),
        ]);
      }

      buttons.push([Markup.button.callback('🔙 بازگشت', 'main_menu')]);

      await ctx.editMessageText(contactsText, Markup.inlineKeyboard(buttons));

    } catch (error) {
      logger.error('❌ Show contacts error:', error);
      await ctx.reply('⚠️ خطا در دریافت مخاطبین.');
    }
  }

  /**
   * نمایش علاقه‌مندی‌ها
   */
  private async showFavorites(ctx: Context) {
    const user = ctx.state.user;

    try {
      const favorites = await chatService.getUserFavorites(user.id);

      if (favorites.length === 0) {
        return await ctx.editMessageText(
          '⭐ لیست علاقه‌مندی‌های شما خالی است.',
          Markup.inlineKeyboard([[Markup.button.callback('🔙 بازگشت', 'contacts_list')]])
        );
      }

      let favoritesText = '⭐ علاقه‌مندی‌های شما:\n\n';
      const buttons: any[] = [];

      favorites.forEach((fav, index) => {
        favoritesText += `${index + 1}. ${fav.first_name}\n`;
        buttons.push([
          Markup.button.callback(`💬 ${fav.first_name}`, `contacts_chat_${fav.id}`),
          Markup.button.callback('💔 حذف', `contacts_remove_fav_${fav.id}`),
        ]);
      });

      buttons.push([Markup.button.callback('🔙 بازگشت', 'contacts_list')]);

      await ctx.editMessageText(favoritesText, Markup.inlineKeyboard(buttons));

    } catch (error) {
      logger.error('❌ Show favorites error:', error);
      await ctx.reply('⚠️ خطا در دریافت علاقه‌مندی‌ها.');
    }
  }

  /**
   * نمایش تاریخچه چت‌ها
   */
  private async showChatHistory(ctx: Context) {
    const user = ctx.state.user;

    try {
      const history = await chatService.getChatHistory(user.id, 20);

      if (history.length === 0) {
        return await ctx.editMessageText(
          '📝 تاریخچه چت شما خالی است.',
          Markup.inlineKeyboard([[Markup.button.callback('🔙 بازگشت', 'main_menu')]])
        );
      }

      let historyText = '📊 تاریخچه چت‌های شما:\n\n';

      history.forEach((chat, index) => {
        const duration = this.calculateDuration(chat.started_at, chat.ended_at);
        historyText +=
          `${index + 1}. ${chat.partner_name}\n` +
          `   نوع: ${this.getChatTypeEmoji(chat.chat_type)}\n` +
          `   مدت: ${duration}\n` +
          `   تاریخ: ${new Date(chat.started_at).toLocaleDateString('fa-IR')}\n\n`;
      });

      await ctx.editMessageText(
        historyText,
        Markup.inlineKeyboard([[Markup.button.callback('🔙 بازگشت', 'main_menu')]])
      );

    } catch (error) {
      logger.error('❌ Show history error:', error);
      await ctx.reply('⚠️ خطا در دریافت تاریخچه.');
    }
  }

  /**
   * اضافه کردن به علاقه‌مندی‌ها
   */
  private async addToFavorites(ctx: Context, contactId: number) {
    const user = ctx.state.user;

    try {
      // TODO: افزودن به جدول favorites
      // await chatService.addToFavorites(user.id, contactId);

      await ctx.answerCbQuery('⭐ به علاقه‌مندی‌ها اضافه شد');
      await this.showContacts(ctx);

    } catch (error) {
      logger.error('❌ Add to favorites error:', error);
      await ctx.answerCbQuery('⚠️ خطا در افزودن به علاقه‌مندی‌ها');
    }
  }

  /**
   * حذف از علاقه‌مندی‌ها
   */
  private async removeFromFavorites(ctx: Context, contactId: number) {
    const user = ctx.state.user;

    try {
      // TODO: حذف از جدول favorites
      // await chatService.removeFromFavorites(user.id, contactId);

      await ctx.answerCbQuery('💔 از علاقه‌مندی‌ها حذف شد');
      await this.showContacts(ctx);

    } catch (error) {
      logger.error('❌ Remove from favorites error:', error);
      await ctx.answerCbQuery('⚠️ خطا در حذف از علاقه‌مندی‌ها');
    }
  }

  /**
   * شروع چت مستقیم با مخاطب
   */
  private async startDirectChat(ctx: Context, contactId: number) {
    // هدایت به direct handler
    ctx.session.directChatTarget = contactId;
    await ctx.answerCbQuery('✅ در حال اتصال...');
    // TODO: فراخوانی directHandlers.initiateChat
  }

  /**
   * حذف مخاطب
   */
  private async deleteContact(ctx: Context, contactId: number) {
    // TODO: پیاده‌سازی حذف مخاطب
    await ctx.answerCbQuery('✅ مخاطب حذف شد');
  }

  /**
   * محاسبه مدت زمان چت
   */
  private calculateDuration(startedAt: Date, endedAt: Date | null): string {
    if (!endedAt) return 'در حال انجام';

    const duration = new Date(endedAt).getTime() - new Date(startedAt).getTime();
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);

    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  /**
   * ایموجی نوع چت
   */
  private getChatTypeEmoji(chatType: string): string {
    switch (chatType) {
      case 'random':
        return '🎲 تصادفی';
      case 'male':
        return '👨 مردانه';
      case 'female':
        return '👩 زنانه';
      case 'direct':
        return '💬 مستقیم';
      default:
        return '❓';
    }
  }
}

export const contactsHandlers = new ContactsHandlers();
