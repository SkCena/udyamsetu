# UdyamSetu

Free, mobile-first business / GST / accounting for small Indian shops.
One product, two surfaces: a static local-first **Site** (PWA) and an
**Android app**. No server, no account, no paywall. Your data stays on
your device.

**Status:** the Site (Setup, Billing, Party ledger, Inventory, GST
reports, Payroll, Reports) is done. The Android app is in progress —
it builds in GitHub Actions, and the APK isn't out yet.

## What it does

- **Setup** — business profile: name, GSTIN (checked with the checksum),
  phone, address, logo, UPI ID, invoice series. Saved on the device.
- **Billing** — GST and non-GST invoices, HSN/SAC, CGST+SGST for
  same-state sales, IGST for inter-state, discount before tax, round-off
  to the nearest rupee, A4 and 80mm thermal print, WhatsApp share, credit
  and debit notes.
- **Party / Udhaar ledger** — customers and suppliers, udhaar entries,
  running balance, statements, due reminders over WhatsApp.
- **Inventory** — items with HSN, rate, unit and prices, godowns, batches
  with expiry dates, low-stock and expiring-soon alerts. Saving a bill
  reduces stock automatically.
- **GST reports** — GSTR-1 and GSTR-3B summaries (drafts for now) and
  2A/2B reconciliation from portal JSON you paste in.
- **e-invoice / e-way bill** — NIC-style JSON drafts made from a saved
  invoice. Nothing is filed from the app yet, and no credentials are
  stored anywhere.
- **Payroll-lite** — employees, attendance, pro-rata payslips, advances.
- **Reports + export** — sales, purchase, expense, P&L, GST, stock and
  cash-flow summaries; CSV and JSON export, plus a Tally-compatible CSV
  (beta — a CA still needs to check the import, see `SPEC.md`).
- **Languages** — English by default, with Hindi, Bengali, Telugu,
  Marathi, Tamil, Gujarati, Punjabi, Odia and Urdu.
- **Desktop view** — on a wide screen the Site shows a sidebar and a
  wider layout; on a phone it's a single column.
- **Shared core** — the GST maths lives in `core/` and is used by both
  the Site (JavaScript) and the app (Kotlin), tested against the same
  test vectors. Money is always integer paise, never float rupees.

## Android app (in progress)

- Kotlin + Jetpack Compose + Room, offline-first. Package
  `in.udyamsetu.app`, minSdk 29.
- Every screen from the Site: language first, Home with 4 quick
  buttons, Setup, Billing (with a preview before you save), Bill list,
  Party, Stock, GST, Payroll, Reports — plus a home widget for a
  one-tap new bill.
- The APK builds only in GitHub Actions
  (`.github/workflows/build-apk.yml`). The workflow file has to be added
  through the GitHub website the first time — the API can't push
  workflow files. Once it's in, every push to `main` builds and tests
  the app.

## The Site on GitHub Pages

The Site is plain static files in `site/`, and it deploys to GitHub
Pages from there (`.github/workflows/pages.yml`). Open it in any
browser — it works offline after the first load.

## What it doesn't do yet

- **CA-checked exports** — the GSTR JSON and Tally CSV stay drafts
  until a real CA checks the format and the import.
- **Phase 2 features** — GSTR-9, e-invoice/e-way bill through a GSP,
  multi-user and multi-firm, POS, manufacturing, loyalty, online store,
  bank feeds, barcode scan and more. All of them will be free when they
  land — `SPEC.md` says why each one waits.
- **Exam Prep and Photo Editor** (Phase 3), direct GST portal filing,
  realtime cloud sync. There is no central server by design — backup is
  an encrypted file that you own.

## Run it

```bash
# Site — no build step, just open site/index.html or serve it
python3 -m http.server -d site 8000

# Site tests (598 tests)
node core/gst.test.js
node site/app.test.js
node site/party-inventory.test.js
node site/gst-einvoice.test.js
node site/payroll-reports.test.js
node site/integration.test.js
node site/i18n.test.js
node site/views.test.js

# Kotlin core tests (needs JDK 17)
kotlinc core/gst.kt core/GstTest.kt -include-runtime -d /tmp/gst-test.jar
java -jar /tmp/gst-test.jar   # 111 tests

# App logic tests (JDK 17 + kotlinc, no Android SDK needed)
kotlinc app/app/src/main/java/in/udyamsetu/app/core/GstCore.kt \
  app/app/src/main/java/in/udyamsetu/app/logic/*.kt \
  app/app/src/test/java/in/udyamsetu/app/LogicTestMain.kt \
  -include-runtime -d /tmp/udyamsetu-logic-test.jar
java -jar /tmp/udyamsetu-logic-test.jar   # 32 tests
```

## Privacy and security

- No accounts, no tracking, no ads. The app only asks for three
  permissions: internet (optional Drive backup and sharing), network
  state, and camera (optional, for barcode scanning later).
- System backups are off (`allowBackup=false`) and the app never talks
  to a server in plain text — your business data leaves the phone only
  when you export it yourself.
- No secrets, no real business GSTINs and no proprietary code in this
  repo. The test data uses made-up GSTINs like `22AAAAA0000A1ZC` and
  the phone number `9876543210` — both are dummy values, not anyone's
  real details.

Found a bug or want a feature? Open an issue:
https://github.com/SkCena/udyamsetu/issues
