import { Markup } from 'telegraf';

/**
 * صفحه‌کلید انتخاب جنسیت برای فیلتر درخواست چت
 */
export function chatFilterGenderKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('🙍‍♂️ فقط پسر', 'chat_filter_gender_male'),
      Markup.button.callback('🙍‍♀️ فقط دختر', 'chat_filter_gender_female'),
    ],
    [Markup.button.callback('👥 همه', 'chat_filter_gender_all')],
    [Markup.button.callback('🔙 بازگشت', 'back_to_settings')],
  ]);
}

/**
 * صفحه‌کلید انتخاب فاصله برای فیلتر درخواست چت
 */
export function chatFilterDistanceKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🏠 هم استانی باشه', 'chat_filter_distance_same_province')],
    [Markup.button.callback('🌍 هم استانی نباشه', 'chat_filter_distance_not_same_province')],
    [Markup.button.callback('📍 نزدیک‌تر از 100 کیلومتر', 'chat_filter_distance_100km')],
    [Markup.button.callback('📍 نزدیک‌تر از 10 کیلومتر', 'chat_filter_distance_10km')],
    [Markup.button.callback('🌐 همه (فرقی نمی‌کنه)', 'chat_filter_distance_all')],
    [Markup.button.callback('🔙 بازگشت', 'chat_filter_back_gender')],
  ]);
}

/**
 * صفحه‌کلید انتخاب بازه سنی برای فیلتر درخواست چت
 */
export function chatFilterAgeKeyboard() {
  const buttons: any[] = [];
  
  // ایجاد دکمه‌های سنی از 13 تا 99 (7 دکمه در هر ردیف)
  const ages: number[] = [];
  for (let age = 13; age <= 99; age++) {
    ages.push(age);
  }

  for (let i = 0; i < ages.length; i += 7) {
    const row = ages.slice(i, i + 7).map(age =>
      Markup.button.callback(age.toString(), `chat_filter_age_${age}`)
    );
    buttons.push(row);
  }

  // دکمه همه
  buttons.push([Markup.button.callback('👥 همه (فرقی نمی‌کنه)', 'chat_filter_age_all')]);
  
  // دکمه بازگشت
  buttons.push([Markup.button.callback('🔙 بازگشت', 'chat_filter_back_distance')]);

  return Markup.inlineKeyboard(buttons);
}

/**
 * صفحه‌کلید تایید نهایی فیلتر
 */
export function chatFilterConfirmKeyboard(filterText: string) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('✅ این متن را در پروفایلم نمایش بده', 'chat_filter_confirm_visible')],
    [Markup.button.callback('🔒 این متن را از پروفایلم مخفی کن', 'chat_filter_confirm_hidden')],
    [Markup.button.callback('🔙 بازگشت', 'chat_filter_back_age')],
  ]);
}
