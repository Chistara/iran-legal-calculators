/**
 * A deadline names the closures it passed.
 *
 * A first-instance civil ruling served on Thursday ۱۴۰۵/۰۵/۰۱; twenty days (مادهٔ ۳۳۶ ق.آ.د.م), the day of service
 * and the day of the act not counted (مادهٔ ۴۴۵): the act day is Thursday ۱۴۰۵/۰۵/۲۲ — شهادت امام رضا (ع), an
 * official closure of 1405 — then Friday the ۲۳rd, so the last day is Saturday ۱۴۰۵/۰۵/۲۴ (مادهٔ ۴۴۴).
 *
 * The 1405 closures come from the official calendar (مرکز تقویم مؤسسهٔ ژئوفیزیک دانشگاه تهران, «تعطیلات رسمی سال
 * ۱۴۰۵»): ۵/۱۳ اربعین (۲۰ صفر), ۵/۲۱ رحلت پیامبر و شهادت امام حسن (۲۸ صفر), ۵/۲۲ شهادت امام رضا (آخر صفر —
 * ربیع‌الاول starts ۵/۲۳ in the same calendar), ۵/۳۰ شهادت امام حسن عسکری (۸ ربیع‌الاول).
 */
import { describe, it, expect } from 'vitest'
import {
  closureLabel,
  closureOn,
  holidaysBetween,
  jalaliToDate,
  officialCalendarFor,
  rolledClosures,
  statutoryDeadline,
} from '../src/index.js'

const P = (s: string) => {
  const [y, m, d] = s.split('/').map(Number) as [number, number, number]
  return jalaliToDate(y, m, d)
}

describe('served ۱۴۰۵/۰۵/۰۱, twenty days — the last day and every closure on the way, named', () => {
  it('the deadline is Saturday ۱۴۰۵/۰۵/۲۴ and the roll names the act day\'s holiday and the Friday after it', () => {
    const sd = statutoryDeadline('1405/05/01', 20, 'service')
    expect(sd.deadline.getTime()).toBe(P('1405/05/24').getTime())
    expect(sd.deadline.getDay()).toBe(6)
    expect(rolledClosures(sd).map(closureLabel)).toEqual(['پنجشنبه ۱۴۰۵/۰۵/۲۲ (شهادت امام رضا (ع))', 'جمعه ۱۴۰۵/۰۵/۲۳ (تعطیل هفتگی)'])
    expect(holidaysBetween(P('1405/05/01'), sd.calendarEnd).map(closureLabel))
      .toEqual(['سه‌شنبه ۱۴۰۵/۰۵/۱۳ (اربعین حسینی)', 'چهارشنبه ۱۴۰۵/۰۵/۲۱ (رحلت پیامبر (ص) و شهادت امام حسن (ع))'])
  })

  it('a last day on a working day passes over nothing', () => {
    // Served Saturday ۱۴۰۵/۰۶/۰۷: twenty days → act day ۱۴۰۵/۰۶/۲۸, a Saturday.
    expect(rolledClosures(statutoryDeadline('1405/06/07', 20, 'service'))).toEqual([])
    // Ten days from ۱۴۰۵/۰۶/۱۷: the tenth day is Friday the ۲۷th but the act day (ماده ۴۴۵) is Saturday the ۲۸th.
    const sd = statutoryDeadline('1405/06/17', 10, 'service')
    expect(rolledClosures(sd)).toEqual([])
    expect(holidaysBetween(P('1405/06/17'), sd.deadline)).toEqual([])
  })
})

describe('the calendar helpers', () => {
  it('closureOn names an official closure, a plain Friday as «جمعه», and nothing on a working day', () => {
    expect(closureOn(P('1405/05/22'))).toMatchObject({ name: 'شهادت امام رضا (ع)', holiday: true })
    expect(closureOn(P('1405/05/23'))).toMatchObject({ name: 'جمعه', holiday: false })
    expect(closureOn(P('1405/05/24'))).toBeNull()
    expect(closureLabel(closureOn(P('1405/05/30'))!)).toBe('جمعه ۱۴۰۵/۰۵/۳۰ (شهادت امام حسن عسکری (ع))') // a holiday on a Friday keeps its name
  })

  it('rolledClosures is the roll exactly; holidaysBetween skips plain Fridays and stops at the end', () => {
    const sd = statutoryDeadline(P('1405/05/01'), 20, 'service')
    expect(rolledClosures(sd).map((c) => c.name)).toEqual(['شهادت امام رضا (ع)', 'جمعه'])
    expect(holidaysBetween(P('1405/05/01'), P('1405/05/22')).map((c) => c.name))
      .toEqual(['اربعین حسینی', 'رحلت پیامبر (ص) و شهادت امام حسن (ع)'])
    expect(holidaysBetween(P('1405/05/01'), P('1405/05/22'), 1)).toHaveLength(1)
  })

  it('the 1405 closures used are the transcribed official calendar (source + PDF url + sha256), and Safar\'s end matches its month starts', () => {
    const y = officialCalendarFor(1405)!
    expect(y.source).toContain('تعطیلات رسمی سال ۱۴۰۵')
    expect(y.url).toMatch(/^https:\/\/calendar\.ut\.ac\.ir\//)
    expect(y.sha256).toMatch(/^[0-9a-f]{64}$/)
    const day = (jm: number, jd: number) => y.lunar.find((d) => d.jm === jm && d.jd === jd)
    expect(day(5, 13)).toMatchObject({ name: 'اربعین حسینی', hm: 2, hd: 20 })
    expect(day(5, 21)).toMatchObject({ name: 'رحلت پیامبر (ص) و شهادت امام حسن (ع)', hm: 2, hd: 28 })
    expect(day(5, 22)).toMatchObject({ name: 'شهادت امام رضا (ع)', hm: 2, hd: 29 })
    // آخر صفر: the official month table starts ربیع‌الاول ۱۴۴۸ on ۱۴۰۵/۰۵/۲۳, so ۵/۲۲ is the last day of Safar.
    expect(y.hijriMonthStarts?.find((m) => m.hy === 1448 && m.hm === 3)).toMatchObject({ jm: 5, jd: 23 })
  })
})
