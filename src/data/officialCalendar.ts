/**
 * Official Iranian calendar data bundled with the library (no runtime I/O).
 *
 * ─── What lives here ────────────────────────────────────────────────────────────────────────────────────────────
 *  · SOLAR_OFFICIAL_HOLIDAYS — the fixed solar (Shamsi) public holidays; same Jalali date every year.
 *  · HIJRI_HOLIDAY_ANCHORS   — the fixed Hijri (Qamari) dates of the lunar public holidays, used to COMPUTE (project)
 *                              a year's lunar closures on the Umm al-Qura calendar when no official year is bundled.
 *  · OFFICIAL_CALENDAR_YEARS — whole years whose lunar closures and Hijri month starts were TRANSCRIBED from the
 *                              official calendar published by the Calendar Center of the Institute of Geophysics,
 *                              University of Tehran (مرکز تقویم مؤسسهٔ ژئوفیزیک دانشگاه تهران; the occasions are
 *                              approved by شورای فرهنگ عمومی کشور). For such a year the computed lunar days are not
 *                              used at all. Each entry records the source PDF URL and its SHA-256.
 *
 * ─── Why official years matter ──────────────────────────────────────────────────────────────────────────────────
 * Lunar holidays in Iran follow the official moon-sighting, not an astronomical table. Measured against the official
 * «تعطیلات رسمی سال ۱۴۰۵», the Umm al-Qura computation put 7 of its 19 lunar closures one day EARLY (۲۴ فروردین for
 * ۲۵, ۱۲ and ۲۰ مرداد for ۱۳ and ۲۱, ۱ and ۱۵ دی for ۲ and ۱۶, ۳ بهمن for ۴, ۱۸–۱۹ اسفند for ۱۹–۲۰); 1404 was off on
 * 11 days. A day treated as a closure that is not one pushes a deadline LATER — the missed-appeal direction.
 *
 * ─── Updating ───────────────────────────────────────────────────────────────────────────────────────────────────
 * See CONTRIBUTING.md. In short: each year, once the official «تعطیلات رسمی سال …» and the full «تقویم رسمی کشور»
 * PDFs are published, transcribe the lunar closures and the Hijri month starts into a new entry below, record the
 * URLs and SHA-256 of both PDFs, and run the test suite (it cross-checks every closure's Hijri date against the month
 * starts and pins the full holiday set of each official year).
 */

/** A fixed or computed public holiday, positioned by Jalali month/day. */
export interface Holiday {
  /** Jalali month, 1–12. */
  month: number
  /** Jalali day of month, 1–31. */
  day: number
  /** Persian name of the occasion. */
  name: string
  /**
   * `solar-fixed` / `national`: fixed solar holidays. `religious`: a lunar (Hijri-anchored) holiday.
   * `override`: a closure added at runtime through {@link setHolidayOverrides} (e.g. an ad-hoc government decree).
   * `lunar` is reserved and kept for type compatibility.
   */
  type: 'solar-fixed' | 'lunar' | 'national' | 'religious' | 'override'
  description?: string
}

/** One day of an official calendar year, by Jalali month/day, with its Hijri date when it is a lunar occasion. */
export interface OfficialDay {
  jm: number
  jd: number
  name: string
  hy?: number
  hm?: number
  hd?: number
  note?: string
}

/** The Jalali date on which a Hijri month begins, per the official calendar. */
export interface OfficialHijriMonthStart {
  hy: number
  /** Hijri month, 1 = محرم … 12 = ذی‌الحجه. */
  hm: number
  jm: number
  jd: number
}

/** A Jalali year transcribed from the official calendar. */
export interface OfficialCalendarYear {
  /** Jalali year. */
  jy: number
  /** Human-readable source line (Persian). */
  source: string
  /** HTTPS URL of the official holiday-list PDF. */
  url: string
  /** SHA-256 of the PDF at `url`, as fetched. */
  sha256?: string
  /** Source of the Hijri month starts (the full official calendar), when different from `source`. */
  hijriMonthsSource?: string
  hijriMonthsUrl?: string
  hijriMonthsSha256?: string
  /** An independent public listing the transcription was compared against. */
  crossCheck?: string
  /** ISO date the source was fetched. */
  fetched?: string
  /** The solar closures as printed (informational — the engine uses SOLAR_OFFICIAL_HOLIDAYS). */
  solar?: OfficialDay[]
  /** The lunar closures of the year. Replaces the computed lunar days for this year. */
  lunar: OfficialDay[]
  /** Hijri month starts in this Jalali year (the official calendar's own Hijri column). */
  hijriMonthStarts?: OfficialHijriMonthStart[]
}

// ═══════════════════════════════════════════════════════════════════════════════
// OFFICIAL PUBLIC HOLIDAYS — تعطیلات رسمی ایران
// ONLY includes days when courts and government offices are actually CLOSED.
// Source: قانون تعطیلات رسمی + the official calendar of the judiciary.
//
// Does NOT include commemorative days (روز خبرنگار، روز کارمند، etc.) that courts remain OPEN on.
// ═══════════════════════════════════════════════════════════════════════════════

/** Solar (Shamsi) fixed official holidays — same Jalali date every year. */
export const SOLAR_OFFICIAL_HOLIDAYS: readonly Holiday[] = [
  // ── نوروز (Nowruz) — ۱ تا ۴ فروردین ──────────────────────────────────────
  { month: 1, day: 1, name: 'نوروز', type: 'solar-fixed', description: 'عید نوروز — تعطیل رسمی' },
  { month: 1, day: 2, name: 'عید نوروز', type: 'solar-fixed' },
  { month: 1, day: 3, name: 'عید نوروز', type: 'solar-fixed' },
  { month: 1, day: 4, name: 'عید نوروز', type: 'solar-fixed' },
  // ── جمهوری اسلامی و سیزده بدر ────────────────────────────────────────────
  { month: 1, day: 12, name: 'روز جمهوری اسلامی', type: 'national', description: '۱۲ فروردین — تعطیل رسمی' },
  { month: 1, day: 13, name: 'سیزده بدر', type: 'solar-fixed', description: 'سیزده به در — تعطیل رسمی' },
  // ── خرداد ─────────────────────────────────────────────────────────────────
  { month: 3, day: 14, name: 'رحلت حضرت امام خمینی (ره)', type: 'national', description: '۱۴ خرداد — تعطیل رسمی' },
  { month: 3, day: 15, name: 'قیام ۱۵ خرداد', type: 'national', description: '۱۵ خرداد — تعطیل رسمی' },
  // ── بهمن ──────────────────────────────────────────────────────────────────
  { month: 11, day: 22, name: 'پیروزی انقلاب اسلامی', type: 'national', description: '۲۲ بهمن — تعطیل رسمی' },
  // ── اسفند ─────────────────────────────────────────────────────────────────
  {
    month: 12, day: 29, name: 'ملی شدن صنعت نفت', type: 'national',
    description: '۲۹ اسفند — تعطیل رسمی (روزی که دادگاه‌ها بسته‌اند؛ در سال‌های عادی که اسفند ۲۹ روزه است این آخرین روز سال است)',
  },
]

/**
 * Fixed Hijri (Qamari) anchors of Iran's official religious closures: `[hijriMonth, hijriDay, name]`.
 *
 * The complete list of Iran's lunar public holidays (تقویم رسمی کشور). Per the official calendar:
 * میلاد پیامبر = ۱۷ ربیع‌الاول (the Shia date — NOT 12, which is not an Iranian holiday); شهادت امام رضا = آخر صفر
 * (29 OR 30 depending on the year) — handled dynamically when computing, not as a fixed anchor.
 */
export const HIJRI_HOLIDAY_ANCHORS: ReadonlyArray<readonly [number, number, string]> = [
  [1, 9, 'تاسوعای حسینی'],
  [1, 10, 'عاشورای حسینی'],
  [2, 20, 'اربعین حسینی'],
  [2, 28, 'رحلت پیامبر (ص) و شهادت امام حسن (ع)'],
  // ۸ ربیع‌الاول — on the official list of both 1404 (ردیف ۱۸) and 1405 (ردیف ۱۶).
  [3, 8, 'شهادت امام حسن عسکری (ع)'],
  [3, 17, 'میلاد حضرت رسول (ص) و امام صادق (ع)'],
  [6, 3, 'شهادت حضرت فاطمه زهرا (س)'],
  [7, 13, 'ولادت حضرت علی (ع)'],
  [7, 27, 'مبعث حضرت رسول اکرم (ص)'],
  [8, 15, 'ولادت حضرت قائم (عج) — نیمه شعبان'],
  [9, 21, 'شهادت حضرت علی (ع)'],
  [10, 1, 'عید سعید فطر'],
  [10, 2, 'عید سعید فطر'],
  [10, 25, 'شهادت امام صادق (ع)'],
  [12, 10, 'عید سعید قربان'],
  [12, 18, 'عید غدیر خم'],
]

/** Name used for the last day of Safar (آخر صفر), which is 29 or 30 Safar depending on the year. */
export const LAST_OF_SAFAR_NAME = 'شهادت امام رضا (ع)'

/** Jalali years transcribed from the official calendar. Vetted data — see the header of this file. */
export const OFFICIAL_CALENDAR_YEARS: readonly OfficialCalendarYear[] = [
  {
    jy: 1405,
    source: 'مرکز تقویم مؤسسهٔ ژئوفیزیک دانشگاه تهران — «تعطیلات رسمی سال ۱۴۰۵» (مناسبت‌ها مصوب شورای فرهنگ عمومی کشور)',
    url: 'https://calendar.ut.ac.ir/documents/2139738/7092644/Holiday-1405.pdf/2d0fc5b3-4a8a-67e4-041a-a883b162ab8e?t=1761990093314',
    sha256: 'e8af6cff4c5648dc658e19e4f1388099e945ba65789ed87c300f33f429c4cf34',
    hijriMonthsSource: 'همان مرکز — «تقویم رسمی کشور، سال ۱۴۰۵ هجری شمسی» (نسخهٔ نهایی؛ ستون هجری قمری روزبه‌روز)',
    hijriMonthsUrl: 'https://calendar.ut.ac.ir/documents/2139738/7092644/Calendar-1405.pdf/64228cbb-f4de-dc32-4d2b-57db3c8e322f?t=1761972997587',
    hijriMonthsSha256: '8e32b520d5da058414b9378d62a01117273336a4c074591f4e84d59ab32a963c',
    crossCheck: 'https://www.time.ir/event-year — the same 26 closures on 1405/07/19',
    fetched: '2026-10-11',
    solar: [
      { jm: 1, jd: 1, name: 'نوروز' },
      { jm: 1, jd: 2, name: 'عید نوروز' },
      { jm: 1, jd: 3, name: 'عید نوروز' },
      { jm: 1, jd: 4, name: 'عید نوروز' },
      { jm: 1, jd: 12, name: 'روز جمهوری اسلامی' },
      { jm: 1, jd: 13, name: 'سیزده بدر' },
      { jm: 3, jd: 14, name: 'رحلت حضرت امام خمینی (ره)' },
      { jm: 3, jd: 15, name: 'قیام ۱۵ خرداد' },
      { jm: 11, jd: 22, name: 'پیروزی انقلاب اسلامی' },
      { jm: 12, jd: 29, name: 'ملی شدن صنعت نفت' },
    ],
    lunar: [
      { jm: 1, jd: 1, name: 'عید سعید فطر', hy: 1447, hm: 10, hd: 1 },
      { jm: 1, jd: 2, name: 'عید سعید فطر', hy: 1447, hm: 10, hd: 2 },
      { jm: 1, jd: 25, name: 'شهادت امام صادق (ع)', hy: 1447, hm: 10, hd: 25 },
      { jm: 3, jd: 6, name: 'عید سعید قربان', hy: 1447, hm: 12, hd: 10 },
      { jm: 3, jd: 14, name: 'عید غدیر خم', hy: 1447, hm: 12, hd: 18 },
      { jm: 4, jd: 3, name: 'تاسوعای حسینی', hy: 1448, hm: 1, hd: 9 },
      { jm: 4, jd: 4, name: 'عاشورای حسینی', hy: 1448, hm: 1, hd: 10 },
      { jm: 5, jd: 13, name: 'اربعین حسینی', hy: 1448, hm: 2, hd: 20 },
      { jm: 5, jd: 21, name: 'رحلت پیامبر (ص) و شهادت امام حسن (ع)', hy: 1448, hm: 2, hd: 28 },
      { jm: 5, jd: 22, name: 'شهادت امام رضا (ع)', hy: 1448, hm: 2, hd: 29, note: 'آخر صفر' },
      { jm: 5, jd: 30, name: 'شهادت امام حسن عسکری (ع)', hy: 1448, hm: 3, hd: 8 },
      { jm: 6, jd: 8, name: 'میلاد حضرت رسول (ص) و امام صادق (ع)', hy: 1448, hm: 3, hd: 17 },
      { jm: 8, jd: 22, name: 'شهادت حضرت فاطمه زهرا (س)', hy: 1448, hm: 6, hd: 3 },
      { jm: 10, jd: 2, name: 'ولادت حضرت علی (ع)', hy: 1448, hm: 7, hd: 13 },
      { jm: 10, jd: 16, name: 'مبعث حضرت رسول اکرم (ص)', hy: 1448, hm: 7, hd: 27 },
      { jm: 11, jd: 4, name: 'ولادت حضرت قائم (عج) — نیمه شعبان', hy: 1448, hm: 8, hd: 15 },
      { jm: 12, jd: 9, name: 'شهادت حضرت علی (ع)', hy: 1448, hm: 9, hd: 21 },
      { jm: 12, jd: 19, name: 'عید سعید فطر', hy: 1448, hm: 10, hd: 1 },
      { jm: 12, jd: 20, name: 'عید سعید فطر', hy: 1448, hm: 10, hd: 2 },
    ],
    hijriMonthStarts: [
      { hy: 1447, hm: 10, jm: 1, jd: 1 },
      { hy: 1447, hm: 11, jm: 1, jd: 30 },
      { hy: 1447, hm: 12, jm: 2, jd: 28 },
      { hy: 1448, hm: 1, jm: 3, jd: 26 },
      { hy: 1448, hm: 2, jm: 4, jd: 25 },
      { hy: 1448, hm: 3, jm: 5, jd: 23 },
      { hy: 1448, hm: 4, jm: 6, jd: 22 },
      { hy: 1448, hm: 5, jm: 7, jd: 20 },
      { hy: 1448, hm: 6, jm: 8, jd: 20 },
      { hy: 1448, hm: 7, jm: 9, jd: 20 },
      { hy: 1448, hm: 8, jm: 10, jd: 20 },
      { hy: 1448, hm: 9, jm: 11, jd: 19 },
      { hy: 1448, hm: 10, jm: 12, jd: 19 },
    ],
  },
]
