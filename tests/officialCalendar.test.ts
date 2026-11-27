/**
 * The official 1405 calendar is the one deadlines are rolled against — never the Umm al-Qura computation.
 *
 * Measured against «تعطیلات رسمی سال ۱۴۰۵» of مرکز تقویم مؤسسهٔ ژئوفیزیک دانشگاه تهران (the PDF whose url and sha256
 * the bundled data carries; time.ir lists the same 26 closures), the computation put 7 of the 19 lunar closures one day
 * EARLY and missed شهادت امام حسن عسکری. A day treated as a closure that is not one pushes a deadline LATER — the
 * missed-appeal direction. For a year WITHOUT an official entry, a deadline is never rolled over a computed lunar
 * closure and is flagged when one is within a day.
 */
import { describe, it, expect } from 'vitest'
import jalaali from 'jalaali-js'
import {
  getHolidaysInMonth, getHolidayName, isWorkingDay, lunarCalendarSource, officialCalendarFor,
  statutoryDeadline, addStatutoryDeadlineDays, unverifiedClosureCaveat, unverifiedLunarHolidaysNear,
  unverifiedLunarClosureName, hijriMonthAt, VERIFY_CLOSURE_FA, OFFICIAL_CALENDAR_YEARS, isValidOfficialYear,
  jalaliToDate,
} from '../src/index.js'

const Y1405 = OFFICIAL_CALENDAR_YEARS.find((o) => o.jy === 1405)!

const J = (jy: number, jm: number, jd: number) => {
  const g = jalaali.toGregorian(jy, jm, jd)
  return new Date(Date.UTC(g.gy, g.gm - 1, g.gd))
}
/** Noon local time, so a Date read by its local day and a UTC-based computation agree on the calendar day. */
const at = (jy: number, jm: number, jd: number) => { const d = jalaliToDate(jy, jm, jd); d.setHours(12); return d }
const key = (d: Date) => { const j = jalaali.toJalaali(d); return `${j.jy}/${j.jm}/${j.jd}` }

/** The 26 closures of the official PDF, transcribed independently of the data module (jm/jd). */
const OFFICIAL_1405 = [
  [1, 1], [1, 2], [1, 3], [1, 4], [1, 12], [1, 13], [1, 25], [3, 6], [3, 14], [3, 15], [4, 3], [4, 4], [5, 13],
  [5, 21], [5, 22], [5, 30], [6, 8], [8, 22], [10, 2], [10, 16], [11, 4], [11, 22], [12, 9], [12, 19], [12, 20], [12, 29],
] as const

describe('bundled official data', () => {
  it('every bundled official year passes validation', () => {
    for (const y of OFFICIAL_CALENDAR_YEARS) expect(isValidOfficialYear(y), String(y.jy)).toBe(true)
  })
})

describe('the official 1405 calendar replaces the computation', () => {
  it('1405 is an official year, and the entry cites the official PDF', () => {
    expect(lunarCalendarSource(1405)).toBe('official')
    const o = officialCalendarFor(1405)!
    expect(o.url).toMatch(/^https:\/\/calendar\.ut\.ac\.ir\/documents\/.*Holiday-1405\.pdf/)
    expect(o.sha256).toMatch(/^[0-9a-f]{64}$/)
  })

  it('FAILS IF A COMPUTED LUNAR DAY IS USED FOR 1405: the holiday set is exactly the 26 official closures', () => {
    const got = new Set<string>()
    for (let m = 1; m <= 12; m++) for (const h of getHolidaysInMonth(1405, m)) got.add(`${m}/${Number(h.jalaliDate.split('/')[2])}`)
    expect([...got].sort()).toEqual(OFFICIAL_1405.map(([m, d]) => `${m}/${d}`).sort())
  })

  it.each<[[number, number], [number, number], string]>([
    // [computed (wrong) day — must be WORKING unless a Friday, official day — must be closed]
    [[1, 24], [1, 25], 'شهادت امام صادق'],
    [[5, 12], [5, 13], 'اربعین'],
    [[5, 20], [5, 21], 'رحلت پیامبر'],
    [[10, 1], [10, 2], 'ولادت حضرت علی'],
    [[10, 15], [10, 16], 'مبعث'],
    [[11, 3], [11, 4], 'نیمه شعبان'],
    [[12, 18], [12, 20], 'فطر'],
  ])('the computed day %j is working and the official day %j is closed (%s)', ([cm, cd], [om, od]) => {
    expect(isWorkingDay(J(1405, cm, cd)) || new Date(J(1405, cm, cd)).getUTCDay() === 5).toBe(true)
    expect(isWorkingDay(J(1405, om, od))).toBe(false)
    expect(getHolidayName(`1405/${om}/${od}`)).toBeTruthy()
  })

  it('specific official days (frontend parity checks)', () => {
    expect(isWorkingDay(at(1405, 1, 24))).toBe(true) // computed شهادت امام صادق — wrong day
    expect(getHolidayName(at(1405, 1, 25))).toContain('صادق')
    expect(isWorkingDay(at(1405, 5, 12))).toBe(true) // computed اربعین — wrong day
    expect(isWorkingDay(at(1405, 5, 13))).toBe(false)
    expect(isWorkingDay(at(1405, 10, 16))).toBe(false) // مبعث
    expect(isWorkingDay(at(1405, 12, 20))).toBe(false) // فطر (دوم)
  })

  it('the Date API and the Jalali-string API agree on EVERY day of 1405', () => {
    for (let jm = 1; jm <= 12; jm++) {
      const len = jalaali.jalaaliMonthLength(1405, jm)
      for (let jd = 1; jd <= len; jd++) {
        expect(isWorkingDay(at(1405, jm, jd)), `1405/${jm}/${jd}`).toBe(isWorkingDay(`1405/${jm}/${jd}`))
        expect(getHolidayName(at(1405, jm, jd)), `1405/${jm}/${jd}`).toBe(getHolidayName(`1405/${jm}/${jd}`))
      }
    }
  })

  it('شهادت امام حسن عسکری (۸ ربیع‌الاول) is on the list (ردیف ۱۶; a Friday in 1405) and in the computed anchors', () => {
    expect(getHolidayName('1405/5/30')).toContain('عسکری')
    // 1406 has no official entry: the anchor exists in the computation too.
    const all1406 = Array.from({ length: 12 }, (_, i) => getHolidaysInMonth(1406, i + 1)).flat()
    expect(all1406.some((h) => h.name.includes('عسکری'))).toBe(true)
  })

  it('every transcribed lunar closure agrees with the transcribed Hijri month starts (two columns of the official calendar)', () => {
    const dayNo = (jm: number, jd: number) => Math.round(J(1405, jm, jd).getTime() / 86_400_000)
    for (const d of Y1405.lunar) {
      const start = Y1405.hijriMonthStarts!.find((m) => m.hy === d.hy && m.hm === d.hm)
      expect(start, `no month start for ${d.hy}/${d.hm}`).toBeTruthy()
      expect(dayNo(d.jm, d.jd) - dayNo(start!.jm, start!.jd) + 1, `${d.name} ${d.jm}/${d.jd}`).toBe(d.hd)
    }
    // The official «آخر صفر» (شهادت امام رضا) is the day before ۱ ربیع‌الاول.
    const reza = Y1405.lunar.find((d) => d.note === 'آخر صفر')!
    const rabi1 = Y1405.hijriMonthStarts!.find((m) => m.hy === 1448 && m.hm === 3)!
    expect(dayNo(rabi1.jm, rabi1.jd) - dayNo(reza.jm, reza.jd)).toBe(1)
  })

  it('the official solar list equals the engine\'s fixed solar closures', () => {
    for (const s of Y1405.solar!) expect(isWorkingDay(J(1405, s.jm, s.jd)), `${s.jm}/${s.jd}`).toBe(false)
  })

  it('a 1405 deadline next to an OFFICIAL closure carries no unverified-closure flag', () => {
    // ۱۴۰۵/۰۵/۲۰ + 1 day → ۵/۲۱ and ۵/۲۲ (official closures), ۵/۲۳ (Friday) → ۵/۲۴, no caveat.
    const sd = statutoryDeadline(J(1405, 5, 20), 1, 'event')
    expect(key(sd.deadline)).toBe('1405/5/24')
    expect(sd.heldAtUnverified).toBeNull()
    expect(unverifiedClosureCaveat(sd)).toBeNull()
  })
})

describe('a year with no official calendar (1406): never rolled over, always flagged', () => {
  // Computed تاسوعا 1406 = ۱۴۰۶/۰۳/۲۴ (Monday), عاشورا ۰۳/۲۵.
  it('a last day ON a computed lunar closure is NOT rolled forward — the earlier date, with the later one stated', () => {
    const sd = statutoryDeadline(J(1406, 3, 4), 20, 'event')
    expect(key(sd.calendarEnd)).toBe('1406/3/24')
    expect(key(sd.deadline)).toBe('1406/3/24')
    expect(sd.heldAtUnverified?.name).toBe('تاسوعای حسینی')
    expect(key(sd.heldAtUnverified!.ifClosed)).toBe('1406/3/26')
    const c = unverifiedClosureCaveat(sd)!
    expect(c).toContain(VERIFY_CLOSURE_FA)
    expect(c).toContain('۱۴۰۶/۰۳/۲۶')
    expect(addStatutoryDeadlineDays(J(1406, 3, 4), 20, 'event').getTime()).toBe(sd.deadline.getTime())
  })

  it('a last day one day BEFORE a computed closure is flagged', () => {
    const sd = statutoryDeadline(J(1406, 3, 3), 20, 'event')
    expect(key(sd.deadline)).toBe('1406/3/23')
    expect(sd.heldAtUnverified).toBeNull()
    expect(unverifiedClosureCaveat(sd)).toContain(VERIFY_CLOSURE_FA)
  })

  it('a last day one day AFTER a computed closure is flagged', () => {
    const near = unverifiedLunarHolidaysNear(J(1406, 3, 26), 1)
    expect(near.map((n) => n.offsetDays)).toEqual([-1])
    expect(unverifiedClosureCaveat({ deadline: J(1406, 3, 26), heldAtUnverified: null, nearUnverified: near })).toContain(VERIFY_CLOSURE_FA)
  })

  it('a deadline far from any lunar day carries no flag', () => {
    const sd = statutoryDeadline(J(1406, 7, 1), 10, 'event')
    expect(sd.heldAtUnverified).toBeNull()
    expect(unverifiedClosureCaveat(sd)).toBeNull()
  })

  it('a service-started twenty days from ۱۴۰۶/۰۳/۰۴ ends on the act day ۰۳/۲۵ (computed عاشورا) — held there and flagged', () => {
    // ظرف ۲۰ روز از ابلاغ: ۱۴۰۶/۰۳/۰۴ + ۲۰ = ۰۳/۲۴، روز اقدام (ماده ۴۴۵) ۰۳/۲۵.
    const sd = statutoryDeadline('1406/03/04', 20, 'service')
    expect(key(sd.deadline)).toBe('1406/3/25')
    expect(unverifiedClosureCaveat(sd)).toContain(VERIFY_CLOSURE_FA)
  })

  it('a computed lunar day of a non-official year (تاسوعا ۱۴۰۶/۰۳/۲۴) is flagged, never silently a roll', () => {
    expect(unverifiedLunarClosureName(at(1406, 3, 24))).toBe('تاسوعای حسینی')
    expect(unverifiedLunarClosureName(at(1405, 4, 3))).toBeNull() // official 1405 تاسوعا is verified
    expect(unverifiedLunarHolidaysNear(at(1406, 3, 23), 1).map((n) => n.offsetDays)).toEqual([1])
  })
})

describe('hijriMonthAt — the official Hijri column, else Umm al-Qura', () => {
  it('reads 1405 dates off the official month starts', () => {
    expect(hijriMonthAt(1405, 9, 20)).toMatchObject({ hm: 7, hd: 1, source: 'official', nearStart: true })
    expect(hijriMonthAt(1405, 9, 19)).toMatchObject({ hm: 6, hd: 30, source: 'official', nearEnd: true })
    expect(hijriMonthAt(1405, 10, 5)).toMatchObject({ hm: 7, hd: 16, source: 'official', nearStart: false, nearEnd: false })
  })
  it('falls back to the computation, marked as such, outside an official year', () => {
    expect(hijriMonthAt(1406, 7, 1)?.source).toBe('computed')
  })
  it('returns null for an invalid date', () => {
    expect(hijriMonthAt(1405, 13, 1)).toBeNull()
    expect(hijriMonthAt(1405, 12, 31)).toBeNull()
  })
})
