/**
 * Small, pure Jalali (Solar Hijri) date helpers shared by the holiday and deadline modules.
 *
 * Calendar rules:
 *  · A month added to a date is a CALENDAR month, day-of-month clamped to the target month's length
 *    (۳۱ شهریور + ۱ ماه = ۳۰ مهر).
 *  · For a statutory period counted in months, ماده ۴۴۳ قانون آیین دادرسی دادگاه‌های عمومی و انقلاب در امور مدنی
 *    counts a month as thirty days («ماه سی روز») — see statutoryMonths.ts, which decides per law which reading applies.
 */
import jalaali from 'jalaali-js'

/** A Jalali calendar date. */
export interface JDate {
  jy: number
  jm: number
  jd: number
}

/** Calendar unit for {@link addToJalali}. */
export type CalendarUnit = 'day' | 'week' | 'month' | 'year'

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹'
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩'

/** ASCII digits → Persian digits («1405» → «۱۴۰۵»). */
export function toPersianDigits(v: string | number): string {
  return String(v).replace(/[0-9]/g, (d) => PERSIAN_DIGITS[Number(d)] as string)
}

/** Persian / Arabic-Indic digits → ASCII digits. */
function toAsciiDigits(s: string): string {
  let out = ''
  for (const ch of s) {
    const p = PERSIAN_DIGITS.indexOf(ch)
    const a = ARABIC_DIGITS.indexOf(ch)
    out += p >= 0 ? String(p) : a >= 0 ? String(a) : ch
  }
  return out
}

/**
 * Parse a Jalali date string: `YYYY-MM-DD` or `YYYY/MM/DD` (single-digit month/day allowed; Persian or
 * Arabic-Indic digits accepted). Returns null when the string has another shape or is not a real Jalali date.
 *
 * @example parseJalaliDate('1405/05/22') // { jy: 1405, jm: 5, jd: 22 }
 */
export function parseJalaliDate(dateStr: string): JDate | null {
  const match = toAsciiDigits(String(dateStr ?? '').trim()).match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/)
  if (!match) return null
  const jy = parseInt(match[1] as string, 10)
  const jm = parseInt(match[2] as string, 10)
  const jd = parseInt(match[3] as string, 10)
  if (!jalaali.isValidJalaaliDate(jy, jm, jd)) return null
  return { jy, jm, jd }
}

/**
 * A Jalali date as a JavaScript `Date` at LOCAL midnight of the corresponding Gregorian day.
 *
 * @example jalaliToDate(1405, 1, 1) // new Date(2026, 2, 21)
 */
export function jalaliToDate(jy: number, jm: number, jd: number): Date {
  const g = jalaali.toGregorian(jy, jm, jd)
  return new Date(g.gy, g.gm - 1, g.gd)
}

/** The Jalali date of a `Date`, read by its LOCAL calendar day. */
export function toJDate(d: Date): JDate {
  const j = jalaali.toJalaali(d)
  return { jy: j.jy, jm: j.jm, jd: j.jd }
}

/** `string | Date` input → a local-midnight Date copy, or null for an unparseable string. */
export function toDateInput(date: string | Date): Date | null {
  if (date instanceof Date) return new Date(date)
  const p = parseJalaliDate(date)
  return p ? jalaliToDate(p.jy, p.jm, p.jd) : null
}

/** True for an integer Jalali date between 1300 and 1500 that exists in the calendar. */
export function isValidJDate(d: JDate | null | undefined): d is JDate {
  return !!d && Number.isInteger(d.jy) && Number.isInteger(d.jm) && Number.isInteger(d.jd)
    && d.jy >= 1300 && d.jy <= 1500 && jalaali.isValidJalaaliDate(d.jy, d.jm, d.jd)
}

const utcOf = (d: JDate): number => {
  const g = jalaali.toGregorian(d.jy, d.jm, d.jd)
  return Date.UTC(g.gy, g.gm - 1, g.gd)
}
const fromUtc = (ms: number): JDate => {
  const t = new Date(ms)
  const j = jalaali.toJalaali(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate())
  return { jy: j.jy, jm: j.jm, jd: j.jd }
}

/**
 * `d` plus `n` units (negative = before). Months and years are CALENDAR units with the day clamped to the target
 * month's length. Null on an invalid input or a result outside 1300–1500.
 *
 * @example addToJalali({ jy: 1405, jm: 6, jd: 31 }, 1, 'month') // { jy: 1405, jm: 7, jd: 30 }
 */
export function addToJalali(d: JDate, n: number, unit: CalendarUnit): JDate | null {
  if (!isValidJDate(d) || !Number.isFinite(n) || !Number.isInteger(n)) return null
  if (unit === 'month' || unit === 'year') {
    const months = unit === 'year' ? n * 12 : n
    const t = d.jm - 1 + months
    const jy = d.jy + Math.floor(t / 12)
    const jm = ((t % 12) + 12) % 12 + 1
    const out = { jy, jm, jd: Math.min(d.jd, jalaali.jalaaliMonthLength(jy, jm)) }
    return isValidJDate(out) ? out : null
  }
  const days = unit === 'week' ? n * 7 : n
  const out = fromUtc(utcOf(d) + days * 86_400_000)
  return isValidJDate(out) ? out : null
}

/** Whole days from `a` to `b` (negative when `b` is earlier). */
export function daysBetween(a: JDate, b: JDate): number {
  return Math.round((utcOf(b) - utcOf(a)) / 86_400_000)
}

/** Weekday names by JS `getDay()` (0 = Sunday). */
export const WEEKDAY_FA = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'] as const

/** «پنجشنبه ۱۴۰۵/۰۵/۲۲» — weekday and Jalali date in Persian digits. */
export function jalaliLabel(d: Date): string {
  const j = jalaali.toJalaali(d)
  return `${WEEKDAY_FA[d.getDay()]} ${toPersianDigits(`${j.jy}/${String(j.jm).padStart(2, '0')}/${String(j.jd).padStart(2, '0')}`)}`
}

/** «۱۴۰۵/۰۵/۲۲» — the Jalali date only, Persian digits. */
export function jalaliNumericFa(d: Date): string {
  const j = jalaali.toJalaali(d)
  return toPersianDigits(`${j.jy}/${String(j.jm).padStart(2, '0')}/${String(j.jd).padStart(2, '0')}`)
}

/** `d` shifted by `n` LOCAL calendar days (DST-safe: uses setDate, not milliseconds). */
export function shiftDays(d: Date, n: number): Date {
  const out = new Date(d)
  out.setDate(out.getDate() + n)
  return out
}
