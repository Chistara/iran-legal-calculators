# @chistara/iran-legal-calculators

Iranian official holidays, working days and statutory deadlines for the Jalali (Solar Hijri) calendar, in TypeScript.

- Official public holidays: the fixed solar ones, plus the lunar (Hijri) ones taken from the **official calendar** where it has been transcribed, or **projected** on the Umm al-Qura calendar otherwise. Projected dates are always labelled as projected.
- Working-day arithmetic: `isWorkingDay`, `nextWorkingDay`, `addWorkingDays`, `countWorkingDays`, and more.
- Statutory deadlines under Iranian civil procedure: periods counted in calendar days (مادهٔ ۴۴۴ ق.آ.د.م), the service day and the action day left out of the count (مادهٔ ۴۴۵), months counted according to the law that sets them (مادهٔ ۴۴۳), and when a law takes effect (مادهٔ ۲ قانون مدنی).
- No I/O at runtime. The data is bundled into the package, so it runs in browsers, Deno, Bun and Node ≥ 18. The only dependency is [`jalaali-js`](https://github.com/jalaali/jalaali-js).

This is release **0.1.0**, the first part of the public-law calculation code from [hoghogh.ai](https://hoghogh.ai) to be open-sourced. See the [roadmap](#roadmap).

> **Not legal advice.** This library helps with calendar arithmetic. Official announcements (the official calendar, government closure decrees, and the text of the law) always take precedence over its output. Check any deadline that matters against an official source.

## Install

```sh
npm install @chistara/iran-legal-calculators
```

Ships ESM and CommonJS builds with type declarations.

## Usage

### Working days and holidays

```ts
import { isWorkingDay, getHolidayName, nextWorkingDay, addWorkingDays, countWorkingDays, formatJalaliDate } from '@chistara/iran-legal-calculators'

isWorkingDay('1405/01/01')               // false (Nowruz)
getHolidayName('1405/05/22')             // 'شهادت امام رضا (ع)'
formatJalaliDate(nextWorkingDay('1405/01/01'))   // '۱۴۰۵/۰۱/۰۵'
addWorkingDays('1405/02/01', 10)         // a Date, 10 working days later
countWorkingDays('1405/02/01', '1405/02/31')     // working days in the range, inclusive
```

Dates can be passed as Jalali strings (`YYYY/MM/DD` or `YYYY-MM-DD`; Persian digits are accepted) or as JavaScript `Date`s.

### Statutory deadlines

```ts
import { statutoryDeadline, unverifiedClosureCaveat, rolledClosures, closureLabel, formatJalaliDate } from '@chistara/iran-legal-calculators'

// A judgment served on 1400/04/10 with a 20-day appeal period. Neither the service day nor the
// action day is counted (مادهٔ ۴۴۵), so the last day is 1400/04/31 (advisory opinion ۷/۱۴۰۰/۱۰۵۲).
const sd = statutoryDeadline('1400/04/10', 20, 'service')
formatJalaliDate(sd.deadline)            // '۱۴۰۰/۰۴/۳۱'

// Served 1405/05/01: the action day is a holiday and the day after it is a Friday,
// so the deadline moves to Saturday 1405/05/24. rolledClosures() lists the days that were skipped:
const s2 = statutoryDeadline('1405/05/01', 20, 'service')
rolledClosures(s2).map(closureLabel)
// ['پنجشنبه ۱۴۰۵/۰۵/۲۲ (شهادت امام رضا (ع))', 'جمعه ۱۴۰۵/۰۵/۲۳ (تعطیل هفتگی)']

// For a year whose lunar holidays are only projected, the deadline is never moved past a projected
// holiday. It stays on that day, and you get a caveat (in Persian) to show your user:
unverifiedClosureCaveat(statutoryDeadline('1406/03/04', 20, 'event'))
// '… تعطیل این روز را با تقویم رسمی تطبیق دهید …'
```

Pass `'service'` when the period runs from a service or announcement (ابلاغ / اعلام), and `'event'` for anything else, for example the issue of an order or an arrest. `deadlineRuleStart()` and `isServiceTrigger()` can work this out from a rule's trigger text.

Periods given in months, such as «سه ماه», are handled by `statutoryMonthsDeadline(trigger, months, legalBasis, from)`. It reads the cited law to decide whether a month means 30 days (مادهٔ ۴۴۳ ق.آ.د.م, including laws that defer to it, such as the Administrative Court law) or the earlier of a 30-day month and a calendar month.

### When a law takes effect

```ts
import { lawEffectiveDate } from '@chistara/iran-legal-calculators'

// مادهٔ ۲ قانون مدنی: a law takes effect 15 days after publication in the Official Gazette.
// This is an effective date, not a deadline for an act, so it is not moved off a Friday or holiday.
lawEffectiveDate(new Date(Date.UTC(2026, 0, 1))).toISOString()   // '2026-01-16T00:00:00.000Z'
```

### Time zones

A Jalali string means exactly one calendar day. A `Date` is read by its **local** calendar day, and the `Date`s returned are local midnights. If your server runs outside Iran, either set `TZ=Asia/Tehran` or build `Date`s with `jalaliToDate(jy, jm, jd)` or `new Date(y, m - 1, d)`. `lawEffectiveDate` is the exception: it works in UTC.

## Data sources and verification

| Data | Source | Status |
|---|---|---|
| Fridays | Weekly closure | Certain; overrides cannot remove a Friday |
| Solar holidays (Nowruz, ۱۲ و ۱۳ فروردین, ۱۴ و ۱۵ خرداد, ۲۲ بهمن, ۲۹ اسفند) | قانون تعطیلات رسمی, the official calendar | Fixed dates |
| Lunar holidays for **1405** | Transcribed from «تعطیلات رسمی سال ۱۴۰۵» and «تقویم رسمی کشور ۱۴۰۵», published by the Calendar Center of the University of Tehran's Institute of Geophysics (مرکز تقویم مؤسسهٔ ژئوفیزیک دانشگاه تهران). The PDF URLs and SHA-256 hashes are recorded in the data. Cross-checked against time.ir | **Vetted** (`'official'`) |
| Lunar holidays for any other year | Projected from fixed Hijri dates on the Umm al-Qura calendar (built into `Intl`) | **Projected** (`'computed'`); can be ±1 day off the official moon sighting |

When the 1405 projection was checked against the official calendar, 7 of the 19 lunar holidays were one day early. That is why official years are preferred, and why a projected holiday never pushes a deadline later. To find out which kind of data you are working with:

```ts
import { holidayDataSource, lunarCalendarSource, officialCalendarYears, officialCalendarFor } from '@chistara/iran-legal-calculators'

officialCalendarYears()             // [1405]
holidayDataSource('1406/03/24')     // 'computed'  ('official' | 'computed' | 'unavailable')
officialCalendarFor(1405)?.url      // the official PDF
```

`hasVettedHolidayData(date)` is kept for compatibility. Despite the name, it only checks that the year falls between 1300 and 1500; use `holidayDataSource` to find out whether the data is official.

### Ad-hoc closures and newly published years

The government sometimes closes offices by decree, for mourning, air pollution or snow. The bundled data cannot know about these closures. Register them at runtime:

```ts
import { setHolidayOverrides } from '@chistara/iran-legal-calculators'

setHolidayOverrides({
  add: [{ jy: 1405, jm: 11, jd: 5, name: 'تعطیل مناسبتی' }],   // a closure by decree
  remove: [],                                                 // a holiday that was cancelled
  official: [/* an OfficialCalendarYear published after this release */],
})
```

### Yearly updates

Iran's official calendar for the next year usually comes out a few months before Nowruz. Each year we transcribe the lunar holidays and the Hijri month starts from the official PDFs, record their URLs and SHA-256 hashes, and publish a release. The test suite checks each transcribed holiday against the Hijri month starts and pins every official holiday. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Reporting a holiday or rate change

If you find a wrong holiday, a decree we have missed, or (in later releases) an outdated rate, please [open an issue](https://github.com/Chistara/iran-legal-calculators/issues). Include a link to the **official source**, such as the official calendar PDF, the government announcement, or the Official Gazette. We cannot accept a change without one.

## Roadmap

- **0.1** (this release): official holidays, working days, statutory deadlines, the date a law takes effect.
- **0.2**: fixed fees (court costs, notary, expert, enforcement, arbitration, registration).
- **0.3**: inheritance shares, severance pay, tax, lawyer's fees.
- **0.4**: diyeh (blood money), mahrieh (dowry) adjusted to the Central Bank index, late-payment damages, with the Central Bank index data.

## Used in production

These calculations run in production at **[hoghogh.ai](https://hoghogh.ai)**. Its public calculators are at [hoghogh.ai/calculators](https://hoghogh.ai/calculators).

## License

[MIT](LICENSE) © 2026 Chistara (hoghogh.ai)

---

<div dir="rtl" lang="fa">

## فارسی

**محاسبه‌گرهای حقوقی ایران**: تعطیلات رسمی، روزهای کاری و مهلت‌های قانونی بر پایهٔ تقویم هجری شمسی، به زبان TypeScript.

### این کتابخانه چه می‌کند؟

- **تعطیلات رسمی:** تعطیلات ثابت شمسی و تعطیلات قمری. تعطیلات قمری هر سالی که تقویم رسمی‌اش وارد شده باشد از همان تقویم گرفته می‌شود و بقیهٔ سال‌ها بر پایهٔ تقویم ام‌القری برآورد می‌شوند. همه‌جا معلوم است کدام تاریخ رسمی است و کدام برآوردی.
- **روزهای کاری:** شمارش روزهای کاری، پیدا کردن روز کاری بعدی، افزودن روز کاری و مانند آن.
- **مهلت‌های قانونی:** مهلت به روز تقویمی شمرده می‌شود و اگر روز آخرش تعطیل باشد به نخستین روز کاری بعد می‌رود (مادهٔ ۴۴۴ ق.آ.د.م). روز ابلاغ و روز اقدام جزء مهلت حساب نمی‌شوند (مادهٔ ۴۴۵). مهلتِ ماهانه به حکم قانونی شمرده می‌شود که آن را تعیین کرده است (مادهٔ ۴۴۳). تاریخ لازم‌الاجرا شدن قانون هم محاسبه می‌شود (مادهٔ ۲ قانون مدنی).
- **بدون I/O:** داده‌ها همراه بسته منتشر می‌شوند و کتابخانه در مرورگر، Deno، Bun و Node 18 به بالا کار می‌کند.

> **این کتابخانه مشاورهٔ حقوقی نیست.** هر جا خروجی آن با اعلام رسمی (تقویم رسمی، مصوبهٔ تعطیلی یا متن قانون) فرق داشته باشد، اعلام رسمی معتبر است. هر مهلت مهمی را با منبع رسمی تطبیق دهید.

### نصب

```sh
npm install @chistara/iran-legal-calculators
```

### نمونه

```ts
import { isWorkingDay, statutoryDeadline, lawEffectiveDate, formatJalaliDate } from '@chistara/iran-legal-calculators'

isWorkingDay('1405/01/01')   // false: نوروز

// دادنامه ۱۴۰۰/۰۴/۱۰ ابلاغ شده و مهلت تجدیدنظرخواهی بیست روز است → آخرین روز ۱۴۰۰/۰۴/۳۱ (نظریهٔ مشورتی ۷/۱۴۰۰/۱۰۵۲)
formatJalaliDate(statutoryDeadline('1400/04/10', 20, 'service').deadline)   // '۱۴۰۰/۰۴/۳۱'

// پانزده روز پس از انتشار در روزنامهٔ رسمی (مادهٔ ۲ قانون مدنی)
lawEffectiveDate(new Date(Date.UTC(2026, 0, 1)))
```

### منبع داده‌ها و راستی‌آزمایی

- تعطیلات قمری **سال ۱۴۰۵** از «تعطیلات رسمی سال ۱۴۰۵» و «تقویم رسمی کشور ۱۴۰۵» (مرکز تقویم مؤسسهٔ ژئوفیزیک دانشگاه تهران) رونویسی شده‌اند. نشانی و هش SHA-256 هر دو PDF در داده‌ها ثبت شده است.
- تعطیلات قمری سال‌های دیگر برآوردی‌اند و ممکن است با رؤیت هلال یک روز جابه‌جا شوند. اگر روز آخر مهلت به چنین تعطیلی بخورد، مهلت از روی آن جلو برده نمی‌شود و هشدار «تعطیل این روز را با تقویم رسمی تطبیق دهید» همراه نتیجه برمی‌گردد.
- تعطیلی‌های مناسبتی (عزای عمومی، آلودگی هوا، برف) در داده‌ها نیستند. آن‌ها را با `setHolidayOverrides` اضافه کنید.
- تقویم رسمی هر سال پس از انتشار رونویسی می‌شود و در نسخهٔ تازه‌ای منتشر می‌شود.

### گزارش خطا یا تغییر

اگر تعطیلی یا (در نسخه‌های بعدی) نرخی نادرست است، لطفاً در [Issues](https://github.com/Chistara/iran-legal-calculators/issues) گزارش دهید و **پیوند منبع رسمی** را هم بگذارید.

### برنامهٔ نسخه‌ها

- **۰٫۲:** هزینه‌های ثابت (هزینهٔ دادرسی، دفترخانه، کارشناسی، اجرا، داوری، ثبت)
- **۰٫۳:** سهم‌الارث، سنوات، مالیات، حق‌الوکاله
- **۰٫۴:** دیه، مهریه به نرخ روز، خسارت تأخیر تأدیه، همراه با داده‌های شاخص بانک مرکزی

این محاسبات در **[hoghogh.ai](https://hoghogh.ai)** به کار می‌روند.

</div>
