# UdyamSetu

> Phase 2 (Android app) STARTED — scaffold + Room + all Phase 1.1/1.2
> screens (Setup, Billing, Party, Stock, GST, Payroll, Reports) + home
> widget + CI workflow. Host tests green: app logic 32/32, GST core
> 111/111, Site 598/598, smoke PASS. **APK NOT built yet** — it builds
> only in GitHub Actions; device test pending (user).
> Headless-verified only — device test pending (user).

Free, mobile-first business / GST / accounting for small Indian shops.
One product, two surfaces: a static local-first **Site** (PWA) and an
**Android app**. No server, no account, no paywall. Data lives on the
user's device.

**Status: Phase 1.1 + 1.2 (Site) DONE, Phase 2 (App) in progress.**
Private repo — public publish only when the user says so.

## What is built (Phase 1.1)

- **Setup** — business profile (name, optional GSTIN with checksum validation,
  phone, address, logo, UPI ID, invoice series), survives reload.
- **Billing** — GST + non-GST invoices, HSN/SAC, CGST+SGST intra-state /
  IGST inter-state, discount before tax, round-off to the nearest rupee,
  A4 + 80mm thermal print (PDF via browser print), WhatsApp share,
  credit note / debit note.
- **Shared core** — `core/` GST math in JS and Kotlin, both passing the same
  test vectors (`core/gst-test-vectors.json`). All money in integer paise.

## What is built (Phase 1.2, Site)

- **Party/Udhaar ledger** — parties, signed ledger (positive = receivable),
  statement with running balance, due reminders with WhatsApp text.
- **Inventory** — items (HSN/rate/unit/prices/reorder/godown), stock in/out,
  batches + expiry, low-stock + expiring alerts; bill save auto-decrements stock.
- **GST reports** — GSTR-1 (B2B/B2CL/B2CS/CDNR) + GSTR-3B summaries (DRAFT),
  2A/2B reconciliation from pasted portal JSON.
- **e-invoice / e-way bill** — NIC-style JSON drafts from a saved invoice.
- **Payroll-lite** — employees, attendance, pro-rata payslip, advance.
- **Reports + export** — sales/purchase/expense/P&L/GST/stock/cash-flow,
  CSV + JSON bundle + Tally-compatible CSV labelled **BETA** (not "CA-ready").
- **Language** — English default; Hindi + 9 more Indian languages.
- **Desktop view** — sidebar nav at >= 1024px; Home (4 Quick buttons,
  today stats, FTU, first-bill guide), language-first prompt, GitHub links
  everywhere, "APK chahiye" badges for barcode scan / widget / sync.

## What is built (Phase 2, App — in progress)

- Gradle project (`app/`, package `in.udyamsetu.app`, minSdk 29, Kotlin +
  Jetpack Compose + Room, offline-first). Shared GST core reused, not
  rewritten (`app/.../core/GstCore.kt` is byte-identical to `core/gst.kt`).
- All Phase 1.1/1.2 screens in the app: Language-first, Home (4 Quick
  buttons + stats + FTU + first-bill guide), Setup, Billing (draft hoisted
  in an Activity-scoped ViewModel, preview before save), Bill List,
  Party (bill/payment from the party card), Stock, GST, Payroll, Reports.
- Home widget (one tap -> New Bill), i18n from `site/i18n.js` via
  `tools/gen-android-strings.py` (115 strings x 10 languages).
- CI workflow `.github/workflows/build-apk.yml` (GitHub Actions only).
  **First-time note:** the workflow file must be added via the GitHub web
  UI (the API token has no workflow scope); after that, API pushes work.

## What is NOT built yet

CA pilot (Phase 1.3); Phase 2 deferred features (GSTR-9, GSP e-invoice,
multi-user/firm, POS, manufacturing, loyalty, online store, bank feeds,
barcode scan, ...); Exam Prep and Photo Editor modules (Phase 3); direct
GST portal filing; realtime cloud sync. See `SPEC.md` — Deferred with reason.

## Run

```
# Site (no build step — open site/index.html, or serve statically)
python3 -m http.server -d site 8000

# Site logic tests
node core/gst.test.js    # 114 tests
node site/app.test.js    # 78 tests

# Kotlin core tests (JDK 17)
kotlinc core/gst.kt core/GstTest.kt -include-runtime -d /tmp/gst-test.jar
java -jar /tmp/gst-test.jar   # 111 tests

# App logic tests (JDK 17 + kotlinc, no Android SDK needed)
kotlinc app/app/src/main/java/in/udyamsetu/app/core/GstCore.kt \
  app/app/src/main/java/in/udyamsetu/app/logic/*.kt \
  app/app/src/test/java/in/udyamsetu/app/LogicTestMain.kt \
  -include-runtime -d /tmp/udyamsetu-logic-test.jar
java -jar /tmp/udyamsetu-logic-test.jar   # 32 tests

# Android APK — GitHub Actions only (local Gradle is blocked on this VM:
# "Could not receive a message from the daemon", verified 2026-11-22)
# Workflow: .github/workflows/build-apk.yml (add via GitHub web UI —
# the API token used for pushes has no workflow scope)
# CI runs: ./gradlew :app:assembleDebug :app:testDebugUnitTest :app:lintDebug
# (from the app/ directory — the Gradle project lives in app/)
```

## Rules

- Private repo until the user says publish. Never make Pages / Releases
  public without asking.
- No secrets, no real business GSTINs, no proprietary code in this repo.
- No device pass is claimed until the user tests on the phone —
  see `docs/DEVICE-TEST-1.1-site.md`.
- Full internet lookup / fetch / download is allowed for this work
  (user permission, 2026-11-22).
