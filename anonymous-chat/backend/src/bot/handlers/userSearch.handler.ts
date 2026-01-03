import { MyContext } from "../types/bot.types";
import { userSearchService } from "../../services/userSearch.service";
import { userSearchMenuKeyboard, backToSearchMenuKeyboard, genderSelectionKeyboard, userListKeyboard, provinceSelectionKeyboard, ageRangeKeyboard, lastActivityKeyboard } from "../keyboards/userSearch.keyboard";
import { mainMenuKeyboard } from "../keyboards/main.keyboard";
import logger from "../../utils/logger";
import { isUserOnline, convertPersianToEnglishNumbers } from "../../utils/helpers";
import { Markup } from "telegraf";
import { generateSearchCode, formatUserDisplay, getSearchTitle, formatSearchDateTime } from "../helpers/userList.helper";
import { PROVINCES } from "../../utils/locations";

class UserSearchHandlers {
  /**
   * نمایش منوی جستجوی کاربران
   */
  async showSearchMenu(ctx: MyContext) {
    try {
      await ctx.reply(
        '🔍 چه کسایی رو نشونت بدم؟ انتخاب کن',
        userSearchMenuKeyboard()
      );
    } catch (error) {
      logger.error('Error showing search menu:', error);
      await ctx.reply('⚠️ خطا در نمایش منو', mainMenuKeyboard());
    }
  }

  /**
   * نمایش لیست کاربران با صفحه‌بندی
   */
  async showUserList(
    ctx: MyContext,
    users: any[],
    searchType: string,
    currentPage: number,
    totalUsers: number,
    gender?: string,
    searchCode?: string
  ) {
    try {
      const limit = 10;
      const totalPages = Math.ceil(totalUsers / limit);
      const myUserId = ctx.state.user.id;

      // تولید کد منحصر به فرد برای inline query (اگر ارسال نشده)
      const code = searchCode || generateSearchCode(searchType, myUserId);

      // ساخت متن پیام با await
      let messageText = `${getSearchTitle(searchType, gender)}\n\n`;
      
      if (users.length === 0) {
        messageText += '❌ کاربری یافت نشد!';
      } else {
        // استفاده از Promise.all برای فرمت کردن همزمان
        const formattedUsers = await Promise.all(
          users.map(async (user, index) => {
            const formatted = await formatUserDisplay(user, myUserId);
            return `${index + 1}. ${formatted}`;
          })
        );
        messageText += formattedUsers.join('\n\n');
      }

      messageText += `\n📄 صفحه ${currentPage} از ${totalPages}\n`;
      messageText += `👥 تعداد کل: ${totalUsers} نفر\n\n`;
      messageText += formatSearchDateTime();

      await ctx.editMessageText(
        messageText,
        {
          ...userListKeyboard(users, currentPage, totalPages, code, searchType, gender),
        }
      );

    } catch (error) {
      logger.error('Error showing user list:', error);
      await ctx.reply('⚠️ خطا در نمایش لیست', backToSearchMenuKeyboard());
    }
  }

  /**
   * جستجوی هم استانی‌ها - نمایش انتخاب جنسیت
   */
  async handleSameProvinceSearch(ctx: MyContext) {
    try {
      await ctx.editMessageText(
        '🎌 چه کسایی رو نشونت بدم؟',
        genderSelectionKeyboard('search_same_province')
      );
    } catch (error) {
      logger.error('Error in same province search:', error);
      await ctx.reply('⚠️ خطا در جستجو');
    }
  }

  /**
   * جستجوی هم سن‌ها - نمایش انتخاب جنسیت
   */
  async handleSameAgeSearch(ctx: MyContext) {
    try {
      await ctx.editMessageText(
        '🎌 چه کسایی رو نشونت بدم؟',
        genderSelectionKeyboard('search_same_age')
      );
    } catch (error) {
      logger.error('Error in same age search:', error);
      await ctx.reply('⚠️ خطا در جستجو');
    }
  }

  /**
   * جستجوی پیشرفته - مرحله 1: انتخاب جنسیت
   */
  async handleAdvancedSearch(ctx: MyContext) {
    try {
      logger.info('🔍 Advanced search initiated');

      // Initialize advanced search state
      ctx.session.advancedSearch = {
        searchType: 'search_advanced',
        gender: undefined,
        provinces: [],
        minAge: null,
        maxAge: null,
        lastActivity: undefined,
      };

      logger.info('📝 Advanced search state initialized:', ctx.session.advancedSearch);

      const messageText = '🔎 *جستجوی پیشرفته*\n\n🎌 چه کسایی رو نشونت بدم؟';
      const keyboard = genderSelectionKeyboard('search_advanced');

      logger.info('💬 Attempting to edit message...');
      
      await ctx.editMessageText(messageText, {
        parse_mode: 'Markdown',
        ...keyboard,
      });
      
      logger.info('✅ Message edited successfully');
    } catch (error) {
      logger.error('❌ Error in advanced search:', error);
      
      // اگر editMessage کار نکرد، پیام جدید بفرست
      try {
        await ctx.reply('🔎 *جستجوی پیشرفته*\n\n🎌 چه کسایی رو نشونت بدم؟', {
          parse_mode: 'Markdown',
          ...genderSelectionKeyboard('search_advanced'),
        });
      } catch (replyError) {
        logger.error('❌ Error sending reply:', replyError);
        await ctx.reply('⚠️ خطا در جستجو');
      }
    }
  }

  /**
   * جستجوی به مخاطب خاص - مرحله 1: انتخاب جنسیت
   */
  async handleSpecificContactSearch(ctx: MyContext) {
    try {
      // Check if already in this state to prevent duplicate edit
      if (ctx.session.advancedSearch?.searchType === 'search_specific' && !ctx.session.advancedSearch?.gender) {
        await ctx.answerCbQuery('در حال انتخاب جنسیت هستید');
        return;
      }

      // Initialize search state
      ctx.session.advancedSearch = {
        searchType: 'search_specific',
        gender: undefined,
        provinces: [],
        minAge: null,
        maxAge: null,
        lastActivity: undefined,
      };

      await ctx.editMessageText(
        '📞 *به مخاطب خاص وصلم کن*\n\n🎌 چه کسایی رو نشونت بدم؟',
        {
          parse_mode: 'Markdown',
          ...genderSelectionKeyboard('search_specific'),
        }
      );
    } catch (error) {
      logger.error('Error in specific search:', error);
      await ctx.reply('⚠️ خطا در جستجو');
    }
  }

  /**
   * مرحله 2: نمایش انتخاب استان‌ها
   */
  async showProvinceSelection(ctx: MyContext, searchType: string, gender: string) {
    try {
      if (!ctx.session.advancedSearch) {
        ctx.session.advancedSearch = {
          searchType: searchType as any,
          gender: gender as any,
          provinces: [],
          minAge: null,
          maxAge: null,
        };
      } else {
        ctx.session.advancedSearch.gender = gender as any;
      }

      const genderText = gender === 'male' ? 'پسر' : gender === 'female' ? 'دختر' : 'هردو';
      const selectedProvinces = ctx.session.advancedSearch.provinces;
      
      let provinceNames = '[]';
      if (selectedProvinces.length > 0) {
        const names = selectedProvinces.map((id: number) => {
          const province = PROVINCES.find(p => p.id === id);
          return province ? province.name : '';
        }).filter(Boolean);
        provinceNames = `[${names.join('، ')}]`;
      }

      const messageText = `👫 جنسیت : [${genderText}]\n\n🎌 استان های انتخاب شده : ${provinceNames}\n\nاستان های مورد نظرتو انتخاب کن و در آخر گزینه «➡️ مرحله بعدی » رو بزن 👇`;

      await ctx.editMessageText(
        messageText,
        provinceSelectionKeyboard(selectedProvinces, searchType)
      );
    } catch (error) {
      logger.error('Error showing province selection:', error);
      await ctx.reply('⚠️ خطا در نمایش استان‌ها');
    }
  }

  /**
   * مرحله 3: نمایش انتخاب بازه سنی
   */
  async showAgeRangeSelection(ctx: MyContext) {
    try {
      const state = ctx.session.advancedSearch;
      if (!state) return;

      const genderText = state.gender === 'male' ? 'پسر' : state.gender === 'female' ? 'دختر' : 'هردو';
      
      let provinceNames = '[]';
      if (state.provinces.length > 0) {
        if (state.provinces.length === PROVINCES.length) {
          provinceNames = '[همه استان‌ها]';
        } else {
          const names = state.provinces.map((id: number) => {
            const province = PROVINCES.find(p => p.id === id);
            return province ? province.name : '';
          }).filter(Boolean);
          provinceNames = `[${names.join('، ')}]`;
        }
      }

      const minAge = state.minAge !== null ? state.minAge : '❓';
      const maxAge = state.maxAge !== null ? state.maxAge : '❓';
      const agePrompt = state.minAge === null ? 'حداقل سن بازه رو انتخاب کن 👇' : 'حداکثر سن بازه رو انتخاب کن 👇';

      const messageText = `👫 جنسیت : [${genderText}]\n\n🎌 استان های انتخاب شده : ${provinceNames}\n👥 بازه سنی : [${minAge} - ${maxAge}]\n\n${agePrompt}`;

      await ctx.editMessageText(
        messageText,
        ageRangeKeyboard(state.minAge, state.maxAge, state.searchType)
      );
    } catch (error) {
      logger.error('Error showing age range selection:', error);
      await ctx.reply('⚠️ خطا در نمایش بازه سنی');
    }
  }

  /**
   * مرحله 4: نمایش انتخاب آخرین حضور
   */
  async showLastActivitySelection(ctx: MyContext) {
    try {
      const state = ctx.session.advancedSearch;
      if (!state) return;

      const genderText = state.gender === 'male' ? 'پسر' : state.gender === 'female' ? 'دختر' : 'هردو';
      
      let provinceNames = '[]';
      if (state.provinces.length > 0) {
        if (state.provinces.length === PROVINCES.length) {
          provinceNames = '[همه استان‌ها]';
        } else {
          const names = state.provinces.map((id: number) => {
            const province = PROVINCES.find(p => p.id === id);
            return province ? province.name : '';
          }).filter(Boolean);
          provinceNames = `[${names.join('، ')}]`;
        }
      }

      const ageRange = `[${state.minAge} - ${state.maxAge}]`;
      
      let activityText = '[]';
      if (state.lastActivity) {
        const activityMap: Record<string, string> = {
          '1h': 'تا یک ساعت قبل',
          '6h': 'تا ۶ ساعت قبل',
          '1d': 'تا یک روز قبل',
          '2d': 'تا دو روز قبل',
          '3d': 'تا سه روز قبل',
          'all': 'همه'
        };
        activityText = `[${activityMap[state.lastActivity]}]`;
      }

      const messageText = `👫 جنسیت : [${genderText}]\n\n🎌 استان های انتخاب شده : ${provinceNames}\n👥 بازه سنی : ${ageRange}\n👀 آخرین حضور : ${activityText}\n\nآخرین زمان حضور کاربر رو انتخاب کن 👇`;

      await ctx.editMessageText(
        messageText,
        lastActivityKeyboard(state.searchType)
      );
    } catch (error) {
      logger.error('Error showing last activity selection:', error);
      await ctx.reply('⚠️ خطا در نمایش آخرین حضور');
    }
  }

  /**
   * کاربران جدید - نمایش انتخاب جنسیت
   */
  async handleNewUsersSearch(ctx: MyContext) {
    try {
      await ctx.editMessageText(
        '🎌 چه کسایی رو نشونت بدم؟',
        genderSelectionKeyboard('search_new_users')
      );
    } catch (error) {
      logger.error('Error in new users search:', error);
      await ctx.reply('⚠️ خطا در جستجو');
    }
  }

  /**
   * کاربران بدون چت - نمایش انتخاب جنسیت
   */
  async handleNoChatsSearch(ctx: MyContext) {
    try {
      await ctx.editMessageText(
        '🎌 چه کسایی رو نشونت بدم؟',
        genderSelectionKeyboard('search_no_chats')
      );
    } catch (error) {
      logger.error('Error in no chats search:', error);
      await ctx.reply('⚠️ خطا در جستجو');
    }
  }

  /**
   * چت‌های اخیر - نمایش انتخاب جنسیت
   */
  async handleRecentChatsSearch(ctx: MyContext) {
    try {
      await ctx.editMessageText(
        '🎌 چه کسایی رو نشونت بدم؟',
        genderSelectionKeyboard('search_recent_chats')
      );
    } catch (error) {
      logger.error('Error in recent chats search:', error);
      await ctx.reply('⚠️ خطا در جستجو');
    }
  }

  /**
   * کاربران محبوب - نمایش انتخاب جنسیت
   */
  async handlePopularUsersSearch(ctx: MyContext) {
    try {
      await ctx.editMessageText(
        '🎌 چه کسایی رو نشونت بدم؟',
        genderSelectionKeyboard('search_popular')
      );
    } catch (error) {
      logger.error('Error in popular users search:', error);
      await ctx.reply('⚠️ خطا در جستجو');
    }
  }

  /**
   * پردازش ورودی کاربر برای جستجوی مخاطب خاص
   * این تابع از طریق message handler فراخوانی می‌شود
   */
  async processSpecificContactInput(ctx: MyContext) {
    const user = ctx.state.user;

    try {
      let targetUserId: number | null = null;
      let targetTelegramId: number | null = null;
      let targetUsername: string | null = null;

      // راه اول: Forward Message
      if (ctx.message && 'forward_from' in ctx.message && ctx.message.forward_from) {
        targetTelegramId = ctx.message.forward_from.id;
        targetUsername = ctx.message.forward_from.username || null;
        logger.info(`Forwarded message from telegram_id: ${targetTelegramId}, username: ${targetUsername}`);
      }
      // راه دوم و سوم: Text Input
      else if (ctx.message && 'text' in ctx.message) {
        const text = ctx.message.text.trim();
        
        // چک کردن آیا Custom ID است (مثل ID_MWBACI) - اولویت اول
        if (/^ID_[A-Z0-9]+$/i.test(text)) {
          const customId = text.toUpperCase();
          const result = await userSearchService.searchSpecificContact(user.id, customId);
          
          if (result) {
            targetUserId = result.id;
            logger.info(`Custom ID found: ${customId} -> user_id: ${targetUserId}`);
          } else {
            await ctx.reply(
              `❌ کاربری با آیدی \`${customId}\` یافت نشد.\n\n` +
              'لطفاً دوباره تلاش کنید یا از روش دیگری استفاده کنید.',
              {
                parse_mode: 'Markdown',
                ...backToSearchMenuKeyboard(),
              }
            );
            return;
          }
        }
        // چک کردن آیا عدد است (Telegram ID) - اولویت دوم
        // ابتدا اعداد فارسی/عربی را به انگلیسی تبدیل می‌کنیم
        const normalizedText = convertPersianToEnglishNumbers(text);
        if (/^\d+$/.test(normalizedText)) {
          targetTelegramId = parseInt(normalizedText);
          logger.info(`Telegram ID entered: ${targetTelegramId}`);
        }
        // چک کردن آیا username تلگرام است (با یا بدون @) - اولویت سوم
        else if (/^@?[a-zA-Z][a-zA-Z0-9_]{4,31}$/.test(text)) {
          targetUsername = text.replace('@', '');
          logger.info(`Username entered: @${targetUsername}`);
        }
        else {
          await ctx.reply(
            '⚠️ فرمت ورودی نامعتبر است.\n\n' +
            'لطفاً یکی از روش‌های زیر را انتخاب کنید:\n' +
            '• فوروارد پیام\n' +
            '• وارد کردن آیدی تلگرام (مثل: @username یا username)\n' +
            '• وارد کردن آیدی عددی (مثل: 123456789)\n' +
            '• وارد کردن آیدی کاربر (مثل: ID_MWBACI)',
            backToSearchMenuKeyboard()
          );
          return;
        }
      }

      // اگر username دریافت شد، کاربر را پیدا کن و telegram_id را به‌روز کن
      if (targetUsername && !targetUserId) {
        const targetUser = await userSearchService.findByUsername(targetUsername);
        
        if (targetUser) {
          targetUserId = targetUser.id;
          // به‌روزرسانی telegram_id در صورت تغییر
          if (targetUser.telegram_id && targetUser.telegram_id !== targetTelegramId) {
            logger.info(`Username @${targetUsername} found with telegram_id: ${targetUser.telegram_id}`);
          }
        } else {
          await ctx.reply(
            `❌ کاربری با آیدی تلگرام \`@${targetUsername}\` یافت نشد.\n\n` +
            'این کاربر هنوز عضو ربات نیست یا آیدی تلگرامش را تغییر داده است.',
            {
              parse_mode: 'Markdown',
              ...backToSearchMenuKeyboard(),
            }
          );
          delete ctx.session.searchState;
          return;
        }
      }

      // اگر telegram_id دریافت شد، کاربر را پیدا کن
      if (targetTelegramId && !targetUserId) {
        const targetUser = await userSearchService.findByTelegramId(targetTelegramId);
        
        if (targetUser) {
          targetUserId = targetUser.id;
        } else {
          await ctx.reply(
            '❌ این کاربر هنوز عضو ربات نیست.\n\n' +
            'ابتدا باید او را به ربات دعوت کنید.',
            backToSearchMenuKeyboard()
          );
          
          // پاک کردن state
          delete ctx.session.searchState;
          return;
        }
      }

      // اگر کاربر پیدا شد
      if (targetUserId) {
        // چک کردن اینکه کاربر خودش نباشد
        if (targetUserId === user.id) {
          await ctx.reply(
            '⚠️ نمی‌توانید با خودتان چت کنید!',
            backToSearchMenuKeyboard()
          );
          delete ctx.session.searchState;
          return;
        }

        // نمایش پروفایل کاربر
        const { profileHandlers } = await import('./profile.handler');
        await profileHandlers.showUserProfile(ctx, targetUserId);

        // پاک کردن state
        delete ctx.session.searchState;
        
        logger.info(`User ${user.id} found contact: ${targetUserId}`);
      } else {
        await ctx.reply(
          '❌ کاربر یافت نشد. لطفاً دوباره تلاش کنید.',
          backToSearchMenuKeyboard()
        );
      }

    } catch (error) {
      logger.error('Error processing specific contact input:', error);
      await ctx.reply('⚠️ خطا در پردازش اطلاعات', backToSearchMenuKeyboard());
      delete ctx.session.searchState;
    }
  }

  /**
   * پردازش انتخاب جنسیت و نمایش لیست
   */
  async handleGenderSelection(ctx: MyContext, searchType: string, gender: string) {
    const user = ctx.state.user;
    const page = 1;
    const limit = 10;

    try {
      // For advanced and specific search, go to province selection
      if (searchType === 'search_advanced' || searchType === 'search_specific') {
        await this.showProvinceSelection(ctx, searchType, gender);
        return;
      }

      // For other search types, proceed with immediate search
      let users: any[] = [];
      let totalCount = 0;
      const genderValue = gender === 'all' ? undefined : gender;

      // فراخوانی متد مناسب بر اساس نوع جستجو
      switch (searchType) {
        case 'search_same_province':
          users = await userSearchService.searchSameProvince(user.id, page, limit, genderValue);
          break;
        case 'search_same_age':
          users = await userSearchService.searchSameAge(user.id, page, limit, genderValue);
          break;
        case 'search_new_users':
          users = await userSearchService.searchNewUsers(user.id, page, limit, genderValue);
          break;
        case 'search_no_chats':
          users = await userSearchService.searchUsersWithoutChat(user.id, page, limit, genderValue);
          break;
        case 'search_recent_chats':
          users = await userSearchService.searchRecentChats(user.id, page, limit, genderValue);
          break;
        case 'search_popular':
          users = await userSearchService.searchPopularUsers(user.id, page, limit, genderValue);
          break;
        default:
          throw new Error(`Unknown search type: ${searchType}`);
      }

      totalCount = users.length;

      // تولید کد جستجو و ذخیره نتایج
      const searchCode = generateSearchCode(searchType, user.id);
      const userIds = users.map(u => u.id);
      await userSearchService.saveSearchResults(searchCode, user.id, searchType, userIds, genderValue);

      await this.showUserList(ctx, users, searchType, page, totalCount, genderValue, searchCode);

    } catch (error) {
      logger.error('Error handling gender selection:', error);
      await ctx.reply('⚠️ خطا در دریافت لیست', backToSearchMenuKeyboard());
    }
  }

  /**
   * پردازش تغییر صفحه در لیست کاربران
   */
  async handlePageChange(ctx: MyContext, searchType: string, page: number, gender?: string) {
    const user = ctx.state.user;
    const limit = 10;

    try {
      let users: any[] = [];
      let totalCount = 0;

      // فراخوانی متد مناسب بر اساس نوع جستجو
      switch (searchType) {
        case 'search_same_province':
          users = await userSearchService.searchSameProvince(user.id, page, limit, gender);
          break;
        case 'search_same_age':
          users = await userSearchService.searchSameAge(user.id, page, limit, gender);
          break;
        case 'search_new_users':
          users = await userSearchService.searchNewUsers(user.id, page, limit, gender);
          break;
        case 'search_no_chats':
          users = await userSearchService.searchUsersWithoutChat(user.id, page, limit, gender);
          break;
        case 'search_recent_chats':
          users = await userSearchService.searchRecentChats(user.id, page, limit, gender);
          break;
        case 'search_popular':
          users = await userSearchService.searchPopularUsers(user.id, page, limit, gender);
          break;
        default:
          throw new Error(`Unknown search type: ${searchType}`);
      }

      // TODO: دریافت تعداد کل
      totalCount = users.length;

      await this.showUserList(ctx, users, searchType, page, totalCount, gender);

    } catch (error) {
      logger.error('Error handling page change:', error);
      await ctx.reply('⚠️ خطا در دریافت لیست', backToSearchMenuKeyboard());
    }
  }

  /**
   * بازگشت به منوی جستجو
   */
  async backToSearchMenu(ctx: MyContext) {
    try {
      await ctx.editMessageText(
        '🔍 چه کسایی رو نشونت بدم؟ انتخاب کن',
        userSearchMenuKeyboard()
      );
    } catch (error) {
      // اگر پیام قابل ویرایش نبود، پیام جدید ارسال کن
      await this.showSearchMenu(ctx);
    }
  }

  /**
   * پردازش inline query برای نمایش کشویی کاربران
   */
  async handleInlineQuery(ctx: MyContext) {
    try {
      const query = ctx.inlineQuery?.query || '';
      
      // چک کردن فرمت query (باید search_TYPE_CODE باشد)
      if (!query.startsWith('search_')) {
        await ctx.answerInlineQuery([]);
        return;
      }

      // دریافت نتایج جستجو از دیتابیس
      const searchResults = await userSearchService.getSearchResults(query);
      
      if (!searchResults || searchResults.userIds.length === 0) {
        await ctx.answerInlineQuery([], {
          cache_time: 0,
          is_personal: true,
        });
        return;
      }

      // دریافت اطلاعات کاربران
      const users = await userSearchService.getUsersForInlineQuery(searchResults.userIds);

      // ساخت نتایج inline query
      const results = users.map((user, index) => {
        const displayName = user.display_name || user.first_name;
        const age = user.age || '❓';
        const gender = user.gender === 'female' ? '🙍' : user.gender === 'male' ? '🙎' : '👤';
        const province = user.province || 'نامشخص';
        const city = user.city ? `(${user.city})` : '';
        const likes = user.likes_count || 0;
        
        const lastActivity = user.last_activity ? new Date(user.last_activity) : null;
        const isOnline = user.is_online
          ? true
          : lastActivity
          ? isUserOnline(lastActivity)
          : false;
        const onlineStatusShort = isOnline ? '👀 آنلایـــن' : '💤 آفلایــن';
        const customId = user.custom_id || '';

        const title = `${gender} ${displayName} - ${age} سال`;
        const description = `${province}${city} | ❤️${likes} | ${onlineStatusShort}`;
        
        // متن پیامی که ارسال می‌شود
        const messageText = `${age} ${gender}${displayName} ${customId ? `/${customId}` : ''}\n${province}${city} | ❤️${likes}\n${onlineStatusShort}`;

        // اگر عکس پروفایل دارد
        if (user.photo_file_id) {
          return {
            type: 'photo' as const,
            id: `user_${user.id}_${index}`,
            photo_file_id: user.photo_file_id,
            title: title,
            description: description,
            caption: messageText,
            reply_markup: Markup.inlineKeyboard([
              [Markup.button.callback('👁 مشاهده پروفایل کامل', `view_profile_${user.id}`)],
            ]),
          };
        } else {
          // بدون عکس - article
          return {
            type: 'article' as const,
            id: `user_${user.id}_${index}`,
            title: title,
            description: description,
            input_message_content: {
              message_text: messageText,
            },
            reply_markup: Markup.inlineKeyboard([
              [Markup.button.callback('👁 مشاهده پروفایل کامل', `view_profile_${user.id}`)],
            ]),
          };
        }
      });

      await ctx.answerInlineQuery(results, {
        cache_time: 30, // 30 ثانیه cache
        is_personal: true,
      });

    } catch (error) {
      logger.error('Error handling inline query:', error);
      await ctx.answerInlineQuery([], { cache_time: 0 });
    }
  }

  /**
   * Handle province toggle (add/remove from selection)
   */
  async handleProvinceToggle(ctx: MyContext, searchType: string, provinceId: number) {
    try {
      if (!ctx.session.advancedSearch) return;

      const state = ctx.session.advancedSearch;
      const index = state.provinces.indexOf(provinceId);

      if (index > -1) {
        // Remove province
        state.provinces.splice(index, 1);
      } else {
        // Add province
        state.provinces.push(provinceId);
      }

      // Refresh the keyboard
      await this.showProvinceSelection(ctx, searchType, state.gender!);
    } catch (error) {
      logger.error('Error toggling province:', error);
    }
  }

  /**
   * Handle select all provinces
   */
  async handleSelectAllProvinces(ctx: MyContext, searchType: string) {
    try {
      if (!ctx.session.advancedSearch) return;

      const state = ctx.session.advancedSearch;
      
      if (state.provinces.length === PROVINCES.length) {
        // Deselect all
        state.provinces = [];
      } else {
        // Select all
        state.provinces = PROVINCES.map(p => p.id);
      }

      // Refresh the keyboard
      await this.showProvinceSelection(ctx, searchType, state.gender!);
    } catch (error) {
      logger.error('Error selecting all provinces:', error);
    }
  }

  /**
   * Handle age selection
   */
  async handleAgeSelection(ctx: MyContext, _searchType: string, age: number) {
    try {
      if (!ctx.session.advancedSearch) return;

      const state = ctx.session.advancedSearch;

      if (state.minAge === null) {
        // Set minimum age
        state.minAge = age;
      } else if (state.maxAge === null) {
        // Set maximum age
        state.maxAge = age;
        
        // Ensure minAge <= maxAge
        if (state.minAge > state.maxAge) {
          [state.minAge, state.maxAge] = [state.maxAge, state.minAge];
        }

        // Both ages selected, move to next step
        await this.showLastActivitySelection(ctx);
        return;
      } else {
        // Reset and set new minimum
        state.minAge = age;
        state.maxAge = null;
      }

      // Refresh the keyboard
      await this.showAgeRangeSelection(ctx);
    } catch (error) {
      logger.error('Error handling age selection:', error);
    }
  }

  /**
   * Handle select all ages
   */
  async handleSelectAllAges(ctx: MyContext) {
    try {
      if (!ctx.session.advancedSearch) return;

      const state = ctx.session.advancedSearch;
      state.minAge = 13;
      state.maxAge = 99;

      // Move to next step
      await this.showLastActivitySelection(ctx);
    } catch (error) {
      logger.error('Error selecting all ages:', error);
    }
  }

  /**
   * Handle last activity selection and show results
   */
  async handleActivitySelection(ctx: MyContext, _searchType: string, activity: string) {
    try {
      if (!ctx.session.advancedSearch) return;

      const state = ctx.session.advancedSearch;
      state.lastActivity = activity as any;

      // Now perform the search with all filters
      await this.performAdvancedSearch(ctx);
    } catch (error) {
      logger.error('Error handling activity selection:', error);
    }
  }

  /**
   * Perform advanced search with all filters
   */
  async performAdvancedSearch(ctx: MyContext) {
    try {
      const state = ctx.session.advancedSearch;
      if (!state) return;

      const user = ctx.state.user;
      const page = 1;
      const limit = 10;

      // Build filters
      const genderValue = state.gender === 'all' ? undefined : state.gender;
      const provinceIds = state.provinces.length === PROVINCES.length ? undefined : state.provinces;
      
      // Calculate activity timestamp
      let activitySince: Date | undefined;
      if (state.lastActivity && state.lastActivity !== 'all') {
        const now = new Date();
        switch (state.lastActivity) {
          case '1h':
            activitySince = new Date(now.getTime() - 1 * 60 * 60 * 1000);
            break;
          case '6h':
            activitySince = new Date(now.getTime() - 6 * 60 * 60 * 1000);
            break;
          case '1d':
            activitySince = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            break;
          case '2d':
            activitySince = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
            break;
          case '3d':
            activitySince = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
            break;
        }
      }

      // Debug logging
      logger.info('Advanced search filters:', {
        userId: user.id,
        gender: genderValue || 'all',
        minAge: state.minAge,
        maxAge: state.maxAge,
        provinceIds: provinceIds || 'all',
        activitySince: activitySince?.toISOString() || 'all',
        lastActivity: state.lastActivity
      });

      // Perform search
      const users = await userSearchService.advancedSearch(
        user.id,
        page,
        limit,
        genderValue,
        state.minAge!,
        state.maxAge!,
        provinceIds,
        activitySince
      );

      const totalCount = users.length;

      logger.info('Advanced search results:', {
        totalUsers: totalCount,
        userIds: users.map(u => u.id)
      });

      // Generate search code and save results
      const searchCode = generateSearchCode(state.searchType, user.id);
      const userIds = users.map(u => u.id);
      await userSearchService.saveSearchResults(searchCode, user.id, state.searchType, userIds, genderValue);

      await this.showUserList(ctx, users, state.searchType, page, totalCount, genderValue, searchCode);

    } catch (error) {
      logger.error('Error performing advanced search:', error);
      await ctx.reply('⚠️ خطا در جستجو', backToSearchMenuKeyboard());
    }
  }
}

export const userSearchHandlers = new UserSearchHandlers();