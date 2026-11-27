/**
 * ماده ۴۴۵ ق.آ.د.م: «موعدی که ابتدای آن تاریخ ابلاغ یا اعلام ذکر شده است، روز ابلاغ و اعلام و همچنین روز اقدام جزء
 * مدت محسوب نمی‌شود.» Advisory opinion ۷/۱۴۰۰/۱۰۵۲: a judgment served ۱۴۰۰/۰۴/۱۰ → the twenty-day appeal ends
 * ۱۴۰۰/۰۴/۳۱ (start + N + 1). A period from any other event keeps start + N, and the holiday roll (ماده ۴۴۴) applies
 * to the corrected last day.
 */
import { describe, it, expect } from 'vitest'
import jalaali from 'jalaali-js'
import {
  actionDayOffset,
  deadlineRuleStart,
  isServiceTrigger,
  LAW_STARTS_AT_SERVICE,
  ruleDeadline,
  SERVICE_DAY_RULE_FA,
  statutoryDeadline,
  statutoryMonthsDeadline,
} from '../src/index.js'

const J = (jy: number, jm: number, jd: number) => {
  const g = jalaali.toGregorian(jy, jm, jd)
  return new Date(g.gy, g.gm - 1, g.gd)
}
const key = (d: Date) => {
  const j = jalaali.toJalaali(d)
  return `${j.jy}/${String(j.jm).padStart(2, '0')}/${String(j.jd).padStart(2, '0')}`
}

describe('statutoryDeadline — the day of service and the day of the act (ماده ۴۴۵)', () => {
  it('advisory opinion ۷/۱۴۰۰/۱۰۵۲: served ۱۴۰۰/۰۴/۱۰, twenty days → ۱۴۰۰/۰۴/۳۱', () => {
    const sd = statutoryDeadline(J(1400, 4, 10), 20, 'service')
    expect(key(sd.calendarEnd)).toBe('1400/04/31')
    expect(key(sd.deadline)).toBe('1400/04/31')
  })

  it('the same twenty days from an event that is not a service keep start + N', () => {
    expect(key(statutoryDeadline(J(1400, 4, 10), 20, 'event').deadline)).toBe('1400/04/30')
  })

  it('the holiday roll applies to the CORRECTED day: served ۱۴۰۵/۱۱/۰۱ → ۲۲ بهمن (holiday) → جمعه ۲۳ → شنبه ۲۴', () => {
    // start + 20 = Wednesday ۱۱/۲۱, a working day.
    expect(key(statutoryDeadline(J(1405, 11, 1), 20, 'event').deadline)).toBe('1405/11/21')
    const sd = statutoryDeadline(J(1405, 11, 1), 20, 'service')
    expect(key(sd.calendarEnd)).toBe('1405/11/22')
    expect(key(sd.deadline)).toBe('1405/11/24')
    expect(sd.deadline.getDay()).toBe(6) // Saturday
  })

  it('a last day an event count had already rolled does not move twice (served Thursday ۱۴۰۵/۰۶/۱۷, ten days)', () => {
    // Event: ۰۶/۲۷ is a Friday → ۰۶/۲۸. Service: the day of the act is ۰۶/۲۸ itself, a Saturday.
    expect(key(statutoryDeadline(J(1405, 6, 17), 10, 'event').deadline)).toBe('1405/06/28')
    expect(key(statutoryDeadline(J(1405, 6, 17), 10, 'service').deadline)).toBe('1405/06/28')
  })

  it('accepts a Jalali string start, and rejects a non-finite day count', () => {
    expect(key(statutoryDeadline('1400/04/10', 20, 'service').deadline)).toBe('1400/04/31')
    expect(() => statutoryDeadline('1400/04/10', Number.NaN, 'service')).toThrow()
  })

  it('actionDayOffset is 1 for a service and 0 otherwise', () => {
    expect(actionDayOffset('service')).toBe(1)
    expect(actionDayOffset('event')).toBe(0)
  })
})

describe('where a period\'s clock starts', () => {
  it('a trigger that names a ابلاغ / اعلام is a service', () => {
    expect(isServiceTrigger('ابلاغ دادنامه بدوی')).toBe(true)
    expect(isServiceTrigger('اعلام رأی هیئت حل اختلاف')).toBe(true)
    expect(isServiceTrigger('صدور قرار')).toBe(false)
    expect(isServiceTrigger(null)).toBe(false)
    expect(deadlineRuleStart({ case_type: 'civil', trigger_event: 'ابلاغ دادنامه غیابی', deadline_name: 'واخواهی' })).toBe('service')
    expect(deadlineRuleStart({ case_type: 'criminal', trigger_event: 'ابلاغ حکم حضوری', deadline_name: 'تجدیدنظرخواهی' })).toBe('service')
  })

  it('the rules whose article starts the clock at service, though the trigger names the decision', () => {
    expect(LAW_STARTS_AT_SERVICE).toHaveLength(10)
    for (const r of LAW_STARTS_AT_SERVICE) {
      expect(deadlineRuleStart(r), `${r.case_type}|${r.trigger_event}|${r.deadline_name}`).toBe('service')
      expect(r.article).toMatch(/ماده/)
    }
    // ZWNJ / Arabic-letter variants of the same key still match.
    expect(deadlineRuleStart({ case_type: 'family', trigger_event: 'تعیین اجرت المثل', deadline_name: 'اعتراض' })).toBe('service')
    expect(deadlineRuleStart({ case_type: 'family', trigger_event: 'تعيين اجرت‌المثل', deadline_name: 'اعتراض' })).toBe('service')
  })

  it('periods from an event that is not a service keep start + N', () => {
    const events = [
      { case_type: 'civil', trigger_event: 'صدور قرار تأمین خواسته', deadline_name: 'اجرای قرار' }, // ق.آ.د.م ۱۱۲: «از تاریخ صدور قرار»
      { case_type: 'criminal', trigger_event: 'بازداشت موقت', deadline_name: 'تمدید' },
      { case_type: 'labor', trigger_event: 'اخراج کارگر', deadline_name: 'شکایت' },
      { case_type: 'family', trigger_event: 'صدور گواهی عدم سازش', deadline_name: 'ثبت طلاق' }, // ق.ح.خ ۳۴: ابلاغ OR قطعی شدن
      { case_type: 'non_litigation', trigger_event: 'فوت مورث', deadline_name: 'مهلت درخواست انحصار وراثت' },
      // Same deadline_name as a service row, different trigger: the key is the whole row.
      { case_type: 'labor', trigger_event: 'رأی هیئت تشخیص', deadline_name: 'اعتراض در دیوان' },
    ]
    for (const r of events) expect(deadlineRuleStart(r), r.trigger_event).toBe('event')
    expect(deadlineRuleStart({})).toBe('event')
  })
})

describe('ruleDeadline — one computation for every deadline rule', () => {
  it('rule «تجدیدنظرخواهی ۲۰ روز / ابلاغ دادنامه بدوی»: served ۱۴۰۰/۰۴/۱۰ → ۱۴۰۰/۰۴/۳۱, and the note states the rule', () => {
    const r = ruleDeadline({ case_type: 'civil', trigger_event: 'ابلاغ دادنامه بدوی', deadline_name: 'تجدیدنظرخواهی', duration_days: 20, duration_months: null, legal_basis: 'ماده ۳۳۶ ق.آ.د.م' }, J(1400, 4, 10))!
    expect(key(r.deadline)).toBe('1400/04/31')
    expect(r.notes.join(' ')).toContain('روز ابلاغ و روز اقدام جزء مهلت حساب نمی‌شوند (مادهٔ ۴۴۵')
    expect(r.notes[0]).toBe(`${SERVICE_DAY_RULE_FA}.`)
  })

  it('rule «اجرای قرار ۱۰ روز / صدور قرار تأمین خواسته» keeps start + N and says nothing about ماده ۴۴۵', () => {
    const r = ruleDeadline({ case_type: 'civil', trigger_event: 'صدور قرار تأمین خواسته', deadline_name: 'اجرای قرار', duration_days: 10, duration_months: null, legal_basis: 'ماده ۱۱۲ ق.آ.د.م' }, J(1405, 7, 1))!
    expect(key(r.deadline)).toBe('1405/07/11')
    expect(r.notes.join(' ')).not.toContain('۴۴۵')
  })

  it('a months rule from service: «اعتراض در دیوان ۳ ماه» → ۹۰ days (ماده ۴۴۳) + the day of the act', () => {
    const r = ruleDeadline({ case_type: 'labor', trigger_event: 'رأی هیئت حل اختلاف', deadline_name: 'اعتراض در دیوان', duration_days: null, duration_months: 3, legal_basis: 'ماده ۱۶ ق.د.ع.ا' }, J(1405, 1, 15))!
    // ۱۴۰۵/۰۱/۱۵ + ۹۰ days (31 + 31 + 31 in the first three months) = ۰۴/۱۲; the day of the act ۰۴/۱۳.
    expect(key(r.deadline)).toBe('1405/04/13')
    expect(r.notes.join(' ')).toContain('مادهٔ ۴۴۵')
  })

  it('a rule with no duration yields nothing', () => {
    expect(ruleDeadline({ case_type: 'criminal', trigger_event: 'ابلاغ کیفرخواست', deadline_name: 'آخرین دفاع', duration_days: null, duration_months: null, legal_basis: null }, J(1405, 1, 15))).toBeNull()
  })

  it('statutoryMonthsDeadline: the event reading is unchanged, the service reading is one day later (three months)', () => {
    const ev = statutoryMonthsDeadline(J(1405, 1, 15), 3, 'ماده ۱۶ ق.د.ع.ا', 'event')!
    const sv = statutoryMonthsDeadline(J(1405, 1, 15), 3, 'ماده ۱۶ ق.د.ع.ا', 'service')!
    expect(key(ev.thirtyDayEnd)).toBe('1405/04/12')
    expect(key(sv.thirtyDayEnd)).toBe('1405/04/13')
    expect(ev.note).not.toContain('۴۴۵')
    expect(sv.note).toContain('مادهٔ ۴۴۵')
  })
})
