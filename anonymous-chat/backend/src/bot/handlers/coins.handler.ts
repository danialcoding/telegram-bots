import { Context } from "telegraf";
import { Markup } from "telegraf";
import coinService from "../../services/coin.service";
import logger from "../../utils/logger";

/**
 * کیبوردهای مربوط به سکه
 */
const coinsKeyboards = {
  packages: () =>
    Markup.inlineKeyboard([
      [Markup.button.callback("💎 50 سکه - 10,000 تومان", "coin_buy_50")],
      [Markup.button.callback("💎 100 سکه - 18,000 تومان", "coin_buy_100")],
      [Markup.button.callback("💎 200 سکه - 35,000 تومان", "coin_buy_200")],
      [Markup.button.callback("💎 500 سکه - 80,000 تومان", "coin_buy_500")],
      [Markup.button.callback("💎 1000 سکه - 150,000 تومان", "coin_buy_1000")],
      [Markup.button.callback("🔙 بازگشت", "main_menu")],
    ]),

  payment: (packageId: string, amount: number) =>
    Markup.inlineKeyboard([
      [
        Markup.button.url(
          "💳 پرداخت کنید",
          `https://pay.example.com/${packageId}`
        ),
      ],
      [Markup.button.callback("✅ پرداخت کردم", `coin_verify_${packageId}`)],
      [Markup.button.callback("❌ انصراف", "coin_cancel")],
    ]),
};

/**
 * تعریف پکیج‌های سکه
 */
const coinPackages = {
  "50": { coins: 50, price: 10000, discount: 0 },
  "100": { coins: 100, price: 18000, discount: 10 },
  "200": { coins: 200, price: 35000, discount: 12 },
  "500": { coins: 500, price: 80000, discount: 20 },
  "1000": { coins: 1000, price: 150000, discount: 25 },
};

/**
 * Coins Handlers
 */
class CoinsHandlers {
  /**
   * مدیریت اکشن‌های سکه
   */
  async handleActions(ctx: Context) {
    if (!ctx.callbackQuery || !("data" in ctx.callbackQuery)) return;

    const action = ctx.callbackQuery.data;
    const user = ctx.state.user;

    try {
      await ctx.answerCbQuery();

      // نمایش صفحه اصلی سکه‌ها
      if (action === "coins_menu") {
        return await this.showCoinsMenu(ctx);
      }

      // خرید پکیج
      if (action.startsWith("coin_buy_")) {
        const packageAmount = action.replace("coin_buy_", "");
        return await this.initiatePurchase(ctx, packageAmount);
      }

      // تایید پرداخت
      if (action.startsWith("coin_verify_")) {
        const packageAmount = action.replace("coin_verify_", "");
        return await this.verifyPayment(ctx, packageAmount);
      }

      // انصراف از خرید
      if (action === "coin_cancel") {
        await ctx.editMessageText("❌ خرید لغو شد.");
        return;
      }

      // تاریخچه تراکنش‌ها
      if (action === "coin_history") {
        return await this.showHistory(ctx);
      }

      // دعوت دوستان
      if (action === "coin_invite") {
        return await this.showInviteLink(ctx);
      }
    } catch (error) {
      logger.error("❌ Coins action error:", error);
      await ctx.reply("⚠️ خطایی رخ داد.");
    }
  }

  /**
   * مدیریت پرداخت
   * این متد برای compatibility با bot/index.ts اضافه شده
   */
  async handlePayment(ctx: Context) {
    return this.handleActions(ctx);
  }

  /**
   * نمایش منوی سکه‌ها
   */
  private async showCoinsMenu(ctx: Context) {
    const user = ctx.state.user;

    const menuText =
      `💰 موجودی سکه شما: ${user.coins}\n\n` +
      `🎁 برای هر دوست که دعوت کنید، هر دو 50 سکه دریافت می‌کنید!\n\n` +
      `📦 پکیج‌های سکه:`;

    await ctx.editMessageText(menuText, coinsKeyboards.packages());
  }

  /**
   * شروع فرآیند خرید
   */
  private async initiatePurchase(ctx: Context, packageAmount: string) {
    const user = ctx.state.user;
    const pkg = coinPackages[packageAmount as keyof typeof coinPackages];

    if (!pkg) {
      return await ctx.reply("⚠️ پکیج نامعتبر است.");
    }

    try {
      // ایجاد تراکنش
      const transaction = await coinService.createTransaction({
        user_id: user.id,
        type: "purchase",
        amount: pkg.coins,
        price: pkg.price,
      });

      // ذخیره در session برای تایید بعدی
      ctx.session.pendingPurchase = {
        transactionId: transaction.id,
        packageAmount,
        coins: pkg.coins,
        price: pkg.price,
      };

      const purchaseText =
        `💎 پکیج ${pkg.coins} سکه\n` +
        `💵 قیمت: ${pkg.price.toLocaleString("fa-IR")} تومان\n` +
        `${pkg.discount > 0 ? `🎉 ${pkg.discount}% تخفیف\n` : ""}` +
        `\n` +
        `📌 شماره تراکنش: ${transaction.id}\n\n` +
        `لطفا روی دکمه زیر کلیک کنید و پرداخت را انجام دهید.\n` +
        `بعد از پرداخت، دکمه "✅ پرداخت کردم" را بزنید.`;

      await ctx.editMessageText(
        purchaseText,
        coinsKeyboards.payment(transaction.id, pkg.price)
      );
    } catch (error) {
      logger.error("❌ Initiate purchase error:", error);
      await ctx.reply("⚠️ خطا در ایجاد تراکنش.");
    }
  }

  /**
   * تایید پرداخت (شبیه‌سازی - باید با درگاه واقعی یکپارچه شود)
   */
  private async verifyPayment(ctx: Context, packageAmount: string) {
    const user = ctx.state.user;
    const pendingPurchase = ctx.session.pendingPurchase;

    if (!pendingPurchase || pendingPurchase.packageAmount !== packageAmount) {
      return await ctx.reply("⚠️ تراکنشی برای تایید وجود ندارد.");
    }

    try {
      // TODO: یکپارچه‌سازی با درگاه پرداخت واقعی
      // در اینجا فرض می‌کنیم پرداخت موفق بوده است

      // شبیه‌سازی: چک کردن وضعیت پرداخت از درگاه
      const paymentSuccessful = await this.checkPaymentStatus(
        pendingPurchase.transactionId
      );

      if (paymentSuccessful) {
        // به‌روزرسانی تراکنش و اضافه کردن سکه
        await coinService.confirmTransaction(
          pendingPurchase.transactionId,
          "completed",
          "FAKE_REF_12345" // شماره پیگیری از درگاه
        );

        await coinService.addCoins(
          user.id,
          pendingPurchase.coins,
          "purchase",
          `خرید ${pendingPurchase.coins} سکه`
        );

        // پاک کردن session
        delete ctx.session.pendingPurchase;

        await ctx.editMessageText(
          `✅ پرداخت موفق!\n\n` +
            `💎 ${pendingPurchase.coins} سکه به حساب شما اضافه شد.\n` +
            `💰 موجودی جدید: ${user.coins + pendingPurchase.coins}`
        );

        logger.info("Purchase completed:", {
          userId: user.id,
          coins: pendingPurchase.coins,
          price: pendingPurchase.price,
        });
      } else {
        await ctx.reply(
          "❌ پرداخت هنوز تایید نشده است.\n" +
            "لطفا کمی صبر کنید و دوباره امتحان کنید."
        );
      }
    } catch (error) {
      logger.error("❌ Verify payment error:", error);
      await ctx.reply("⚠️ خطا در تایید پرداخت.");
    }
  }

  /**
   * چک کردن وضعیت پرداخت (شبیه‌سازی)
   * TODO: باید با API درگاه پرداخت یکپارچه شود
   */
  private async checkPaymentStatus(transactionId: string): Promise<boolean> {
    // شبیه‌سازی: در واقعیت باید به API درگاه پرداخت زده شود
    // مثال: await paymentGateway.verify(transactionId)

    // فعلا همیشه true برمی‌گردانیم (برای تست)
    return true;
  }

  /**
   * نمایش تاریخچه تراکنش‌ها
   */
  private async showHistory(ctx: Context) {
    const user = ctx.state.user;

    try {
      const transactions = await coinService.getTransactionHistory(user.id, 10);

      if (transactions.length === 0) {
        return await ctx.reply("📝 هیچ تراکنشی یافت نشد.");
      }

      let historyText = "📊 تاریخچه تراکنش‌های شما:\n\n";

      transactions.forEach((tx, index) => {
        const typeEmoji =
          tx.type === "purchase"
            ? "🛒"
            : tx.type === "earned"
            ? "🎁"
            : tx.type === "spent"
            ? "💸"
            : "💰";

        const amountText =
          tx.type === "spent" ? `-${tx.amount}` : `+${tx.amount}`;

        historyText +=
          `${index + 1}. ${typeEmoji} ${amountText} سکه\n` +
          `   📅 ${new Date(tx.created_at).toLocaleDateString("fa-IR")}\n` +
          `   📝 ${tx.description || "بدون توضیح"}\n\n`;
      });

      await ctx.reply(historyText);
    } catch (error) {
      logger.error("❌ Show history error:", error);
      await ctx.reply("⚠️ خطا در دریافت تاریخچه.");
    }
  }

  /**
   * نمایش لینک دعوت
   */
  private async showInviteLink(ctx: Context) {
    const user = ctx.state.user;

    const botUsername = ctx.botInfo?.username || "YourBotUsername";
    const inviteLink = `https://t.me/${botUsername}?start=ref_${user.id}`;

    const inviteText =
      `🎁 دعوت از دوستان\n\n` +
      `برای هر دوستی که از طریق لینک شما ثبت‌نام کند:\n` +
      `• شما 50 سکه دریافت می‌کنید 🎉\n` +
      `• دوست شما هم 50 سکه دریافت می‌کند 🎊\n\n` +
      `🔗 لینک دعوت شما:\n` +
      `${inviteLink}\n\n` +
      `👥 تعداد دعوت‌های شما: ${user.referral_count || 0}`;

    await ctx.reply(
      inviteText,
      Markup.inlineKeyboard([
        [
          Markup.button.url(
            "📤 اشتراک‌گذاری",
            `https://t.me/share/url?url=${encodeURIComponent(inviteLink)}`
          ),
        ],
        [Markup.button.callback("🔙 بازگشت", "coins_menu")],
      ])
    );
  }
}

export const coinsHandlers = new CoinsHandlers();
