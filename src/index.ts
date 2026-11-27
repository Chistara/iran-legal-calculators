/**
 * @chistara/iran-legal-calculators — Iranian official holidays, working days and statutory deadlines.
 *
 * Not legal advice: official announcements (the official calendar, government closure decrees, and the law itself)
 * always prevail. See README.md.
 *
 * @packageDocumentation
 */

export {
  // working days & holidays
  isWorkingDay,
  getHolidayName,
  nextWorkingDay,
  addWorkingDays,
  subtractWorkingDays,
  countWorkingDays,
  getHolidaysInMonth,
  getLunarHolidaysForYear,
  formatJalaliDate,
  // statutory deadlines
  statutoryDeadline,
  addStatutoryDeadlineDays,
  // closures, named
  closureOn,
  rolledClosures,
  holidaysBetween,
  closureLabel,
  // vetted vs projected data
  hasVettedHolidayData,
  holidayDataSource,
  lunarCalendarSource,
  officialCalendarFor,
  officialCalendarYears,
  isValidOfficialYear,
  unverifiedLunarClosureName,
  unverifiedLunarHolidaysNear,
  unverifiedClosureCaveat,
  VERIFY_CLOSURE_FA,
  // runtime overrides (ad-hoc decrees, newly published official years)
  setHolidayOverrides,
  resetHolidayOverrides,
  getHolidayOverrides,
  // Hijri month
  hijriMonthAt,
  HIJRI_MONTH_FA,
} from './holidays.js'
export type {
  HolidayInstance,
  HolidayOverrideAdd,
  HolidayOverrideRemove,
  HolidayOverrides,
  HolidayOverridesResult,
  LunarCalendarSource,
  StatutoryDeadline,
  NamedClosure,
  UnverifiedLunarHoliday,
  HijriMonthAt,
} from './holidays.js'

export { statutoryMonthsDeadline } from './statutoryMonths.js'
export type { StatutoryMonthsDeadline } from './statutoryMonths.js'

export { monthReckoningFor } from './monthReckoning.js'
export type { MonthReckoning, ReckoningRule } from './monthReckoning.js'

export {
  actionDayOffset,
  isServiceTrigger,
  deadlineRuleStart,
  LAW_STARTS_AT_SERVICE,
  SERVICE_DAY_RULE_FA,
} from './periodStart.js'
export type { PeriodStart, DeadlineRuleIdentity, LawStartsAtServiceRule } from './periodStart.js'

export { lawEffectiveDate, ruleDeadline } from './deadlines.js'
export type { RuleForDeadline, RuleDeadlineResult } from './deadlines.js'

export { parseJalaliDate, jalaliToDate, addToJalali, daysBetween, toPersianDigits } from './jalali.js'
export type { JDate, CalendarUnit } from './jalali.js'

export {
  SOLAR_OFFICIAL_HOLIDAYS,
  HIJRI_HOLIDAY_ANCHORS,
  OFFICIAL_CALENDAR_YEARS,
} from './data/officialCalendar.js'
export type {
  Holiday,
  OfficialCalendarYear,
  OfficialDay,
  OfficialHijriMonthStart,
} from './data/officialCalendar.js'
