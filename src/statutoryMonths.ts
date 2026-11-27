/**
 * A statutory period stated in MONTHS, counted the way the law that sets it says, with the holiday roll of the days
 * path ({@link statutoryDeadline}).
 *
 * ─── Why ────────────────────────────────────────────────────────────────────────────────────────────────────────
 * Adding months on the GREGORIAN calendar (setMonth) is wrong for Iranian periods: ۱۴۰۵/۰۱/۱۵ + ۳ ماه → Gregorian
 * ۱۴۰۵/۰۴/۱۳, Jalali calendar ۰۴/۱۵, ماده ۴۴۳ («ماه سی روز») ۹۰ days = ۰۴/۱۴ — up to two days EARLY, or a day LATE
 * (۱۴۰۵/۱۲/۲۰ → ۱۴۰۶/۰۳/۲۱ against ۰۳/۲۰). Neither the Gregorian month nor any other is chosen by the statute except
 * where the statute says so, so the reading is decided per rule FROM THE LAW IT CITES:
 *
 *  · ق.آ.د.م itself — مادهٔ ۴۴۳: «از نظر احتساب مواعد قانونی، سال دوازده ماه، ماه سی روز، هفته هفت روز … است»
 *    (قانون آیین دادرسی دادگاه‌های عمومی و انقلاب در امور مدنی, rc.majlis.ir/fa/law/show/93305). E.g. «صدور رأی
 *    داور ۳ ماه» (تبصرهٔ مادهٔ ۴۸۴) → 90 days.
 *  · ق.د.ع.ا (قانون تشکیلات و آیین دادرسی دیوان عدالت اداری) — تبصرهٔ ۲ مادهٔ ۱۶: «… سه ماه … از تاریخ ابلاغ رأی یا
 *    تصمیم قطعی مرجع مربوط مطابق قانون آیین دادرسی دادگاه‌های عمومی و انقلاب (در امور مدنی) است», and مادهٔ ۱۲۲:
 *    «… سایر موارد سکوت در این قانون به ترتیبی است که در قانون آیین دادرسی … (در امور مدنی) … مقرر شده است»
 *    (rc.majlis.ir/fa/law/show/853390). That law has no counting rule of its own, so ماده ۴۴۳ governs → 30-day
 *    months.
 *  · Any other law (ق.ح.خ مادهٔ ۳۴ — «سه ماه پس از تاریخ ابلاغ رای قطعی»; ق.م; ق.ک) states «ماه» with no counting
 *    rule, and ماده ۴۴۳ is ق.آ.د.م's own (ق.ح.خ مادهٔ ۸ even dispenses with ق.آ.د.م's formalities). The text does not
 *    settle the reading, so the engine takes the EARLIER of the two — the one a lawyer cannot lose by — and prints
 *    both.
 */
import jalaali from 'jalaali-js'
import { statutoryDeadline, unverifiedClosureCaveat } from './holidays.js'
import { addToJalali, daysBetween, jalaliNumericFa, toPersianDigits, type JDate } from './jalali.js'
import { monthReckoningFor, type MonthReckoning } from './monthReckoning.js'
import { SERVICE_DAY_RULE_FA, type PeriodStart } from './periodStart.js'

/** The result of {@link statutoryMonthsDeadline}. */
export interface StatutoryMonthsDeadline {
  /** The last day, after the holiday roll. */
  deadline: Date
  /** Which reading produced `deadline`. */
  reading: 'thirty_day' | 'calendar'
  reckoning: MonthReckoning
  /**
   * trigger + 30·months days, and trigger + months Jalali calendar months (day clamped) — both before the roll, and
   * both one day later for a service-started period (مادهٔ ۴۴۵).
   */
  thirtyDayEnd: Date
  calendarEnd: Date
  /** Persian: how the months were counted, the article, and the other reading when it differs. */
  note: string
  /** The unverified-lunar-closure caveat of the chosen end, or null. */
  closureCaveat: string | null
}

const jOf = (d: Date): JDate => {
  const j = jalaali.toJalaali(d)
  return { jy: j.jy, jm: j.jm, jd: j.jd }
}

/**
 * `trigger` + `months` months for a rule citing `legalBasis`, rolled off a closure like any period (مادهٔ ۴۴۴). The
 * trigger day itself is not counted; when the period runs from a service or an announcement (`from: 'service'`) the
 * day of the act is not counted either (مادهٔ ۴۴۵ — the last day is one day after the months end).
 *
 * @param trigger    The start date (read by its local day).
 * @param months     Whole months, 1–120.
 * @param legalBasis The article the period comes from, e.g. «ماده ۱۶ ق.د.ع.ا» — decides the month reading.
 * @param from       `'service'` for a period from a service/announcement, else `'event'`.
 * @returns null on a non-positive, fractional or absurd month count.
 *
 * @example statutoryMonthsDeadline(jalaliToDate(1405, 2, 10), 3, 'ماده ۴۸۴ قانون آیین دادرسی مدنی', 'event') // 1405/05/07
 */
export function statutoryMonthsDeadline(trigger: Date, months: number, legalBasis: string | null | undefined, from: PeriodStart): StatutoryMonthsDeadline | null {
  if (!Number.isInteger(months) || months <= 0 || months > 120) return null
  if (Number.isNaN(trigger.getTime())) return null
  const start = jOf(trigger)
  const cal = addToJalali(start, months, 'month')
  if (!cal) return null
  const calendarDays = daysBetween(start, cal)
  const thirtyDays = months * 30
  const rule = monthReckoningFor(legalBasis)
  const reading: 'thirty_day' | 'calendar' =
    rule.reckoning === 'thirty_day' || thirtyDays <= calendarDays ? 'thirty_day' : 'calendar'
  const sd = statutoryDeadline(trigger, reading === 'thirty_day' ? thirtyDays : calendarDays, from)
  const thirty = statutoryDeadline(trigger, thirtyDays, from).calendarEnd
  const calendar = statutoryDeadline(trigger, calendarDays, from).calendarEnd
  const same = jalaliNumericFa(thirty) === jalaliNumericFa(calendar)
  const counted = reading === 'thirty_day'
    ? `«${toPersianDigits(months)} ماه» ${toPersianDigits(thirtyDays)} روز شمرده شد`
    : `«${toPersianDigits(months)} ماه» به ماه تقویمی شمرده شد`
  const other = same
    ? ''
    : reading === 'thirty_day'
      ? `؛ به ماه تقویمی ${jalaliNumericFa(calendar)} می‌شد`
      : `؛ به حساب ماه سی‌روزه ${jalaliNumericFa(thirty)} می‌شد`
  return {
    deadline: sd.deadline,
    reading,
    reckoning: rule.reckoning,
    thirtyDayEnd: thirty,
    calendarEnd: calendar,
    note: `${counted} (${rule.basisFa})${other}.${from === 'service' ? ` ${SERVICE_DAY_RULE_FA}.` : ''}`,
    closureCaveat: unverifiedClosureCaveat(sd),
  }
}
