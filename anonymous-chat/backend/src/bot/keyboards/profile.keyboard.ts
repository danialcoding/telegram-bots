// src/bot/handlers/keyboards/profile.keyboard.ts
import { Markup } from 'telegraf';
import { PROVINCES, CITIES_BY_PROVINCE } from '../../utils/locations';

export const profileKeyboards = {
  /**
   * کیبورد اصلی پروفایل
   */
  main: () =>
    Markup.inlineKeyboard([
      [
        Markup.button.callback('✏️ ویرایش پروفایل', 'profile_edit'),
        Markup.button.callback('📸 تغییر عکس', 'profile_photo'),
      ],
      [
        Markup.button.callback('👁️ پنهان کردن', 'profile_hide'),
        Markup.button.callback('🔍 نمایش در جستجو', 'profile_show'),
      ],
      [Markup.button.callback('🔙 بازگشت', 'main_menu')],
    ]),

  /**
   * کیبورد ویرایش پروفایل
   */
  edit: () =>
    Markup.inlineKeyboard([
      [Markup.button.callback('👤 نام', 'profile_edit_name')],
      [Markup.button.callback('🎂 سن', 'profile_edit_age')],
      [Markup.button.callback('🚻 جنسیت', 'profile_edit_gender')],
      [Markup.button.callback('📍 استان', 'profile_select_province')],
      [Markup.button.callback('📝 بیوگرافی', 'profile_edit_bio')],
      [Markup.button.callback('🔙 بازگشت', 'profile_view')],
    ]),

  /**
   * کیبورد انتخاب جنسیت
   */
  gender: () =>
    Markup.inlineKeyboard([
      [
        Markup.button.callback('👨 مرد', 'profile_gender_male'),
        Markup.button.callback('👩 زن', 'profile_gender_female'),
      ],
      [Markup.button.callback('❌ انصراف', 'profile_cancel')],
    ]),

  /**
   * کیبورد انتخاب استان
   */
  province: () => {
    const buttons = PROVINCES.map((p) => [
      Markup.button.callback(p.name, `profile_province_${p.id}`),
    ]);
    buttons.push([Markup.button.callback('❌ انصراف', 'profile_cancel')]);
    return Markup.inlineKeyboard(buttons);
  },

  /**
   * کیبورد انتخاب شهر
   */
  city: (provinceId: number) => {
    const cities = CITIES_BY_PROVINCE[provinceId] || [];
    const buttons = cities.map((c) => [
      Markup.button.callback(c.name, `profile_city_${c.id}`),
    ]);
    buttons.push([
      Markup.button.callback('🔙 بازگشت', 'profile_select_province'),
    ]);
    return Markup.inlineKeyboard(buttons);
  },

  /**
   * کیبورد لغو عملیات
   */
  cancel: () =>
    Markup.inlineKeyboard([
      [Markup.button.callback('❌ انصراف', 'profile_cancel')],
    ]),
};
