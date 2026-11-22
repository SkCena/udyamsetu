# Device Test — UdyamSetu Site Phase 1.2 (phone, ~10 min)

> Headless tests are green (550 node tests + browser smoke), but NO device pass
> is claimed. Run these steps on your phone and report what you see.

## Setup
1. Serve the folder over http (not `file://` — service worker needs http):
   `python3 -m http.server 8123` inside `~/workspace/udyamsetu`, open
   `http://<computer-ip>:8123/site/` on the phone.
   (Or open `site/index.html` directly — everything except offline cache works.)
2. Setup tab: save your business (name + GSTIN if you have one). Reload — profile must survive.

## Language switch (new in 1.2)
3. Top-right language dropdown: default should be **English** (tabs say
   "Setup", "New Bill", "Party / Udhaar", "Stock", "GST Report", "Salary", "Reports").
4. Switch to **हिंदी** — tabs/buttons/messages turn Hindi. Switch to **বাংলা** — tabs turn Bengali.
5. Switch to **اردو** — page direction should flip right-to-left.
6. Reload the page — your last language must stay selected.
7. KNOWN LIMIT: form field labels inside Party/Stock/GST/Salary/Reports tabs are
   Hindi-only static text for now — only tabs, titles, buttons, messages and
   hints switch language. Report if any tab title or button stays Hindi after
   switching to English.

## Party / Udhaar
8. Party tab → add a customer (e.g. "Ramesh", opening balance ₹1,000 *Party owes us*).
9. Add an udhaar entry (+₹500) then a payment received (−₹200). Balance should show ₹1,300.
10. Open the party statement — entries + running balance must look right.
11. Due reminders section: the party should appear with a WhatsApp link.

## Stock
12. Stock tab → add an item (name, HSN, GST 18%, purchase ₹100, sale ₹150, reorder 5).
13. Add stock +10, then make a bill in New Bill tab for that item (qty 2) and save.
    Stock should drop by 2 automatically.
14. Add a batch with an expiry date near today — it should appear in the
    expiring-soon alert; set stock below reorder level — low-stock alert shows.

## GST reports
15. GST Report tab → pick the current month. GSTR-1 summary should list your
    bills (B2B / B2C). Download the GSTR-1 JSON — it must say DRAFT.
16. GSTR-3B: enter ITC by hand (app never guesses it) — net payable must never go negative.
17. e-invoice: open any saved bill → download e-invoice JSON and e-way bill JSON.
    Both are DRAFTS only — the app files nothing and stores no credentials.

## Salary
18. Salary tab → add an employee (monthly ₹15,000), mark 26 days present,
    advance ₹1,000. Payslip should show pro-rata pay minus advance.
19. Print payslip — check it prints on one page.

## Reports / Export
20. Reports tab → pick a date range. Sales / purchase / P&L numbers must match
    your bills and party entries.
21. Download CSV and JSON — files must open cleanly (CSV in a spreadsheet).
22. Download Tally CSV — first line must say **BETA — CA pilot pending**, NOT
    "CA-ready". Do not use it with a CA until the pilot passes.

## What to report back
- Any step that shows a wrong number, a blank screen, or a crash (screenshot + step number).
- Any text that does not change when you switch language (step 7 limit is known).
- Whether the site works offline after first load (turn on airplane mode, reload).

## Honest limits (do NOT test as working)
- No GST portal filing — reports are DRAFTS, verify on the portal before filing.
- No cloud sync / multi-device — data stays on this phone only (backup = export JSON).
- Tally export is BETA — CA pilot pending; never call it "CA-ready" yet.
- No Android app in this round — Site only.
