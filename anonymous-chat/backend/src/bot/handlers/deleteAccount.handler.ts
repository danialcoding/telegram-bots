import { MyContext } from "../../types/bot.types";
import { deleteAccountInitialKeyboard, deleteAccountConfirmKeyboard } from "../keyboards/deleteAccount.keyboard";
import logger from "../../utils/logger";
import pool from "../../database/db";
import { DELETE_ACCOUNT_COST } from "../../utils/constants";
import * as coinService from "../../services/coin.service";

class DeleteAccountHandler {
  /**
   * نمایش منوی اولیه حذف اکانت
   */
  async showDeleteAccountMenu(ctx: MyContext) {
    try {
      const messageText = `👈 اگر میخواهید از ربات بصورت کامل خارج شوید و کل اطلاعات ذخیره شده شما حذف شود

با پرداخت هزینه ${DELETE_ACCOUNT_COST} سکه کل اطلاعات شما از ربات حذف میشود و شما دیگر اکانتی داخل ربات نخواهید داشت.
بعد پرداخت بطور خودکار اکانت شما حذف میشود 👇`;

      await ctx.reply(messageText, deleteAccountInitialKeyboard());
    } catch (error) {
      logger.error('Error showing delete account menu:', error);
      await ctx.reply('⚠️ خطا در نمایش منو');
    }
  }

  /**
   * مرحله پرداخت - نمایش صفحه تایید
   */
  async handlePaymentStep(ctx: MyContext) {
    try {
      const user = ctx.state.user;

      // بررسی موجودی کاربر
      const result = await pool.query(
        'SELECT balance FROM coins WHERE user_id = $1',
        [user.id]
      );

      const coinBalance = result.rows[0]?.balance || 0;

      if (coinBalance < DELETE_ACCOUNT_COST) {
        await ctx.answerCbQuery(`⚠️ موجودی شما کافی نیست. موجودی فعلی: ${coinBalance} سکه`);
        return;
      }

      const messageText = `⚠️ آیا از حذف اکانت خود مطمئن هستید؟

🔻 با تایید، ${DELETE_ACCOUNT_COST} سکه از حساب شما کسر شده و تمام اطلاعات شما حذف خواهد شد.
🔻 این عملیات غیرقابل بازگشت است!`;

      await ctx.editMessageText(messageText, deleteAccountConfirmKeyboard());
      await ctx.answerCbQuery();
    } catch (error) {
      logger.error('Error in payment step:', error);
      await ctx.answerCbQuery('⚠️ خطا در پردازش');
    }
  }

  /**
   * تایید نهایی و حذف اکانت
   */
  async confirmDeleteAccount(ctx: MyContext) {
    try {
      const user = ctx.state.user;
      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        // بررسی موجودی مجدد
        const balanceResult = await client.query(
          'SELECT balance FROM coins WHERE user_id = $1',
          [user.id]
        );

        const coinBalance = balanceResult.rows[0]?.balance || 0;

        if (coinBalance < DELETE_ACCOUNT_COST) {
          await client.query('ROLLBACK');
          await ctx.answerCbQuery('⚠️ موجودی کافی نیست');
          return;
        }

        // کسر سکه
        await coinService.deductCoins(user.id, DELETE_ACCOUNT_COST, 'spend', 'حذف اکانت');

        // حذف داده‌های کاربر
        // حذف پیام‌ها
        await client.query('DELETE FROM messages WHERE sender_id = $1 OR receiver_id = $1', [user.id]);
        
        // حذف چت‌ها
        await client.query('DELETE FROM chats WHERE user1_id = $1 OR user2_id = $1', [user.id]);
        
        // حذف درخواست‌های چت
        await client.query('DELETE FROM chat_requests WHERE sender_id = $1 OR receiver_id = $1', [user.id]);
        
        // حذف بلاک‌ها
        await client.query('DELETE FROM blocks WHERE blocker_id = $1 OR blocked_id = $1', [user.id]);
        
        // حذف لایک‌ها
        await client.query('DELETE FROM likes WHERE liker_id = $1 OR liked_id = $1', [user.id]);
        
        // حذف گزارش‌ها
        await client.query('DELETE FROM reports WHERE reporter_id = $1 OR reported_id = $1', [user.id]);
        
        // حذف تراکنش‌های سکه
        await client.query('DELETE FROM coin_transactions WHERE user_id = $1', [user.id]);
        
        // حذف سکه‌ها
        await client.query('DELETE FROM coins WHERE user_id = $1', [user.id]);
        
        // حذف پروفایل
        await client.query('DELETE FROM profiles WHERE user_id = $1', [user.id]);
        
        // حذف کاربر
        await client.query('DELETE FROM users WHERE id = $1', [user.id]);

        await client.query('COMMIT');

        await ctx.editMessageText('✅ اکانت شما با موفقیت حذف شد.\n\n👋 امیدواریم دوباره شما را ببینیم!');
        await ctx.answerCbQuery('✅ اکانت حذف شد');

        logger.info(`User ${user.telegram_id} deleted their account`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Error deleting account:', error);
      await ctx.answerCbQuery('⚠️ خطا در حذف اکانت');
    }
  }

  /**
   * لغو عملیات حذف اکانت
   */
  async cancelDeleteAccount(ctx: MyContext) {
    try {
      await ctx.editMessageText('❌ عملیات حذف اکانت لغو شد.');
      await ctx.answerCbQuery('لغو شد');
    } catch (error) {
      logger.error('Error cancelling delete account:', error);
      await ctx.answerCbQuery('⚠️ خطا');
    }
  }
}

export const deleteAccountHandler = new DeleteAccountHandler();
