// src/constants/locations.ts

export interface Province {
  id: number;
  name: string;
}

export interface City {
  id: number;
  name: string;
  provinceId: number;
}

export const PROVINCES: Province[] = [
  { id: 1, name: 'تهران' },
  { id: 2, name: 'اصفهان' },
  { id: 3, name: 'فارس' },
  { id: 4, name: 'خراسان رضوی' },
  { id: 5, name: 'خوزستان' },
  { id: 6, name: 'مازندران' },
  { id: 7, name: 'آذربایجان شرقی' },
  { id: 8, name: 'کرمان' },
  { id: 9, name: 'گیلان' },
  { id: 10, name: 'آذربایجان غربی' },
  { id: 11, name: 'همدان' },
  { id: 12, name: 'کرمانشاه' },
  { id: 13, name: 'هرمزگان' },
  { id: 14, name: 'لرستان' },
  { id: 15, name: 'مرکزی' },
  { id: 16, name: 'یزد' },
  { id: 17, name: 'سمنان' },
  { id: 18, name: 'قزوین' },
  { id: 19, name: 'قم' },
  { id: 20, name: 'گلستان' },
  { id: 21, name: 'کردستان' },
  { id: 22, name: 'بوشهر' },
  { id: 23, name: 'زنجان' },
  { id: 24, name: 'چهارمحال و بختیاری' },
  { id: 25, name: 'ایلام' },
  { id: 26, name: 'خراسان شمالی' },
  { id: 27, name: 'خراسان جنوبی' },
  { id: 28, name: 'البرز' },
  { id: 29, name: 'اردبیل' },
  { id: 30, name: 'کهگیلویه و بویراحمد' },
  { id: 31, name: 'سیستان و بلوچستان' },
];

export const CITIES_BY_PROVINCE: Record<number, City[]> = {
  // 1. تهران
  1: [
    { id: 101, name: 'تهران', provinceId: 1 },
    { id: 102, name: 'ری', provinceId: 1 },
    { id: 103, name: 'ورامین', provinceId: 1 },
    { id: 104, name: 'شهریار', provinceId: 1 },
    { id: 105, name: 'اسلامشهر', provinceId: 1 },
    { id: 106, name: 'رباط کریم', provinceId: 1 },
    { id: 107, name: 'پاکدشت', provinceId: 1 },
    { id: 108, name: 'قدس', provinceId: 1 },
    { id: 109, name: 'دماوند', provinceId: 1 },
    { id: 110, name: 'فیروزکوه', provinceId: 1 },
    { id: 111, name: 'ملارد', provinceId: 1 },
    { id: 112, name: 'پردیس', provinceId: 1 },
  ],

  // 2. اصفهان
  2: [
    { id: 201, name: 'اصفهان', provinceId: 2 },
    { id: 202, name: 'کاشان', provinceId: 2 },
    { id: 203, name: 'نجف‌آباد', provinceId: 2 },
    { id: 204, name: 'خمینی‌شهر', provinceId: 2 },
    { id: 205, name: 'فلاورجان', provinceId: 2 },
    { id: 206, name: 'شاهین‌شهر', provinceId: 2 },
    { id: 207, name: 'گلپایگان', provinceId: 2 },
    { id: 208, name: 'نطنز', provinceId: 2 },
    { id: 209, name: 'اردستان', provinceId: 2 },
    { id: 210, name: 'نایین', provinceId: 2 },
    { id: 211, name: 'فریدن', provinceId: 2 },
    { id: 212, name: 'فریدون‌شهر', provinceId: 2 },
    { id: 213, name: 'سمیرم', provinceId: 2 },
    { id: 214, name: 'دولت‌آباد', provinceId: 2 },
  ],

  // 3. فارس
  3: [
    { id: 301, name: 'شیراز', provinceId: 3 },
    { id: 302, name: 'مرودشت', provinceId: 3 },
    { id: 303, name: 'جهرم', provinceId: 3 },
    { id: 304, name: 'کازرون', provinceId: 3 },
    { id: 305, name: 'فسا', provinceId: 3 },
    { id: 306, name: 'لار', provinceId: 3 },
    { id: 307, name: 'آباده', provinceId: 3 },
    { id: 308, name: 'داراب', provinceId: 3 },
    { id: 309, name: 'فیروزآباد', provinceId: 3 },
    { id: 310, name: 'اقلید', provinceId: 3 },
    { id: 311, name: 'استهبان', provinceId: 3 },
    { id: 312, name: 'نی‌ریز', provinceId: 3 },
  ],

  // 4. خراسان رضوی
  4: [
    { id: 401, name: 'مشهد', provinceId: 4 },
    { id: 402, name: 'نیشابور', provinceId: 4 },
    { id: 403, name: 'سبزوار', provinceId: 4 },
    { id: 404, name: 'تربت حیدریه', provinceId: 4 },
    { id: 405, name: 'قوچان', provinceId: 4 },
    { id: 406, name: 'گناباد', provinceId: 4 },
    { id: 407, name: 'کاشمر', provinceId: 4 },
    { id: 408, name: 'تربت جام', provinceId: 4 },
    { id: 409, name: 'تایباد', provinceId: 4 },
    { id: 410, name: 'چناران', provinceId: 4 },
    { id: 411, name: 'خواف', provinceId: 4 },
  ],

  // 5. خوزستان
  5: [
    { id: 501, name: 'اهواز', provinceId: 5 },
    { id: 502, name: 'دزفول', provinceId: 5 },
    { id: 503, name: 'آبادان', provinceId: 5 },
    { id: 504, name: 'خرمشهر', provinceId: 5 },
    { id: 505, name: 'بهبهان', provinceId: 5 },
    { id: 506, name: 'اندیمشک', provinceId: 5 },
    { id: 507, name: 'ماهشهر', provinceId: 5 },
    { id: 508, name: 'شوشتر', provinceId: 5 },
    { id: 509, name: 'ایذه', provinceId: 5 },
    { id: 510, name: 'باغملک', provinceId: 5 },
    { id: 511, name: 'هندیجان', provinceId: 5 },
    { id: 512, name: 'شادگان', provinceId: 5 },
  ],

  // 6. مازندران
  6: [
    { id: 601, name: 'ساری', provinceId: 6 },
    { id: 602, name: 'بابل', provinceId: 6 },
    { id: 603, name: 'آمل', provinceId: 6 },
    { id: 604, name: 'قائم‌شهر', provinceId: 6 },
    { id: 605, name: 'بابلسر', provinceId: 6 },
    { id: 606, name: 'نوشهر', provinceId: 6 },
    { id: 607, name: 'چالوس', provinceId: 6 },
    { id: 608, name: 'تنکابن', provinceId: 6 },
    { id: 609, name: 'رامسر', provinceId: 6 },
    { id: 610, name: 'نکا', provinceId: 6 },
    { id: 611, name: 'محمودآباد', provinceId: 6 },
    { id: 612, name: 'بهشهر', provinceId: 6 },
  ],

  // 7. آذربایجان شرقی
  7: [
    { id: 701, name: 'تبریز', provinceId: 7 },
    { id: 702, name: 'مراغه', provinceId: 7 },
    { id: 703, name: 'مرند', provinceId: 7 },
    { id: 704, name: 'میانه', provinceId: 7 },
    { id: 705, name: 'شبستر', provinceId: 7 },
    { id: 706, name: 'سراب', provinceId: 7 },
    { id: 707, name: 'بناب', provinceId: 7 },
    { id: 708, name: 'آذرشهر', provinceId: 7 },
    { id: 709, name: 'هریس', provinceId: 7 },
    { id: 710, name: 'ملکان', provinceId: 7 },
    { id: 711, name: 'جلفا', provinceId: 7 },
  ],

  // 8. کرمان
  8: [
    { id: 801, name: 'کرمان', provinceId: 8 },
    { id: 802, name: 'رفسنجان', provinceId: 8 },
    { id: 803, name: 'جیرفت', provinceId: 8 },
    { id: 804, name: 'سیرجان', provinceId: 8 },
    { id: 805, name: 'بم', provinceId: 8 },
    { id: 806, name: 'زرند', provinceId: 8 },
    { id: 807, name: 'بافت', provinceId: 8 },
    { id: 808, name: 'کهنوج', provinceId: 8 },
    { id: 809, name: 'راور', provinceId: 8 },
    { id: 810, name: 'بردسیر', provinceId: 8 },
  ],

  // 9. گیلان
  9: [
    { id: 901, name: 'رشت', provinceId: 9 },
    { id: 902, name: 'لاهیجان', provinceId: 9 },
    { id: 903, name: 'بندر انزلی', provinceId: 9 },
    { id: 904, name: 'لنگرود', provinceId: 9 },
    { id: 905, name: 'آستارا', provinceId: 9 },
    { id: 906, name: 'تالش', provinceId: 9 },
    { id: 907, name: 'رودبار', provinceId: 9 },
    { id: 908, name: 'صومعه‌سرا', provinceId: 9 },
    { id: 909, name: 'فومن', provinceId: 9 },
    { id: 910, name: 'ماسال', provinceId: 9 },
  ],

  // 10. آذربایجان غربی
  10: [
    { id: 1001, name: 'ارومیه', provinceId: 10 },
    { id: 1002, name: 'خوی', provinceId: 10 },
    { id: 1003, name: 'میاندوآب', provinceId: 10 },
    { id: 1004, name: 'بوکان', provinceId: 10 },
    { id: 1005, name: 'مهاباد', provinceId: 10 },
    { id: 1006, name: 'سلماس', provinceId: 10 },
    { id: 1007, name: 'نقده', provinceId: 10 },
    { id: 1008, name: 'پیرانشهر', provinceId: 10 },
    { id: 1009, name: 'سردشت', provinceId: 10 },
    { id: 1010, name: 'ماکو', provinceId: 10 },
  ],

  // 11. همدان
  11: [
    { id: 1101, name: 'همدان', provinceId: 11 },
    { id: 1102, name: 'ملایر', provinceId: 11 },
    { id: 1103, name: 'نهاوند', provinceId: 11 },
    { id: 1104, name: 'تویسرکان', provinceId: 11 },
    { id: 1105, name: 'کبودرآهنگ', provinceId: 11 },
    { id: 1106, name: 'اسدآباد', provinceId: 11 },
    { id: 1107, name: 'بهار', provinceId: 11 },
    { id: 1108, name: 'رزن', provinceId: 11 },
  ],

  // 12. کرمانشاه
  12: [
    { id: 1201, name: 'کرمانشاه', provinceId: 12 },
    { id: 1202, name: 'اسلام‌آباد غرب', provinceId: 12 },
    { id: 1203, name: 'پاوه', provinceId: 12 },
    { id: 1204, name: 'سنقر', provinceId: 12 },
    { id: 1205, name: 'هرسین', provinceId: 12 },
    { id: 1206, name: 'کنگاور', provinceId: 12 },
    { id: 1207, name: 'صحنه', provinceId: 12 },
    { id: 1208, name: 'قصرشیرین', provinceId: 12 },
    { id: 1209, name: 'سرپل ذهاب', provinceId: 12 },
    { id: 1210, name: 'جوانرود', provinceId: 12 },
  ],

  // 13. هرمزگان
  13: [
    { id: 1301, name: 'بندرعباس', provinceId: 13 },
    { id: 1302, name: 'قشم', provinceId: 13 },
    { id: 1303, name: 'کیش', provinceId: 13 },
    { id: 1304, name: 'میناب', provinceId: 13 },
    { id: 1305, name: 'بندر لنگه', provinceId: 13 },
    { id: 1306, name: 'جاسک', provinceId: 13 },
    { id: 1307, name: 'بستک', provinceId: 13 },
    { id: 1308, name: 'حاجی‌آباد', provinceId: 13 },
    { id: 1309, name: 'رودان', provinceId: 13 },
  ],

  // 14. لرستان
  14: [
    { id: 1401, name: 'خرم‌آباد', provinceId: 14 },
    { id: 1402, name: 'بروجرد', provinceId: 14 },
    { id: 1403, name: 'دورود', provinceId: 14 },
    { id: 1404, name: 'الیگودرز', provinceId: 14 },
    { id: 1405, name: 'ازنا', provinceId: 14 },
    { id: 1406, name: 'کوهدشت', provinceId: 14 },
    { id: 1407, name: 'نورآباد', provinceId: 14 },
    { id: 1408, name: 'الشتر', provinceId: 14 },
  ],

  // 15. مرکزی
  15: [
    { id: 1501, name: 'اراک', provinceId: 15 },
    { id: 1502, name: 'ساوه', provinceId: 15 },
    { id: 1503, name: 'خمین', provinceId: 15 },
    { id: 1504, name: 'محلات', provinceId: 15 },
    { id: 1505, name: 'دلیجان', provinceId: 15 },
    { id: 1506, name: 'تفرش', provinceId: 15 },
    { id: 1507, name: 'شازند', provinceId: 15 },
    { id: 1508, name: 'آشتیان', provinceId: 15 },
  ],

  // 16. یزد
  16: [
    { id: 1601, name: 'یزد', provinceId: 16 },
    { id: 1602, name: 'میبد', provinceId: 16 },
    { id: 1603, name: 'اردکان', provinceId: 16 },
    { id: 1604, name: 'مهریز', provinceId: 16 },
    { id: 1605, name: 'تفت', provinceId: 16 },
    { id: 1606, name: 'ابرکوه', provinceId: 16 },
    { id: 1607, name: 'بافق', provinceId: 16 },
    { id: 1608, name: 'هرات', provinceId: 16 },
  ],

  // 17. سمنان
  17: [
    { id: 1701, name: 'سمنان', provinceId: 17 },
    { id: 1702, name: 'شاهرود', provinceId: 17 },
    { id: 1703, name: 'گرمسار', provinceId: 17 },
    { id: 1704, name: 'دامغان', provinceId: 17 },
    { id: 1705, name: 'مهدی‌شهر', provinceId: 17 },
    { id: 1706, name: 'سرخه', provinceId: 17 },
  ],

  // 18. قزوین
  18: [
    { id: 1801, name: 'قزوین', provinceId: 18 },
    { id: 1802, name: 'تاکستان', provinceId: 18 },
    { id: 1803, name: 'آبیک', provinceId: 18 },
    { id: 1804, name: 'بوئین‌زهرا', provinceId: 18 },
    { id: 1805, name: 'الوند', provinceId: 18 },
  ],

  // 19. قم
  19: [
    { id: 1901, name: 'قم', provinceId: 19 },
    { id: 1902, name: 'جعفریه', provinceId: 19 },
  ],

  // 20. گلستان
  20: [
    { id: 2001, name: 'گرگان', provinceId: 20 },
    { id: 2002, name: 'گنبد کاووس', provinceId: 20 },
    { id: 2003, name: 'علی‌آباد', provinceId: 20 },
    { id: 2004, name: 'مینودشت', provinceId: 20 },
    { id: 2005, name: 'آق‌قلا', provinceId: 20 },
    { id: 2006, name: 'بندر ترکمن', provinceId: 20 },
    { id: 2007, name: 'کلاله', provinceId: 20 },
    { id: 2008, name: 'آزادشهر', provinceId: 20 },
  ],

  // 21. کردستان
  21: [
    { id: 2101, name: 'سنندج', provinceId: 21 },
    { id: 2102, name: 'مریوان', provinceId: 21 },
    { id: 2103, name: 'سقز', provinceId: 21 },
    { id: 2104, name: 'بانه', provinceId: 21 },
    { id: 2105, name: 'قروه', provinceId: 21 },
    { id: 2106, name: 'بیجار', provinceId: 21 },
    { id: 2107, name: 'کامیاران', provinceId: 21 },
    { id: 2108, name: 'دیواندره', provinceId: 21 },
  ],

  // 22. بوشهر
  22: [
    { id: 2201, name: 'بوشهر', provinceId: 22 },
    { id: 2202, name: 'برازجان', provinceId: 22 },
    { id: 2203, name: 'بندر گناوه', provinceId: 22 },
    { id: 2204, name: 'دشتستان', provinceId: 22 },
    { id: 2205, name: 'کنگان', provinceId: 22 },
    { id: 2206, name: 'دیر', provinceId: 22 },
    { id: 2207, name: 'دیلم', provinceId: 22 },
  ],

  // 23. زنجان
  23: [
    { id: 2301, name: 'زنجان', provinceId: 23 },
    { id: 2302, name: 'ابهر', provinceId: 23 },
    { id: 2303, name: 'خدابنده', provinceId: 23 },
    { id: 2304, name: 'خرمدره', provinceId: 23 },
    { id: 2305, name: 'طارم', provinceId: 23 },
    { id: 2306, name: 'ماهنشان', provinceId: 23 },
  ],

  // 24. چهارمحال و بختیاری
  24: [
    { id: 2401, name: 'شهرکرد', provinceId: 24 },
    { id: 2402, name: 'بروجن', provinceId: 24 },
    { id: 2403, name: 'فارسان', provinceId: 24 },
    { id: 2404, name: 'لردگان', provinceId: 24 },
    { id: 2405, name: 'کوهرنگ', provinceId: 24 },
    { id: 2406, name: 'اردل', provinceId: 24 },
  ],

  // 25. ایلام
  25: [
    { id: 2501, name: 'ایلام', provinceId: 25 },
    { id: 2502, name: 'دهلران', provinceId: 25 },
    { id: 2503, name: 'آبدانان', provinceId: 25 },
    { id: 2504, name: 'ایوان', provinceId: 25 },
    { id: 2505, name: 'مهران', provinceId: 25 },
    { id: 2506, name: 'دره‌شهر', provinceId: 25 },
  ],

  // 26. خراسان شمالی
  26: [
    { id: 2601, name: 'بجنورد', provinceId: 26 },
    { id: 2602, name: 'شیروان', provinceId: 26 },
    { id: 2603, name: 'اسفراین', provinceId: 26 },
    { id: 2604, name: 'جاجرم', provinceId: 26 },
    { id: 2605, name: 'فاروج', provinceId: 26 },
    { id: 2606, name: 'گرمه', provinceId: 26 },
  ],

  // 27. خراسان جنوبی
  27: [
    { id: 2701, name: 'بیرجند', provinceId: 27 },
    { id: 2702, name: 'قائنات', provinceId: 27 },
    { id: 2703, name: 'فردوس', provinceId: 27 },
    { id: 2704, name: 'طبس', provinceId: 27 },
    { id: 2705, name: 'نهبندان', provinceId: 27 },
    { id: 2706, name: 'بشرویه', provinceId: 27 },
  ],

  // 28. البرز
  28: [
    { id: 2801, name: 'کرج', provinceId: 28 },
    { id: 2802, name: 'نظرآباد', provinceId: 28 },
    { id: 2803, name: 'ساوجبلاغ', provinceId: 28 },
    { id: 2804, name: 'هشتگرد', provinceId: 28 },
    { id: 2805, name: 'طالقان', provinceId: 28 },
    { id: 2806, name: 'اشتهارد', provinceId: 28 },
    { id: 2807, name: 'فردیس', provinceId: 28 },
  ],

  // 29. اردبیل
  29: [
    { id: 2901, name: 'اردبیل', provinceId: 29 },
    { id: 2902, name: 'پارس‌آباد', provinceId: 29 },
    { id: 2903, name: 'خلخال', provinceId: 29 },
    { id: 2904, name: 'مشگین‌شهر', provinceId: 29 },
    { id: 2905, name: 'گرمی', provinceId: 29 },
    { id: 2906, name: 'بیله‌سوار', provinceId: 29 },
    { id: 2907, name: 'نمین', provinceId: 29 },
    { id: 2908, name: 'نیر', provinceId: 29 },
  ],

  // 30. کهگیلویه و بویراحمد
  30: [
    { id: 3001, name: 'یاسوج', provinceId: 30 },
    { id: 3002, name: 'دوگنبدان', provinceId: 30 },
    { id: 3003, name: 'دهدشت', provinceId: 30 },
    { id: 3004, name: 'سی‌سخت', provinceId: 30 },
    { id: 3005, name: 'دنا', provinceId: 30 },
    { id: 3006, name: 'چرام', provinceId: 30 },
  ],

  // 31. سیستان و بلوچستان
  31: [
    { id: 3101, name: 'زاهدان', provinceId: 31 },
    { id: 3102, name: 'زابل', provinceId: 31 },
    { id: 3103, name: 'چابهار', provinceId: 31 },
    { id: 3104, name: 'ایرانشهر', provinceId: 31 },
    { id: 3105, name: 'خاش', provinceId: 31 },
    { id: 3106, name: 'سراوان', provinceId: 31 },
    { id: 3107, name: 'نیکشهر', provinceId: 31 },
    { id: 3108, name: 'کنارک', provinceId: 31 },
    { id: 3109, name: 'سرباز', provinceId: 31 },
  ],
};

/**
 * پیدا کردن استان با ID
 */
export function getProvinceById(id: number): Province | undefined {
  return PROVINCES.find((p) => p.id === id);
}

/**
 * پیدا کردن شهر با ID
 */
export function getCityById(cityId: number, provinceId: number): City | undefined {
  const cities = CITIES_BY_PROVINCE[provinceId] || [];
  return cities.find((c) => c.id === cityId);
}

/**
 * دریافت شهرهای یک استان
 */
export function getCitiesByProvinceId(provinceId: number): City[] {
  return CITIES_BY_PROVINCE[provinceId] || [];
}
