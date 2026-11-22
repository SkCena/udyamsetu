# Spec: UdyamSetu — V1 (Phase 1.1: Setup + Billing; Phase 1.2: Party, Stock, GST, Payroll, Reports)

## Objective
UdyamSetu is a free, mobile-first business / GST / accounting product for small
Indian shops. One product, two surfaces: a static local-first Site (PWA) and an
Android app. No server, no account, no paywall. Data lives on the user's device.

V1 Phase 1.1 covers: business **Setup** and **Billing** (invoice create,
GST math, PDF, share). Phase 1.2 adds: **Party/Udhaar ledger, Inventory,
GST reports + e-invoice/e-way JSON, Payroll-lite, Reports + export**.
Everything else from the plan is Deferred, not dropped.

## Language LOCK (2026-11-22, user)
Primary language is **ENGLISH** (default). Other Indian languages switch via
the language tab in the header: Hindi, Bengali, Telugu, Marathi, Tamil,
Gujarati, Punjabi, Odia, Urdu. All strings live in `site/i18n.js` — one dict
per language, English fallback for any missing key. Add a language by adding
one dict, no code change elsewhere. The Android app MUST use the same keys
and structure when it is built. Known limit (Phase 1.2): Phase 1.2 form field
labels are Hindi-only static text for now — chrome (tabs/titles/buttons/
messages/hints) switches fully; field-label translation is the next i18n step.

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
  Gradle 8.7, AGP 8.5. JDK 17 in CI. (Android work is STOPPED this round —
  see Risks; the Site carries Phase 1.2 alone until the App route is decided.)
- Shared core: `core/` — GST math + data model, implemented twice from the
  same spec: `core/gst.js` (Site) and `core/gst.kt` (App). Both must pass the
  same test vectors in `core/gst-test-vectors.json`. All money in integer
  paise — never float rupees.
- i18n: `site/i18n.js` — SUPPORTED_LANGS (10) + STRINGS per language.
  `t(key, lang)` falls back to English, then to the key. Language is stored
  in localStorage (`udyamsetu.lang`).
- Classic-script rule (learned 2026-11-22, see Risks): all Site scripts are
  classic scripts sharing ONE global lexical scope — top-level `const`/`let`/
  `function` names MUST be unique across files. Each module file therefore
  uses a file-specific top-level name (e.g. `partyApi`, `invApi`,
  `gstRepApi`) while the public `window.UdyamSetu.*` names stay stable.

## Commands
```
Site tests:   node core/gst.test.js            (114 tests)
              node site/app.test.js            (78)
              node site/party-inventory.test.js (87)
              node site/gst-einvoice.test.js    (103)
              node site/payroll-reports.test.js (82)
              node site/integration.test.js     (53)
              node site/i18n.test.js            (33)
              Total: 550 tests, all green (2026-11-22)
Browser load smoke: node /tmp/udyamsetu-smoke.js  (all 12 scripts load in
  order, DOMContentLoaded handlers run, all 5 Phase 1.2 tabs render)
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

## Success Criteria (Phase 1.1 — done, headless-verified)
- [x] Setup saves business profile (name, optional GSTIN validated, logo
      optional, UPI ID, invoice series prefix + next number) and survives reload.
- [x] Billing creates GST and non-GST invoices; CGST+SGST split intra-state,
      IGST inter-state; discount before tax; round-off to nearest rupee.
- [x] All 20+ shared GST test vectors pass in BOTH JS and Kotlin.
- [x] Invoice renders A4 + 80mm thermal PDF via print; WhatsApp share link
      opens with invoice text.
- [x] Credit note and debit note can be issued against an invoice.
- [x] Site works fully offline after first load (PWA cache); App works fully
      offline (Room local) — App pending (see Risks).
- [ ] CI workflow file exists in repo history notes (added via web UI) and the
      Android project compiles in CI — BLOCKED, Android work stopped.
- [x] Device test card written for the user (exact steps, expected results).

## Success Criteria (Phase 1.2 — done, headless-verified)
- [x] Party/Udhaar ledger: party add, udhaar/payment entries with the
      documented sign convention (positive = receivable), statement with
      running balance, due reminders with WhatsApp text.
- [x] Inventory: items (HSN/rate/unit/prices/reorder/godown), stock
      movements, batches + expiry, low-stock + expiring alerts; bill save
      auto-decrements stock for HSN/name-matched items.
- [x] GST reports: GSTR-1 (B2B/B2CL/B2CS/CDNR) + GSTR-3B (ITC user-entered,
      never guessed) summaries + portal-style JSON downloads (DRAFT);
      2A/2B reconciliation from user-pasted portal JSON.
- [x] e-invoice (NIC v1.03-style) + e-way bill JSON drafts from a saved
      invoice; no filing, no credentials stored; SupTyp B2B/B2C by GSTIN.
- [x] Payroll-lite: employees, attendance, pro-rata payslip, advance,
      payslip print; PF/ESI/PT/TDS user-configured (default 0, no statutory
      assumption).
- [x] Reports + export: sales/purchase/expense/P&L/GST/stock/cash-flow
      summaries; CSV + JSON bundle + Tally-compatible CSV labelled BETA
      (NOT "CA-ready" — CA pilot pending).
- [x] Language: English default; language tab switches Hindi + Bengali,
      Telugu, Marathi, Tamil, Gujarati, Punjabi, Odia, Urdu (all visible
      chrome keys translated; messages fall back to English).
- [x] All 550 node tests green; browser load smoke green (12 scripts,
      all tabs render); 16/16 files HTTP 200 over local http.
- [ ] Device test card for Phase 1.2 written — see
      `docs/DEVICE-TEST-1.2-site.md` (user runs it on the phone).

## Out of Scope (Deferred)
- Multi-user/firm, bank feeds, online store/POS/loyalty, manufacturing/BOM,
  AI — Phase 2+.
- Exam Prep and Photo Editor modules — Phase 3.
- Direct GST portal filing, GSP integration, realtime cloud sync.
- Public repo / GitHub Pages publish — user decision, later.
- "CA-ready" claim — only after a real CA import test passes (Phase 1.3).

## Risks / Lessons (2026-11-22)
- **Classic-script global collision (FOUND + FIXED in Phase 1.2):** every
  Site module used top-level `const api` (and `let gst`, `roundDiv`,
  `newId`, `paiseToRupees` …) — classic scripts share one global scope, so
  the second script would throw `Identifier 'api' has already been
  declared` and the Site would never load in a browser. Phase 1.1 never
  ran in a browser, so it went unnoticed. Fixed by file-specific top-level
  names + a Node vm smoke test that loads all scripts in order.
  Rule: never add a top-level name without checking all other scripts.
- **Sign conventions must be canonical:** party.js is the ledger truth
  (positive = receivable). reports.js originally counted credit purchases
  as cash-out and credit sales as cash-in — fixed in Phase 1.2 review:
  cash flow counts only real cash (`payment` entries + cash invoices);
  purchaseSummary returns the purchase value as a positive cost.
- **Android subagent result removed by safety classifiers; that portion
  must not be continued/recreated in this round** — no Android app or CI
  workflow in this deliverable. Parent decides the next route.
- **Repo creation failed (2026-11-22):** SkCena org repo create returned
  GitHub API 404 — SkCena is not connected to Muse (connected account is
  anon257261-lang). Local files are in `~/workspace/udyamsetu`; no GitHub
  repo exists yet. User action needed to connect SkCena or pick an account.
- GST rules change / wrong calc = user penalty — CA review + test JSON
  before any "CA-ready" claim; never guess rates.
- Trademark for "UdyamSetu" — check before any public publish.

## Open Questions
- Trademark check for "UdyamSetu" — not done; before any public publish.
- Real CA validation of invoice format / GSTR JSON — Phase 1.3, needs a CA.
- Logo upload in Setup: file input now, cropping later.
- Phase 1.2 form field labels are Hindi-only static text — translate to
  i18n keys in the next i18n step (chrome already switches fully).
