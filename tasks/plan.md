# Implementation Plan: UdyamSetu Phase 1.1

Source spec: SPEC.md (V1, Phase 1.1: Setup + Billing)

## Overview
Free, mobile-first Business/GST/Accounting. Phase 1.1 = Setup + Billing only,
on two surfaces (static Site PWA + Android app) sharing one GST core and one
data model. Local-first, no server, no paywall. Public repo.

## Architecture Decisions
- Money in integer paise everywhere; GST math in pure functions, tested
  against shared vectors in JS and Kotlin.
- Site: no framework, no build step, IndexedDB + localStorage fallback.
- App: Kotlin + Compose + Room, minSdk 29, package in.udyamsetu.app.
  (`in` is a Kotlin keyword — package lines use backticks.)
- APK builds on GitHub Actions only (local Gradle daemon IPC blocked).
  Workflow file must be added via GitHub web UI (push token has no
  workflow scope).

## Task List

### Phase 1.1 — done this round
- [x] Task 1: Repo SkCena/udyamsetu created (now public)
- [x] Task 2: SPEC.md + CAPABILITY-MAP.md + README + LICENSE (MIT)
- [x] Task 3: Shared GST core (JS + Kotlin) + vectors — JS 114/114, Kotlin 111/111
- [x] Task 4: Site Setup + Billing (PWA) — site tests 78/78
- [ ] Task 5: Android app + CI workflow — STOPPED (see Risks). Not rebuilt here.
- [ ] Task 6: Push Phase 1.1 to main + verify head commit

### Checkpoint: Phase 1.1
- [ ] All test suites green (core JS, core Kotlin, site)
- [ ] Site + spec pushed to the repo
- [ ] Device test cards written (site done; app pending Android work)
- [ ] No device pass claimed

### Phase 1.2 — done this round (Site only, 2026-11-22, headless-verified)
- [x] Party/Udhaar ledger — party.js, 87 tests (party-inventory)
- [x] Inventory (godown, batch/expiry) — inventory.js; barcode deferred
- [x] GST reports (GSTR-1/3B, 2A/2B) + e-invoice/e-way JSON — gst-reports.js + einvoice.js, 103 tests
- [x] Payroll-lite — payroll.js, 82 tests (payroll-reports)
- [x] Reports + export (CSV/JSON/Tally BETA) — reports.js; integration 53 tests
- [x] Language LOCK — English default, 10-language tab switch (i18n.js, 33 tests)
- [x] Device test card — docs/DEVICE-TEST-1.2-site.md (user to run on phone)
- [x] Fixes found in review: cross-module cash-flow sign bug; e-invoice SupTyp B2B/B2C; classic-script global `const api` collision (Site would not have loaded in a browser — now covered by a Node vm smoke test loading all 12 scripts in order)

## Risks and Mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| Android subagent result removed by safety classifiers; that portion must not be continued/recreated in this round | High — no Android app or CI workflow in this deliverable | Report honestly; parent decides next route for the App |
| GST rules change / wrong calc = user penalty | High | CA review + test JSON before any "CA-ready" claim; never guess rates |
| CA acceptance of export formats | High | Pilot with a real CA in Phase 1.3; no claim until import test passes |
| Trademark for "UdyamSetu" | Med | Check before any Play Store listing; repo is public now |
| Local Gradle blocked | Med | GitHub Actions is the only APK route |

## Open Questions
- Trademark check — before public publish.
- CI workflow file — needs web-UI add (no workflow scope on push token).
- User's official Vyapar/Zoho APKs — static REA pass waits on those files.
