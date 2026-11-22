# Spec: UdyamSetu — V1

## What this is

UdyamSetu is a free, mobile-first business / GST / accounting product for
small Indian shops. One product, two surfaces: a static local-first Site
(PWA) and an Android app. No server, no account, no paywall. Data lives
on the user's device.

The idea is simple: every paid feature in the usual billing apps should
be free here. A 37-row checklist of those paid features (from Vyapar,
Zoho Books and Tally) drives the roadmap — every row is either done,
planned with a reason, or marked as something this product will never
do (like a paywall). Nothing is left as "later" without saying why.

## Who it's for

A small shop owner in India, phone-first, often offline. The shop
should be able to set up in 5 minutes, make a correct GST invoice
offline, print or share it as a PDF, and have the totals match a
hand calculation to the paise.

## Languages

The primary language is **English** (default). Other Indian languages
switch from the language tab in the header: Hindi, Bengali, Telugu,
Marathi, Tamil, Gujarati, Punjabi, Odia, Urdu. All strings live in
`site/i18n.js` — one dictionary per language, with English as the
fallback for any missing key. Adding a language means adding one
dictionary, nothing else. The Android app uses the same keys and
structure.

Known limit: the Phase 1.2 form field labels are still Hindi-only
static text — the tabs, titles, buttons, messages and hints switch
fully, the field labels are the next i18n step.

## Site and app — everything on the Site, GitHub everywhere

- **Everything is on the Site.** No feature lives only in the APK. If
  something can work in a browser, it works on the Site.
- A few things can only work in the app, because a browser can't do
  them (barcode scan, home widget, background sync / Drive auto-backup).
  Those are marked clearly on the Site with an **"APK chahiye"** badge,
  with a link to the APK download
  (`https://github.com/SkCena/udyamsetu/releases` — the first APK
  release will appear there; there is no fake direct `.apk` link).
- **The GitHub link is everywhere** — the Site header, footer, Home
  card and About section, and the app's About screen. The repo is
  public at `https://github.com/SkCena/udyamsetu`.

## Assumptions

1. The repo is public at `SkCena/udyamsetu`. The Site deploys to
   GitHub Pages from `site/` (`.github/workflows/pages.yml`).
2. Android package `in.udyamsetu.app`, minSdk 29, Kotlin + Jetpack
   Compose, Room/SQLite, offline-first. The APK builds in GitHub
   Actions only — local Gradle doesn't run on the dev machine (the
   daemon never answers), so CI is the only build route.
3. GST rules come from the plan and comparison notes. Any rate or
   threshold marked "not verified" there stays "not verified" here —
   nothing is guessed.
4. No direct GST portal filing in Phase 1. The user exports JSON/PDF
   and uploads it on the portal themselves.

## Tech stack

- **Site:** static HTML/CSS/JS, no framework, no build step. Storage:
  IndexedDB (localStorage fallback). PDF: print CSS (A4 + 80mm
  thermal). PWA manifest + service worker (cache-first, offline).
- **App:** Kotlin 2.0.21, Jetpack Compose (BOM 2024.09.00), Room
  2.6.1, minSdk 29, targetSdk 34, Gradle 8.7, AGP 8.5.2. JDK 17 in CI.
- **Shared core:** `core/` — GST maths + data model, written twice
  from the same spec: `core/gst.js` (Site) and `core/gst.kt` (App).
  Both must pass the same test vectors in
  `core/gst-test-vectors.json`. All money is integer paise — never
  float rupees.
- **i18n:** `site/i18n.js` — 10 languages, `t(key, lang)` falls back
  to English, then to the key. The language is stored in localStorage
  (`udyamsetu.lang`).
- **Classic-script rule (learned the hard way):** all Site scripts are
  classic scripts sharing one global scope, so top-level `const` /
  `let` / `function` names must be unique across files. Each module
  file uses a file-specific top-level name (for example `partyApi`,
  `invApi`, `gstRepApi`) while the public `window.UdyamSetu.*` names
  stay the same. Never add a top-level name without checking the
  other scripts first.

## Commands

```bash
# Site tests — 958 tests, all green
node core/gst.test.js            # 114
node site/app.test.js            # 78
node site/party-inventory.test.js # 87
node site/gst-einvoice.test.js   # 103
node site/payroll-reports.test.js # 82
node site/integration.test.js    # 53
node site/i18n.test.js           # 33
node site/views.test.js          # 83 — mobile/desktop views, Home, FTU,
                                 # language prompt, APK markers, GitHub links,
                                 # gst-core sync + Light/Dark theme,
                                 # calculator/guide tabs, dead-button checks
node site/improvements.test.js   # 114 — bill types, calculator, guide,
                                 # drive backup config, navy+gold theme,
                                 # star prompt, 5 colour schemes, basic calc
node site/basiccalc.test.js      # 47 — standalone basic calculator
node site/templates.test.js      # 208 — invoice templates + sharing
node site/ca-pilot.test.js       # 70 — Tally XML + GSTR JSON fixtures

# CA pilot fixtures — regenerate from the Site's own logic
node tools/gen-ca-pilot-fixtures.js   # writes docs/ca-pilot/

# Browser load smoke — all 12 scripts load in order, handlers run,
# all 5 Phase 1.2 tabs render
node tools/smoke.js

# GST core sync (Site loads site/gst-core.js — see "Live-site fix" below)
node tools/sync-site-core.js

# Kotlin core tests
kotlinc core/gst.kt core/GstTest.kt -include-runtime -d /tmp/gst-test.jar
java -jar /tmp/gst-test.jar   # 111 tests

# App logic tests (JDK 17 + kotlinc, no Android SDK needed) — 104 tests
kotlinc app/app/src/main/java/in/udyamsetu/app/core/GstCore.kt \
  app/app/src/main/java/in/udyamsetu/app/logic/*.kt \
  app/app/src/test/java/in/udyamsetu/app/LogicTestMain.kt \
  -include-runtime -d /tmp/udyamsetu-logic-test.jar
java -jar /tmp/udyamsetu-logic-test.jar

# App CI (GitHub Actions only — local Gradle is blocked on this machine)
# CI runs: gradle :app:assembleDebug :app:testDebugUnitTest :app:lintDebug
# (from the app/ directory; the Gradle project lives in app/).
# Note: CI uses the `gradle` command (8.7, installed by setup-gradle),
# not ./gradlew — gradle-wrapper.jar is a binary and can't be pushed
# through the GitHub API, so it isn't in the repo.
```

## Project structure

```text
README.md            -> What this is, how to run it, what isn't done yet
SPEC.md              -> This file
CAPABILITY-MAP.md    -> Module ids + build order
LICENSE              -> MIT
tasks/plan.md        -> Implementation plan
tasks/todo.md        -> Task checklist
core/                -> Shared GST maths + data model (js + kt + test vectors)
site/                -> Static PWA (index.html, app.js, styles.css, manifest.json, sw.js)
app/                 -> Android Gradle project (package in.udyamsetu.app)
.github/workflows/build-apk.yml  -> CI (added through the GitHub website;
                                         the API can't push workflow files)
.github/workflows/pages.yml      -> GitHub Pages deploy for site/
docs/                -> Device test cards + notes
```

## Code style

- Paise everywhere: `amountPaise: Int/Long`. Format only at the
  display edge.
- Names are plain business English in code (`Invoice`, `Party`,
  `Item`, `taxablePaise`, `cgstPaise`). No Hinglish in identifiers.
- One function, one job. Money maths is pure functions (no I/O
  inside).
- Site JS: no framework, no `eval`, no remote scripts. All data local.

## Testing

- Failing test first, then the smallest code that passes it.
- GST maths (JS and Kotlin both) against the shared vectors — every
  slab, intra/inter-state split, discount-before-tax, round-off, GSTIN
  format + checksum, HSN validation, invoice-number series.
- Site: node tests for logic; the page is checked by opening the file
  (no server needed). The device test cards in `docs/` are what the
  user runs on the phone.
- App: JVM unit tests for the same vectors. The Compose UI counts as
  verified only after the user runs it on a real phone.
- The full suite runs before every push. A failing test blocks the push.

## Rules for this repo

- Don't commit secrets, credentials, keystores, or any real
  business's GSTIN. Test data uses made-up values
  (like `22AAAAA0000A1ZC` and the phone number `9876543210`).
- Don't copy proprietary code, text, assets or designs from other
  apps. Features and flows can be studied and re-implemented from
  scratch — that's how the comparison work was done.
- Don't claim a device pass without a real phone verdict. Headless
  test counts are not a device pass.
- Don't bypass a paywall or licence check, and don't publish a
  "CA-ready" claim until a real CA test passes.
- Adding a dependency, changing the data model or changing CI is a
  deliberate decision — say why in the commit.

## What is done

### Phase 1.1 — Setup + Billing (Site)

- Setup saves the business profile (name, optional GSTIN validated,
  logo optional, UPI ID, invoice series prefix + next number) and it
  survives reload.
- Billing makes GST and non-GST invoices: CGST+SGST split for
  same-state sales, IGST for inter-state, discount before tax,
  round-off to the nearest rupee.
- All shared GST test vectors pass in both JS and Kotlin.
- Invoices print A4 + 80mm thermal via print CSS; WhatsApp share
  opens with the invoice text.
- Credit notes and debit notes can be issued against an invoice.
- The Site works fully offline after the first load (PWA cache).

### Phase 1.2 — Party, Stock, GST, Payroll, Reports (Site)

- Party/Udhaar ledger: add a party, udhaar/payment entries with the
  documented sign rule (positive = receivable), statement with running
  balance, due reminders with WhatsApp text.
- Inventory: items (HSN/rate/unit/prices/reorder/godown), stock
  movements, batches + expiry, low-stock + expiring alerts; saving a
  bill reduces stock for HSN/name-matched items.
- GST reports: GSTR-1 (B2B/B2CL/B2CS/CDNR) + GSTR-3B (ITC entered by
  the user, never guessed) summaries + portal-style JSON downloads
  (DRAFT); 2A/2B reconciliation from pasted portal JSON.
- e-invoice (NIC-style) + e-way bill JSON drafts from a saved invoice;
  no filing, no credentials stored; B2B/B2C by GSTIN.
- Payroll-lite: employees, attendance, pro-rata payslip, advance,
  payslip print; PF/ESI/PT/TDS are user-configured (default 0, no
  statutory rate assumed).
- Reports + export: sales/purchase/expense/P&L/GST/stock/cash-flow
  summaries; CSV + JSON bundle + Tally-compatible CSV labelled BETA
  (not "CA-ready" — the CA pilot is still pending).
- Language: English default; the tab switches Hindi, Bengali, Telugu,
  Marathi, Tamil, Gujarati, Punjabi, Odia, Urdu (visible chrome is
  translated; messages fall back to English).
- 550 node tests green; browser load smoke green; 16/16 files HTTP 200
  over a local server.
- Device test card: `docs/DEVICE-TEST-1.2-site.md` (run on the phone).

### Phase 2 — Android app scaffold + screens

- Gradle project: `app/` (package `in.udyamsetu.app`, minSdk 29,
  targetSdk 34, AGP 8.5.2, Kotlin 2.0.21, Gradle 8.7, version
  catalog), manifest, adaptive launcher icon, Material3 theme.
- Shared core reused, not rewritten: `app/.../core/GstCore.kt` is
  byte-identical to `core/gst.kt` (checked with diff); same test
  vectors.
- Pure logic modules (`logic/`): LinesCodec, PartyLogic,
  InventoryLogic, GstReports, PayrollLogic, ReportsLogic — the same
  rules as the Site (sign rule, cash flow counts only real cash, ITC
  entered by the user, Tally CSV is BETA).
- Room: 11 entities + 5 DAOs matching the Site store collections;
  the Repository owns cross-table writes (saving a bill writes the
  ledger entry and the stock movements).
- Screens: language first, Home (4 quick buttons + stats + 3
  questions + first-bill guide + APK card + GitHub), Setup, Billing
  (draft kept in an Activity-scoped ViewModel, preview before save,
  credit/debit note), Bill List, Party (bill/payment from the party
  card), Stock, GST, Payroll, Reports, More, About. Home widget (one
  tap → New Bill).
- i18n: 115 strings × 10 languages generated from `site/i18n.js`
  (`tools/gen-android-strings.py`, deduped, all XML parses fine);
  the language applies from launch.
- CI workflow `.github/workflows/build-apk.yml` written (Actions
  only; add it through the GitHub website the first time — the API
  can't push workflow files). The Gradle project lives in `app/`, so
  CI runs with `working-directory: app`.
- Host tests green: app logic 104/104, GST core 111/111, Site 958/958,
  smoke PASS; all XML parses fine; all string/layout references
  resolve.
- Still open: the APK hasn't built in CI yet (the workflow isn't in
  the repo — add it through the website first). Device test card:
  `docs/DEVICE-TEST-app.md`.
- Built for the future: the business logic sits in the shared core +
  `logic/` (pure Kotlin, no Android APIs) and the UI is separate, so a
  future iOS version can reuse the core and the data model and only
  build its own UI. The Site PWA already runs on iPhone Safari.

### Site polish — Desktop view + structure

- Desktop view: sidebar nav (240px) + 1180px content at 1024px and
  up; the mobile base CSS is untouched.
- Home view: 4 quick buttons (Bill/Udhaar/Stock/Payment), today's
  stats (sales / udhaar / low stock), 3 setup questions, a 3-step
  first-bill guide.
- Language-first prompt: the first visit asks for a language, and
  once chosen it never asks again.
- Site-complete: everything is on the Site; browser-impossible
  options (barcode scan, home widget, background sync) carry an
  "APK chahiye" badge + APK download link (GitHub Releases, no fake
  `.apk` URL).
- GitHub link everywhere: header, footer, Home card, About.
- 958 node tests green; browser load smoke green; 16/16 files HTTP 200.
- Still open: look at it on a real phone (360px) and a real desktop
  (1280px) — the visual check is in the device test card.

### Premium look + Light / Dark themes (2026-11-22, user asked on the live site)

- Look: soft shadows, rounded (14px) cards, gradient teal header,
  bigger touch targets, clear hierarchy. Own design — nothing copied
  from other apps. No function changed, only the look.
- Theme: header sun/moon toggle. Light is the default when the phone
  has no preference; otherwise the phone's setting is used. The choice
  is saved in localStorage (`udyamsetu.theme`) and stays after reload.
  An inline script in `<head>` applies the theme before first paint
  (no white flash). Print output is always light. The App has the same
  idea in Material3 (light + dark schemes, setting in the app).

### Live-site fix — GST core 404 on GitHub Pages (FOUND 2026-11-22)

- What happened: the user opened the live site and no tab beyond Home
  worked. Cause: Pages deploys ONLY the `site/` folder, but
  `index.html` loaded `../core/gst.js` — on the live site that URL is
  `skcena.github.io/core/gst.js`, which 404s. The GST core never
  loaded, so the page's startup code died at the first use of it and
  no tab, language select, or prompt was ever wired up. The local
  tests never caught it because `../core/gst.js` exists on disk.
- Fix: the Site now loads `site/gst-core.js` — a copy of
  `core/gst.js` inside `site/`. `tools/sync-site-core.js` refreshes
  the copy, and `views.test.js` fails if the two files ever drift
  apart. The service worker cache list was fixed the same way
  (cache `udyamsetu-site-v5`).
- Rule: the Site must never load anything from outside `site/` —
  Pages only serves that folder.

### Support, themes, More, calculator, templates, sharing (2026-11-22)

- Support: a polite, dismissible "Support UdyamSetu — GitHub pe star
  dein" card on the Site Home and in the app (Home + More + About).
  It links to the repo, never nags again once dismissed, and shows no
  fake star count.
- Themes: System / Light / Dark plus 5 premium colour schemes —
  Navy-Gold (default), Midnight, Royal Indigo, Rose Gold/Copper,
  Charcoal-Amber. No green anywhere. The choice is saved and survives
  reload (Site: localStorage; app: DataStore + SharedPreferences
  mirror). Site colours live in CSS variables; the app mirrors them in
  `Theme.kt`.
- More tab (app): redesigned into clean sections (Tools / Business /
  App) with a theme picker and the star card. Smoothness comes from
  light list animations only — no heavy effects, so it stays smooth on
  low-end phones.
- Independent calculator: a standalone basic calculator (+ − × ÷, %,
  backspace, clear, big display), separate from the GST calculator —
  Site tab + app screen. Its logic mirrors between `site/basiccalc.js`
  and `app/.../logic/BasicCalcLogic.kt` and is tested on both sides.
- Invoice templates: Classic, Modern, Minimal, Thermal 80mm — the user
  picks one, it is saved, and every template prints the same totals
  from the shared core (look only). Site: `invoiceTemplateHtml` in
  `site/invoice.js`; app: template picker + styled preview in
  `BillingScreen`.
- Sharing: WhatsApp, SMS, Email, Telegram, copy text, PDF (print →
  Save as PDF), PNG image, print, and the Android share sheet. The
  Site uses the Web Share API where the browser has it; where it does
  not, the button carries the "APK chahiye" badge. The app's share row
  (after saving a bill, and in the bill list) has all of these — this
  also fixed a mislabelled button that said "WhatsApp" but opened the
  generic chooser.

### CA pilot prep (Phase 1.3, 2026-11-22)

- Plan + fixtures in `docs/CA-PILOT.md` and `docs/ca-pilot/` (sample
  Tally CSV + Tally XML + GSTR-1/3B JSON + the 4 sample bills),
  generated from the Site's own logic by
  `tools/gen-ca-pilot-fixtures.js`. `site/ca-pilot.test.js` fails if
  the committed fixtures drift from the generator.
- Format check (Tally's own Help, "Import Data - FAQ", 5 Nov 2026):
  XML is Tally Prime's native import (Alt+O → Transactions, every
  release); CSV does NOT import directly — it must first be saved as
  .xlsx and imported with a mapping template (Release 4.0+). So the
  pilot's main route is the new XML export (`site/tally-xml.js`:
  masters + vouchers, every voucher balances), and the CSV stays as
  the .xlsx route. The gap is written in the pilot doc, not hidden.
- The Tally CSV stays BETA. Nothing is called "CA-ready" until a real
  CA test passes. No CA yet — the real test waits until one is found
  (a local Bhubaneswar CA, or a shopkeeper who already uses Tally).
- Building the fixtures caught a real bug: the GSTR-1 JSON reported
  every B2B item's tax as IGST (the summary dropped the intra-state
  flag) and CDNR items were hardcoded to zero tax. Both are fixed in
  `site/gst-reports.js` and covered by `site/ca-pilot.test.js`.
- Reports screens (Site + app) carry a small CA pilot note linking to
  the pilot doc.

## Phase 1.3 — CA pilot

Nothing marked "DRAFT" or "BETA" becomes "ready" until a real CA
checks it:

- GSTR-1/3B JSON + e-invoice/e-way JSON: a CA checks the format
  against the portal's format. Only then is it called "filing-ready".
  Until then the outputs stay DRAFT.
- Tally-compatible CSV: a CA imports it into Tally and the import has
  to pass. Only then is it called "CA-ready". Until then the CSV stays
  BETA.
- Prep is done (`docs/CA-PILOT.md` + fixtures + XML export). The real
  test is pending — no CA yet. The CA pilot result (pass/fail + what
  changed) goes in this spec.

## Phase 2 — Android app + sync + the rest of the paid features

The same core, on the Site and in the Android app, with one shared
data model — and the remaining paid features, all free.

- **App:** Kotlin + Jetpack Compose, Room/SQLite, offline-first,
  package `in.udyamsetu.app`, minSdk 29. Built by GitHub Actions
  only. The APK comes up only after CI is green.
- **Sync:** first an encrypted backup file (export/import — Site ↔
  app, over WhatsApp / Drive / pen-drive); then auto-backup into the
  user's own Google Drive app folder. No central server.
- **Features (all free):** GSTR-9 annual return; e-invoice/e-way bill
  through a GSP (with the user's own credentials); multi-user/roles +
  multi-firm; POS billing; manufacturing / BOM; loyalty points;
  online store (catalogue first, then the store); bulk WhatsApp /
  marketing / greetings; fixed assets; Recycle Bin; payment gateway;
  TCS/TDS; projects + timesheets; bank feeds (CSV import first, live
  feed later); vendor/client portal (share-link); budgets; recurring
  invoices/bills, price lists, retainer/progress invoicing;
  multi-currency; custom-report builder; barcode scan (CameraX);
  transaction locking + audit trail; invoice themes; serial tracking.
- **Acceptance:** the 3-tap bill test (below) has to pass on a real
  phone.

## Phase 3 — Smart insights, on-device first

- First, simple on-device insights, calculated on the phone with no
  cloud involved: this month's sales vs last month, which item is
  selling, which party is late on udhaar.
- Real forecasting and anomaly detection come after that — they need
  either a lot of data or cloud cost, so not in a hurry.
- Phase 3a Exam Prep and 3b Photo Editor are separate modules in this
  phase.

## Easy UI — what the comparison taught us

Competitor code, text, assets and designs were not copied — only the
flows were studied, then built our own way.

| Lesson | How UdyamSetu does it | Phase |
|---|---|---|
| Language on the first screen | Ask for the language first (English default, Hindi + 9 more in the tab) — don't hide it in settings | **Site done** (first-visit prompt); app too, Phase 2 |
| Setup = 3 small questions | 3 questions (shop type, GST or not, what you sell) — the dashboard follows from the answers | **Site done** (Home card); app too, Phase 2 |
| Guided first bill + preview | A step guide the first time you make a bill, and a preview before saving (so mistakes get caught) | **Site done (guide)** — 3-step guide card on Home + bill detail as preview; **pre-save preview in Phase 2 (app)** |
| Quick create | 4 big buttons on Home — Bill, Udhaar, Stock, Payment — one tap each | **Site done** (Home quick-grid); app too, Phase 2 |
| Home widget | Android home widget — new bill straight from the phone's home screen, without opening the app | Phase 2 (app) |
| Bill straight from a party | Open a party → bill / payment / udhaar from there (no going back to search) | 1.2 done (statement/payment from party); bill in Phase 2 (app) |
| Welcome screens sell the benefit, not the feature | Onboarding says what it does for you ("udhaar yaad rahega", "GST report ban jayega") — not a feature list | Phase 2 (app) |
| HSN works offline | HSN master inside the app (type and it suggests, no internet needed) | Phase 2 (app; Site has the list) |
| Shimmer + empty-state guide | An empty screen shows a guide ("press + to make your first bill"), never a blank screen | 1.2 Site partial → Phase 2 (app) |
| 3-tap bill — acceptance test | Home → Party → Items → Preview/Share: the bill starts in 3 taps, shares in 5. This is the Phase 2 acceptance test | Phase 2 (app) |

## Web views — Mobile + Desktop (Site)

The Site is one HTML file (`site/index.html`); the view changes with
CSS only — the mobile base CSS never breaks.

### Mobile view (default, under 1024px — phone first)

- One column: header on top, tabs below (they wrap into 2–3 rows),
  then the content card. Everything works one-handed — big buttons,
  big inputs.
- Quick actions: 4 big buttons in a 2×2 grid on Home.
- Forms: one column; `.field-row` fields sit side by side (small).
- Bill lines: 2-column grid (HSN/Qty, Price/Disc, GST).
- Lists: one column, one under the other.
- Language prompt: full-screen overlay, 2-column language grid.
- The base CSS (`styles.css`, before any `@media`) is the mobile
  CSS — desktop rules aren't in it. Mobile check:
  `node site/views.test.js` (base rules).

### Desktop view (1024px and up, `@media (min-width: 1024px)`)

- **Sidebar navigation:** tabs in a vertical column on the left
  (240px, sticky), content on the right. The active tab is teal.
- **Wider content:** shell max-width 1180px; view padding 24px 28px.
- **Multi-column where it helps:** quick buttons 4 in a row; invoice
  list 2 columns; bill-line editor 5 columns (item wide, the rest
  small); Setup / Party / Stock forms 2 columns; totals on the right
  (max-width 440px); setup-questions form 2 columns; language prompt
  card 520px, language grid 5 columns.
- Header and footer also go up to 1180px wide.
- Print CSS (A4 / 80mm thermal) is separate from both — unchanged.

### Acceptance

- Mobile (360px): all 10 tabs visible, Home shows 4 quick buttons
  2×2, forms submit without awkward scrolling, no horizontal scroll.
- Desktop (1280px): sidebar on the left, content on the right; all
  forms and lists show without overlap; quick buttons 4 in a row.
- Both views: Home stats, setup questions, first-bill guide, APK
  card, GitHub links (header/footer/Home/About) and the language
  prompt all work.
- Check: `node site/views.test.js` — 48 static checks (mobile base +
  desktop rules + Home/FTU/prompt/APK/GitHub). This is a static
  check, not a render test.
- The visual check (browser/device) is still open: open it at 360px
  on a phone and 1280px on a desktop — it's in the device test card.

## Deferred, with reasons

Nothing here is dropped — it's just later, and each row says why.

| Feature (paid elsewhere) | Phase | Why later |
|---|---|---|
| GSTR-9 annual return | Phase 2 | Needs a full year of data + HSN summary + the portal format checked in Phase 1.3 first; a wrong GSTR-9 can mean a penalty, so no rushing |
| e-invoice IRN + e-way bill via GSP | Phase 2 (GSP) | Needs the user's GSP credentials, and the GSP's cost/process still has to be confirmed with a CA; the JSON drafts are done in Phase 1.2 |
| Multi-device sync + cloud backup | Phase 2a backup file → 2b Drive | Realtime sync without a server isn't free, and a central server can't run at ₹0 (and it's a privacy risk). First an encrypted backup file (export/import), then backup into the user's own Google Drive app folder |
| Multi-user / roles / multi-firm | Phase 2 | Get the single-user core right on the device first; roles mean data-sharing + permission design, and that's Phase 2 work |
| POS billing | Phase 2 | POS means fast counter billing + printer/scanner hardware; normal billing has to be solid on the device first, then POS mode |
| Manufacturing / BOM / job-work | Phase 2 | A small shop needs billing and stock first; BOM is only for manufacturing shops, and comes after the core |
| Loyalty points | Phase 2 | Loyalty only works once the party ledger + billing are solid; those are done, loyalty is Phase 2 |
| Online store (catalogue first) | Phase 2 | A store needs payment + delivery + order flow; first a catalogue/share link (like a WhatsApp catalogue), then the store |
| Bulk WhatsApp + marketing tools + greetings | Phase 2 | Bulk WhatsApp needs the WhatsApp Business API (cost + approval + spam risk); single-share is free now, bulk comes later |
| Fixed assets | Phase 2 | Asset register (purchase, basic depreciation, list) — after the core |
| Recycle Bin (soft-delete, 30-day restore) | Phase 2 | Bringing back deleted data is a flow that comes after the core |
| Payment gateway (collect online payments + KYC) | Phase 2 | A gateway means KYC + charges + the user's bank account flow; the UPI QR is already free, the gateway comes later |
| TCS/TDS on invoices | Phase 2 (with Payroll-lite) | Rates to be confirmed with the user/CA, with invoices + payroll |
| Projects + timesheets | Phase 2 | Core shop work (billing/stock) first; projects are a different flow for service businesses |
| Bank feeds | Phase 2 (CSV import first, live feed later) | A live feed needs a bank partnership/API (cost + approval); CSV import covers most of it |
| Vendor/client portal | Phase 2 (share-link) | Send the party their statement/payment link, no login needed |
| Budgets | Phase 2 | Monthly spend target vs actual — after the core reports |
| Recurring invoices/bills, price lists, retainer/progress invoicing | Phase 2 | Auto monthly bills, per-party price lists, advance/retainer — after core billing |
| Multi-currency | Phase 2 | INR first; foreign-currency parties get a rate the user enters |
| Custom-report builder | Phase 2 | The summaries are free in Phase 1.2; the builder (make your own report) is Phase 2 |
| Barcode scan | Phase 2 (app) | Barcode generation is in the Phase 1.2 spec; scanning uses CameraX in the Phase 2 app |
| Transaction locking / audit trail | Phase 2 | Audit trail (who changed what, when) + period-close lock — after the core ledger |
| Premium invoice themes | Phase 2 | All reports are free in Phase 1.2; invoice themes come in our own design, with no lock |
| Serial number tracking | Phase 2 | Batch/expiry is done in Phase 1.2; serials come with items in Phase 2 |
| Smart insights / forecasting | Phase 3 (on-device first) | Real forecasting needs either a lot of data or cloud cost; first a simple on-device insight (this month's sales vs last month, which item is selling), the rest later |
| Exam Prep and Photo Editor modules | Phase 3a / 3b | After the business core, as separate modules |
| Direct GST portal filing, realtime cloud sync | Never (by design) | The user uploads to the portal themselves; realtime sync would need a central server that can't run at ₹0 |
| "CA-ready" claim | Only after Phase 1.3 | Only after a real CA import test passes — the Tally CSV stays BETA until then |

**Out of scope (not deferred, never):** no paywall / "Pro" tier; no
ads; user data never goes to a central server.

## Improvement round (2026-11-22 — premium look, bill types, calculator, guide, Drive backup)

- **Premium look, no green:** deep navy (`#16233D` / `#1B2A4A`) + gold (`#C9A227` / `#D4AF37`) everywhere, Site + App. The old teal/green brand is gone, including the app launcher icon (new vector: gold bridge arc + ledger line on navy). The Site keeps its layout — a full Site redesign waits for the user's own plan.
- **Credit:** "Made by Sk Akram" in the Site footer + About and the App About screen.
- **i18n rule:** every language reads professional and simple, in that language; technical words (GST, Bill, Invoice, UPI, HSN) stay in English. App strings come from `site/i18n.js` through `tools/gen-android-strings.py` (186 keys × 10 languages, regen is byte-identical).
- **Bill types:** GST bill, non-GST bill, estimate/quotation, credit note, debit note, receipt — Site + App. Number series: `INV/...`, `EST/...`, `RCT/...`. Non-GST + receipt force tax to 0. **Sign rule (fixed this round): only a credit note negates; a debit note stays positive** — the App used to negate both, the Site only ever negated credit notes, so the App now matches the Site (and the GSTR-1 CDNR rule).
- **Exports:** Site invoice detail has Download DOC (Word-compatible HTML) + Download JSON next to print/PDF and WhatsApp share.
- **Calculator tab/screen:** GST calculator, Site + App — amount + rate (0/5/12/18/28) → GST + total, exclusive (add GST) and inclusive (split GST out) modes, integer-paise math.
- **GST Guide tab/screen:** 6 sections (what GST is, slabs, GSTR-1/3B, e-invoice/e-way, GSTR-9, common mistakes). Only verified facts; due dates and turnover limits say "check the GST portal" instead of stating numbers that change.
- **Drive backup (setup pending):** Google sign-in (optional — everything works without it) + AES-GCM encrypted backup into the user's own Drive appDataFolder, Site (GIS + Drive API, `site/drive-config.js`) + App (Google Sign-In + Drive API, `res/values/drive_config.xml`). Both configs are **empty placeholders** — no secret in the repo. Fill in a Google Cloud OAuth client id to enable it; until then the backup UI shows "Setup pending". Firebase sync is a later step, not this round.
- **Device verdict fix (first APK, user tested on phone):** the "First bill — 3 steps" card did nothing on tap. Site: the whole guide card is now tappable (tap/keyboard → New Bill). App: the card is a tappable `Card` with a "Start first bill" button (→ Setup if the shop name is blank, else New Bill). Dead-button audit, Site + App: stock rows, party due rows, empty-guide buttons with empty actions, Reports "Share summary" placeholder text, widget deep-link — all fixed/wired.
- **Tests after this round:** Site 734, GST Kotlin 111, App logic 74 — all green, smoke PASS. App Compose compile is decided by CI (local Gradle is blocked).

## Risks and lessons

- **Classic-script global collision (found and fixed in Phase 1.2):**
  every Site module used top-level `const api` (plus `let gst`,
  `roundDiv`, `newId`, `paiseToRupees` …). Classic scripts share one
  global scope, so the second script would throw `Identifier 'api'
  has already been declared` and the Site would never load in a
  browser. Phase 1.1 was never opened in a browser, so nobody
  noticed. Fixed with file-specific top-level names + a Node vm smoke
  test that loads all scripts in order.
- **Sign rules have to be canonical:** `party.js` is the ledger truth
  (positive = receivable). `reports.js` first counted credit purchases
  as cash-out and credit sales as cash-in — fixed in the Phase 1.2
  review: cash flow counts only real cash (`payment` entries + cash
  invoices); the purchase summary returns the purchase value as a
  positive cost.
- **Local Gradle doesn't run on the dev machine** — verified again
  with the local Gradle 8.7 binary (`--no-daemon` still fails: "Could
  not receive a message from the daemon"). GitHub Actions is the only
  build route. The workflow file itself can't be pushed through the
  API (no workflow scope) — it has to be added through the GitHub
  website the first time.
- **CI build #1 failed on the app theme (fixed 2026-11-22):**
  `:app:processDebugResources` failed — `Theme.Material3.DayNight.NoActionBar`
  and the `colorPrimary` attrs were not found. The theme in `themes.xml`
  comes from the Material Components library, but the project only had
  Compose material3, which is Kotlin-only and ships no XML resources.
  Fixed by adding `com.google.android.material:material:1.12.0` to the
  version catalog + app dependencies; nothing else changed.
- **CI build #5 failed on missing dependencies (fixed 2026-11-22):**
  `:app:compileDebugKotlin` failed — every `androidx.navigation.*`
  import was unresolved because `navigation-compose` was never declared
  (the NavHost + 12 screens used it, but the catalog had no entry).
  Two more errors came out of the same audit: `Repository.kt` used the
  `BillLine.toInput` extension without importing it, and `BigButton`
  had `onClick` before the defaulted `enabled` param, so the trailing
  lambda at every call site had nowhere to bind. The audit also caught
  a manifest bug — the launcher activity was declared as
  `.MainActivity` while the class lives in `.ui.MainActivity`, so the
  app would have crashed on launch even after a green build. Fixed by
  adding `navigation-compose:2.8.5`, `activity-ktx:1.9.0` (for
  `by viewModels()`) and `lifecycle-viewmodel-ktx:2.8.5` (for
  `AndroidViewModel` / `viewModelScope`), the missing import, the
  `BigButton` parameter order, and the manifest activity name.
- **Gradle wrapper jar:** `gradle-wrapper.jar` is a binary, so it
  can't be pushed through the GitHub API either — that's why CI runs
  the `gradle` command (8.7, installed by setup-gradle) instead of
  `./gradlew`. If the jar is ever uploaded through the website,
  `./gradlew` can come back.
- GST rules change, and a wrong calculation means a penalty for the
  user — CA review + test JSON before any "CA-ready" claim; never
  guess rates.

## Open questions

- Trademark check for "UdyamSetu" — still pending; do it before any
  Play Store listing.
- Real CA validation of the invoice format / GSTR JSON — Phase 1.3,
  needs a CA.
- Logo upload in Setup: file input now, cropping later.
- Phase 1.2 form field labels are Hindi-only static text — move them
  to i18n keys in the next i18n step (the chrome already switches
  fully).
