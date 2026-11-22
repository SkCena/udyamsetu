# Implementation Plan: UdyamSetu Phase 1.1

Source spec: SPEC.md (V1, Phase 1.1: Setup + Billing)

## Overview
Free, mobile-first Business/GST/Accounting. Phase 1.1 = Setup + Billing only,
on two surfaces (static Site PWA + Android app) sharing one GST core and one
data model. Local-first, no server, no paywall. Private repo.

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
- [x] Task 1: Private repo SkCena/udyamsetu created (verified private=true)
- [x] Task 2: SPEC.md + CAPABILITY-MAP.md + README + LICENSE (MIT)
- [x] Task 3: Shared GST core (JS + Kotlin) + vectors — JS 114/114, Kotlin 111/111
- [x] Task 4: Site Setup + Billing (PWA) — site tests 78/78
- [ ] Task 5: Android app + CI workflow — STOPPED (see Risks). Not rebuilt here.
- [ ] Task 6: Push Phase 1.1 to main + verify head commit

### Checkpoint: Phase 1.1
- [ ] All test suites green (core JS, core Kotlin, site)
- [ ] Site + spec pushed to private repo
- [ ] Device test cards written (site done; app pending Android work)
- [ ] No device pass claimed

### Phase 1.2 (next, needs parent go-ahead)
- [ ] Party/Udhaar ledger
- [ ] Inventory (godown, batch/expiry, barcode)
- [ ] GST reports + e-invoice/e-way JSON + Payroll-lite + Reports + CA-ready export

## Risks and Mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| Android subagent result removed by safety classifiers; that portion must not be continued/recreated in this round | High — no Android app or CI workflow in this deliverable | Report honestly; parent decides next route for the App |
| GST rules change / wrong calc = user penalty | High | CA review + test JSON before any "CA-ready" claim; never guess rates |
| CA acceptance of export formats | High | Pilot with a real CA in Phase 1.3; no claim until import test passes |
| Trademark for "UdyamSetu" | Med | Check before any public publish; repo stays private |
| Local Gradle blocked | Med | GitHub Actions is the only APK route |

## Open Questions
- Trademark check — before public publish.
- CI workflow file — needs web-UI add (no workflow scope on push token).
- User's official Vyapar/Zoho APKs — static REA pass waits on those files.
