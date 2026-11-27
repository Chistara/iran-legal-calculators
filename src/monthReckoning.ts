/**
 * WHICH month a rule's «N ماه» means, decided from the law its legal basis cites. Pure and dependency-free.
 * statutoryMonths.ts documents the statute text read for each reading.
 */

/** `thirty_day`: a month is 30 days (مادهٔ ۴۴۳ ق.آ.د.م). `earlier_of_both`: the earlier of 30-day and calendar months. */
export type MonthReckoning = 'thirty_day' | 'earlier_of_both'

export interface ReckoningRule {
  reckoning: MonthReckoning
  /** Persian: which article decides the reading. */
  basisFa: string
}

const fold = (s: string) => s.replace(/[ي]/g, 'ی').replace(/[ك]/g, 'ک').replace(/‌/g, ' ').replace(/\s+/g, ' ')

const M443 = 'مادهٔ ۴۴۳ قانون آیین دادرسی مدنی («ماه سی روز»)'
// ق.آ.د.م — and not ق.آ.د.ک (criminal), nor ق.م (civil code).
const CIVIL_PROCEDURE = /ق\.?\s*آ\.?\s*د\.?\s*م(?![؀-ۿ])|آیین دادرسی[^،.]*مدنی/
const ADMIN_COURT = /ق\.?\s*د\.?\s*ع\.?\s*ا(?![؀-ۿ])|دیوان عدالت اداری/

/**
 * The month reading for a rule, from the law its `legalBasis` cites.
 *
 * @example monthReckoningFor('ماده ۴۸۴ قانون آیین دادرسی مدنی').reckoning // 'thirty_day'
 * @example monthReckoningFor('ماده ۱۲۱۸ ق.م').reckoning // 'earlier_of_both'
 */
export function monthReckoningFor(legalBasis: string | null | undefined): ReckoningRule {
  const b = fold(String(legalBasis ?? ''))
  if (CIVIL_PROCEDURE.test(b)) return { reckoning: 'thirty_day', basisFa: M443 }
  if (ADMIN_COURT.test(b)) {
    return { reckoning: 'thirty_day', basisFa: `تبصرهٔ ۲ مادهٔ ۱۶ و مادهٔ ۱۲۲ قانون دیوان عدالت اداری (شمارش «مطابق قانون آیین دادرسی … مدنی») و ${M443}` }
  }
  return {
    reckoning: 'earlier_of_both',
    basisFa: 'قانونِ این مهلت قاعدهٔ شمارش ماه ندارد و شمول مادهٔ ۴۴۳ قانون آیین دادرسی مدنی بر آن از متن روشن نیست؛ زودترینِ دو حساب (ماه سی‌روزه و ماه تقویمی) گرفته شد',
  }
}
