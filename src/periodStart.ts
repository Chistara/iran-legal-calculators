/**
 * Does a statutory period run from a SERVICE or an ANNOUNCEMENT (ابلاغ / اعلام)? Then the day of service and the day
 * of the act are both outside the count, and the last day is one day later than «start + N».
 * Pure and dependency-free.
 *
 * ─── The rule ───────────────────────────────────────────────────────────────────────────────────────────────────
 * مادهٔ ۴۴۵ قانون آیین دادرسی دادگاه‌های عمومی و انقلاب در امور مدنی:
 * «موعدی که ابتدای آن تاریخ ابلاغ یا اعلام ذکر شده است، روز ابلاغ و اعلام و همچنین روز اقدام جزء مدت محسوب
 * نمی‌شود.» Advisory opinion ۷/۱۴۰۰/۱۰۵۲ (۱۴۰۰/۰۹/۲۲) of the judiciary's legal department applies it to the
 * twenty-day appeal: «… مدت تجدید نظرخواهی با احتساب روز ابلاغ و اقدام بیست و دو روز است؛ بنابراین … دادنامه در
 * تاریخ ۱۰/۴/۱۴۰۰ ابلاغ شده است، مهلت قانونی برای تجدید نظرخواهی ۳۱/۴/۱۴۰۰ است» — start + N + 1. The holiday roll
 * (مادهٔ ۴۴۴) applies to the corrected last day.
 *
 * The other procedure codes reach the same counting through their own reference articles:
 *   · ق.ا.ا.م مادهٔ ۳۲: «حساب مواعد مطابق مقررات آیین دادرسی مدنی است» (opinion ۷/۱۴۰۱/۸۹۶ reads ۴۴۵ through it);
 *   · ق.د.ع.ا مادهٔ ۱۲۲ («… سایر موارد سکوت در این قانون به ترتیبی است که در قانون آیین دادرسی … (در امور مدنی) …
 *     مقرر شده است») and تبصرهٔ ۲ مادهٔ ۱۶ («… از تاریخ ابلاغ رأی … مطابق قانون آیین دادرسی … (در امور مدنی)»);
 *   · ق.آ.د.ک — opinion ۷/۱۴۰۰/۱۰۶۰: «حکم مقرر در ماده ۴۴۵ … با توجه به اطلاق آن» governs a criminal period that
 *     runs from service (مادهٔ ۱۷۷ ق.آ.د.ک sends service to the civil code).
 *
 * A period from anything else — صدور قرار (ق.آ.د.م مادهٔ ۱۱۲ «ده روز از تاریخ صدور قرار تأمین»), an arrest, a
 * dismissal, a death, a filing — keeps start + N: مادهٔ ۴۴۵ does not reach it.
 */

/** Where a period's clock starts: a service/announcement (مادهٔ ۴۴۵ applies) or any other event. */
export type PeriodStart = 'service' | 'event'

/**
 * Days the last day lies beyond «start + N» before the holiday roll: 1 for a service-started period (the day of the
 * act is not counted either, مادهٔ ۴۴۵), 0 otherwise.
 */
export function actionDayOffset(start: PeriodStart): 0 | 1 {
  return start === 'service' ? 1 : 0
}

const fold = (s: string) => s.replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/[‌‏‎]/g, ' ').replace(/\s+/g, ' ').trim()

/** A trigger text that names a service or an announcement — the two starts مادهٔ ۴۴۵ names. */
export function isServiceTrigger(trigger: string | null | undefined): boolean {
  return /ابلاغ|اعلام/.test(fold(String(trigger ?? '')))
}

/** The fields that identify a deadline rule (a statutory period attached to a trigger event). */
export interface DeadlineRuleIdentity {
  /** e.g. `civil`, `criminal`, `family`, `labor`, `administrative`. */
  case_type?: string | null
  /** The event that starts the clock, in Persian (e.g. «ابلاغ دادنامه بدوی»). */
  trigger_event?: string | null
  /** The act the period is for, in Persian (e.g. «تجدیدنظرخواهی»). */
  deadline_name?: string | null
}

/** A rule whose trigger names the DECISION but whose article starts the clock at its service, with the article. */
export type LawStartsAtServiceRule = Required<{ [K in keyof DeadlineRuleIdentity]: string }> & { article: string }

/**
 * Rules whose trigger_event names the DECISION, not its service, while the article that sets the period starts the
 * clock at its service («از تاریخ ابلاغ»). Keyed by (case_type, trigger_event, deadline_name), each with the article
 * text that decides it.
 */
export const LAW_STARTS_AT_SERVICE: ReadonlyArray<LawStartsAtServiceRule> = [
  { case_type: 'civil', trigger_event: 'صدور اجراییه', deadline_name: 'اجرای داوطلبانه', article: 'مادهٔ ۳۴ ق.ا.ا.م: «همین که اجراییه به محکوم‌علیه ابلاغ شد محکوم‌علیه مکلف است ظرف ده روز …»' },
  { case_type: 'civil', trigger_event: 'داوری', deadline_name: 'صدور رأی داور', article: 'تبصرهٔ مادهٔ ۴۸۴ ق.آ.د.م: «… مدت آن سه ماه و ابتدای آن از روزی است که موضوع برای انجام داوری به داور یا تمام داوران ابلاغ می‌شود»' },
  { case_type: 'civil', trigger_event: 'اخطار رفع نقص دادخواست', deadline_name: 'رفع نقص دادخواست', article: 'مادهٔ ۵۴ ق.آ.د.م: «… از تاریخ‌ابلاغ به‌مدت ده روز به او مهلت می‌دهد …»' },
  { case_type: 'criminal', trigger_event: 'قرار منع تعقیب', deadline_name: 'اعتراض شاکی', article: 'تبصرهٔ مادهٔ ۲۷۰ ق.آ.د.ک: «مهلت اعتراض به قرارهای قابل اعتراض … ده روز … از تاریخ ابلاغ است»' },
  { case_type: 'criminal', trigger_event: 'قرار بازداشت', deadline_name: 'اعتراض متهم', article: 'تبصرهٔ مادهٔ ۲۷۰ ق.آ.د.ک: «مهلت اعتراض به قرارهای قابل اعتراض … ده روز … از تاریخ ابلاغ است»' },
  { case_type: 'labor', trigger_event: 'رأی هیئت تشخیص', deadline_name: 'اعتراض', article: 'مادهٔ ۱۵۹ قانون کار: «رأی هیأتهای تشخیص پس از 15 روز از تاریخ ابلاغ آن لازم‌الاجرا می‌گردد …»' },
  { case_type: 'labor', trigger_event: 'رأی هیئت حل اختلاف', deadline_name: 'اعتراض در دیوان', article: 'تبصرهٔ ۲ مادهٔ ۱۶ ق.د.ع.ا: «… سه ماه … از تاریخ ابلاغ رأی یا تصمیم قطعی مرجع مربوط …»' },
  { case_type: 'administrative', trigger_event: 'رأی کمیسیون ماده ۱۰۰', deadline_name: 'اعتراض', article: 'تبصرهٔ مادهٔ ۱۰۰ قانون شهرداری: «… از تاریخ ابلاغ رأی ظرف مدت ده روز نسبت به آن رأی اعتراض نماید …»' },
  { case_type: 'administrative', trigger_event: 'رأی شعبه بدوی دیوان', deadline_name: 'درخواست تجدیدنظر', article: 'مادهٔ ۶۵ ق.د.ع.ا: «مهلت تجدیدنظرخواهی … بیست روز … از تاریخ ابلاغ است»' },
  { case_type: 'family', trigger_event: 'تعیین اجرت‌المثل', deadline_name: 'اعتراض', article: 'مادهٔ ۳۳۶ ق.آ.د.م: «مهلت درخواست تجدیدنظر … بیست روز … از تاریخ‌ابلاغ …»' },
]

const keyOf = (r: DeadlineRuleIdentity) => [r.case_type, r.trigger_event, r.deadline_name].map((v) => fold(String(v ?? ''))).join('|')
const LAW_STARTS_AT_SERVICE_KEYS = new Set(LAW_STARTS_AT_SERVICE.map(keyOf))

/**
 * A deadline rule → where its clock starts: its trigger names a ابلاغ / اعلام, or the article that sets it starts at
 * service ({@link LAW_STARTS_AT_SERVICE}). Everything else is an event start and keeps start + N.
 */
export function deadlineRuleStart(rule: DeadlineRuleIdentity): PeriodStart {
  if (isServiceTrigger(rule.trigger_event)) return 'service'
  return LAW_STARTS_AT_SERVICE_KEYS.has(keyOf(rule)) ? 'service' : 'event'
}

/** The Persian sentence that states the rule, for every place that explains how a service-started period is counted. */
export const SERVICE_DAY_RULE_FA = 'روز ابلاغ و روز اقدام جزء مهلت حساب نمی‌شوند (مادهٔ ۴۴۵ قانون آیین دادرسی مدنی)'
