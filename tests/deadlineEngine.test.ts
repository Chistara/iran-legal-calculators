/**
 * The pure parts of the deadline engine: lawEffectiveDate (مادهٔ ۲ قانون مدنی) and ruleDeadline (the last day of a
 * deadline rule from its trigger date). The holiday engine is not mocked — its exact outputs are asserted against.
 */
import { describe, it, expect } from 'vitest'
import {
  addStatutoryDeadlineDays,
  hasVettedHolidayData,
  isWorkingDay,
  lawEffectiveDate,
  nextWorkingDay,
  ruleDeadline,
  type RuleForDeadline,
} from '../src/index.js'

// ═══════════════════════════════════════════════════════════════════════════
// lawEffectiveDate — ماده ۲ قانون مدنی (15-day law-effectiveness rule)
// ═══════════════════════════════════════════════════════════════════════════
describe('lawEffectiveDate', () => {
  it('adds exactly 15 calendar days and returns UTC midnight', () => {
    const publication = new Date(Date.UTC(2026, 0, 1)) // 1 Jan 2026
    const result = lawEffectiveDate(publication)
    expect(result.toISOString()).toBe('2026-01-16T00:00:00.000Z')
    expect(result.getUTCHours()).toBe(0)
    expect(result.getUTCMinutes()).toBe(0)
    expect(result.getUTCSeconds()).toBe(0)
  })

  it('uses UTC calendar components, not local-timezone components (no day-shift bug)', () => {
    // 23:30 UTC on 10 Jan 2024 is already 11 Jan in Tehran (the suite runs with TZ=Asia/Tehran). If the function read
    // local getFullYear/getMonth/getDate instead of the UTC variants, it would compute from the WRONG publication day.
    const publication = new Date(Date.UTC(2024, 0, 10, 23, 30))
    expect(publication.getUTCDate()).toBe(10)
    expect(publication.getDate()).toBe(11) // sanity: local date really does differ

    const result = lawEffectiveDate(publication)
    expect(result.toISOString()).toBe('2024-01-25T00:00:00.000Z') // 10 Jan + 15, not 11 Jan + 15
  })

  it('correctly rolls across a month/leap-day boundary (Feb 29 2024 + 15 = Mar 15)', () => {
    const result = lawEffectiveDate(new Date(Date.UTC(2024, 1, 29)))
    expect(result.toISOString()).toBe('2024-03-15T00:00:00.000Z')
  })

  it('does NOT roll forward off a Friday/holiday — this is an effectiveness date, not a procedural مهلت', () => {
    // 15 Mar 2024 is a Friday. A statute that becomes effective on a Friday still becomes effective that Friday.
    const result = lawEffectiveDate(new Date(Date.UTC(2024, 1, 29)))
    expect(result.getUTCDay()).toBe(5) // Friday
    expect(isWorkingDay(result)).toBe(false)
    expect(result.toISOString()).toBe('2024-03-15T00:00:00.000Z')
  })

  it('does not mutate the input Date', () => {
    const publication = new Date(Date.UTC(2025, 5, 1))
    const before = publication.getTime()
    lawEffectiveDate(publication)
    expect(publication.getTime()).toBe(before)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// ruleDeadline — the computation a deadline rule's last day comes from
// ═══════════════════════════════════════════════════════════════════════════
describe('ruleDeadline', () => {
  const base: RuleForDeadline = { case_type: 'civil', trigger_event: 'ابلاغ', deadline_name: 'x', duration_days: null, duration_months: null, legal_basis: null }

  it('a duration_days rule gives the exact statutory date (service-started: the act day is not counted)', () => {
    const triggerDate = new Date('2025-01-01T00:00:00Z')
    const r = ruleDeadline({ ...base, trigger_event: 'ابلاغ دادنامه بدوی', deadline_name: 'تجدیدنظر', duration_days: 20, legal_basis: 'ماده ۳۳۹ ق.آ.د.م' }, triggerDate)!
    expect(r.deadline.getTime()).toBe(addStatutoryDeadlineDays(triggerDate, 20, 'service').getTime())
    expect(isWorkingDay(r.deadline)).toBe(true)
  })

  it('computes duration_months deadlines by the law the rule cites and rolls off a holiday landing (Nowruz)', () => {
    // 29 آذر 1402 + 3 months, no cited law → the earlier of «۹۰ روز» and the Jalali calendar month, both 29 اسفند 1402
    // = 19 Mar 2024, a closure → rolls past Nowruz to 24 Mar 2024 / 5 Farvardin.
    const triggerDate = new Date(Date.UTC(2023, 11, 20))
    const preRollLanding = new Date(Date.UTC(2024, 2, 19))
    expect(isWorkingDay(preRollLanding)).toBe(false) // sanity: it really is a closure
    const expectedDeadline = nextWorkingDay(preRollLanding)
    expect(expectedDeadline.toISOString()).toBe('2024-03-24T00:00:00.000Z') // time of day is preserved

    // A trigger «ابلاغ» is service-started; use an event trigger to keep start + N as the original case did.
    const r = ruleDeadline({ ...base, trigger_event: 'وقوع حادثه', deadline_name: 'اعاده دادرسی', duration_months: 3 }, triggerDate)!
    expect(r.deadline.getTime()).toBe(expectedDeadline.getTime())
    expect(isWorkingDay(r.deadline)).toBe(true)
  })

  it('computes a duration_months deadline that lands on an ordinary working day unchanged', () => {
    // 24 اردیبهشت 1403 (13 May 2024) + 1 month, no cited law → the EARLIER of 30 days (23 خرداد = 12 Jun 2024, an
    // ordinary working Wednesday) and the calendar month (24 خرداد). The Gregorian reading (13 Jun) is not used.
    const r = ruleDeadline({ ...base, trigger_event: 'وقوع حادثه', deadline_name: 'مهلت عادی', duration_months: 1 }, new Date(2024, 4, 13))!
    expect(r.deadline.getTime()).toBe(new Date(2024, 5, 12).getTime())
    expect(isWorkingDay(r.deadline)).toBe(true)
    expect(r.notes.join(' ')).toContain('زودترینِ دو حساب')
  })

  it('a far-future deadline is outside the vetted range (the caller should warn)', () => {
    const r = ruleDeadline({ ...base, duration_days: 10 }, new Date(Date.UTC(2500, 0, 1)))! // Jalali ~1878
    expect(hasVettedHolidayData(r.deadline)).toBe(false)
  })

  it('an ordinary near-term deadline is inside the vetted range', () => {
    const r = ruleDeadline({ ...base, duration_days: 10 }, new Date('2025-01-01T00:00:00Z'))!
    expect(hasVettedHolidayData(r.deadline)).toBe(true)
  })

  it.each([
    ['both durations null', null, null],
    ['duration_days is zero', 0, null],
    ['duration_months is zero', null, 0],
    ['duration_days is negative', -5, null],
  ])('returns null for a rule with no positive calculable duration (%s)', (_label, durationDays, durationMonths) => {
    expect(ruleDeadline({ ...base, deadline_name: 'قبل از محاکمه', duration_days: durationDays, duration_months: durationMonths }, new Date())).toBeNull()
  })

  it('returns null for an absurd month count', () => {
    expect(ruleDeadline({ ...base, duration_months: 500 }, new Date(2024, 4, 13))).toBeNull()
  })
})
