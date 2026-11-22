# UdyamSetu

Free, mobile-first business / GST / accounting for small Indian shops.
One product, two surfaces: a static local-first **Site** (PWA) and an
**Android app**. No server, no account, no paywall. Data lives on the
user's device.

**Status: Phase 1.1 in progress (Setup + Billing).** Private repo — public
publish only when the user says so.

## What is built (Phase 1.1)

- **Setup** — business profile (name, optional GSTIN with checksum validation,
  phone, address, logo, UPI ID, invoice series), survives reload.
- **Billing** — GST + non-GST invoices, HSN/SAC, CGST+SGST intra-state /
  IGST inter-state, discount before tax, round-off to the nearest rupee,
  A4 + 80mm thermal print (PDF via browser print), WhatsApp share,
  credit note / debit note.
- **Shared core** — `core/` GST math in JS and Kotlin, both passing the same
  test vectors (`core/gst-test-vectors.json`). All money in integer paise.

## What is NOT built yet

Party/Udhaar ledger, Inventory, GST reports, e-invoice / e-way bill,
Payroll-lite, Reports, CA-ready export (Phase 1.2+); Exam Prep and Photo
Editor modules (Phase 3); direct GST portal filing; realtime cloud sync.
See `SPEC.md` — Out of Scope.

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

# Android APK — GitHub Actions only (local Gradle is blocked on this VM)
# Workflow: .github/workflows/build-apk.yml (add via GitHub web UI —
# the API token used for pushes has no workflow scope)
```

## Rules

- Private repo until the user says publish. Never make Pages / Releases
  public without asking.
- No secrets, no real business GSTINs, no proprietary code in this repo.
- No device pass is claimed until the user tests on the phone —
  see `docs/DEVICE-TEST-1.1-site.md`.
- Full internet lookup / fetch / download is allowed for this work
  (user permission, 2026-11-22).
