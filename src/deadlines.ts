/**
 * Pure deadline helpers built on the holiday engine: when a law takes effect, and the last day of a statutory
 * deadline rule (a period in days or months attached to a trigger event).
 */
import { statutoryDeadline, unverifiedClosureCaveat } from './holidays.js'
import { deadlineRuleStart, SERVICE_DAY_RULE_FA, type DeadlineRuleIdentity } from './periodStart.js'
import { statutoryMonthsDeadline } from './statutoryMonths.js'

/**
 * The date a law becomes binding — مادهٔ ۲ قانون مدنی:
 * «قوانین، پانزده روز پس از انتشار [در روزنامهٔ رسمی]، در سراسر کشور لازم‌الاجرا است مگر آنکه در خود قانون، ترتیب
 * خاصی برای موقع اجرا مقرر شده باشد.» The trigger is publication in the Official Gazette (روزنامهٔ رسمی).
 *
 * Deliberately NOT holiday-rolled: this is an *effectiveness* date, not a procedural مهلت for performing an act — the
 * final-day roll-forward off a Friday/holiday (مادهٔ ۴۴۴ ق.آ.د.م) applies only to act deadlines, so rolling here would
 * wrongly delay when a statute binds. Pure calendar arithmetic in UTC: the result is UTC midnight of publication
 * day + 15, read from the input's UTC calendar day. The input is not mutated.
 *
 * Does not apply when the law itself sets another commencement — check the law's own text.
 *
 * @example lawEffectiveDate(new Date(Date.UTC(2026, 0, 1))).toISOString() // '2026-01-16T00:00:00.000Z'
 */
export function lawEffectiveDate(publicationDate: Date): Date {
  const d = new Date(Date.UTC(
    publicationDate.getUTCFullYear(),
    publicationDate.getUTCMonth(),
    publicationDate.getUTCDate(),
  ))
  d.setUTCDate(d.getUTCDate() + 15)
  return d
}

/** A deadline rule: who/what it applies to, how long it is, and the article it comes from. */
export interface RuleForDeadline extends DeadlineRuleIdentity {
  /** Length in calendar days (takes precedence when positive). */
  duration_days: number | null
  /** Length in months, counted by the law the rule cites. */
  duration_months: number | null
  /** The article the period comes from, e.g. «ماده ۳۳۶ ق.آ.د.م». */
  legal_basis: string | null
}

/** The result of {@link ruleDeadline}. */
export interface RuleDeadlineResult {
  deadline: Date
  /** Persian notes: how the period was counted, and any unverified-lunar-closure caveat. */
  notes: string[]
}

/**
 * ONE computation of a deadline rule's last day from its trigger date:
 *
 *  · Days: calendar days, the final day rolled off a Friday/holiday (مادهٔ ۴۴۴), via {@link statutoryDeadline}.
 *  · Months: by the law the rule cites (مادهٔ ۴۴۳ «ماه سی روز» or the earlier reading — {@link statutoryMonthsDeadline}).
 *  · A period that runs from a ابلاغ / اعلام ({@link deadlineRuleStart}) also leaves the day of the act out of the
 *    count (مادهٔ ۴۴۵): its last day is one day later, and the note says so next to the date.
 *
 * @returns null when the rule has no calculable duration (e.g. «قبل از محاکمه»).
 *
 * @example
 * ruleDeadline({ case_type: 'civil', trigger_event: 'ابلاغ دادنامه بدوی', deadline_name: 'تجدیدنظرخواهی',
 *   duration_days: 20, duration_months: null, legal_basis: 'ماده ۳۳۶ ق.آ.د.م' }, jalaliToDate(1400, 4, 10))
 * // → deadline 1400/04/31
 */
export function ruleDeadline(rule: RuleForDeadline, triggerDate: Date): RuleDeadlineResult | null {
  const from = deadlineRuleStart(rule)
  const notes: string[] = []
  let deadline: Date
  if (rule.duration_days != null && rule.duration_days > 0) {
    const sd = statutoryDeadline(triggerDate, rule.duration_days, from)
    deadline = sd.deadline
    if (from === 'service') notes.push(`${SERVICE_DAY_RULE_FA}.`)
    const caveat = unverifiedClosureCaveat(sd)
    if (caveat) notes.push(caveat)
  } else if (rule.duration_months != null && rule.duration_months > 0) {
    // Months are counted by the law the rule cites, never on the Gregorian calendar: ماده ۴۴۳ ق.آ.د.م «ماه سی روز»
    // where that law governs, else the earlier of the 30-day and Jalali-calendar readings.
    const sm = statutoryMonthsDeadline(triggerDate, rule.duration_months, rule.legal_basis, from)
    if (!sm) return null
    deadline = sm.deadline
    notes.push(sm.note)
    if (sm.closureCaveat) notes.push(sm.closureCaveat)
  } else {
    return null
  }
  return { deadline, notes }
}
