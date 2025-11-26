import { Context } from 'telegraf';
import { Markup } from 'telegraf';
import userService from '../../services/user.service';
import profileService from '../../services/profile.service';
import logger from '../../utils/logger';

/**
 * کیبوردهای تنظیمات
 */
const settingsKeyboards = {
  main: () => Markup.inlineKeyboard([
    [Markup.button.callback('🔔 تنظیمات اعلان‌ها', 'settings_notifications')],
    [Markup.button.callback('🔒 حریم خصوصی', 'settings_privacy')],
    [Markup.button.callback('🚫 لیست بلاک', 'settings_blocklist')],
    [Markup.button.callback('🗑 حذف حساب', 'settings_delete_account')],
    [Markup.button.callback('🔙 بازگشت', 'main_menu')],
  ]),

  notifications: (settings: any) => Markup.inlineKeyboard([
    [
      Markup.button.callback(
        `پیام‌های جدید: ${settings.new_messages ? '✅' : '❌'}`,
        'settings_toggle_new_messages'
      ),
    ],
    [
      Markup.button.callback(
        `پیام‌های ناشناس: ${settings.anonymous_messages ? '✅' : '❌'}`,
        'settings_toggle_anonymous'
      ),
    ],
    [
      Markup.button.callback(
        `چت تصادفی: ${settings.random_chat ? '✅' : '❌'}`,
        'settings_toggle_random_chat'
      ),
    ],
    [Markup.button.callback('🔙 بازگشت', 'settings_menu')],
  ]),

  privacy: (settings: any) => Markup.inlineKeyboard([
    [
      Markup.button.callback(
        `نمایش آخرین بازدید: ${settings.show_last_seen ? '✅' : '❌'}`,
        'settings_toggle_last_seen'
      ),
    ],
    [
      Markup.button.callback(
        `نمایش عکس پروفایل: ${settings.show_profile_photo ? '✅' : '❌'}`,
        'settings_toggle_profile_photo'
      ),
    ],
    [
      Markup.button.callback(
        `قابل جستجو بودن: ${settings.searchable ? '✅' : '❌'}`,
        'settings_toggle_searchable'
      ),
    ],
    [Markup.button.callback('🔙 بازگشت', 'settings_menu')],
  ]),

  deleteConfirm: () => Markup.inlineKeyboard([
    [Markup.button.callback('✅ بله، حذف کن', 'settings_delete_confirm')],
    [Markup.button.callback('❌ خیر، انصراف', 'settings_menu')],
  ]),
};

/**
 * Settings Handlers
 */
class SettingsHandlers {
  /**
   * مدیریت اکشن‌های تنظیمات
   */
  async handleActions(ctx: Context) {
    if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) return;

    const action = ctx.callbackQuery.data;
    const user = ctx.state.user;

    try {
      await ctx.answerCbQuery();

      // منوی اصلی تنظیمات
      if (action === 'settings_menu') {
        return await this.showMainMenu(ctx);
      }

      // تنظیمات اعلان‌ها
      if (action === 'settings_notifications') {
        return await this.showNotifications(ctx);
      }

      // تنظیمات حریم خصوصی
      if (action === 'settings_privacy') {
        return await this.showPrivacy(ctx);
      }

      // لیست بلاک
      if (action === 'settings_blocklist') {
        return await this.showBlockList(ctx);
      }

      // حذف حساب
      if (action === 'settings_delete_account') {
        return await this.confirmDelete(ctx);
      }

      if (action === 'settings_delete_confirm') {
        return await this.deleteAccount(ctx);
      }

      // Toggle تنظیمات اعلان
      if (action.startsWith('settings_toggle_')) {
        return await this.toggleSetting(ctx, action);
      }

      // حذف از بلاک‌لیست
      if (action.startsWith('settings_unblock_')) {
        const blockedUserId = parseInt(action.replace('settings_unblock_', ''));
        return await this.unblockUser(ctx, blockedUserId);
      }

    } catch (error) {
      logger.error('❌ Settings action error:', error);
      await ctx.reply('⚠️ خطایی رخ داد.');
    }
  }

  /**
   * نمایش منوی اصلی تنظیمات
   */
  private async showMainMenu(ctx: Context) {
    const menuText =
      `⚙️ تنظیمات\n\n` +
      `از گزینه‌های زیر استفاده کنید:`;

    await ctx.editMessageText(menuText, settingsKeyboards.main());
  }

  /**
   * نمایش تنظیمات اعلان‌ها
   */
  private async showNotifications(ctx: Context) {
    const user = ctx.state.user;

    // دریافت تنظیمات فعلی
    const settings = {
      new_messages: user.notification_enabled ?? true,
      anonymous_messages: true, // از دیتابیس بخوانید
      random_chat: true,
    };

    const text =
      `🔔 تنظیمات اعلان‌ها\n\n` +
      `گزینه‌های مورد نظر خود را فعال/غیرفعال کنید:`;

    await ctx.editMessageText(text, settingsKeyboards.notifications(settings));
  }

  /**
   * نمایش تنظیمات حریم خصوصی
   */
  private async showPrivacy(ctx: Context) {
    const user = ctx.state.user;

    const settings = {
      show_last_seen: true,
      show_profile_photo: true,
      searchable: true,
    };

    const text =
      `🔒 تنظیمات حریم خصوصی\n\n` +
      `کنترل کنید که چه اطلاعاتی برای دیگران قابل مشاهده باشد:`;

    await ctx.editMessageText(text, settingsKeyboards.privacy(settings));
  }

  /**
   * تغییر وضعیت یک تنظیم
   */
  private async toggleSetting(ctx: Context, action: string) {
    const user = ctx.state.user;
    const setting = action.replace('settings_toggle_', '');

    try {
      // TODO: ذخیره تنظیم در دیتابیس
      // await userService.updateSettings(user.id, { [setting]: !currentValue });

      await ctx.answerCbQuery('✅ تنظیمات به‌روزرسانی شد');

      // به‌روزرسانی کیبورد
      if (action.includes('new_messages') || action.includes('anonymous') || action.includes('random_chat')) {
        await this.showNotifications(ctx);
      } else {
        await this.showPrivacy(ctx);
      }

    } catch (error) {
      logger.error('❌ Toggle setting error:', error);
      await ctx.answerCbQuery('⚠️ خطا در به‌روزرسانی');
    }
  }

  /**
   * نمایش لیست بلاک
   */
  private async showBlockList(ctx: Context) {
    const user = ctx.state.user;

    try {
      // TODO: دریافت لیست کاربران بلاک شده از دیتابیس
      const blockedUsers: any[] = []; // await userService.getBlockedUsers(user.id);

      if (blockedUsers.length === 0) {
        return await ctx.editMessageText(
          '📝 لیست بلاک شما خالی است.',
          Markup.inlineKeyboard([[Markup.button.callback('🔙 بازگشت', 'settings_menu')]])
        );
      }

      let blockListText = '🚫 کاربران بلاک شده:\n\n';
      const buttons: any[] = [];

      blockedUsers.forEach((blockedUser, index) => {
        blockListText += `${index + 1}. ${blockedUser.first_name}\n`;
        buttons.push([
          Markup.button.callback(
            `❌ حذف ${blockedUser.first_name}`,
            `settings_unblock_${blockedUser.id}`
          ),
        ]);
      });

      buttons.push([Markup.button.callback('🔙 بازگشت', 'settings_menu')]);

      await ctx.editMessageText(blockListText, Markup.inlineKeyboard(buttons));

    } catch (error) {
      logger.error('❌ Show blocklist error:', error);
      await ctx.reply('⚠️ خطا در دریافت لیست بلاک.');
    }
  }

  /**
   * حذف کاربر از بلاک‌لیست
   */
  private async unblockUser(ctx: Context, blockedUserId: number) {
    const user = ctx.state.user;

    try {
      // TODO: حذف از دیتابیس
      // await userService.unblockUser(user.id, blockedUserId);

      await ctx.answerCbQuery('✅ کاربر از بلاک‌لیست حذف شد');
      await this.showBlockList(ctx);

    } catch (error) {
      logger.error('❌ Unblock user error:', error);
      await ctx.answerCbQuery('⚠️ خطا در حذف از بلاک‌لیست');
    }
  }

  /**
   * تایید حذف حساب
   */
  private async confirmDelete(ctx: Context) {
    const warningText =
      `⚠️ حذف حساب کاربری\n\n` +
      `با حذف حساب:\n` +
      `• تمام اطلاعات شما پاک می‌شود\n` +
      `• سکه‌ها و چت‌ها حذف می‌شوند\n` +
      `• این عمل غیرقابل بازگشت است\n\n` +
      `آیا مطمئن هستید؟`;

    await ctx.editMessageText(warningText, settingsKeyboards.deleteConfirm());
  }

  /**
   * حذف حساب کاربری
   */
  private async deleteAccount(ctx: Context) {
    const user = ctx.state.user;

    try {
      // حذف تمام داده‌های کاربر
      await userService.deleteUser(user.id);

      await ctx.editMessageText(
        '✅ حساب شما با موفقیت حذف شد.\n' +
        'امیدواریم دوباره شما را ببینیم! 👋'
      );

      logger.info('User deleted account:', { userId: user.id });

    } catch (error) {
      logger.error('❌ Delete account error:', error);
      await ctx.reply('⚠️ خطا در حذف حساب.');
    }
  }
}

export const settingsHandlers = new SettingsHandlers();
