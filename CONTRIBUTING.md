# Contributing

Thanks for helping keep Iranian legal date arithmetic correct. Bug fixes and tests are welcome as ordinary pull
requests. **Data changes need an official source.**

## Proposing a data update (holidays, closures, later: rates)

1. Open an issue or pull request that links the **official source**: the official calendar PDF of مرکز تقویم مؤسسهٔ
   ژئوفیزیک دانشگاه تهران, a government closure announcement, or the Official Gazette (روزنامهٔ رسمی). Secondary
   sites (news, time.ir) are welcome as a cross-check, not as the source.
2. For a **new official year**, add an entry to `src/data/officialCalendar.ts` (`OFFICIAL_CALENDAR_YEARS`):
   - `lunar`: every lunar closure of the year from «تعطیلات رسمی سال …», with its Hijri date (`hy`, `hm`, `hd`);
   - `hijriMonthStarts`: the Jalali date each Hijri month starts, from the full «تقویم رسمی کشور» PDF;
   - `url` / `sha256` (and `hijriMonthsUrl` / `hijriMonthsSha256`) of the PDFs as you downloaded them
     (`shasum -a 256 file.pdf`), plus `fetched`.
3. Add a test that pins the year's full closure list, transcribed **independently** from the PDF (see
   `tests/officialCalendar.test.ts`), and run `npm test` — it also checks each closure's Hijri date against the month
   starts.
4. Ad-hoc closures by decree are usually better applied by users at runtime with `setHolidayOverrides`; open an issue
   if you think one belongs in the bundled data.

## Development

```sh
npm ci
npm run typecheck
npm test
npm run build
```

Keep legal citations (article numbers) in comments next to the rule they justify.
