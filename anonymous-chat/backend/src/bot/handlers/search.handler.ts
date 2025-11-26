import { Context } from 'telegraf';
import { Markup } from 'telegraf';
import searchService from '../../services/search.service';
import logger from '../../utils/logger';

/**
 * Search Handlers
 */
class SearchHandlers {
  /**
   * مدیریت اکشن‌های جستجو
   */
  async handleActions(ctx: Context) {
    if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) return;

    const action = ctx.callbackQuery.data;
    const user = ctx.state.user;

    try {
      await ctx.answerCbQuery();

      // شروع جستجو
      if (action === 'search_start') {
        return await this.showSearchMenu(ctx);
      }

      // جستجوی سریع (آنلاین)
      if (action === 'search_quick') {
        return await this.quickSearch(ctx);
      }

      // جستجوی پیشرفته
      if (action === 'search_advanced') {
        return await this.startAdvancedSearch(ctx);
      }

      // پیشنهادات
      if (action === 'search_suggested') {
        return await this.showSuggested(ctx);
      }

      // مشاهده پروفایل
      if (action.startsWith('search_profile_')) {
        const userId = parseInt(action.replace('search_profile_', ''));
        return await this.viewProfile(ctx, userId);
      }

      // شروع چت با نتیجه جستجو
      if (action.startsWith('search_chat_')) {
        const userId = parseInt(action.replace('search_chat_', ''));
        return await this.startChatWithUser(ctx, userId);
      }

      // صفحه‌بندی
      if (action.startsWith('search_page_')) {
        const page = parseInt(action.replace('search_page_', ''));
        return await this.showSearchResults(ctx, page);
      }

    } catch (error) {
      logger.error('❌ Search action error:', error);
      await ctx.reply('⚠️ خطایی رخ داد.');
    }
  }

  /**
   * نمایش منوی جستجو
   */
  private async showSearchMenu(ctx: Context) {
    const menuText =
      `🔍 جستجوی کاربران\n\n` +
      `چه نوع جستجویی می‌خواهید؟`;

    await ctx.editMessageText(
      menuText,
      Markup.inlineKeyboard([
        [Markup.button.callback('⚡ جستجوی سریع (آنلاین)', 'search_quick')],
        [Markup.button.callback('🎯 جستجوی پیشرفته', 'search_advanced')],
        [Markup.button.callback('💡 پیشنهادات', 'search_suggested')],
        [Markup.button.callback('🔙 بازگشت', 'main_menu')],
      ])
    );
  }

  /**
   * جستجوی سریع (کاربران آنلاین)
   */
  private async quickSearch(ctx: Context) {
    const user = ctx.state.user;

    try {
      const onlineUsers = await searchService.searchOnlineUsers({
        excludeUserId: user.id,
        limit: 10,
      });

      if (onlineUsers.length === 0) {
        return await ctx.editMessageText(
          '❌ کاربر آنلاینی یافت نشد.',
          Markup.inlineKeyboard([[Markup.button.callback('🔙 بازگشت', 'search_start')]])
        );
      }

      await this.displaySearchResults(ctx, onlineUsers, 'quick');

    } catch (error) {
      logger.error('❌ Quick search error:', error);
      await ctx.reply('⚠️ خطا در جستجو.');
    }
  }

  /**
   * شروع جستجوی پیشرفته
   */
  private async startAdvancedSearch(ctx: Context) {
    ctx.session.searchState = 'awaiting_gender';

    await ctx.editMessageText(
      '🎯 جستجوی پیشرفته\n\n' +
      'جنسیت مورد نظر را انتخاب کنید:',
      Markup.inlineKeyboard([
        [
          Markup.button.callback('👨 مرد', 'search_filter_gender_male'),
          Markup.button.callback('👩 زن', 'search_filter_gender_female'),
        ],
        [Markup.button.callback('🔄 همه', 'search_filter_gender_all')],
        [Markup.button.callback('🔙 بازگشت', 'search_start')],
      ])
    );
  }

  /**
   * فیلتر جستجو بر اساس جنسیت
   */
  async handleGenderFilter(ctx: Context) {
    if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) return;

    const action = ctx.callbackQuery.data;
    await ctx.answerCbQuery();

    const gender = action.includes('male')
      ? 'male'
      : action.includes('female')
      ? 'female'
      : null;

    ctx.session.searchFilters = { gender };
    ctx.session.searchState = 'awaiting_age';

    await ctx.editMessageText(
      '📅 محدوده سنی را انتخاب کنید:',
      Markup.inlineKeyboard([
        [Markup.button.callback('18-25', 'search_filter_age_18_25')],
        [Markup.button.callback('26-35', 'search_filter_age_26_35')],
        [Markup.button.callback('36-45', 'search_filter_age_36_45')],
        [Markup.button.callback('45+', 'search_filter_age_45_plus')],
        [Markup.button.callback('🔄 همه', 'search_filter_age_all')],
        [Markup.button.callback('🔙 بازگشت', 'search_advanced')],
      ])
    );
  }

  /**
   * فیلتر جستجو بر اساس سن
   */
  async handleAgeFilter(ctx: Context) {
    if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) return;

    const action = ctx.callbackQuery.data;
    await ctx.answerCbQuery();

    let ageRange: { min?: number; max?: number } = {};

    if (action.includes('18_25')) {
      ageRange = { min: 18, max: 25 };
    } else if (action.includes('26_35')) {
      ageRange = { min: 26, max: 35 };
    } else if (action.includes('36_45')) {
      ageRange = { min: 36, max: 45 };
    } else if (action.includes('45_plus')) {
      ageRange = { min: 45 };
    }

    ctx.session.searchFilters = {
      ...ctx.session.searchFilters,
      ...ageRange,
    };

    // انجام جستجو
    await this.performAdvancedSearch(ctx);
  }

  /**
   * اجرای جستجوی پیشرفته
   */
  private async performAdvancedSearch(ctx: Context) {
    const user = ctx.state.user;
    const filters = ctx.session.searchFilters || {};

    try {
      const results = await searchService.searchUsers({
        ...filters,
        excludeUserId: user.id,
        limit: 10,
      });

      if (results.length === 0) {
        return await ctx.editMessageText(
          '❌ کاربری با این فیلترها یافت نشد.',
          Markup.inlineKeyboard([[Markup.button.callback('🔙 بازگشت', 'search_start')]])
        );
      }

      await this.displaySearchResults(ctx, results, 'advanced');

      // پاک کردن session
      delete ctx.session.searchState;
      delete ctx.session.searchFilters;

    } catch (error) {
      logger.error('❌ Advanced search error:', error);
      await ctx.reply('⚠️ خطا در جستجو.');
    }
  }

  /**
   * نمایش پیشنهادات
   */
  private async showSuggested(ctx: Context) {
    const user = ctx.state.user;

    try {
      const suggested = await searchService.getSuggestedUsers(user.id, 10);

      if (suggested.length === 0) {
        return await ctx.editMessageText(
          '❌ پیشنهادی یافت نشد.',
          Markup.inlineKeyboard([[Markup.button.callback('🔙 بازگشت', 'search_start')]])
        );
      }

      await this.displaySearchResults(ctx, suggested, 'suggested');

    } catch (error) {
      logger.error('❌ Show suggested error:', error);
      await ctx.reply('⚠️ خطا در دریافت پیشنهادات.');
    }
  }

  /**
   * نمایش نتایج جستجو
   */
  private async displaySearchResults(
    ctx: Context,
    results: any[],
    searchType: string
  ) {
    let resultsText = '🔍 نتایج جستجو:\n\n';
    const buttons: any[] = [];

    results.forEach((result, index) => {
      const age = result.age || '؟';
      const city = result.city || 'نامشخص';

      resultsText +=
        `${index + 1}. ${result.first_name}\n` +
        `   ${result.gender === 'male' ? '👨' : '👩'} ${age} ساله | 📍 ${city}\n` +
        `   ${result.bio ? `📝 ${result.bio.substring(0, 50)}...` : ''}\n\n`;

      buttons.push([
        Markup.button.callback(
          `👤 ${result.first_name}`,
          `search_profile_${result.id}`
        ),
        Markup.button.callback('💬 چت', `search_chat_${result.id}`),
      ]);
    });

    buttons.push([Markup.button.callback('🔙 بازگشت', 'search_start')]);

    await ctx.editMessageText(resultsText, Markup.inlineKeyboard(buttons));
  }

  /**
   * مشاهده پروفایل کاربر
   */
  private async viewProfile(ctx: Context, userId: number) {
    try {
      const profile = await searchService.getUserProfile(userId);
      if (!profile) return;

      const profileText =
        `👤 پروفایل ${profile.first_name}\n\n` +
        `${profile.gender === 'male' ? '👨' : '👩'} ${profile.age} ساله\n` +
        `📍 ${profile.province || '؟'} - ${profile.city || '؟'}\n\n` +
        `${profile.bio ? `📝 ${profile.bio}` : 'بدون بیو'}`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('💬 شروع چت', `search_chat_${userId}`)],
        [Markup.button.callback('🔙 بازگشت', 'search_start')],
      ]);

      if (profile.photo_url) {
        await ctx.replyWithPhoto(profile.photo_url, {
          caption: profileText,
          ...keyboard,
        });
      } else {
        await ctx.reply(profileText, keyboard);
      }

    } catch (error) {
      logger.error('❌ View profile error:', error);
      await ctx.reply('⚠️ خطا در نمایش پروفایل.');
    }
  }

  /**
   * شروع چت با کاربر یافت شده
   */
  private async startChatWithUser(ctx: Context, targetUserId: number) {
    // هدایت به direct handler
    const { directHandlers } = await import('./direct.handler');
    await directHandlers.initiateChat(ctx, targetUserId);
  }

  /**
   * صفحه‌بندی نتایج
   */
  private async showSearchResults(ctx: Context, page: number) {
    // TODO: پیاده‌سازی pagination
    await ctx.answerCbQuery(`صفحه ${page}`);
  }
}

export const searchHandlers = new SearchHandlers();
