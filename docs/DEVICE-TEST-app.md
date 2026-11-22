# Device test — UdyamSetu Android app (Phase 2, v1.0.0)

**Headless status (2026-11-22):** host tests green — shared GST core 111/111,
app logic 32/32, Site 598/598, smoke PASS. **The APK itself is NOT built yet:**
it builds only in GitHub Actions (local Gradle is blocked on the dev VM).
**No device pass is claimed here** — run these steps on the phone and report
back what you see. If anything below fails, note the exact screen + step.

## 0. Get the APK
1. GitHub repo `SkCena/udyamsetu` -> Actions -> latest "Build APK" run -> 
   artifact `udyamsetu-debug-apk` -> download -> install on the phone
   (allow "Install unknown apps" for the browser/files app once).
2. App icon: teal square with a white bridge arc. App name: UdyamSetu.

## 1. Language first (Easy-UI)
1. First launch: a language screen must appear FIRST (10 languages).
2. Pick Hindi -> the Home screen should switch to Hindi.
3. Kill the app, reopen: the language screen must NOT appear again.
4. More -> Language: pick English -> the app restarts in English.

## 2. Home (4 Quick buttons)
1. Home shows 4 big buttons: New Bill, Udhaar, Stock, Payment.
2. Today stats show 0 sale / 0 udhaar / 0 low-stock on a fresh install.
3. FTU card: fill shop type / GST yes-no / what you sell -> Save -> kill
   the app -> reopen -> the answers are still filled.
4. First-bill guide card is visible until the first bill is saved.

## 3. Setup (5-minute test)
1. More -> Setup. Fill shop name "Sharma Kirana Store", leave GSTIN blank,
   UPI `test@okhdfc`, prefix INV -> Save Setup -> "Setup saved" shows.
2. GSTIN check: type a wrong GSTIN (e.g. `22AAAAA0000A1Z9`) -> save must
   REFUSE with a GSTIN error. Type `22AAAAA0000A1Z5` -> it saves.
3. Kill the app -> reopen -> Setup still shows the saved shop name.

## 4. Billing — 3-tap bill test (acceptance)
1. Home -> New Bill (tap 1) -> type party "Ramesh" (tap 2) -> tap an item
   line, type name "Rice", qty 2, price 100, GST 18% (tap 3 starts the bill).
2. Totals must read: Taxable ₹200.00, CGST ₹18.00, SGST ₹18.00,
   Grand Total ₹236.00. (Hand check: 2 x 100 = 200, 18% = 36, total 236.)
3. Tap "Preview before saving" -> preview shows the same totals.
4. Tap "Save Bill" -> "Invoice saved" shows -> Bills tab lists
   INV/2026-27/0001, ₹236.00.
5. Switch to the Party tab and back to Billing: the next draft must be
   empty (saved), and no crash.
6. Inter-state check: buyer state 27 (Maharashtra), seller 21 (Odisha) ->
   totals must show IGST ₹36.00, CGST/SGST ₹0.

## 5. Party / Udhaar
1. Party tab -> add party "Ramesh" -> open it -> Statement shows the
   credit sale ₹236.00, balance ₹236.00 (positive = he owes you).
2. Record a Payment of ₹100 -> balance becomes ₹136.00.
3. From the party card tap "New Bill" -> the bill opens with party
   "Ramesh" already filled.

## 6. Stock
1. Stock -> add item "Rice", HSN 1001, sale price 100, reorder 5.
   (Stock starts at 0; the bill above already took 2 out only if the item
   existed before the bill — on a fresh install add the item FIRST, then
   make the bill, then check stock went down by the bill qty.)

## 7. GST / Salary / Reports
1. GST tab -> GSTR-1 shows 1 invoice, taxable ₹200.00. GSTR-3B shows
   outward CGST/SGST ₹18.00 each, net payable the same (ITC 0).
2. Salary -> add employee "Sita", salary ₹30,000, month 2026-11,
   present 26 / total 30 -> payslip gross ₹26,000.00.
3. Reports -> Sales ₹236.00, Gross profit matches sales minus purchases.
   "Share Tally CSV (BETA)" opens the share sheet (do NOT call it CA-ready).

## 8. About + widget
1. More -> About -> GitHub link is shown, with the note that the code is
   open source.
2. Long-press the home screen -> Widgets -> UdyamSetu "New bill" ->
   place it -> tapping it opens the app into New Bill.

## 9. Offline + rotation
1. Turn on airplane mode -> make a bill -> it saves (offline-first).
2. Rotate the phone on the Billing screen mid-draft -> the draft must
   NOT be lost (Activity-scoped ViewModel).

## Report back
For each section: PASS / FAIL + what you saw. Screenshots help for any FAIL.
