/**
 * «N ماه» is counted by the law the rule cites — never on the Gregorian calendar.
 *
 * Adding months with setMonth gives ۱۴۰۵/۰۲/۱۰ + ۳ ماه → ۱۴۰۵/۰۵/۰۸ where ماده ۴۴۳ ق.آ.د.م («ماه سی روز») gives
 * ۰۵/۰۷ — a day late — and ۱۴۰۵/۱۲/۲۰ + ۳ ماه → ۱۴۰۶/۰۳/۲۱ against ۰۳/۱۹. Each legal-basis string is pinned with
 * the article that decides its reading:
 *  · ق.آ.د.م (ماده ۴۸۴ تبصره — داوری ۳ ماه): ماده ۴۴۳ → 30-day months.
 *  · ق.د.ع.ا (ماده ۱۶ تبصرهٔ ۲ «… مطابق قانون آیین دادرسی … مدنی», ماده ۱۲۲): → 30-day months.
 *  · ق.ح.خ / ق.م / ق.ک: no counting rule of their own → the EARLIER of 30-day and Jalali-calendar months.
 */
import { describe, it, expect } from 'vitest'
import jalaali from 'jalaali-js'
import { monthReckoningFor, ruleDeadline, statutoryMonthsDeadline } from '../src/index.js'

const J = (jy: number, jm: number, jd: number) => {
  const g = jalaali.toGregorian(jy, jm, jd)
  return new Date(Date.UTC(g.gy, g.gm - 1, g.gd))
}
const key = (d: Date) => { const j = jalaali.toJalaali(d); return `${j.jy}/${j.jm}/${j.jd}` }

/** Month-rules (legal basis, months) and the reading the law gives. */
const RULES: Array<[string, number, 'thirty_day' | 'earlier_of_both']> = [
  ['ماده ۴۸۴ قانون آیین دادرسی مدنی', 3, 'thirty_day'],
  ['ماده ۳۴ ق.ح.خ', 3, 'earlier_of_both'],
  ['ماده ۲۸ ق.ح.خ', 2, 'earlier_of_both'],
  ['ماده ۱۶ ق.د.ع.ا', 3, 'thirty_day'],
  ['ماده ۱۲۱۸ ق.م', 1, 'earlier_of_both'],
  ['ماده ۳۷ ق.ک', 1, 'earlier_of_both'],
  ['ماده ۷۹ ق.د.ع.ا', 3, 'thirty_day'],
]

describe('monthReckoningFor — per rule, from the law it cites', () => {
  it.each(RULES)('«%s» (%i months) → %s', (basis, _m, expected) => {
    expect(monthReckoningFor(basis).reckoning).toBe(expected)
  })
  it('ق.آ.د.ک (criminal procedure) and ق.م (civil code) are NOT read as ق.آ.د.م', () => {
    expect(monthReckoningFor('ماده ۴۳۱ ق.آ.د.ک').reckoning).toBe('earlier_of_both')
    expect(monthReckoningFor('ماده ۱۲۱۸ ق.م').reckoning).toBe('earlier_of_both')
    expect(monthReckoningFor('ماده ۳۳۶ ق.آ.د.م').reckoning).toBe('thirty_day')
    expect(monthReckoningFor(null).reckoning).toBe('earlier_of_both')
  })
  it('the full name of the administrative court law is recognised, and every reading carries its basis', () => {
    expect(monthReckoningFor('قانون دیوان عدالت اداری').reckoning).toBe('thirty_day')
    for (const [basis] of RULES) expect(monthReckoningFor(basis).basisFa.length).toBeGreaterThan(10)
  })
})

describe('statutoryMonthsDeadline — dates', () => {
  it('ماده ۴۴۳ (ق.آ.د.م): ۱۴۰۵/۰۲/۱۰ + ۳ ماه = ۹۰ روز = ۱۴۰۵/۰۵/۰۷ (Gregorian gave ۰۵/۰۸, calendar ۰۵/۱۰)', () => {
    const r = statutoryMonthsDeadline(J(1405, 2, 10), 3, 'ماده ۴۸۴ قانون آیین دادرسی مدنی', 'event')!
    expect(key(r.deadline)).toBe('1405/5/7')
    expect(r.reading).toBe('thirty_day')
    expect(key(r.calendarEnd)).toBe('1405/5/10')
    expect(r.note).toContain('۴۴۳')
    expect(r.note).toContain('۱۴۰۵/۰۵/۱۰') // the other reading is printed
  })

  it('ماده ۴۴۳ across the year end: ۱۴۰۵/۱۲/۲۰ + ۳ ماه = ۱۴۰۶/۰۳/۱۹ (Gregorian gave ۰۳/۲۱)', () => {
    const r = statutoryMonthsDeadline(J(1405, 12, 20), 3, 'ماده ۱۶ ق.د.ع.ا', 'event')!
    expect(key(r.deadline)).toBe('1406/3/19')
  })

  it('no counting rule in the cited law: the EARLIER reading — the 30-day one in a 31-day half…', () => {
    const r = statutoryMonthsDeadline(J(1405, 2, 10), 3, 'ماده ۳۴ ق.ح.خ', 'event')!
    expect(key(r.deadline)).toBe('1405/5/7')
    expect(r.reckoning).toBe('earlier_of_both')
  })

  it('…and the calendar one across a 29-day اسفند (۱۴۰۵/۱۲/۱۰ + ۱ ماه → ۱۴۰۶/۰۱/۱۰, not ۰۱/۱۱)', () => {
    const r = statutoryMonthsDeadline(J(1405, 12, 10), 1, 'ماده ۱۲۱۸ ق.م', 'event')!
    expect(r.reading).toBe('calendar')
    expect(key(r.deadline)).toBe('1406/1/10')
    expect(r.note).toContain('ماه سی‌روزه') // the other reading is printed
    const t = statutoryMonthsDeadline(J(1405, 12, 10), 1, 'ماده ۴۸۴ قانون آیین دادرسی مدنی', 'event')!
    expect(key(t.deadline)).toBe('1406/1/11')
  })

  it('rolls off a closure like any period (ماده ۴۴۴): ۱۴۰۵/۰۱/۱۵ + ۳ ماه = ۰۴/۱۲ (Friday) → ۰۴/۱۳', () => {
    const r = statutoryMonthsDeadline(J(1405, 1, 15), 3, 'ماده ۴۸۴ قانون آیین دادرسی مدنی', 'event')!
    expect(key(r.thirtyDayEnd)).toBe('1405/4/12')
    expect(key(r.deadline)).toBe('1405/4/13')
  })

  it('refuses an absurd month count or an invalid trigger', () => {
    expect(statutoryMonthsDeadline(J(1405, 1, 15), 0, null, 'event')).toBeNull()
    expect(statutoryMonthsDeadline(J(1405, 1, 15), 1.5, null, 'event')).toBeNull()
    expect(statutoryMonthsDeadline(J(1405, 1, 15), 121, null, 'event')).toBeNull()
    expect(statutoryMonthsDeadline(new Date(NaN), 1, null, 'event')).toBeNull()
  })
})

describe('ruleDeadline — a month rule carries its reading', () => {
  it('ماده ۴۸۴ rule from ۱۴۰۵/۰۲/۱۰ ends on ۱۴۰۵/۰۵/۰۷ with the ماده ۴۴۳ note', () => {
    // «داوری» is not a service trigger and this key is not in LAW_STARTS_AT_SERVICE under another deadline name.
    const r = ruleDeadline({ case_type: 'civil', trigger_event: 'داوری', deadline_name: 'مهلت داوری', duration_days: null, duration_months: 3, legal_basis: 'ماده ۴۸۴ قانون آیین دادرسی مدنی' }, J(1405, 2, 10))!
    expect(key(r.deadline)).toBe('1405/5/7')
    expect(r.notes.join(' ')).toContain('۴۴۳')
  })
})
