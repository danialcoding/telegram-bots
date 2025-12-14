import crypto from 'crypto';
import { getProvinceById, getCityById } from '../../utils/locations';
import { profileService } from '../../services/profile.service';
import { getLastSeenText, isUserOnline, getChatStatusText } from '../../utils/helpers';

/**
 * محاسبه فاصله بین دو نقطه جغرافیایی (فرمول Haversine)
 * @returns فاصله به کیلومتر
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // شعاع زمین به کیلومتر
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return Math.round(distance * 10) / 10; // گرد کردن به یک رقم اعشار
}

/**
 * تولید کد منحصر به فرد برای جستجو
 * Format: search_[TYPE]_[RANDOM]
 */
export function generateSearchCode(searchType: string, userId: number): string {
  const random = crypto.randomBytes(3).toString('base64').replace(/[/+=]/g, '').substring(0, 5);
  return `search_${searchType}_${random}`;
}

/**
 * فرمت کردن اطلاعات کاربر برای نمایش در لیست
 */
export async function formatUserDisplay(user: any, myUserId: number): Promise<string> {
  const displayName = user.display_name || user.first_name;
  const age = user.age || '❓';
  const gender = user.gender === 'female' ? '🙍‍♀️' : user.gender === 'male' ? '🙍‍♂️' : '👤';
  const customId = user.custom_id ? `/user_${user.custom_id}` : '';
  const province = getProvinceById(user.province)?.name || 'نامشخص';
  const city = getCityById(user.city, user.province)?.name || 'نامشخص';
  const location = city ? `${province}(${city})` : province;
  const likes = user.likes_count || 0;
  
  // وضعیت آنلاین با بررسی دقیق
  const lastActivity = user.last_activity ? new Date(user.last_activity) : null;
  const isOnline = user.is_online
    ? true
    : lastActivity
    ? isUserOnline(lastActivity)
    : false;
  const onlineStatus = getLastSeenText(lastActivity, isOnline);
  
  // وضعیت چت (جدا از وضعیت آنلاین)
  const hasActiveChat = user.has_active_chat || false;
  const chatStatus = getChatStatusText(hasActiveChat);

  // ✅ محاسبه فاصله اگر هر دو کاربر موقعیت دارند
  let locationInfo = "";
  
  if (!user.latitude || !user.longitude) {
    // کاربر مقابل موقعیت ندارد
    locationInfo = "❓";
  } else {
    // کاربر مقابل موقعیت دارد
    const myProfile = await profileService.getProfile(myUserId);
    
    if (myProfile?.latitude && myProfile?.longitude) {
      // هر دو موقعیت دارند - نمایش فاصله
      const distance = calculateDistance(
        myProfile.latitude,
        myProfile.longitude,
        user.latitude,
        user.longitude
      );
      
      if (distance < 1) {
        locationInfo = `📍(${Math.round(distance * 1000)}m)`;
      } else {
        locationInfo = `📍(${distance.toFixed(1)}km)`;
      }
    } else {
      // فقط کاربر مقابل موقعیت دارد
      locationInfo = "📍";
    }
  }

  // ساخت خط وضعیت چت (فقط اگر در حال چت باشد)
  const chatLine = chatStatus ? `\n${chatStatus}` : '';
  
  return `${age} ${gender}${displayName} ${customId}\n${location} ${locationInfo} (🤍️${likes})\n${onlineStatus}${chatLine}\n〰️〰️〰️〰️〰️〰️〰️〰️〰️〰️〰️`;
}

/**
 * دریافت عنوان لیست بر اساس نوع جستجو
 */
export function getSearchTitle(searchType: string, gender?: string): string {
  const titles: { [key: string]: string } = {
    'same_province': '🎌 لیست افراد هم استانی شما',
    'same_age': '🎌 لیست افراد هم سن شما',
    'new_users': '🎌 لیست کاربران جدید',
    'no_chats': '🎌 لیست کاربران بدون چت',
    'recent_chats': '🎌 لیست چت‌های اخیر شما',
    'popular': '🎌 لیست کاربران محبوب',
    'advanced': '🎌 نتایج جستجوی پیشرفته',
  };

  let title = titles[searchType] || '🎌 لیست کاربران';
  
  if (gender === 'female') {
    title += ' (فقط دختران)';
  } else if (gender === 'male') {
    title += ' (فقط پسران)';
  }

  return title;
}

/**
 * فرمت کردن تاریخ و ساعت جستجو (شمسی)
 */
export function formatSearchDateTime(): string {
  const now = new Date();
  const persianDate = new Intl.DateTimeFormat('fa-IR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(now);
  
  return `جستجو شده در ${persianDate.replace(',', '')}`;
}
