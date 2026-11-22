# Spec: UdyamSetu — V1 (Phase 1.1: Setup + Billing)

## Objective
UdyamSetu is a free, mobile-first business / GST / accounting product for small
Indian shops. One product, two surfaces: a static local-first Site (PWA) and an
Android app. No server, no account, no paywall. Data lives on the user's device.

V1 Phase 1.1 covers only: business **Setup** and **Billing** (invoice create,
GST math, PDF, share). Everything else from the plan is Deferred, not dropped.

User: a small shop owner in India, phone-first, often offline, Hindi-first.
Success: the shop can set up in 5 minutes and make a correct GST invoice
offline, print/share it as PDF, and the totals match hand calculation to the
paise.

Source plan: `~/workspace/research_notes/vyapar-tally-zoho-rea-20261122/plan-and-name.md`
Source REA: `~/workspace/research_notes/vyapar-tally-zoho-rea-20261122/report.md`

## Assumptions (stated, not silent)
1. User gave full permission for internet lookup / fetch / download for this
   work (2026-11-22). Official docs / APKs may be fetched freely.
2. Repo is PRIVATE on SkCena (`SkCena/udyamsetu`) until the user says publish.
   GitHub Pages is therefore NOT public yet — the Site is built as a static
   PWA preview in this repo, Pages decision comes later from the user.
3. Android package `in.udyamsetu.app`, minSdk 29, Kotlin + Jetpack Compose,
   Room/SQLite, offline-first. Local Gradle is blocked on this VM (daemon IPC);
   the APK is built by GitHub Actions only.
4. GST rules are taken from the plan/REA notes; any rate/threshold the plan
   marks "not verified" stays "not verified" here and is NOT guessed.
5. No direct GST portal filing in Phase 1.1. Invoices export as JSON/PDF for
   the user to upload on the portal.

## Tech Stack
- Site: static HTML/CSS/JS, no framework, no build step. Storage: IndexedDB
  (localStorage fallback). PDF: print CSS (A4 + 80mm thermal). PWA manifest +
  service worker (cache-first, offline).
- App: Kotlin 1.9, Jetpack Compose (BOM), Room 2.6, minSdk 29, targetSdk 34,
  Gradle 8.7, AGP 8.5. JDK 17 in CI.
- Shared core: `core/` — GST math + data model, implemented twice from the
  same spec: `core/gst.js` (Site) and `core/gst.kt` (App). Both must pass the
  same test vectors in `core/gst-test-vectors.json`. All money in integer
  paise — never float rupees.

## Commands
```
Site tests:   node core/gst.test.js            (Node 20+)
Kotlin tests: kotlinc core/gst.kt core/GstTest.kt -include-runtime -d /tmp/gst-test.jar && java -jar /tmp/gst-test.jar
App CI:       ./gradlew :app:assembleDebug :app:testDebugUnitTest :app:lintDebug   (GitHub Actions only)
```

## Project Structure
```
README.md            -> What this is, how to run, what is NOT done yet
SPEC.md              -> This file (V1, Phase 1.1)
CAPABILITY-MAP.md    -> Module ids + build order
LICENSE              -> MIT
tasks/plan.md        -> Implementation plan
tasks/todo.md        -> Task checklist
core/                -> Shared GST math + data model (js + kt + test vectors)
  gst.js / gst.kt / gst-test-vectors.json / gst.test.js / GstTest.kt
site/                -> Static PWA (index.html, app.js, styles.css, manifest.json, sw.js)
app/                 -> Android Gradle project (package in.udyamsetu.app)
  build.gradle.kts, settings.gradle.kts, gradle.properties, gradlew
  app/build.gradle.kts, app/src/main/...
.github/workflows/build-apk.yml  -> CI (added via web UI; API token has no workflow scope)
docs/                -> Device test cards + notes
```

## Code Style
- Paise everywhere: `amountPaise: Int/Long`. Format only at display edge.
- Names: business words in plain English (`Invoice`, `Party`, `Item`,
  `taxablePaise`, `cgstPaise`). No Hinglish in code identifiers.
- One function, one job. Pure functions for money math (no I/O inside).
- Site JS: no framework, no `eval`, no remote scripts. All data local.

## Testing Strategy
- TDD: failing test first (vectors), then minimal code. Red-green-refactor.
- Unit: GST math (both JS and Kotlin) against the shared vectors — every
  slab, intra/inter-state split, discount-before-tax, round-off, GSTIN
  format + checksum, HSN validation, invoice-number series.
- Site: node tests for logic; HTML checked by opening the file (no server
  needed) — manual device check card in `docs/DEVICE-TEST-1.1.md`.
- App: JVM unit tests for the same vectors; Compose UI is NOT claimed
  verified until the user runs it on the phone (device-first rule).
- Full suite runs before every push. A failing test blocks the push.

## Boundaries
- Always: run the full test suite before pushing; keep Site and App math
  identical via the shared vectors; state what is headless-only vs
  device-verified.
- Ask first: adding a dependency, changing the data model, changing CI,
  making anything public (repo, Pages, Release).
- Never: commit secrets / credentials / GSTINs of real businesses; copy
  proprietary code; claim a device pass without the user's phone verdict;
  publish the repo or the Site publicly; bypass a paywall or licence check.

## Success Criteria (Phase 1.1)
- [ ] Setup saves business profile (name, optional GSTIN validated, logo
      optional, UPI ID, invoice series prefix + next number) and survives reload.
- [ ] Billing creates GST and non-GST invoices; CGST+SGST split intra-state,
      IGST inter-state; discount before tax; round-off to nearest rupee.
- [ ] All 20+ shared GST test vectors pass in BOTH JS and Kotlin.
- [ ] Invoice renders A4 + 80mm thermal PDF via print; WhatsApp share link
      opens with invoice text.
- [ ] Credit note and debit note can be issued against an invoice.
- [ ] Site works fully offline after first load (PWA cache); App works fully
      offline (Room local).
- [ ] CI workflow file exists in repo history notes (added via web UI) and the
      Android project compiles in CI (or the CI failure is reported honestly).
- [ ] Device test card written for the user (exact steps, expected results).

## Out of Scope (Deferred)
- Party/Udhaar ledger, Inventory, GST reports, e-invoice/e-way bill,
  Payroll-lite, Reports, CA-ready export, multi-user/firm, bank feeds,
  online store/POS/loyalty, manufacturing/BOM, AI — all Phase 1.2+.
- Exam Prep and Photo Editor modules — Phase 3.
- Direct GST portal filing, GSP integration, realtime cloud sync.
- Public repo / GitHub Pages publish — user decision, later.

## Open Questions
- Trademark check for "UdyamSetu" — not done; before any public publish.
- Real CA validation of invoice format / GSTR JSON — Phase 1.3, needs a CA.
- Logo upload in Setup: file input now, cropping later.
