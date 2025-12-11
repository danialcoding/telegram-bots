import { MyContext } from "../types/bot.types";
import { userSearchService } from "../../services/userSearch.service";
import { userSearchMenuKeyboard, backToSearchMenuKeyboard, genderSelectionKeyboard, userListKeyboard } from "../keyboards/userSearch.keyboard";
import { mainMenuKeyboard } from "../keyboards/main.keyboard";
import logger from "../../utils/logger";
import { isUserOnline, convertPersianToEnglishNumbers } from "../../utils/helpers";
import { Markup } from "telegraf";
import { generateSearchCode, formatUserDisplay, getSearchTitle, formatSearchDateTime } from "../helpers/userList.helper";

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
   * جستجوی پیشرفته
   */
  async handleAdvancedSearch(ctx: MyContext) {
    try {
      // TODO: پیاده‌سازی فرم جستجوی پیشرفته
      await ctx.editMessageText(
        '🔎 *جستجوی پیشرفته*\n\nاین بخش به زودی فعال می‌شود...',
        {
          parse_mode: 'Markdown',
          ...backToSearchMenuKeyboard(),
        }
      );
    } catch (error) {
      logger.error('Error in advanced search:', error);
      await ctx.reply('⚠️ خطا در جستجو');
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
   * جستجوی مخاطب خاص
   */
  async handleSpecificContactSearch(ctx: MyContext) {
    try {
      await ctx.editMessageText(
        '📞 *به مخاطب خاص وصلم کن*\n\n' +
        'برای اینکه بتونم به مخاطب خاصت بطور ناشناس وصلت کنم، یکی از کارای زیر رو انجام بده:\n\n' +
        '👈 *راه اول:* یه پیام متنی از کسی که می‌خوای بهش پیام ناشناس بفرستی رو الان به این ربات فوروارد کن تا ببینم عضو هست یا نه!\n\n' +
        '👈 *راه دوم:* آیدی تلگرام (username@) مخاطبت رو ارسال کن توی ربات، تا ببینیم عضو ربات هست یا نه!\n\n' +
        '👈 *راه سوم:* آیدی‌عددی (id number) اون شخص رو الان وارد ربات کن!\n\n' +
        '_(در روش اول لازمه مخاطبت دسترسی بات‌ها به دیدن حسابش از طریق فوروارد پیام رو نبسته باشه)_',
        {
          parse_mode: 'Markdown',
          ...backToSearchMenuKeyboard(),
        }
      );

      // ذخیره state برای دریافت اطلاعات از کاربر
      ctx.session.searchState = { type: 'specific_contact' };
    } catch (error) {
      logger.error('Error in specific contact search:', error);
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
}

export const userSearchHandlers = new UserSearchHandlers();