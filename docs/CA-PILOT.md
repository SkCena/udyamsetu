# CA Pilot — Phase 1.3 prep

Goal: prove, with a real CA, that UdyamSetu's exports are genuinely usable —
a Tally import that lands in the Day Book with the right numbers, and GSTR-1/3B
JSON the portal accepts. Until this pilot passes, nothing here is called
"CA-ready". The Tally CSV stays labelled **BETA** until then.

Status: **prep done, real test pending**. We have no CA yet — the test will
happen when one is found (a local Bhubaneswar CA, or a shopkeeper who already
uses Tally). No CA is named here on purpose; add their name and date when the
test is arranged.

## What the pilot checks

| # | Check | Pass means |
|---|-------|-----------|
| 1 | Tally XML import (`sample-tally.xml`) | All 4 vouchers import, Day Book shows the 4 entries, ledger balances match the table below |
| 2 | Tally CSV route (`sample-tally.csv`) | CSV saved as .xlsx imports via a mapping template (Release 4.0+) with the same totals |
| 3 | GSTR-1 JSON (`sample-gstr1.json`) | Portal offline tool / JSON upload accepts it; B2B, B2CS and CDNR sections match the table below |
| 4 | GSTR-3B JSON (`sample-gstr3b.json`) | Portal accepts it; outward-supply heads match the table below |

## Format check (done 2026-11-22, from Tally's own Help)

- **XML is Tally Prime's native import format.** Alt+O → Transactions, every
  release, and Tally.ERP 9 too (Gateway of Tally → Import Data → Vouchers).
  Source: help.tallysolutions.com — "Import Data - FAQ" (updated 5 Nov 2026).
- **CSV does NOT import directly.** Tally's Help FAQ says it plainly: CSV must
  first be saved as .xls/.xlsx, then imported with a mapping template
  (Release 4.0 and later). Older releases take XML only.
- **Bank-statement CSV import is a different thing** — only bank-portal
  downloads, only for reconciliation. It is not a voucher import route.
- So: the XML file is the main pilot route. The CSV stays as a convenience
  export (and as the .xlsx route for Release 4.0+ users). This gap is honest,
  not hidden — the CSV file itself carries the BETA notice in its first line.

## Sample data (all dummy — not real businesses)

Seller: Sharma Kirana Store, GSTIN `22AAAAA0000A1ZC` (test value), Odisha (21).
Period: November 2026, filing period `112026`, FY 2026-27.

| Bill | Party | Type | Total |
|------|-------|------|-------|
| INV/2026-27/0001 | Ramesh Kumar (GSTIN 27AAAPL1234C1ZE, Odisha) | GST bill, intra-state | ₹1,178.00 |
| INV/2026-27/0002 | Delhi Traders (GSTIN 07AAAAA0000A1Z5, Delhi) | GST bill, inter-state | ₹2,100.00 |
| INV/2026-27/0003 | Walk-in Customer (unregistered, Odisha) | GST bill, intra-state | ₹504.00 |
| INV/2026-27/0004 | Ramesh Kumar | Credit note vs 0001 (1 bag rice returned) | −₹525.00 |

Expected GSTR-3B outward heads (after the credit note): taxable ₹3,101.50,
IGST ₹100.00, CGST ₹27.54, SGST ₹27.54, ITC ₹0 (none entered in the sample).

Fixtures live in `docs/ca-pilot/` and are generated from the Site's own logic
(`tools/gen-ca-pilot-fixtures.js` — re-run it to refresh them; the test
`site/ca-pilot.test.js` fails if the committed files drift from the generator):

- `sample-invoices.json` — the 4 bills with full details
- `sample-tally.csv` — Tally-compatible CSV (BETA)
- `sample-tally.xml` — Tally XML import file (masters + vouchers)
- `sample-gstr1.json` — GSTR-1 portal-style JSON
- `sample-gstr3b.json` — GSTR-3B portal-style JSON

## Tally import steps (for the CA)

1. **Use a test company first** — never import into live books on the first try.
   Take a backup before importing (Tally offers one on the import screen).
2. **XML route (all releases):** open the company → Alt+O (Import) →
   Transactions → pick `sample-tally.xml` → import → read the summary.
   The file carries its own masters first (party ledgers under Sundry Debtors,
   Sales, CGST/SGST/IGST Payable under Duties & Taxes, Round Off, and the
   stock items), then the 4 vouchers — so no ledger has to exist beforehand.
3. **CSV route (Release 4.0+ only):** open `sample-tally.csv` in Excel/LibreOffice
   → Save As .xlsx → Alt+O → Transactions → pick the .xlsx → build a mapping
   template (Date, Voucher Type, Voucher No, Party, Debit/Credit Ledger,
   Amount) → preview → import. **Delete the first line** (`# BETA …` comment)
   before importing — it is a notice, not data.
4. **Verify:** Day Book shows 4 vouchers; party ledger "Ramesh Kumar" balance
   is ₹653.00 (1,178.00 − 525.00); Sales ledger credit is ₹3,101.50; CGST
   Payable ₹27.54, SGST Payable ₹27.54, IGST Payable ₹100.00.
5. **One honest note for the CA:** the XML names the tax ledgers
   "CGST Payable" / "SGST Payable" / "IGST Payable". If the company's books
   already have GST ledgers under different names, map them in Tally (or tell
   us the names you use — we will match them).

## GSTR JSON check steps (for the CA)

1. Open the GST portal → Returns → GSTR-1 → Prepare offline (or JSON upload)
   → upload `sample-gstr1.json`. Expect: B2B shows both registered buyers,
   B2CS shows the walk-in sale, CDNR shows the credit note (₹−525.00).
2. Same for GSTR-3B with `sample-gstr3b.json` → outward supplies match the
   table above; ITC is zero because no purchase/ITC was entered in the sample.
3. If the portal rejects a file, keep the exact error text — that is the
   most useful feedback we can get.

## Pass / fail

- **Pass:** checks 1–4 all green, or the CA confirms in writing what is
  acceptable with named fixes. Then — and only then — the BETA label comes
  off the Tally export and the app/site may say "CA-checked".
- **Fail:** any check red. The pilot does not "mostly pass": the failing
  check, the exact error, and the fixture line that caused it go into the
  feedback below, and the fix lands before any re-test.

## What the CA should report back

1. Tally release used (e.g. Prime Release 4.0 / 5.0 / ERP 9) and whether the
   XML imported cleanly — how many vouchers accepted / rejected, and the
   exact error for any rejection.
2. Did the Day Book and ledger balances match the table above? If not, which
   ledger and by how much?
3. Are the ledger names in the XML sensible for real books, or should they
   be different (e.g. your GST ledger names)?
4. Did the portal accept both GSTR JSON files? Exact error text if not.
5. Anything else a real shop's books need that the sample does not cover
   (e.g. e-invoice IRN, HSN summary, purchase-side ITC, round-off handling).
6. Your name, firm, date — so the pilot result is attributable, not anonymous.

## Known limits (so nobody is surprised)

- The sample has no purchases, so ITC is zero — a real month's 3B needs
  purchase entries from the portal's 2B, which the user enters by hand.
- e-invoice / e-way bill JSONs are drafts only (no GSP, no live IRN) — they
  are not part of this pilot.
- The GSTR JSONs are portal-format drafts. The portal is the judge: if it
  rejects them, the portal is right and the export is wrong.
- One real bug already came out of building these fixtures: the GSTR-1 JSON
  used to report every B2B item's tax as IGST (the summary dropped the
  intra-state flag) and CDNR items were zeroed. Both are fixed and covered
  by `site/ca-pilot.test.js`.
