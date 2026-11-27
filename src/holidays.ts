/**
 * Iranian official holidays, working days and statutory deadlines.
 *
 * Persian-calendar holidays and working-day calculations: fixed solar (Shamsi) holidays and lunar (Qamari)
 * holidays. Fridays are always non-working.
 *
 * ─── Where lunar holidays come from ─────────────────────────────────────────────────────────────────────────────
 *  · OFFICIAL years (bundled in data/officialCalendar.ts): the lunar closures and Hijri month starts are transcribed
 *    from the official calendar. For such a year the computed lunar days are not used at all.
 *  · Every other year: each lunar closure is PROJECTED from its fixed Hijri anchor on the Umm al-Qura calendar built
 *    into the JS Intl engine. Iran's lunar holidays follow the official moon-sighting, so a projected day can be one
 *    day off. Such a day is still used to tell a Friday-like closure apart, but `statutoryDeadline` never rolls a
 *    deadline over one, and flags any deadline within a day of one («تعطیل این روز را با تقویم رسمی تطبیق دهید»).
 *
 * Neither source can know AD-HOC government closures (mourning, pollution, snow decrees): register them at runtime
 * with {@link setHolidayOverrides}.
 *
 * ─── Dates and time zones ───────────────────────────────────────────────────────────────────────────────────────
 * A Jalali date string (`'1405/05/22'`, `'1405-5-22'`) is unambiguous. A JavaScript `Date` is read by its LOCAL
 * calendar day (getFullYear/getMonth/getDate) and returned Dates are local midnights. On a server outside Iran,
 * either run with `TZ=Asia/Tehran`, or build Dates with {@link jalaliToDate} / `new Date(y, m - 1, d)`.
 *
 * @example
 * isWorkingDay('1405-01-01')               // false (Nowruz)
 * nextWorkingDay('1405-01-01')             // the first working day after Nowruz
 * statutoryDeadline('1400/04/10', 20, 'service').deadline  // 1400/04/31 (مادهٔ ۴۴۵)
 */

import jalaali from 'jalaali-js'
import {
  HIJRI_HOLIDAY_ANCHORS,
  LAST_OF_SAFAR_NAME,
  OFFICIAL_CALENDAR_YEARS,
  SOLAR_OFFICIAL_HOLIDAYS,
  type Holiday,
  type OfficialCalendarYear,
  type OfficialDay,
} from './data/officialCalendar.js'
import { jalaliLabel, jalaliToDate, parseJalaliDate, shiftDays, toDateInput, toPersianDigits, type JDate } from './jalali.js'
import { actionDayOffset, type PeriodStart } from './periodStart.js'

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

/** A holiday placed on a concrete date. */
export interface HolidayInstance {
  /** Gregorian date, `YYYY-MM-DD`. */
  date: string
  /** Jalali date, `YYYY/MM/DD`. */
  jalaliDate: string
  name: string
  type: Holiday['type']
}

/** Force a date to be a holiday. `jy` omitted = every year (a fixed solar-type override). */
export interface HolidayOverrideAdd {
  jy?: number
  jm: number
  jd: number
  name: string
}

/** Force a date to be a working day. `jy` omitted = every year. Can never un-close a Friday. */
export interface HolidayOverrideRemove {
  jy?: number
  jm: number
  jd: number
}

/** Runtime corrections on top of the bundled calendar. */
export interface HolidayOverrides {
  /** Dates to treat as closures (e.g. an ad-hoc government decree). */
  add?: HolidayOverrideAdd[]
  /** Dates to treat as working days. Fridays stay non-working regardless. */
  remove?: HolidayOverrideRemove[]
  /**
   * Additional official calendar years. A year supplied here replaces a bundled year with the same `jy`. A year with
   * any malformed entry is rejected as a whole — never a half-official calendar.
   */
  official?: OfficialCalendarYear[]
}

/** What {@link setHolidayOverrides} accepted. */
export interface HolidayOverridesResult {
  add: number
  remove: number
  /** Jalali years now served from an official calendar (bundled and supplied). */
  officialYears: number[]
  /** Entries dropped because they were not real dates / not well-formed. */
  rejected: { add: number; remove: number; official: number }
}

/** Where a year's lunar closures come from: the transcribed official calendar, or the Umm al-Qura projection. */
export type LunarCalendarSource = 'official' | 'computed'

export type { Holiday, OfficialCalendarYear, OfficialDay, OfficialHijriMonthStart } from './data/officialCalendar.js'
export type { PeriodStart } from './periodStart.js'

// ═══════════════════════════════════════════════════════════════════════════════
// Official years and overrides
// ═══════════════════════════════════════════════════════════════════════════════

const isRealJalali = (jy: number, jm: number, jd: number) =>
  Number.isInteger(jy) && Number.isInteger(jm) && Number.isInteger(jd) && jalaali.isValidJalaaliDate(jy, jm, jd)

/**
 * An official year is used only if EVERY entry in it is a real date — one malformed row drops the whole year back to
 * computation (and its flags), never a half-official calendar.
 */
export function isValidOfficialYear(o: unknown): o is OfficialCalendarYear {
  if (!o || typeof o !== 'object') return false
  const y = o as OfficialCalendarYear
  const okDay = (d: OfficialDay) => !!d && isRealJalali(y.jy, d.jm, d.jd) && typeof d.name === 'string' && d.name.trim() !== ''
  return Number.isInteger(y.jy) && y.jy >= 1300 && y.jy <= 1500
    && typeof y.url === 'string' && /^https:\/\//.test(y.url)
    && Array.isArray(y.lunar) && y.lunar.length > 0 && y.lunar.every(okDay)
    && (y.solar === undefined || (Array.isArray(y.solar) && y.solar.every(okDay)))
    && (y.hijriMonthStarts === undefined || (Array.isArray(y.hijriMonthStarts) && y.hijriMonthStarts.every((m) =>
      !!m && Number.isInteger(m.hy) && Number.isInteger(m.hm) && m.hm >= 1 && m.hm <= 12
      && isRealJalali(y.jy, m.jm, m.jd))))
}

const okAdd = (o: HolidayOverrideAdd) => !!o && (o.jy === undefined || Number.isInteger(o.jy))
  && isRealJalali(o.jy ?? 1403 /* a leap year: allows اسفند ۳۰ for an every-year entry */, o.jm, o.jd)
  && typeof o.name === 'string' && o.name.trim() !== ''
const okRemove = (o: HolidayOverrideRemove) => !!o && (o.jy === undefined || Number.isInteger(o.jy))
  && isRealJalali(o.jy ?? 1403, o.jm, o.jd)

const BUNDLED_OFFICIAL: ReadonlyMap<number, OfficialCalendarYear> = new Map(
  OFFICIAL_CALENDAR_YEARS.filter(isValidOfficialYear).map((o) => [o.jy, o]),
)

let ADD: readonly HolidayOverrideAdd[] = []
let REMOVE: readonly HolidayOverrideRemove[] = []
let OFFICIAL_BY_YEAR: ReadonlyMap<number, OfficialCalendarYear> = BUNDLED_OFFICIAL
const _lunarCache = new Map<number, Holiday[]>()

/**
 * Apply runtime corrections on top of the bundled calendar: ad-hoc closures (`add`), cancelled closures (`remove`)
 * and extra official calendar years (`official`). Replaces any overrides set before (it does not accumulate). Fridays
 * are always non-working and cannot be overridden away.
 *
 * Malformed entries are dropped (see the result's `rejected`); an official year with any malformed entry is dropped as
 * a whole.
 *
 * @example
 * setHolidayOverrides({ add: [{ jy: 1405, jm: 11, jd: 5, name: 'تعطیل مناسبتی' }] })
 */
export function setHolidayOverrides(overrides: HolidayOverrides | null | undefined): HolidayOverridesResult {
  const o = overrides ?? {}
  const add = Array.isArray(o.add) ? o.add : []
  const remove = Array.isArray(o.remove) ? o.remove : []
  const official = Array.isArray(o.official) ? o.official : []
  ADD = add.filter(okAdd).map((a) => ({ ...a }))
  REMOVE = remove.filter(okRemove).map((r) => ({ ...r }))
  const validOfficial = official.filter(isValidOfficialYear)
  const merged = new Map(BUNDLED_OFFICIAL)
  for (const y of validOfficial) merged.set(y.jy, y)
  OFFICIAL_BY_YEAR = merged
  _lunarCache.clear()
  return {
    add: ADD.length,
    remove: REMOVE.length,
    officialYears: officialCalendarYears(),
    rejected: { add: add.length - ADD.length, remove: remove.length - REMOVE.length, official: official.length - validOfficial.length },
  }
}

/** Drop every runtime override and go back to the bundled calendar. */
export function resetHolidayOverrides(): void {
  setHolidayOverrides(null)
}

/** The runtime overrides currently in force (copies). */
export function getHolidayOverrides(): Required<Pick<HolidayOverrides, 'add' | 'remove'>> {
  return { add: ADD.map((a) => ({ ...a })), remove: REMOVE.map((r) => ({ ...r })) }
}

/** Jalali years whose lunar closures come from a transcribed official calendar (vetted), ascending. */
export function officialCalendarYears(): number[] {
  return [...OFFICIAL_BY_YEAR.keys()].sort((a, b) => a - b)
}

/** Where a year's lunar closures come from: the transcribed official calendar, or the Umm al-Qura projection. */
export function lunarCalendarSource(jy: number): LunarCalendarSource {
  return OFFICIAL_BY_YEAR.has(jy) ? 'official' : 'computed'
}

/** The official calendar entry for a year (source line, PDF url, transcribed days), or null. */
export function officialCalendarFor(jy: number): OfficialCalendarYear | null {
  return OFFICIAL_BY_YEAR.get(jy) ?? null
}

/** Override hit for a Jalali date: 'add' (force holiday), 'remove' (force working), or null. */
function overrideFor(jy: number, jm: number, jd: number): { kind: 'add'; name: string } | { kind: 'remove' } | null {
  for (const o of ADD) {
    if ((o.jy === undefined || o.jy === jy) && o.jm === jm && o.jd === jd) return { kind: 'add', name: o.name }
  }
  for (const o of REMOVE) {
    if ((o.jy === undefined || o.jy === jy) && o.jm === jm && o.jd === jd) return { kind: 'remove' }
  }
  return null
}

// ═══════════════════════════════════════════════════════════════════════════════
// Lunar holidays — official table, else projected on Umm al-Qura
// ═══════════════════════════════════════════════════════════════════════════════

const _hijriFmt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
  day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'UTC',
})

/**
 * An engine without the islamic-umalqura calendar silently formats GREGORIAN parts (a «9 Muharram» on 9 January).
 * Then there is nothing to compute from: such a year has no computed lunar days at all and every deadline in it is
 * flagged instead.
 */
const UMALQURA_AVAILABLE = _hijriFmt.resolvedOptions().calendar === 'islamic-umalqura'

function hijriPartsOf(d: Date): { hm: number; hd: number } {
  const parts = _hijriFmt.formatToParts(d)
  let hm = 0
  let hd = 0
  for (const p of parts) {
    if (p.type === 'month') hm = parseInt(p.value, 10)
    else if (p.type === 'day') hd = parseInt(p.value, 10)
  }
  return { hm, hd }
}

/**
 * The lunar (Qamari) official closures within a Jalali year: the transcribed official list for an official year,
 * otherwise projected by walking the year's Gregorian span and matching each day's Umm al-Qura Hijri date against
 * the fixed Hijri anchors. Cached per year.
 *
 * Projected days may differ by ±1 from Iran's official moon-sighting — check {@link lunarCalendarSource} first.
 */
export function getLunarHolidaysForYear(jy: number): Holiday[] {
  const cached = _lunarCache.get(jy)
  if (cached) return cached.map((h) => ({ ...h }))

  const official = OFFICIAL_BY_YEAR.get(jy)
  if (official) {
    const days = official.lunar.map((d): Holiday => ({ month: d.jm, day: d.jd, name: d.name, type: 'religious' }))
    _lunarCache.set(jy, days)
    return days.map((h) => ({ ...h }))
  }
  if (!UMALQURA_AVAILABLE || !Number.isInteger(jy)) {
    _lunarCache.set(jy, [])
    return []
  }

  // Gregorian span of the Jalali year, padded ±2 days for boundary holidays.
  const gStart = jalaali.toGregorian(jy, 1, 1)
  const gEnd = jalaali.toGregorian(jy, 12, 29)
  let cur = new Date(Date.UTC(gStart.gy, gStart.gm - 1, gStart.gd - 2))
  const last = new Date(Date.UTC(gEnd.gy, gEnd.gm - 1, gEnd.gd + 3))

  const out: Holiday[] = []
  while (cur <= last) {
    const { hm, hd } = hijriPartsOf(cur)
    for (const [ahm, ahd, name] of HIJRI_HOLIDAY_ANCHORS) {
      if (hm === ahm && hd === ahd) {
        const j = jalaali.toJalaali(cur.getUTCFullYear(), cur.getUTCMonth() + 1, cur.getUTCDate())
        if (j.jy === jy) out.push({ month: j.jm, day: j.jd, name, type: 'religious' })
      }
    }
    // شهادت امام رضا (ع) = آخر صفر: the last day of Safar (29 or 30 varies by year). A fixed [2,29] anchor would be
    // wrong in 30-day-Safar years (it would mark the 29th and miss the real holiday on the 30th).
    if (hm === 2 && hd >= 29) {
      const next = hijriPartsOf(new Date(cur.getTime() + 86_400_000))
      if (next.hm === 3) {
        const j = jalaali.toJalaali(cur.getUTCFullYear(), cur.getUTCMonth() + 1, cur.getUTCDate())
        if (j.jy === jy) out.push({ month: j.jm, day: j.jd, name: LAST_OF_SAFAR_NAME, type: 'religious' })
      }
    }
    cur = new Date(cur.getTime() + 86_400_000)
  }
  _lunarCache.set(jy, out)
  return out.map((h) => ({ ...h }))
}

/** Lunar holidays of a year without copying (internal hot path). */
function lunarOf(jy: number): readonly Holiday[] {
  if (!_lunarCache.has(jy)) getLunarHolidaysForYear(jy)
  return _lunarCache.get(jy) ?? []
}

/**
 * True when the Date's Jalali year is in the range the engine can reason about (1300–1500 SH).
 *
 * NOTE: this is a RANGE guard, kept for compatibility — it does NOT mean the lunar holidays of that year were taken
 * from an official calendar. Use {@link lunarCalendarSource} / {@link holidayDataSource} for vetted vs projected.
 */
export function hasVettedHolidayData(date: Date): boolean {
  if (Number.isNaN(date.getTime())) return false
  const { jy } = jalaali.toJalaali(date)
  return jy >= 1300 && jy <= 1500
}

/**
 * How trustworthy the holiday data for a date is:
 *  · `official`    — the year's lunar holidays are transcribed from the official calendar (vetted);
 *  · `computed`    — lunar holidays are projected on Umm al-Qura and may be ±1 day off the official moon-sighting;
 *  · `unavailable` — invalid date, outside 1300–1500 SH, or (for a non-official year) the JS engine lacks the
 *                    islamic-umalqura calendar, so no lunar holiday is known at all.
 * Solar holidays and Fridays are certain in every case.
 */
export function holidayDataSource(date: string | Date): 'official' | 'computed' | 'unavailable' {
  const d = toDateInput(date)
  if (!d || Number.isNaN(d.getTime())) return 'unavailable'
  const { jy } = jalaali.toJalaali(d)
  if (jy < 1300 || jy > 1500) return 'unavailable'
  if (OFFICIAL_BY_YEAR.has(jy)) return 'official'
  return UMALQURA_AVAILABLE ? 'computed' : 'unavailable'
}

// ── Unverified (computed) lunar closures ─────────────────────────────────────────────────────────────────────────

/** A projected (not official) lunar closure near a date. */
export interface UnverifiedLunarHoliday {
  date: Date
  name: string
  /** Days from the date asked about (−1, 0, +1). */
  offsetDays: number
}

/**
 * The day is closed ONLY by a computed lunar holiday of a year with no official calendar — not a Friday, not an
 * override, not a solar holiday. Such a closure may sit a day off the real one. Null otherwise.
 */
export function unverifiedLunarClosureName(d: Date): string | null {
  if (Number.isNaN(d.getTime()) || d.getDay() === 5) return null
  const { jy, jm, jd } = jalaali.toJalaali(d)
  if (lunarCalendarSource(jy) !== 'computed') return null
  if (overrideFor(jy, jm, jd)) return null
  if (SOLAR_OFFICIAL_HOLIDAYS.some((h) => h.month === jm && h.day === jd)) return null
  return lunarOf(jy).find((h) => h.month === jm && h.day === jd)?.name ?? null
}

/**
 * Computed (not official) lunar closures within ±`windowDays` of `date`. A moon sighting moves a lunar day by one, so
 * a deadline next to one of these may in truth fall on a closure (or not).
 */
export function unverifiedLunarHolidaysNear(date: Date, windowDays = 1): UnverifiedLunarHoliday[] {
  const out: UnverifiedLunarHoliday[] = []
  if (Number.isNaN(date.getTime())) return out
  for (let k = -windowDays; k <= windowDays; k++) {
    const d = shiftDays(date, k)
    const { jy, jm, jd } = jalaali.toJalaali(d)
    if (lunarCalendarSource(jy) !== 'computed' || overrideFor(jy, jm, jd)) continue
    const h = lunarOf(jy).find((x) => x.month === jm && x.day === jd)
    if (h) out.push({ date: d, name: h.name, offsetDays: k })
  }
  return out
}

// ═══════════════════════════════════════════════════════════════════════════════
// Statutory deadlines (مواعد قانونی)
// ═══════════════════════════════════════════════════════════════════════════════

/** The result of {@link statutoryDeadline}. */
export interface StatutoryDeadline {
  /**
   * The last day of the period, rolled off a Friday / official or solar closure: start + days for an event-started
   * period, start + days + 1 for a service-started one (مادهٔ ۴۴۵ — the day of service and the day of the act are not
   * counted).
   */
  deadline: Date
  /** The last day before any roll (start + days, + 1 when service-started). */
  calendarEnd: Date
  /**
   * The roll STOPPED at a computed lunar closure instead of passing it (it may be a working day in the official
   * calendar). `ifClosed` is the last day if that closure is real.
   */
  heldAtUnverified: { date: Date; name: string; ifClosed: Date } | null
  /** Computed lunar closures within a day of the deadline (only for years with no official calendar). */
  nearUnverified: UnverifiedLunarHoliday[]
}

/**
 * The last day of a statutory period of N CALENDAR days from `start`, rolled forward to the next working day if (and
 * only if) it lands on a Friday or official holiday.
 *
 * This is the Iranian statutory-deadline rule of قانون آیین دادرسی دادگاه‌های عمومی و انقلاب در امور مدنی: the period
 * is counted in calendar days; only the FINAL day, if it is a non-working day, extends to the next working day (مادهٔ
 * ۴۴۴). The start day itself is not counted, and when the period runs from a SERVICE or an ANNOUNCEMENT
 * (`from: 'service'`) the day of the act is not counted either (مادهٔ ۴۴۵: «روز ابلاغ و اعلام و همچنین روز اقدام جزء
 * مدت محسوب نمی‌شود»), so the last day is start + N + 1 — served ۱۴۰۰/۰۴/۱۰, twenty days, last day ۱۴۰۰/۰۴/۳۱
 * (advisory opinion ۷/۱۴۰۰/۱۰۵۲). The roll applies to that corrected day. Counting WORKING days throughout would
 * over-extend every deadline and risk a missed appeal.
 *
 * A COMPUTED lunar closure (a year with no official calendar) never extends a deadline: the roll stops on it and the
 * result says so (`heldAtUnverified`) — the earlier date is the one a lawyer can never lose by.
 *
 * @param start Jalali date string (`YYYY/MM/DD` or `YYYY-MM-DD`) or Date (read by its local day).
 * @param days  Length of the period in calendar days.
 * @param from  `'service'` when the period runs from a service/announcement (ابلاغ/اعلام), else `'event'`.
 * @throws Error('Invalid date format') for an unparseable string.
 *
 * @example
 * statutoryDeadline('1400/04/10', 20, 'service').deadline // 1400/04/31
 */
export function statutoryDeadline(start: string | Date, days: number, from: PeriodStart): StatutoryDeadline {
  const deadline = toDateInput(start)
  if (!deadline || Number.isNaN(deadline.getTime())) throw new Error('Invalid date format')
  if (!Number.isFinite(days)) throw new Error('Days must be a finite number')
  deadline.setDate(deadline.getDate() + days + actionDayOffset(from))
  const calendarEnd = new Date(deadline)
  let heldAtUnverified: StatutoryDeadline['heldAtUnverified'] = null
  for (let steps = 0; !isWorkingDay(deadline); steps++) {
    scanGuard(steps)
    const unverified = unverifiedLunarClosureName(deadline)
    if (unverified) {
      heldAtUnverified = { date: new Date(deadline), name: unverified, ifClosed: nextWorkingDay(deadline) }
      break
    }
    deadline.setDate(deadline.getDate() + 1)
  }
  return { deadline, calendarEnd, heldAtUnverified, nearUnverified: unverifiedLunarHolidaysNear(deadline, 1) }
}

/** `statutoryDeadline(...).deadline` — for callers that only need the date. */
export function addStatutoryDeadlineDays(start: string | Date, days: number, from: PeriodStart): Date {
  return statutoryDeadline(start, days, from).deadline
}

// ── The closures a deadline passed over, by name ───────────────────────────────────────────────────────────────────

/**
 * A non-working day, named. Example: served Thursday ۱۴۰۵/۰۵/۰۱, twenty days: the act day is Thursday ۱۴۰۵/۰۵/۲۲ —
 * شهادت امام رضا (ع), an official closure — and Friday the ۲۳rd follows, so the last day is Saturday the ۲۴th. Each
 * closure is named from the calendar the count used, so nobody has to guess why the date moved.
 */
export interface NamedClosure {
  date: Date
  /** «شهادت امام رضا (ع)», or «جمعه» for a plain Friday. */
  name: string
  /** An official closure (solar, lunar or a decree), not only the weekly Friday. */
  holiday: boolean
}

/** The closure on `d`, or null on a working day: the holiday's name (also on a Friday), else «جمعه». */
export function closureOn(d: Date): NamedClosure | null {
  if (isWorkingDay(d)) return null
  const name = getHolidayName(d)
  return name ? { date: new Date(d), name, holiday: true } : { date: new Date(d), name: 'جمعه', holiday: false }
}

/** The closures the roll of a statutory deadline passed over: every day from `calendarEnd` up to (not including) `deadline`. */
export function rolledClosures(sd: Pick<StatutoryDeadline, 'calendarEnd' | 'deadline'>): NamedClosure[] {
  const out: NamedClosure[] = []
  for (let d = new Date(sd.calendarEnd), k = 0; jalaliLabel(d) !== jalaliLabel(sd.deadline) && k < 31; d = shiftDays(d, 1), k++) {
    const c = closureOn(d)
    if (c) out.push(c)
  }
  return out
}

/**
 * The OFFICIAL closures strictly between `from` and `to` (Fridays only when they carry a holiday), at most `max`. A
 * period is counted in calendar days: these do not lengthen it (مادهٔ ۴۴۴ moves only a last day) — they are listed so
 * a count «with the official holidays» can be shown from the calendar.
 */
export function holidaysBetween(from: Date, to: Date, max = 12): NamedClosure[] {
  const out: NamedClosure[] = []
  for (let d = shiftDays(from, 1), k = 0; jalaliLabel(d) !== jalaliLabel(to) && k < 400 && out.length < max; d = shiftDays(d, 1), k++) {
    const c = closureOn(d)
    if (c?.holiday) out.push(c)
  }
  return out
}

/** «پنجشنبه ۱۴۰۵/۰۵/۲۲ (شهادت امام رضا (ع))» — or «جمعه ۱۴۰۵/۰۵/۲۳ (تعطیل هفتگی)». */
export function closureLabel(c: NamedClosure): string {
  return `${jalaliLabel(c.date)} (${c.holiday ? c.name : 'تعطیل هفتگی'})`
}

/** The phrase every unverified-closure caveat carries, so a reader (and a test) can find it. */
export const VERIFY_CLOSURE_FA = 'تعطیل این روز را با تقویم رسمی تطبیق دهید'

/**
 * The Persian caveat for a deadline that a computed lunar closure could move, or null. Never silent: a held roll
 * states the later date the official calendar would give.
 */
export function unverifiedClosureCaveat(sd: Pick<StatutoryDeadline, 'deadline' | 'heldAtUnverified' | 'nearUnverified'>): string | null {
  if (sd.heldAtUnverified) {
    const h = sd.heldAtUnverified
    return `روز آخر مهلت، ${jalaliLabel(h.date)}، طبق محاسبهٔ نجومی «${h.name}» است، اما تقویم رسمی سال ${toPersianDigits(jalaali.toJalaali(h.date).jy)} هنوز در داده‌های این کتابخانه ثبت نشده و تعطیلات قمری با رؤیت هلال تا یک روز جابه‌جا می‌شوند؛ ${VERIFY_CLOSURE_FA}. مهلت را به اتکای این تعطیلِ تأییدنشده جلو نبردیم: اگر این روز در تقویم رسمی تعطیل باشد، آخرین روز مهلت ${jalaliLabel(h.ifClosed)} است.`
  }
  const near = sd.nearUnverified.filter((n) => n.offsetDays !== 0)
  if (near.length === 0) return null
  const list = near.map((n) => `«${n.name}» (${jalaliLabel(n.date)})`).join(' و ')
  return `روز آخر مهلت، ${jalaliLabel(sd.deadline)}، یک روز با ${list} فاصله دارد؛ تقویم رسمی آن سال هنوز در داده‌های این کتابخانه ثبت نشده و این تعطیل فقط محاسبه شده است، و با رؤیت هلال ممکن است یک روز جابه‌جا شود و روز آخر مهلت را تعطیل کند؛ ${VERIFY_CLOSURE_FA}.`
}

// ── Hijri month of a date (e.g. دیه: ماه‌های حرام، مادهٔ ۵۵۵ ق.م.ا) ───────────────────────────────────────────────

/** Persian names of the Hijri months, index 0 = محرم. */
export const HIJRI_MONTH_FA = ['محرم', 'صفر', 'ربیع‌الاول', 'ربیع‌الثانی', 'جمادی‌الاول', 'جمادی‌الثانی', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذی‌القعده', 'ذی‌الحجه'] as const

/** The result of {@link hijriMonthAt}. */
export interface HijriMonthAt {
  /** 1 = محرم … 12 = ذی‌الحجه */
  hm: number
  /** Day of the Hijri month, by the same source. */
  hd: number
  source: LunarCalendarSource
  /** The date is the first day of its month by the official table (first two days when computed). */
  nearStart: boolean
  /** The date is the last day of its month by the official table (day 29+ when computed). */
  nearEnd: boolean
}

const dayNumber = (jy: number, jm: number, jd: number) => {
  const g = jalaali.toGregorian(jy, jm, jd)
  return Math.round(Date.UTC(g.gy, g.gm - 1, g.gd) / 86_400_000)
}

/**
 * The Hijri month a Jalali date falls in. An official year answers from its transcribed month starts (the official
 * calendar's own Hijri column); any other date from Umm al-Qura, with a wider boundary band because Iran's sighting
 * can differ from it by a day. Null for an invalid date (or when the engine lacks the Umm al-Qura calendar).
 *
 * @example hijriMonthAt(1405, 9, 20) // { hm: 7, hd: 1, source: 'official', nearStart: true, nearEnd: false }
 */
export function hijriMonthAt(jy: number, jm: number, jd: number): HijriMonthAt | null {
  if (!isRealJalali(jy, jm, jd)) return null
  const starts = OFFICIAL_BY_YEAR.get(jy)?.hijriMonthStarts
  if (starts && starts.length > 0) {
    const n = dayNumber(jy, jm, jd)
    const sorted = [...starts].sort((a, b) => dayNumber(jy, a.jm, a.jd) - dayNumber(jy, b.jm, b.jd))
    let idx = -1
    for (let i = 0; i < sorted.length; i++) if (dayNumber(jy, sorted[i]!.jm, sorted[i]!.jd) <= n) idx = i
    if (idx >= 0) {
      const cur = sorted[idx]!
      const hd = n - dayNumber(jy, cur.jm, cur.jd) + 1
      const next = sorted[idx + 1]
      // The month after the table's last start ends outside this year: past day 28 its end is unknown.
      const nearEnd = next ? dayNumber(jy, next.jm, next.jd) - n === 1 : hd >= 29
      return { hm: cur.hm, hd, source: 'official', nearStart: hd === 1, nearEnd }
    }
  }
  if (!UMALQURA_AVAILABLE) return null
  const g = jalaali.toGregorian(jy, jm, jd)
  const { hm, hd } = hijriPartsOf(new Date(Date.UTC(g.gy, g.gm - 1, g.gd)))
  if (!hm || !hd) return null
  return { hm, hd, source: 'computed', nearStart: hd <= 2, nearEnd: hd >= 29 }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main API
// ═══════════════════════════════════════════════════════════════════════════════

function jParts(date: string | Date): JDate | null {
  if (date instanceof Date) {
    if (Number.isNaN(date.getTime())) return null
    const j = jalaali.toJalaali(date)
    return { jy: j.jy, jm: j.jm, jd: j.jd }
  }
  return parseJalaliDate(date)
}

/**
 * Is the date a working day (not a Friday, not an official holiday, not an added closure)?
 *
 * @param date Jalali date string (`YYYY-MM-DD` / `YYYY/MM/DD`) or Date (read by its local day).
 * @returns false for an unparseable string (fails closed, never throws).
 *
 * @example isWorkingDay('1405/01/01') // false — Nowruz
 */
export function isWorkingDay(date: string | Date): boolean {
  const p = jParts(date)
  if (!p) return false
  const { jy, jm, jd } = p

  // Friday is always non-working, not overridable (JS getDay: 0 = Sunday … 5 = Friday).
  if (jalaliToDate(jy, jm, jd).getDay() === 5) return false

  // Official overrides take precedence over computation (but never over Friday).
  const ov = overrideFor(jy, jm, jd)
  if (ov) return ov.kind === 'remove' // remove → working; add → holiday

  // Solar official holidays (تعطیلات رسمی شمسی ثابت)
  if (SOLAR_OFFICIAL_HOLIDAYS.some((h) => h.month === jm && h.day === jd)) return false

  // Lunar holidays for this year
  if (lunarOf(jy).some((h) => h.month === jm && h.day === jd)) return false

  return true
}

/**
 * The name of the official holiday on a date, or null (a plain Friday has no holiday name and returns null).
 *
 * @example getHolidayName('1405/05/22') // 'شهادت امام رضا (ع)'
 */
export function getHolidayName(date: string | Date): string | null {
  const p = jParts(date)
  if (!p) return null
  const { jy, jm, jd } = p

  const ov = overrideFor(jy, jm, jd)
  if (ov) return ov.kind === 'add' ? ov.name : null

  const solarHoliday = SOLAR_OFFICIAL_HOLIDAYS.find((h) => h.month === jm && h.day === jd)
  if (solarHoliday) return solarHoliday.name

  const lunarHoliday = lunarOf(jy).find((h) => h.month === jm && h.day === jd)
  if (lunarHoliday) return lunarHoliday.name

  return null
}

/**
 * Safety cap for the day-by-day scans: no real calendar closes this many consecutive days, so hitting it means the
 * overrides close every day — fail loudly instead of looping forever.
 */
const MAX_SCAN_DAYS = 3660
function scanGuard(steps: number): void {
  if (steps > MAX_SCAN_DAYS) throw new Error('No working day found within ten years — check the holiday overrides')
}

function requireDate(date: string | Date, message = 'Invalid date format'): Date {
  const d = toDateInput(date)
  if (!d || Number.isNaN(d.getTime())) throw new Error(message)
  return d
}

/**
 * The first working day strictly AFTER `date`.
 *
 * @throws Error('Invalid date format') for an unparseable string or an invalid Date.
 */
export function nextWorkingDay(date: string | Date): Date {
  const currentDate = requireDate(date)
  currentDate.setDate(currentDate.getDate() + 1)
  for (let steps = 0; !isWorkingDay(currentDate); steps++) {
    scanGuard(steps)
    currentDate.setDate(currentDate.getDate() + 1)
  }
  return currentDate
}

/**
 * `date` plus N WORKING days (Fridays and holidays are skipped). N = 0 returns the date unchanged.
 *
 * Note: Iranian statutory periods are counted in CALENDAR days — use {@link statutoryDeadline} for them.
 *
 * @throws for a negative `days` (use {@link subtractWorkingDays}) or an unparseable date.
 */
export function addWorkingDays(date: string | Date, days: number): Date {
  if (days < 0) throw new Error('Days must be non-negative. Use subtractWorkingDays for negative values.')
  const currentDate = requireDate(date)
  let added = 0
  for (let idle = 0; added < days; idle++) {
    scanGuard(idle)
    currentDate.setDate(currentDate.getDate() + 1)
    if (isWorkingDay(currentDate)) {
      added++
      idle = -1
    }
  }
  return currentDate
}

/**
 * `date` minus N WORKING days (Fridays and holidays are skipped). N = 0 returns the date unchanged.
 *
 * @throws for a negative `days` or an unparseable date.
 */
export function subtractWorkingDays(date: string | Date, days: number): Date {
  if (days < 0) throw new Error('Days must be non-negative')
  const currentDate = requireDate(date)
  let subtracted = 0
  for (let idle = 0; subtracted < days; idle++) {
    scanGuard(idle)
    currentDate.setDate(currentDate.getDate() - 1)
    if (isWorkingDay(currentDate)) {
      subtracted++
      idle = -1
    }
  }
  return currentDate
}

const gIso = (jy: number, jm: number, jd: number) => {
  const g = jalaali.toGregorian(jy, jm, jd)
  return `${g.gy}-${String(g.gm).padStart(2, '0')}-${String(g.gd).padStart(2, '0')}`
}
const jSlash = (jy: number, jm: number, jd: number) => `${jy}/${String(jm).padStart(2, '0')}/${String(jd).padStart(2, '0')}`

/**
 * All official holidays in a Jalali month (solar, lunar, and runtime-added closures; dates removed by an override are
 * left out), sorted by date. A date carrying two occasions is listed once per occasion.
 *
 * @example getHolidaysInMonth(1405, 1).map((h) => h.jalaliDate)
 */
export function getHolidaysInMonth(jy: number, jm: number): HolidayInstance[] {
  const holidays: HolidayInstance[] = []
  const removed = (jd: number) => overrideFor(jy, jm, jd)?.kind === 'remove'
  const push = (jd: number, name: string, type: Holiday['type']) => {
    if (!isRealJalali(jy, jm, jd)) return
    holidays.push({ date: gIso(jy, jm, jd), jalaliDate: jSlash(jy, jm, jd), name, type })
  }

  for (const h of SOLAR_OFFICIAL_HOLIDAYS) if (h.month === jm && !removed(h.day)) push(h.day, h.name, h.type)
  for (const h of lunarOf(jy)) if (h.month === jm && !removed(h.day)) push(h.day, h.name, h.type)
  for (const o of ADD) if ((o.jy === undefined || o.jy === jy) && o.jm === jm) push(o.jd, o.name, 'override')

  return holidays.sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * The number of WORKING days between two dates, both inclusive.
 *
 * @throws when `endDate` is before `startDate`, or for an unparseable date.
 */
export function countWorkingDays(startDate: string | Date, endDate: string | Date): number {
  const start = requireDate(startDate, 'Invalid start date')
  const end = requireDate(endDate, 'Invalid end date')
  if (end < start) throw new Error('End date must be after start date')
  let count = 0
  const current = new Date(start)
  while (current <= end) {
    if (isWorkingDay(current)) count++
    current.setDate(current.getDate() + 1)
  }
  return count
}

/**
 * A Date as a Jalali date in Persian digits, `YYYY/MM/DD`.
 *
 * @example formatJalaliDate(new Date(2024, 2, 20)) // '۱۴۰۳/۰۱/۰۱'
 */
export function formatJalaliDate(date: Date): string {
  const j = jalaali.toJalaali(date)
  return `${toPersianDigits(j.jy)}/${toPersianDigits(j.jm).padStart(2, '۰')}/${toPersianDigits(j.jd).padStart(2, '۰')}`
}
