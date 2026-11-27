/**
 * Coverage for the exported helpers not exercised by the ported suites: vetted-vs-projected data, runtime overrides,
 * Jalali helpers, the bundled data tables, and the public export surface.
 */
import { afterEach, describe, it, expect } from 'vitest'
import * as lib from '../src/index.js'
import {
  addToJalali,
  daysBetween,
  getHolidayOverrides,
  getLunarHolidaysForYear,
  HIJRI_HOLIDAY_ANCHORS,
  HIJRI_MONTH_FA,
  holidayDataSource,
  isValidOfficialYear,
  isWorkingDay,
  jalaliToDate,
  lunarCalendarSource,
  nextWorkingDay,
  officialCalendarFor,
  officialCalendarYears,
  OFFICIAL_CALENDAR_YEARS,
  parseJalaliDate,
  resetHolidayOverrides,
  setHolidayOverrides,
  SOLAR_OFFICIAL_HOLIDAYS,
  statutoryDeadline,
  toPersianDigits,
  unverifiedLunarClosureName,
  unverifiedLunarHolidaysNear,
  type OfficialCalendarYear,
} from '../src/index.js'

afterEach(() => resetHolidayOverrides())

describe('public export surface', () => {
  it('exports the documented API', () => {
    const fns = [
      'isWorkingDay', 'nextWorkingDay', 'addWorkingDays', 'subtractWorkingDays', 'countWorkingDays', 'holidaysBetween',
      'getHolidayName', 'getHolidaysInMonth', 'getLunarHolidaysForYear', 'statutoryDeadline', 'addStatutoryDeadlineDays',
      'statutoryMonthsDeadline', 'lawEffectiveDate', 'ruleDeadline', 'formatJalaliDate', 'hijriMonthAt', 'closureOn',
      'rolledClosures', 'closureLabel', 'hasVettedHolidayData', 'holidayDataSource', 'lunarCalendarSource',
      'officialCalendarFor', 'officialCalendarYears', 'isValidOfficialYear', 'unverifiedLunarClosureName',
      'unverifiedLunarHolidaysNear', 'unverifiedClosureCaveat', 'setHolidayOverrides', 'resetHolidayOverrides',
      'getHolidayOverrides', 'monthReckoningFor', 'actionDayOffset', 'isServiceTrigger', 'deadlineRuleStart',
      'parseJalaliDate', 'jalaliToDate', 'addToJalali', 'daysBetween', 'toPersianDigits',
    ]
    for (const f of fns) expect(typeof (lib as Record<string, unknown>)[f], f).toBe('function')
    for (const c of ['VERIFY_CLOSURE_FA', 'SERVICE_DAY_RULE_FA']) expect(typeof (lib as Record<string, unknown>)[c], c).toBe('string')
  })
})

describe('vetted (official) vs projected (computed) holiday data', () => {
  it('officialCalendarYears lists the bundled official years', () => {
    expect(officialCalendarYears()).toEqual(OFFICIAL_CALENDAR_YEARS.map((y) => y.jy).sort((a, b) => a - b))
    expect(officialCalendarYears()).toContain(1405)
  })

  it('holidayDataSource tells official, computed and unavailable apart', () => {
    expect(holidayDataSource('1405/07/01')).toBe('official')
    expect(holidayDataSource('1406/07/01')).toBe('computed')
    expect(holidayDataSource(jalaliToDate(1404, 7, 1))).toBe('computed')
    expect(holidayDataSource(new Date(Date.UTC(2500, 0, 1)))).toBe('unavailable')
    expect(holidayDataSource('nonsense')).toBe('unavailable')
    expect(holidayDataSource(new Date(NaN))).toBe('unavailable')
  })

  it('lunarCalendarSource and officialCalendarFor agree', () => {
    expect(lunarCalendarSource(1405)).toBe('official')
    expect(lunarCalendarSource(1406)).toBe('computed')
    expect(officialCalendarFor(1406)).toBeNull()
  })

  it('getLunarHolidaysForYear: the official list for 1405, a projected list for 1406 with every anchor present', () => {
    expect(getLunarHolidaysForYear(1405)).toHaveLength(19)
    const y1406 = getLunarHolidaysForYear(1406)
    const names = new Set(y1406.map((h) => h.name))
    for (const [, , name] of HIJRI_HOLIDAY_ANCHORS) expect(names.has(name), name).toBe(true)
    expect(names.has('شهادت امام رضا (ع)')).toBe(true) // آخر صفر, found dynamically
    for (const h of y1406) expect(h.type).toBe('religious')
    // A returned list is a copy: mutating it does not corrupt the cache.
    y1406.length = 0
    expect(getLunarHolidaysForYear(1406).length).toBeGreaterThan(0)
  })

  it('unverifiedLunarClosureName is null on a Friday, a solar holiday, a working day and an invalid Date', () => {
    expect(unverifiedLunarClosureName(jalaliToDate(1406, 3, 21))).toBeNull() // a Friday
    expect(unverifiedLunarClosureName(jalaliToDate(1406, 1, 1))).toBeNull() // Nowruz (solar)
    expect(unverifiedLunarClosureName(jalaliToDate(1406, 7, 1))).toBeNull()
    expect(unverifiedLunarClosureName(new Date(NaN))).toBeNull()
    expect(unverifiedLunarHolidaysNear(new Date(NaN))).toEqual([])
  })

  it('a computed lunar day overridden by the official decree is no longer "unverified"', () => {
    setHolidayOverrides({ add: [{ jy: 1406, jm: 3, jd: 24, name: 'تاسوعای حسینی' }] })
    expect(unverifiedLunarClosureName(jalaliToDate(1406, 3, 24))).toBeNull()
    expect(statutoryDeadline('1406/03/04', 20, 'event').heldAtUnverified?.date.getTime()).toBe(jalaliToDate(1406, 3, 25).getTime())
  })
})

describe('runtime overrides', () => {
  const official1406: OfficialCalendarYear = {
    jy: 1406,
    source: 'test transcription',
    url: 'https://example.org/Holiday-1406.pdf',
    lunar: [{ jm: 3, jd: 25, name: 'تاسوعای حسینی' }, { jm: 3, jd: 26, name: 'عاشورای حسینی' }],
  }

  it('a supplied official year replaces the computation for that year, and the deadline rolls over it', () => {
    const r = setHolidayOverrides({ official: [official1406] })
    expect(r.officialYears).toEqual([1405, 1406])
    expect(lunarCalendarSource(1406)).toBe('official')
    expect(isWorkingDay('1406/03/24')).toBe(true) // the projected تاسوعا is not used any more
    expect(isWorkingDay('1406/03/25')).toBe(false)
    const sd = statutoryDeadline('1406/03/05', 20, 'event') // ends ۰۳/۲۵ → ۰۳/۲۶ → ۰۳/۲۷
    expect(sd.heldAtUnverified).toBeNull()
    expect(sd.deadline.getTime()).toBe(jalaliToDate(1406, 3, 27).getTime())
    resetHolidayOverrides()
    expect(lunarCalendarSource(1406)).toBe('computed')
  })

  it('an official year with one malformed entry is rejected as a whole', () => {
    const bad = { ...official1406, lunar: [...official1406.lunar, { jm: 3, jd: 40, name: 'x' }] }
    expect(isValidOfficialYear(bad)).toBe(false)
    expect(isValidOfficialYear({ ...official1406, url: 'http://insecure.example' })).toBe(false)
    expect(isValidOfficialYear(null)).toBe(false)
    const r = setHolidayOverrides({ official: [bad] })
    expect(r.rejected.official).toBe(1)
    expect(lunarCalendarSource(1406)).toBe('computed')
  })

  it('getHolidayOverrides returns copies of what is in force; overrides replace, not accumulate', () => {
    setHolidayOverrides({ add: [{ jm: 7, jd: 7, name: 'a' }] })
    setHolidayOverrides({ remove: [{ jm: 1, jd: 13 }] })
    const o = getHolidayOverrides()
    expect(o).toEqual({ add: [], remove: [{ jm: 1, jd: 13 }] })
    o.remove.push({ jm: 1, jd: 1 })
    expect(getHolidayOverrides().remove).toHaveLength(1)
  })

  it('closing every day fails loudly instead of looping forever', () => {
    const add = []
    for (let jm = 1; jm <= 12; jm++) for (let jd = 1; jd <= 31; jd++) add.push({ jm, jd, name: 'x' })
    setHolidayOverrides({ add })
    expect(() => nextWorkingDay('1405/01/01')).toThrow(/No working day/)
  })
})

describe('Jalali helpers', () => {
  it('parseJalaliDate accepts - and /, single digits, Persian and Arabic-Indic digits; rejects non-dates', () => {
    expect(parseJalaliDate('1405/05/22')).toEqual({ jy: 1405, jm: 5, jd: 22 })
    expect(parseJalaliDate('1405-5-2')).toEqual({ jy: 1405, jm: 5, jd: 2 })
    expect(parseJalaliDate('۱۴۰۵/۰۵/۲۲')).toEqual({ jy: 1405, jm: 5, jd: 22 })
    expect(parseJalaliDate('١٤٠٥/٠٥/٢٢')).toEqual({ jy: 1405, jm: 5, jd: 22 })
    expect(parseJalaliDate(' 1405/05/22 ')).toEqual({ jy: 1405, jm: 5, jd: 22 })
    expect(parseJalaliDate('1405/12/30')).toBeNull() // 1405 is not a leap year
    expect(parseJalaliDate('1403/12/30')).toEqual({ jy: 1403, jm: 12, jd: 30 })
    expect(parseJalaliDate('05/22/1405')).toBeNull()
    expect(parseJalaliDate('')).toBeNull()
  })

  it('jalaliToDate gives local midnight of the Gregorian day', () => {
    const d = jalaliToDate(1405, 1, 1)
    expect([d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours()]).toEqual([2026, 3, 21, 0])
  })

  it('addToJalali clamps calendar months, handles weeks/days/years, and rejects bad input', () => {
    expect(addToJalali({ jy: 1405, jm: 6, jd: 31 }, 1, 'month')).toEqual({ jy: 1405, jm: 7, jd: 30 })
    expect(addToJalali({ jy: 1405, jm: 12, jd: 10 }, 1, 'month')).toEqual({ jy: 1406, jm: 1, jd: 10 })
    expect(addToJalali({ jy: 1405, jm: 1, jd: 10 }, -1, 'month')).toEqual({ jy: 1404, jm: 12, jd: 10 })
    expect(addToJalali({ jy: 1403, jm: 12, jd: 30 }, 1, 'year')).toEqual({ jy: 1404, jm: 12, jd: 29 })
    expect(addToJalali({ jy: 1405, jm: 1, jd: 1 }, 2, 'week')).toEqual({ jy: 1405, jm: 1, jd: 15 })
    expect(addToJalali({ jy: 1405, jm: 1, jd: 1 }, -1, 'day')).toEqual({ jy: 1404, jm: 12, jd: 29 })
    expect(addToJalali({ jy: 1405, jm: 13, jd: 1 }, 1, 'day')).toBeNull()
    expect(addToJalali({ jy: 1405, jm: 1, jd: 1 }, 1.5, 'day')).toBeNull()
    expect(addToJalali({ jy: 1500, jm: 12, jd: 1 }, 1, 'month')).toBeNull()
  })

  it('daysBetween counts whole days, negative when earlier', () => {
    expect(daysBetween({ jy: 1405, jm: 1, jd: 1 }, { jy: 1406, jm: 1, jd: 1 })).toBe(365)
    expect(daysBetween({ jy: 1405, jm: 1, jd: 10 }, { jy: 1405, jm: 1, jd: 1 })).toBe(-9)
  })

  it('toPersianDigits', () => {
    expect(toPersianDigits(1405)).toBe('۱۴۰۵')
    expect(toPersianDigits('1405/05/22')).toBe('۱۴۰۵/۰۵/۲۲')
  })
})

describe('bundled data tables', () => {
  it('the solar list has the ten fixed closures, all real dates', () => {
    expect(SOLAR_OFFICIAL_HOLIDAYS).toHaveLength(10)
    for (const h of SOLAR_OFFICIAL_HOLIDAYS) expect(parseJalaliDate(`1405/${h.month}/${h.day}`), h.name).not.toBeNull()
  })

  it('the Hijri anchors are valid month/day pairs; 12 Hijri month names', () => {
    expect(HIJRI_HOLIDAY_ANCHORS).toHaveLength(16)
    for (const [m, d] of HIJRI_HOLIDAY_ANCHORS) {
      expect(m).toBeGreaterThanOrEqual(1)
      expect(m).toBeLessThanOrEqual(12)
      expect(d).toBeGreaterThanOrEqual(1)
      expect(d).toBeLessThanOrEqual(30)
    }
    expect(HIJRI_MONTH_FA).toHaveLength(12)
    expect(HIJRI_MONTH_FA[0]).toBe('محرم')
  })
})
