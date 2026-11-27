import { afterEach, describe, it, expect } from 'vitest'
import jalaali from 'jalaali-js'
import {
  isWorkingDay,
  getHolidayName,
  nextWorkingDay,
  addWorkingDays,
  subtractWorkingDays,
  countWorkingDays,
  getHolidaysInMonth,
  formatJalaliDate,
  addStatutoryDeadlineDays,
  hasVettedHolidayData,
  setHolidayOverrides,
  resetHolidayOverrides,
} from '../src/index.js'

// Dates are built with explicit LOCAL components (new Date(y, m0, d)) to avoid
// UTC-vs-local timezone drift in getDay()/toJalaali().
const D = (y: number, m1: number, d: number) => new Date(y, m1 - 1, d)

const MS_PER_DAY = 24 * 60 * 60 * 1000

describe('addStatutoryDeadlineDays — canonical calendar-day statutory counter', () => {
  it('counts CALENDAR days, not working days (no mid-period extension)', () => {
    // Monday 2024-05-13. +20 calendar days = 2024-06-02 (a Sunday, working in Iran).
    // Working-day counting would have pushed this ~28 days out.
    const start = D(2024, 5, 13)
    const out = addStatutoryDeadlineDays(start, 20, 'event')
    const diffDays = Math.round((out.getTime() - start.getTime()) / MS_PER_DAY)
    expect(diffDays).toBe(20)
    expect(isWorkingDay(out)).toBe(true)
  })

  it('rolls ONLY the final day forward when it lands on a Friday/holiday', () => {
    // 2024-05-12 (Sun) + 5 = 2024-05-17 which is a Friday → must roll to 2024-05-18 (Sat).
    const start = D(2024, 5, 12)
    expect(D(2024, 5, 17).getDay()).toBe(5) // Friday
    const out = addStatutoryDeadlineDays(start, 5, 'event')
    expect(isWorkingDay(out)).toBe(true)
    const diffDays = Math.round((out.getTime() - start.getTime()) / MS_PER_DAY)
    expect(diffDays).toBe(6) // 5 + one-day roll off the Friday
  })

  it('accepts a Jalali date STRING start (dash separator) and produces the same result as the Date form', () => {
    // 2024-05-12 == 1403/02/23
    const out = addStatutoryDeadlineDays('1403-02-23', 5, 'event')
    const outFromDate = addStatutoryDeadlineDays(D(2024, 5, 12), 5, 'event')
    expect(out.getTime()).toBe(outFromDate.getTime())
  })

  it('throws on an unparseable Jalali date string', () => {
    expect(() => addStatutoryDeadlineDays('not-a-date', 5, 'event')).toThrow('Invalid date format')
  })
})

describe('official overrides — add/remove on top of computation', () => {
  afterEach(() => resetHolidayOverrides())

  it('add forces a holiday; remove forces a working day (Fridays unaffected)', () => {
    const r = setHolidayOverrides({
      add: [{ jy: 1405, jm: 7, jd: 15, name: 'تعطیل آزمایشی' }],
      remove: [{ jm: 1, jd: 13 }], // سیزده‌بدر every year
    })
    expect(r).toMatchObject({ add: 1, remove: 1, rejected: { add: 0, remove: 0, official: 0 } })

    const g1 = jalaali.toGregorian(1405, 7, 15)
    const added = new Date(g1.gy, g1.gm - 1, g1.gd)
    expect(getHolidayName(added)).toBe('تعطیل آزمایشی')
    expect(isWorkingDay(added)).toBe(false)

    const g2 = jalaali.toGregorian(1405, 1, 13)
    const removed = new Date(g2.gy, g2.gm - 1, g2.gd)
    // سیزده‌بدر is normally a solar holiday; the override forces it working
    // (unless it lands on a Friday, which this year it does not).
    expect(removed.getDay()).not.toBe(5)
    expect(isWorkingDay(removed)).toBe(true)
    expect(getHolidayName(removed)).toBeNull()
  })

  it('a year-scoped ("jy") add override does NOT leak into other years on the same month/day', () => {
    setHolidayOverrides({ add: [{ jy: 1405, jm: 7, jd: 15, name: 'تعطیل آزمایشی' }], remove: [] })
    // Same month/day but a DIFFERENT Jalali year — must be unaffected by the 1405-only override.
    const gOtherYear = jalaali.toGregorian(1406, 7, 15)
    const otherYearDate = new Date(gOtherYear.gy, gOtherYear.gm - 1, gOtherYear.gd)
    expect(getHolidayName(otherYearDate)).not.toBe('تعطیل آزمایشی')
  })

  it('a "remove" override can NEVER make a Friday a working day (hard business rule)', () => {
    // 2024-03-15 is a Friday == 1402/12/25.
    const friday = D(2024, 3, 15)
    expect(friday.getDay()).toBe(5)
    const j = jalaali.toJalaali(2024, 3, 15)
    setHolidayOverrides({ add: [], remove: [{ jy: j.jy, jm: j.jm, jd: j.jd }] })
    // Even with an explicit "remove" override targeting this exact date, Friday wins.
    expect(isWorkingDay(friday)).toBe(false)
  })

  it('no overrides (the default, or after reset) is a no-op: the bundled calendar applies', () => {
    setHolidayOverrides({ remove: [{ jm: 1, jd: 1 }] })
    expect(isWorkingDay(D(2024, 3, 20))).toBe(true)
    resetHolidayOverrides()
    // Plain calendar again — Nowruz is a holiday.
    expect(isWorkingDay(D(2024, 3, 20))).toBe(false)
    setHolidayOverrides(null)
    expect(isWorkingDay(D(2024, 3, 20))).toBe(false)
  })

  it('malformed entries are dropped and reported, and the calendar still computes normally', () => {
    const r = setHolidayOverrides({
      add: [
        { jy: 1405, jm: 13, jd: 1, name: 'bad month' },
        { jm: 1, jd: 1, name: '' },
        null as never,
      ],
      remove: [{ jy: 1405, jm: 2, jd: 32 }],
      official: [{ jy: 1405 } as never],
    })
    expect(r.add).toBe(0)
    expect(r.remove).toBe(0)
    expect(r.rejected).toEqual({ add: 3, remove: 1, official: 1 })
    expect(isWorkingDay(D(2024, 3, 20))).toBe(false) // Nowruz still computed normally
    expect(getHolidayName(D(2024, 3, 20))).toBe('نوروز')
  })
})

describe('hasVettedHolidayData — computable range guard', () => {
  it('reports data available for an in-range Jalali year (1404)', () => {
    expect(hasVettedHolidayData(D(2025, 6, 1))).toBe(true) // ~1404
  })

  it('still reports data available for a future year (lunar days are computed, no table cliff)', () => {
    expect(hasVettedHolidayData(D(2040, 6, 1))).toBe(true) // ~1419
  })

  it('reports data NOT available for a far-past date below jy 1300', () => {
    expect(hasVettedHolidayData(D(1800, 1, 1))).toBe(false) // ~jy 1178
  })

  it('reports data NOT available for a far-future date above jy 1500', () => {
    expect(hasVettedHolidayData(D(2200, 6, 1))).toBe(false) // ~jy 1579
  })

  it('reports data NOT available for an invalid Date', () => {
    expect(hasVettedHolidayData(new Date(NaN))).toBe(false)
  })
})

describe('computed lunar holidays (Umm al-Qura)', () => {
  // Ground truth: Ashura (10 Muharram) fell on ~16-17 Jul 2024 and ~5-6 Jul 2025.
  it('marks Ashura 1403 (Umm al-Qura: 16 Jul 2024 = 26 Tir) as a non-working holiday', () => {
    expect(getHolidayName(D(2024, 7, 16))).toMatch(/عاشورا/)
    expect(isWorkingDay(D(2024, 7, 16))).toBe(false)
  })

  it('marks Ashura 1404 in Tir (5 Jul 2025), NOT on Farvardin 1', () => {
    expect(getHolidayName(D(2025, 7, 5))).toMatch(/عاشورا/) // 14 Tir 1404
    // Farvardin 1 1404 (21 Mar 2025) is Nowruz, NOT Ashura.
    expect(getHolidayName(D(2025, 3, 21))).not.toMatch(/عاشورا/)
  })

  it('computes lunar holidays for far years without throwing', () => {
    expect(() => isWorkingDay(D(2027, 3, 20))).not.toThrow()
    expect(() => isWorkingDay(D(2040, 3, 20))).not.toThrow()
  })
})

describe('iranianHolidays — working-day engine (deadline date-math core)', () => {
  describe('isWorkingDay', () => {
    it('treats Friday as a non-working day', () => {
      expect(D(2024, 3, 15).getDay()).toBe(5)
      expect(isWorkingDay(D(2024, 3, 15))).toBe(false)
    })

    it('treats Nowruz (1 Farvardin) as a non-working solar holiday', () => {
      // 2024-03-20 = 1 Farvardin 1403 (Nowruz) — a Wednesday, so only the holiday rule applies.
      expect(D(2024, 3, 20).getDay()).not.toBe(5)
      expect(isWorkingDay(D(2024, 3, 20))).toBe(false)
    })

    it('treats a normal mid-week non-holiday as a working day', () => {
      // 2024-05-13 = Monday, ~24 Ordibehesht 1403, no holiday.
      expect(isWorkingDay(D(2024, 5, 13))).toBe(true)
    })

    it('accepts a Jalali date string with dash separator', () => {
      expect(isWorkingDay('1403-02-24')).toBe(true)
    })

    it('accepts a Jalali date string with slash separator', () => {
      expect(isWorkingDay('1403/02/24')).toBe(true)
    })

    it('accepts single-digit month/day in a Jalali date string', () => {
      // 1404-1-1 must resolve identically to 1404-01-01 (Nowruz — non-working).
      expect(isWorkingDay('1404-1-1')).toBe(false)
    })

    it('accepts Persian digits in a Jalali date string', () => {
      expect(isWorkingDay('۱۴۰۳/۰۲/۲۴')).toBe(true)
      expect(isWorkingDay('۱۴۰۴/۰۱/۰۱')).toBe(false)
    })

    it('returns false (fails closed, does not throw) for a string that is not a date', () => {
      expect(isWorkingDay('garbage')).toBe(false)
      expect(isWorkingDay('')).toBe(false)
      expect(isWorkingDay('1405/13/01')).toBe(false) // no 13th month
      expect(isWorkingDay(new Date(NaN))).toBe(false)
    })
  })

  describe('getHolidayName', () => {
    it('returns the Persian name for a solar-fixed holiday (Nowruz)', () => {
      expect(getHolidayName(D(2024, 3, 20))).toBe('نوروز')
    })

    it('returns null for an ordinary working day', () => {
      expect(getHolidayName(D(2024, 5, 13))).toBeNull()
    })

    it('returns null (not a holiday name) for a plain Friday with no coinciding holiday', () => {
      expect(getHolidayName(D(2024, 3, 15))).toBeNull()
    })

    it('returns null for an unparseable date string', () => {
      expect(getHolidayName('not-a-date')).toBeNull()
    })

    it('accepts a Jalali date string and finds the same holiday as the Date form', () => {
      expect(getHolidayName('1403-01-01')).toBe(getHolidayName(D(2024, 3, 20)))
    })
  })

  describe('nextWorkingDay', () => {
    it('rolls a Friday forward to the next working day', () => {
      const result = nextWorkingDay(D(2024, 3, 15)) // Friday
      expect(isWorkingDay(result)).toBe(true)
      expect(result.getDay()).not.toBe(5)
      expect(result.getTime()).toBeGreaterThan(D(2024, 3, 15).getTime())
    })

    it('always returns a working day and never the input non-working day itself', () => {
      const start = D(2024, 3, 20) // Nowruz holiday
      const result = nextWorkingDay(start)
      expect(isWorkingDay(result)).toBe(true)
      expect(result.getTime()).toBeGreaterThan(start.getTime())
    })

    it('skips the Nowruz block, landing on the first genuinely open day', () => {
      // 1-4 Farvardin are solar holidays, so starting AT 1 Farvardin 1403 resolves to the 5th.
      const result = nextWorkingDay(D(2024, 3, 20))
      const j = jalaali.toJalaali(result)
      expect(j.jm).toBe(1)
      expect(j.jd).toBe(5)
    })

    it('returns the next working day even when the input is a working day', () => {
      // Monday 2024-05-13 → Tuesday 2024-05-14 (strictly after).
      expect(nextWorkingDay(D(2024, 5, 13)).getTime()).toBe(D(2024, 5, 14).getTime())
    })

    it('accepts a Jalali date string start', () => {
      const result = nextWorkingDay('1403-01-01') // Nowruz
      expect(isWorkingDay(result)).toBe(true)
    })

    it('throws on an unparseable Jalali date string', () => {
      expect(() => nextWorkingDay('nonsense')).toThrow('Invalid date format')
    })

    it('does not mutate the input Date', () => {
      const input = D(2024, 3, 15)
      const before = input.getTime()
      nextWorkingDay(input)
      expect(input.getTime()).toBe(before)
    })
  })

  describe('addWorkingDays', () => {
    it('adds N working days, skipping an intervening Friday', () => {
      // 2024-05-13 (Mon) + 5 working days, skipping Friday 2024-05-17 → lands 2024-05-19 (Sun).
      const result = addWorkingDays(D(2024, 5, 13), 5)
      expect(result.getFullYear()).toBe(2024)
      expect(result.getMonth()).toBe(4)
      expect(result.getDate()).toBe(19)
      expect(isWorkingDay(result)).toBe(true)
    })

    it('returns the same date unchanged when adding 0 days', () => {
      const start = D(2024, 5, 13)
      expect(addWorkingDays(start, 0).getTime()).toBe(start.getTime())
    })

    it('accepts a Jalali date string start', () => {
      const result = addWorkingDays('1403-02-24', 5) // == 2024-05-13
      expect(result.getDate()).toBe(19)
      expect(result.getMonth()).toBe(4)
    })

    it('throws for negative day counts (must use subtractWorkingDays)', () => {
      expect(() => addWorkingDays(D(2024, 5, 13), -1)).toThrow(
        'Days must be non-negative. Use subtractWorkingDays for negative values.',
      )
    })

    it('throws on an unparseable Jalali date string', () => {
      expect(() => addWorkingDays('nonsense', 5)).toThrow('Invalid date format')
    })
  })

  describe('subtractWorkingDays', () => {
    it('subtracts N working days, skipping an intervening Friday', () => {
      // 2024-05-20 (Mon) - 5 working days, skipping Friday 2024-05-17 → lands 2024-05-14 (Tue).
      const result = subtractWorkingDays(D(2024, 5, 20), 5)
      expect(result.getFullYear()).toBe(2024)
      expect(result.getMonth()).toBe(4)
      expect(result.getDate()).toBe(14)
      expect(isWorkingDay(result)).toBe(true)
    })

    it('returns the same date unchanged when subtracting 0 days', () => {
      const start = D(2024, 5, 20)
      expect(subtractWorkingDays(start, 0).getTime()).toBe(start.getTime())
    })

    it('throws for negative day counts', () => {
      expect(() => subtractWorkingDays(D(2024, 5, 20), -3)).toThrow('Days must be non-negative')
    })

    it('throws on an unparseable Jalali date string', () => {
      expect(() => subtractWorkingDays('nonsense', 5)).toThrow('Invalid date format')
    })
  })

  describe('countWorkingDays', () => {
    it('counts only working days across an inclusive range, excluding a Friday inside it', () => {
      // 2024-05-13 (Mon) .. 2024-05-20 (Mon) inclusive = 8 calendar days, 1 Friday excluded → 7.
      expect(countWorkingDays(D(2024, 5, 13), D(2024, 5, 20))).toBe(7)
    })

    it('returns 1 for a single-day range that is a working day', () => {
      expect(countWorkingDays(D(2024, 5, 13), D(2024, 5, 13))).toBe(1)
    })

    it('returns 0 for a single-day range that is a holiday', () => {
      expect(countWorkingDays(D(2024, 3, 20), D(2024, 3, 20))).toBe(0) // Nowruz
    })

    it('accepts Jalali date strings for both bounds', () => {
      // 1403-02-24 == 2024-05-13, 1403-02-31 == 2024-05-20.
      expect(countWorkingDays('1403-02-24', '1403-02-31')).toBe(countWorkingDays(D(2024, 5, 13), D(2024, 5, 20)))
    })

    it('throws when end date is before start date', () => {
      expect(() => countWorkingDays(D(2024, 5, 20), D(2024, 5, 13))).toThrow('End date must be after start date')
    })

    it('throws on an unparseable start date string', () => {
      expect(() => countWorkingDays('nonsense', '1403-02-24')).toThrow('Invalid start date')
    })

    it('throws on an unparseable end date string', () => {
      expect(() => countWorkingDays('1403-02-24', 'nonsense')).toThrow('Invalid end date')
    })
  })

  describe('getHolidaysInMonth', () => {
    it('lists Nowruz-block solar holidays for Farvardin (month 1) with correct shape', () => {
      const holidays = getHolidaysInMonth(1404, 1)
      const nowruz = holidays.find((h) => h.name === 'نوروز')
      expect(nowruz).toBeDefined()
      expect(nowruz).toMatchObject({ jalaliDate: '1404/01/01', name: 'نوروز', type: 'solar-fixed' })
      expect(nowruz!.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)

      const days = holidays.filter((h) => h.type === 'solar-fixed' || h.type === 'national').map((h) => h.jalaliDate)
      expect(days).toEqual(expect.arrayContaining([
        '1404/01/01', '1404/01/02', '1404/01/03', '1404/01/04', '1404/01/12', '1404/01/13',
      ]))
    })

    it('only includes entries for the requested month', () => {
      for (const h of getHolidaysInMonth(1404, 1)) expect(h.jalaliDate.startsWith('1404/01/')).toBe(true)
    })

    it('returns holidays sorted ascending by Gregorian date', () => {
      const dates = getHolidaysInMonth(1404, 1).map((h) => h.date)
      expect(dates).toEqual([...dates].sort((a, b) => a.localeCompare(b)))
    })

    it('returns an array of in-month entries for a month with no fixed solar holiday (Mehr)', () => {
      const holidays = getHolidaysInMonth(1404, 7)
      expect(Array.isArray(holidays)).toBe(true)
      for (const h of holidays) expect(h.jalaliDate.startsWith('1404/07/')).toBe(true)
    })

    it('reflects runtime overrides: an added closure is listed, a removed one is not', () => {
      try {
        setHolidayOverrides({ add: [{ jy: 1405, jm: 7, jd: 15, name: 'تعطیل آزمایشی' }], remove: [{ jy: 1405, jm: 1, jd: 13 }] })
        expect(getHolidaysInMonth(1405, 7)).toContainEqual(expect.objectContaining({ jalaliDate: '1405/07/15', type: 'override' }))
        expect(getHolidaysInMonth(1405, 1).map((h) => h.jalaliDate)).not.toContain('1405/01/13')
      } finally {
        resetHolidayOverrides()
      }
    })
  })

  describe('formatJalaliDate', () => {
    it('formats a Gregorian Date into Persian-digit YYYY/MM/DD', () => {
      expect(formatJalaliDate(D(2024, 3, 20))).toBe('۱۴۰۳/۰۱/۰۱')
    })

    it('zero-pads single-digit month/day with Persian digits', () => {
      expect(formatJalaliDate(D(2024, 5, 13))).toBe('۱۴۰۳/۰۲/۲۴')
    })
  })

  describe('calendar-day deadline with terminal-day roll-forward', () => {
    // Count CALENDAR days, then if the final day is a holiday/Friday, roll forward to the next working day.
    const calcDeadline = (start: Date, days: number) => {
      const d = new Date(start)
      d.setDate(d.getDate() + days)
      return isWorkingDay(d) ? d : nextWorkingDay(d)
    }

    it('does NOT skip intermediate Fridays/holidays (calendar counting)', () => {
      const start = D(2024, 5, 5) // Sunday
      const deadline = calcDeadline(start, 20)
      const calendarGap = Math.round((deadline.getTime() - start.getTime()) / 86_400_000)
      expect(calendarGap).toBeGreaterThanOrEqual(20)
      expect(calendarGap).toBeLessThanOrEqual(23)
      expect(deadline.getTime()).toBe(addStatutoryDeadlineDays(start, 20, 'event').getTime())
    })

    it('lands the final deadline on a working day', () => {
      expect(isWorkingDay(calcDeadline(D(2024, 5, 5), 10))).toBe(true)
    })
  })
})
