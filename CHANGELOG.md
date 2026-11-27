# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-11-27

### Added

- Iranian official holidays: fixed solar holidays; lunar holidays from the transcribed official calendar for 1405
  (مرکز تقویم مؤسسهٔ ژئوفیزیک دانشگاه تهران, source PDF URL and SHA-256 recorded), projected on the Umm al-Qura
  calendar for every other year.
- Working-day helpers: `isWorkingDay`, `nextWorkingDay`, `addWorkingDays`, `subtractWorkingDays`, `countWorkingDays`,
  `getHolidayName`, `getHolidaysInMonth`, `getLunarHolidaysForYear`, `holidaysBetween`, `closureOn`, `rolledClosures`,
  `closureLabel`, `formatJalaliDate`.
- Statutory deadlines: `statutoryDeadline` / `addStatutoryDeadlineDays` (calendar-day count, final-day roll — مادهٔ
  ۴۴۴ ق.آ.د.م; service and action day excluded — مادهٔ ۴۴۵), `statutoryMonthsDeadline` and `monthReckoningFor`
  (مادهٔ ۴۴۳ «ماه سی روز» or the earlier reading), `ruleDeadline`, `deadlineRuleStart`, `isServiceTrigger`,
  `actionDayOffset`, `lawEffectiveDate` (مادهٔ ۲ قانون مدنی).
- Vetted-vs-projected transparency: `holidayDataSource`, `lunarCalendarSource`, `officialCalendarYears`,
  `officialCalendarFor`, `unverifiedLunarClosureName`, `unverifiedLunarHolidaysNear`, `unverifiedClosureCaveat`;
  a deadline is never rolled over a projected lunar holiday.
- Runtime corrections without I/O: `setHolidayOverrides` / `resetHolidayOverrides` / `getHolidayOverrides` for
  ad-hoc closure decrees and newly published official years.
- `hijriMonthAt` (official Hijri column for official years, Umm al-Qura otherwise).
- Jalali helpers: `parseJalaliDate` (Persian digits accepted), `jalaliToDate`, `addToJalali`, `daysBetween`,
  `toPersianDigits`.
- ESM + CommonJS builds with type declarations; zero runtime I/O; works in browsers, Deno, Bun and Node ≥ 18.

[Unreleased]: https://github.com/Chistara/iran-legal-calculators/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Chistara/iran-legal-calculators/releases/tag/v0.1.0
