// src/services/chat.service.ts
import { pool } from '../database/db';
import { Context, Markup } from 'telegraf';
import { CustomError } from '../utils/errors';
import { coinService } from './coin.service';
import { profileService } from './profile.service';
import { userService } from './user.service';
import { COIN_COSTS, COIN_REWARDS } from '../utils/constants';

interface ActiveChat {
  id: number;
  user1_id: number;
  user2_id: number;
  chat_type: 'random' | 'gender_specific' | 'custom';
  status: 'active' | 'ended';
  message_count: number;
  user1_message_count: number;
  user2_message_count: number;
  started_at: Date;
  ended_at: Date | null;
}

interface ChatMessage {
  id: number;
  chat_id: number;
  sender_id: number;
  message_text: string | null;
  message_type: 'text' | 'photo' | 'video' | 'voice' | 'document' | 'sticker';
  file_id: string | null;
  created_at: Date;
}

class ChatService {
  /**
   * بررسی اینکه آیا کاربر در چت فعال است
   */
  async isUserInActiveChat(userId: number): Promise<boolean> {
    const result = await pool.query(
      `SELECT id FROM active_chats 
       WHERE (user1_id = $1 OR user2_id = $1) AND status = 'active'`,
      [userId]
    );

    return result.rows.length > 0;
  }

  /**
   * دریافت چت فعال کاربر
   */
  async getUserActiveChat(userId: number): Promise<ActiveChat | null> {
    const result = await pool.query(
      `SELECT * FROM active_chats 
       WHERE (user1_id = $1 OR user2_id = $1) AND status = 'active'`,
      [userId]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * شروع چت رندم
   */
  async startRandomChat(ctx: Context): Promise<void> {
    const userId = ctx.from!.id;
    const user = await userService.findUserByTelegramId(userId);
    const profile = await profileService.getProfileByUserId(user.id);

    if (!profile) {
      return ctx.reply('❌ لطفا ابتدا پروفایل خود را تکمیل کنید.');
    }

    // بررسی چت فعال
    const inActiveChat = await this.isUserInActiveChat(user.id);
    if (inActiveChat) {
      return ctx.reply('❌ شما هم‌اکنون در یک چت فعال هستید.');
    }

    await ctx.reply('🔍 در حال جستجوی کاربر...');

    // جستجوی شریک تصادفی
    const partner = await this.findRandomPartner(user.id);

    if (!partner) {
      return ctx.reply(
        '😔 متاسفانه در حال حاضر کاربری یافت نشد.\n' +
        'لطفا بعداً دوباره تلاش کنید.'
      );
    }

    // ایجاد چت
    await this.createChat(user.id, partner.user_id, 'random');

    // ارسال پیام به هر دو طرف
    await ctx.reply(
      '✅ اتصال برقرار شد!\n\n' +
      '💬 می‌توانید شروع به گفتگو کنید.\n' +
      '❌ برای پایان چت از دکمه "پایان چت" استفاده کنید.',
      Markup.keyboard([
        ['❌ پایان چت', '🚫 گزارش'],
        ['🔙 بازگشت به منو']
      ]).resize()
    );

    await ctx.telegram.sendMessage(
      partner.telegram_id,
      '✅ یک نفر به شما متصل شد!\n\n' +
      '💬 می‌توانید شروع به گفتگو کنید.\n' +
      '❌ برای پایان چت از دکمه "پایان چت" استفاده کنید.',
      Markup.keyboard([
        ['❌ پایان چت', '🚫 گزارش'],
        ['🔙 بازگشت به منو']
      ]).resize()
    );
  }

  /**
   * شروع چت بر اساس جنسیت
   */
  async startGenderSpecificChat(
    ctx: Context,
    targetGender: 'male' | 'female'
  ): Promise<void> {
    const userId = ctx.from!.id;
    const user = await userService.findUserByTelegramId(userId);
    const profile = await profileService.getProfileByUserId(user.id);

    if (!profile) {
      return ctx.reply('❌ لطفا ابتدا پروفایل خود را تکمیل کنید.');
    }

    // بررسی چت فعال
    const inActiveChat = await this.isUserInActiveChat(user.id);
    if (inActiveChat) {
      return ctx.reply('❌ شما هم‌اکنون در یک چت فعال هستید.');
    }

    // محاسبه هزینه
    let cost = 0;
    
    if (targetGender === 'female') {
      cost = COIN_COSTS.MALE_TO_FEMALE_CONNECTION; // 2 سکه
    } else {
      cost = profile.gender === 'male' 
        ? COIN_COSTS.MALE_TO_MALE_CONNECTION // 1 سکه
        : COIN_COSTS.FEMALE_TO_MALE_CONNECTION; // 1 سکه
    }

    // بررسی موجودی
    if (cost > 0) {
      const hasEnough = await coinService.hasEnoughCoins(user.id, cost);
      if (!hasEnough) {
        return ctx.reply(
          `❌ موجودی شما کافی نیست. برای این اتصال به ${cost} سکه نیاز دارید.\n\n` +
          `💰 موجودی فعلی: ${await coinService.getBalance(user.id)} سکه\n\n` +
          `برای خرید سکه از منوی اصلی گزینه "💰 خرید سکه" را انتخاب کنید.`
        );
      }
    }

    await ctx.reply('🔍 در حال جستجوی کاربر مناسب...');

    // جستجوی شریک
    const partner = await this.findAvailablePartner(user.id, targetGender);

    if (!partner) {
      return ctx.reply(
        '😔 متاسفانه در حال حاضر کاربری با این مشخصات یافت نشد.\n' +
        'لطفا بعداً دوباره تلاش کنید.'
      );
    }

    // کسر هزینه
    if (cost > 0) {
      await coinService.deductCoins(
        user.id,
        cost,
        'spend',
        `اتصال به ${targetGender === 'female' ? 'دختر' : 'پسر'}`,
        null
      );
    }

    // ایجاد چت
    await this.createChat(user.id, partner.user_id, 'gender_specific');

    // اطلاع‌رسانی
    await ctx.reply(
      '✅ اتصال برقرار شد!\n\n' +
      '💬 می‌توانید شروع به گفتگو کنید.',
      Markup.keyboard([
        ['❌ پایان چت', '🚫 گزارش'],
        ['🔙 بازگشت به منو']
      ]).resize()
    );

    await ctx.telegram.sendMessage(
      partner.telegram_id,
      '✅ یک نفر به شما متصل شد!\n\n💬 می‌توانید شروع به گفتگو کنید.',
      Markup.keyboard([
        ['❌ پایان چت', '🚫 گزارش'],
        ['🔙 بازگشت به منو']
      ]).resize()
    );
  }

  /**
   * جستجوی شریک تصادفی
   */
  private async findRandomPartner(userId: number): Promise<any> {
    const result = await pool.query(
      `SELECT p.*, u.telegram_id
       FROM profiles p
       JOIN users u ON p.user_id = u.id
       LEFT JOIN active_chats ac ON (ac.user1_id = p.user_id OR ac.user2_id = p.user_id) AND ac.status = 'active'
       WHERE p.user_id != $1 
         AND u.is_blocked = false
         AND ac.id IS NULL
         AND p.is_online = true
       ORDER BY RANDOM()
       LIMIT 1`,
      [userId]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * جستجوی شریک بر اساس جنسیت
   */
  private async findAvailablePartner(userId: number, gender: string): Promise<any> {
    const result = await pool.query(
      `SELECT p.*, u.telegram_id
       FROM profiles p
       JOIN users u ON p.user_id = u.id
       LEFT JOIN active_chats ac ON (ac.user1_id = p.user_id OR ac.user2_id = p.user_id) AND ac.status = 'active'
       WHERE p.user_id != $1 
         AND p.gender = $2
         AND u.is_blocked = false
         AND ac.id IS NULL
         AND p.is_online = true
       ORDER BY RANDOM()
       LIMIT 1`,
      [userId, gender]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * ایجاد چت جدید
   */
  async createChat(
    user1Id: number,
    user2Id: number,
    chatType: 'random' | 'gender_specific' | 'custom'
  ): Promise<ActiveChat> {
    const result = await pool.query(
      `INSERT INTO active_chats 
       (user1_id, user2_id, chat_type, status, message_count, user1_message_count, user2_message_count)
       VALUES ($1, $2, $3, 'active', 0, 0, 0)
       RETURNING *`,
      [user1Id, user2Id, chatType]
    );

    return result.rows[0];
  }

  /**
   * ذخیره پیام چت
   */
  async saveMessage(
    chatId: number,
    senderId: number,
    messageText: string | null,
    messageType: string,
    fileId: string | null = null
  ): Promise<ChatMessage> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // ذخیره پیام
      const messageResult = await client.query(
        `INSERT INTO chat_messages 
         (chat_id, sender_id, message_text, message_type, file_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [chatId, senderId, messageText, messageType, fileId]
      );

      // به‌روزرسانی تعداد پیام‌ها
      const chat = await client.query(
        'SELECT * FROM active_chats WHERE id = $1',
        [chatId]
      );

      const isUser1 = chat.rows[0].user1_id === senderId;
      const updateField = isUser1 ? 'user1_message_count' : 'user2_message_count';

      await client.query(
        `UPDATE active_chats 
         SET message_count = message_count + 1,
             ${updateField} = ${updateField} + 1
         WHERE id = $1`,
        [chatId]
      );

      // بررسی پاداش 30 پیام برای دختران
      await this.checkMessageReward(client, chatId, senderId);

      await client.query('COMMIT');
      return messageResult.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * بررسی و اعطای پاداش 30 پیام
   */
  private async checkMessageReward(client: any, chatId: number, senderId: number): Promise<void> {
    const chat = await client.query(
      'SELECT * FROM active_chats WHERE id = $1',
      [chatId]
    );

    const chatData = chat.rows[0];
    const totalMessages = chatData.message_count;

    // هر 30 پیام یکبار پاداش
    if (totalMessages % 30 === 0) {
      // بررسی جنسیت هر دو طرف
      const user1Profile = await client.query(
        'SELECT gender FROM profiles WHERE user_id = $1',
        [chatData.user1_id]
      );

      const user2Profile = await client.query(
        'SELECT gender FROM profiles WHERE user_id = $1',
        [chatData.user2_id]
      );

      const user1Gender = user1Profile.rows[0]?.gender;
      const user2Gender = user2Profile.rows[0]?.gender;

      // پاداش فقط به دختر در چت با پسر
      if (user1Gender === 'female' && user2Gender === 'male') {
        await coinService.rewardFemale30Messages(chatData.user1_id, chatId);
      } else if (user2Gender === 'female' && user1Gender === 'male') {
        await coinService.rewardFemale30Messages(chatData.user2_id, chatId);
      }
    }
  }

  /**
   * پایان چت
   */
  async endChat(userId: number): Promise<void> {
    const chat = await this.getUserActiveChat(userId);

    if (!chat) {
      throw new CustomError('شما در حال حاضر در چتی نیستید.', 400);
    }

    await pool.query(
      `UPDATE active_chats 
       SET status = 'ended', ended_at = NOW()
       WHERE id = $1`,
      [chat.id]
    );
  }

  /**
   * دریافت تاریخچه چت‌ها
   */
  async getChatHistory(userId: number, limit: number = 20): Promise<ActiveChat[]> {
    const result = await pool.query(
      `SELECT * FROM active_chats 
       WHERE (user1_id = $1 OR user2_id = $1) AND status = 'ended'
       ORDER BY ended_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    return result.rows;
  }

  /**
   * دریافت پیام‌های یک چت
   */
  async getChatMessages(chatId: number, limit: number = 100): Promise<ChatMessage[]> {
    const result = await pool.query(
      `SELECT * FROM chat_messages 
       WHERE chat_id = $1 
       ORDER BY created_at ASC
       LIMIT $2`,
      [chatId, limit]
    );

    return result.rows;
  }
}

export const chatService = new ChatService();
