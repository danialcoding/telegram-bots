/**
 * محاسبه متن "آخرین بازدید" با threshold‌های زمانی دقیق
 * @param lastSeen - تاریخ آخرین فعالیت کاربر
 * @param isOnline - آیا کاربر آنلاین است؟ (طبق last_seen < 5 دقیقه)
 * @param hasActiveChat - آیا کاربر در چت فعال است؟
 * @returns متن وضعیت برای نمایش
 */
export function getLastSeenText(
  lastSeen: Date | string | null,
  isOnline: boolean,
  hasActiveChat?: boolean
): string {
  // اگر در چت فعال است
  if (hasActiveChat) {
    return "وضعیت هم‌اکنون 👀 🗣";
  }

  // اگر آنلاین است
  if (isOnline) {
    return "وضعیت هم‌اکنون 👀 آنلایـــن";
  }

  // اگر last_seen وجود ندارد
  if (!lastSeen) {
    return "وضعیت هم‌اکنون 👀 آفلایـــن";
  }

  // محاسبه اختلاف زمانی
  const diffMs = calculateTimeDiff(lastSeen);
  
  if (diffMs === null || diffMs < 0) {
    return "وضعیت هم‌اکنون 👀 آفلایـــن";
  }

  const diffMinutes = Math.floor(diffMs / (60 * 1000));
  const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

  // کمتر از 15 دقیقه: آفلاین
  if (diffMinutes < 15) {
    return "وضعیت هم‌اکنون 👀 آفلایـــن";
  }

  // بیشتر از 15 دقیقه و کمتر از 30 دقیقه
  if (diffMinutes < 30) {
    return "آخرین بازدید: 15 دقیقه پیش";
  }

  // بیشتر از 30 دقیقه و کمتر از 1 ساعت
  if (diffMinutes < 60) {
    return "آخرین بازدید: نیم ساعت پیش";
  }

  // بیشتر از 1 ساعت و کمتر از 24 ساعت (1 روز)
  if (diffHours < 24) {
    if (diffHours === 1) {
      return "آخرین بازدید: 1 ساعت پیش";
    }
    return `آخرین بازدید: ${diffHours} ساعت پیش`;
  }

  // بیشتر از 1 روز
  if (diffDays === 1) {
    return "آخرین بازدید: 1 روز پیش";
  }

  return `آخرین بازدید: ${diffDays} روز پیش`;
}

/**
 * بررسی آنلاین بودن کاربر (آخرین فعالیت کمتر از 5 دقیقه)
 */
export function isUserOnline(lastSeen: Date | string | null): boolean {
  if (!lastSeen) return false;
  
  const diffMs = calculateTimeDiff(lastSeen);
  if (diffMs === null) return false;
  
  // اگر کمتر از 5 دقیقه گذشته باشد، آنلاین است
  return diffMs >= 0 && diffMs < 5 * 60 * 1000;
}

/**
 * محاسبه اختلاف زمانی بین الان و یک timestamp
 * حالا که db.ts تنظیم شده، Date object ها درست از UTC parse می‌شوند
 */
function calculateTimeDiff(timestamp: Date | string | null): number | null {
  if (!timestamp) return null;

  let date: Date;

  // اگر از قبل Date object است (معمولاً از node-postgres می‌آید)
  if (timestamp instanceof Date) {
    if (Number.isNaN(timestamp.getTime())) return null;
    date = timestamp;
  } else {
    // اگر string است
    const raw = `${timestamp}`.trim();
    if (!raw) return null;

    // اگر timezone دارد، مستقیم parse کن
    if (/[Zz]|[+-]\d{2}:?\d{2}$/.test(raw)) {
      date = new Date(raw);
    } else {
      // اگر timezone ندارد، آن را UTC در نظر بگیر (چون PostgreSQL در UTC است)
      date = new Date(raw + 'Z');
    }

    if (Number.isNaN(date.getTime())) return null;
  }

  return Date.now() - date.getTime();
}

/**
 * تبدیل اعداد فارسی/عربی به انگلیسی
 * مثال: "۱۲۳" -> "123"
 */
export function convertPersianToEnglishNumbers(str: string): string {
  if (!str) return str;
  
  const persianNumbers = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  
  let result = str;
  
  for (let i = 0; i < 10; i++) {
    result = result.replace(new RegExp(persianNumbers[i], 'g'), String(i));
    result = result.replace(new RegExp(arabicNumbers[i], 'g'), String(i));
  }
  
  return result;
}

/**
 * Parse عدد با پشتیبانی از اعداد فارسی/عربی
 */
export function parseIntPersian(str: string): number {
  return parseInt(convertPersianToEnglishNumbers(str), 10);
}
