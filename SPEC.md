# Spec: UdyamSetu — V1 (Phase 1.1: Setup + Billing; Phase 1.2: Party, Stock, GST, Payroll, Reports)

## Objective
UdyamSetu is a free, mobile-first business / GST / accounting product for small
Indian shops. One product, two surfaces: a static local-first Site (PWA) and an
Android app. No server, no account, no paywall. Data lives on the user's device.

V1 Phase 1.1 covers: business **Setup** and **Billing** (invoice create,
GST math, PDF, share). Phase 1.2 adds: **Party/Udhaar ledger, Inventory,
GST reports + e-invoice/e-way JSON, Payroll-lite, Reports + export**.
Everything else from the plan is Deferred, not dropped — see
"Deferred with reason" below.

**Goal LOCK (2026-11-22, user): EACH AND EVERY paid feature free.**
Har paid cheez free mile, taaki user ko realise ho ki jis cheez ka wo paid
de raha tha, wo yahan free hai. Iska poora 37-row checklist APK REA report
`~/workspace/research_notes/vyapar-zoho-apk-rea-20261122/report.md` §5 me hai;
har row ka UdyamSetu jawab §8 me hai. Koi feature bina reason ke "baad me"
nahi chhoda gaya — har deferred feature ke saamne kyun likha hai.

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

## Site-complete + GitHub-everywhere LOCK (2026-11-22, user)
- **Site me SAB hoga** — koi feature sirf APK me nahi hoga. Jo kaam browser
  me ho sakta hai, wo Site par hoga.
- Kuch options sirf APK me ho sakte hain, kyunki browser me nahi ho sakte
  (barcode scan, home widget, background sync / Drive auto-backup). Wo
  options Site par saaf **"APK chahiye"** badge ke saath marked hain, aur
  unke saath APK download link hai (`https://github.com/SkCena/udyamsetu/releases`
  — pehla APK release aane par wahan milega; koi fake direct `.apk` URL nahi hai).
- **GitHub link har jagah hai** — Site ke header, footer, Home card, About
  section (aur App me About me bhi hoga jab App banega). Repo URL:
  `https://github.com/SkCena/udyamsetu`. Repo abhi **PRIVATE** hai, isliye ye
  link tabhi khulega jab user repo ko public karega — link phir bhi daala
  hai, aur About me ye baat likhi hai.

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
              node site/views.test.js           (48 — mobile/desktop views, Home, FTU,
                                                 language prompt, APK markers, GitHub links)
              Total: 598 tests, all green (2026-11-22)
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

## Success Criteria (Site polish — Desktop view + REA structure, 2026-11-22, headless-verified)
- [x] Desktop view: sidebar nav (240px) + 1180px content at >= 1024px;
      mobile base CSS untouched (views.test.js proves it).
- [x] Home view: 4 Quick buttons (Bill/Udhaar/Stock/Payment), today stats
      (sale/udhaar/low-stock), FTU 3 questions, first-bill 3-step guide.
- [x] Language-first prompt: first visit par language poochna, choice save
      hote hi dobara nahi poochna (i18n.hasChosenLang/markLangChosen).
- [x] Site-complete: sab features Site par; browser-impossible options
      (barcode scan, home widget, background sync) "APK chahiye" badge +
      APK download link (GitHub Releases, no fake .apk URL).
- [x] GitHub link har jagah: header, footer, Home card, About
      (`https://github.com/SkCena/udyamsetu` — private hai, public hone ke
      baad hi khulega; About me ye likha hai).
- [x] All 598 node tests green; browser load smoke green; 16/16 files HTTP 200.
- [ ] Visual device check pending: 360px phone + 1280px desktop par khol
      ke dekhna (user runs it on the phone/browser).

## Phase 1.3 — CA pilot (APK REA §8)

Goal: jo "DRAFT / BETA" hai, use real CA se validate karke hi "ready" bolna.
- [ ] GSTR-1/3B JSON + e-invoice/e-way JSON: ek real CA ke paas format check
      karwana — portal ke format se match kare, tabhi "filing-ready" bolenge.
      Usse pehle GSTR/e-invoice outputs **DRAFT** hi rahenge.
- [ ] Tally-compatible CSV: ek real CA ke paas import test pass hona chahiye
      — tabhi "CA-ready" bolenge. Usse pehle Tally CSV **BETA** hi rahega.
- [ ] CA pilot ka result (pass/fail + kya badla) SPEC me likhna.

## Phase 2 — Android app + sync + deferred paid features (APK REA §8)

Goal: wahi core, Site + Android app dono pe, ek hi data — aur §8 ke
Phase-2 features sab free.
- App: Kotlin + Jetpack Compose, Room/SQLite, offline-first, package
  `in.udyamsetu.app`, minSdk 29. Build GitHub Actions se hi (local Gradle
  blocked hai). CI green hone par hi APK ki baat hogi.
- Sync: **2a** encrypted backup file (export/import — site ↔ app, WhatsApp /
  Drive / pen-drive se); **2b** user ke apne Google Drive app-folder me
  auto-backup. Central server nahi hoga.
- Features (sab free): GSTR-9 annual; e-invoice/e-way via GSP (user ke
  credentials se); multi-user/roles + multi-firm; POS billing; manufacturing
  / BOM; loyalty points; online store catalogue → store; bulk WhatsApp /
  marketing / greetings; fixed assets; Recycle Bin; payment gateway; TCS/TDS;
  projects + timesheets; bank feeds (CSV import pehle, live feed baad me);
  vendor/client portal share-link; budgets; recurring invoices/bills, price
  lists, retainer/progress invoicing; multi-currency; custom-report builder;
  barcode scan (CameraX); transaction locking + audit trail; invoice themes;
  serial tracking.
- Acceptance: 3-tap bill test (neeche Easy-UI plan) device pe pass ho.

## Phase 3 — AI insights, on-device pehle (APK REA §8)

- Pehle simple on-device insight, bina cloud AI ke, phone pe calc: is
  mahine ki sale pichhle mahine se kitni, kaunsa item chal raha hai, kaunsa
  party udhaar me late hai.
- Asli AI/forecasting (anomaly detection, forecasting) uske baad — uske liye
  ya to bada data chahiye ya cloud cost, isliye Phase 3 me hi, jaldi me nahi.
- Phase 3a Exam Prep + 3b Photo Editor isi phase ke alag modules hain
  (plan-and-name.md §6 dekho).

## Easy-UI plan (APK REA §6 + §8.1 — dono apps se seekh, apne tareeke se)

Competitor ka code/text/asset/design copy nahi hoga — sirf flow samajh ke
apne tareeke se banayenge.

| Seekh | UdyamSetu me apne tareeke se | Phase |
|---|---|---|
| Language pehle screen pe (Vyapar) | Pehle screen pe language poochna (English default, Hindi + 10 languages tab) — settings me chhupana nahi | **Site DONE** (first-visit prompt, `site/app.js` + `i18n.hasChosenLang`); App me bhi hoga Phase 2 |
| FTU = 3 chhote sawaal | Setup me 3 sawaal (duk kaan type, GST hai ya nahi, kya bechte ho) — uske hisaab se dashboard | **Site DONE** (Home card, `localStorage udyamsetu.ftu`); App me bhi hoga Phase 2 |
| Guided pehla bill + preview | Pehli baar bill banate waqt step guide + save se pehle preview (galti pakadne ka step) | **Site DONE (guide)** — Home pe 3-step guide card (pehle bill tak) + bill detail view = preview; **pre-save preview Phase 2 (App)** |
| Quick Create (Zoho) | Home pe 4 bade button — Bill, Udhaar, Stock, Payment — ek tap me | **Site DONE** (Home quick-grid); App me bhi hoga Phase 2 |
| Home widget (Zoho) | Android home widget — phone ke home se seedha bill, app khole bina | Phase 2 (App) |
| Party se seedha bill (Zoho) | Party kholo → usi se bill / payment / udhaar (context se kaam, wapas jaake dhoondhna nahi) | 1.2 DONE (party se statement/payment); bill Phase 2 (App) |
| Welcome screens me fayda, feature nahi (Zoho) | Onboarding me fayda likhna ("udhaar yaad rahega", "GST report ban jayega") — feature list nahi | Phase 2 (App) |
| HSN offline (Vyapar) | HSN master app ke andar (offline lookup, type karte hi suggestion, internet nahi chahiye) | Phase 2 (App; Site me list) |
| Shimmer + empty-state guide | Khaali screen pe guide ("+ dabake pehla bill banao"), blank screen nahi | 1.2 Site partial → Phase 2 (App) |
| 3-tap bill target — acceptance test | Home → Party → Items → Preview/Share: bill 3 tap me shuru, 5 tap me share. Ye Phase 2 ka acceptance test hai | Phase 2 (App) |

## Web views — Mobile + Desktop (Site, 2026-11-22)

User lock: REA me jo sab nikla, wo achhe sahi structure se hamare me hoga,
easy way. Web ke liye **alag mobile aur desktop view** honge — dono pe sab
sahi; App ka bhi sab sahi hoga. Site ek hi HTML file hai (`site/index.html`);
view sirf CSS se badalta hai — mobile ka base CSS kabhi nahi tootta.

### Mobile view (default, < 1024px — phone pehle)
- Ek column: header upar, tabs neeche (wrap hote hain, 2–3 row me), phir
  content card. Sab kuch ek haath se chale — bade button, bade input.
- Quick actions: Home pe 4 bade button 2×2 grid me.
- Forms: ek column; `.field-row` wale field 2 side-by-side (chhote).
- Bill lines: 2-column grid (HSN/Qty, Price/Disc, GST).
- Lists: ek column, ek ke neeche ek.
- Language prompt: full-screen overlay, 2-column language grid.
- Base CSS (`styles.css`, `@media` se pehle) mobile ka hai — desktop rules
  isme nahi hain. Mobile check: `node site/views.test.js` (base rules).

### Desktop view (>= 1024px, `styles.css` me `@media (min-width: 1024px)`)
- **Sidebar navigation:** tabs left side vertical column (240px, sticky),
  content right side. Active tab teal background.
- **Chauda content:** shell max-width 1180px; view padding 24px 28px.
- **Multi-column jahan sahi ho:** Quick buttons 4 ek row me; invoice list
  2 column; bill-line editor 5 column (Item bada, baaki chhote); Setup /
  Party / Stock forms 2 column (field-row, msg, button full-width span);
  totals right side (max-width 440px); FTU form 2 column; language prompt
  card 520px, language grid 5 column.
- Header/footer bhi 1180px tak chauda hota hai.
- Print CSS (A4 / 80mm thermal) desktop/mobile dono se alag hai — usme
  koi badlav nahi.

### Acceptance
- Mobile (360px): saare 10 tabs dikhte hain, Home pe 4 Quick button 2×2,
  form submit bina scroll kiye mushkil nahi, koi horizontal scroll nahi.
- Desktop (1280px): sidebar left me, content right me; saare form/list
  bina overlap ke dikhte hain; Quick button 4 ek row me.
- Dono views me: Home stats, FTU, first-bill guide, APK card, GitHub links
  (header/footer/Home/About) aur language prompt sahi kaam karte hain.
- Check: `node site/views.test.js` — 48 static checks (mobile base +
  desktop rules + Home/FTU/prompt/APK/GitHub). Ye **static check** hai,
  render test nahi.
- Visual check (browser/device) abhi baki hai: 360px phone + 1280px
  desktop par khol ke dekhna — user ke device test card me likha hai.

## Deferred with reason (APK REA §8, 2026-11-22 — dropped nahi, baad me)

Har row: feature jo competitor apps me paid hai, UdyamSetu me free milega,
par phase baad me hai — saamne kyun likha hai.

| Feature (paid elsewhere) | Phase | Kyun baad me |
|---|---|---|
| GSTR-9 annual return | Phase 2 | Saal-bhar ka data + HSN summary + portal format pehle Phase 1.3 me validate hona chahiye; GSTR-9 galat gaya to penalty ka risk hai, isliye jaldi me nahi |
| e-invoice IRN + e-way bill via GSP | Phase 2 (GSP) | GSP integration ke liye user ke credentials + GSP ka kharcha/process CA se confirm karna baki hai; JSON DRAFT Phase 1.2 me done hai |
| Multi-device sync + cloud backup | Phase 2a backup file → 2b Drive | Bina server ke realtime sync free me nahi hota; central server ₹0 me nahi chalega aur privacy risk hai. Pehle encrypted backup file (export/import), phir user ke apne Google Drive app-folder me backup |
| Multi-user / roles / multi-firm | Phase 2 | Pehle single-user core ko device pe sahi karna hai; roles ke saath data-sharing + permission ka design Phase 2 ka kaam hai |
| POS billing | Phase 2 | POS ka matlab tez counter billing + printer/scanner hardware; pehle normal billing ko device pe sahi karna hai, phir POS mode |
| Manufacturing / BOM / job-work | Phase 2 | Chhoti dukaan ko pehle billing/stock chahiye; BOM sirf manufacturing wali dukaanon ka kaam hai, core ke baad |
| Loyalty points | Phase 2 | Loyalty tabhi kaam karta hai jab party ledger + billing pakka ho; pehle wo done hai, ab loyalty Phase 2 me |
| Online store (catalogue pehle) | Phase 2 | Online store ke liye payment + delivery + order ka flow chahiye; pehle catalogue/share (WhatsApp catalogue jaisa link), phir store |
| Bulk WhatsApp + marketing tools + greetings | Phase 2 | Bulk WhatsApp ke liye WhatsApp Business API chahiye (cost + approval + spam risk); single-share abhi free hai, bulk baad me |
| Fixed assets | Phase 2 | Asset register (kharid, basic depreciation, list) — core ke baad |
| Recycle Bin (soft-delete, 30 din restore) | Phase 2 | Delete hua data wapas lane ka flow core ke baad |
| Payment gateway (online payment collect + KYC) | Phase 2 | Gateway ke liye KYC + charges + user ke bank account ka flow hai; UPI QR pehle se free hai, gateway baad me |
| TCS/TDS on invoices | Phase 2 (Payroll-lite ke saath) | Rates user/CA se confirm karke, invoice + payroll ke saath |
| Projects + timesheets | Phase 2 | Core dukaan (billing/stock) pehle; project service-business ka alag flow hai |
| Bank feeds | Phase 2 (CSV import pehle, live feed baad me) | Live feed ke liye bank partnership/API chahiye (cost + approval); CSV import se 80% kaam ho jata hai |
| Vendor/client portal | Phase 2 (share-link) | Party ko uska statement/payment link bhej do, bina login ke |
| Budgets | Phase 2 | Mahine ka kharcha target vs actual — core reports ke baad |
| Recurring invoices/bills, price lists, retainer/progress invoicing | Phase 2 | Mahine ka bill auto-banao, price list per party, advance/retainer — core billing ke baad |
| Multi-currency | Phase 2 | INR pehle; foreign currency party ke saath rate user daalega |
| Custom-report builder | Phase 2 | Summaries Phase 1.2 me free hain; builder (khud report banao) Phase 2 me |
| Barcode scan | Phase 2 (App) | Barcode generate Phase 1.2 (spec) me hai; scan CameraX se Phase 2 App me |
| Transaction locking / audit trail | Phase 2 | Audit trail (kisne kab kya badla) + period-close lock — core ledger ke baad |
| Premium invoice themes | Phase 2 | Saare reports Phase 1.2 me free hain; invoice themes apne design se, bina lock ke |
| Serial number tracking | Phase 2 | Batch/expiry Phase 1.2 me done hai; serial item ke saath Phase 2 me |
| AI insights / forecasting | Phase 3 (on-device pehle) | Asli AI/forecasting ke liye ya to bada data chahiye ya cloud cost; pehle simple on-device insight (is mahine ki sale pichhle se kitni, kaunsa item chal raha hai), AI baad me |
| Exam Prep and Photo Editor modules | Phase 3a / 3b | Business core ke baad, alag modules |
| Direct GST portal filing, realtime cloud sync | Never (by design) | Portal pe user khud upload karega; realtime sync ke liye central server ₹0 me nahi chalega |
| Public repo / GitHub Pages publish | User decision, later | Repo PRIVATE hai jab tak user publish na kahe |
| "CA-ready" claim | Phase 1.3 ke baad hi | Only after a real CA import test passes — Tally CSV tab tak BETA hi rahega |

**Out of Scope (not deferred, kabhi nahi):** koi paywall / "Pro" tier nahi
hoga; koi ads nahi; user ka data kabhi central server pe nahi jayega.

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
- **Repo — correction (2026-11-22):** `SkCena/udyamsetu` PRIVATE repo pehle
  se bana hua hai; Phase 1.1 + 1.2 push ho chuke hain (head `177bbf0`).
  Pehle ke 404 checks galat account (anon257261-lang) se the — SkCena
  account (`93df4b10c85c4f048d61551aa0dac70f`) se repo dikhta hai. GitHub
  commands me hamesha `--account` ke saath SkCena account use karo.
  Repo create via API fail hota hai (403, App se create nahi hota) — create
  ki zaroorat nahi hai, repo bana hua hai.
- GST rules change / wrong calc = user penalty — CA review + test JSON
  before any "CA-ready" claim; never guess rates.
- Trademark for "UdyamSetu" — check before any public publish.

## Open Questions
- Trademark check for "UdyamSetu" — not done; before any public publish.
- Real CA validation of invoice format / GSTR JSON — Phase 1.3, needs a CA.
- Logo upload in Setup: file input now, cropping later.
- Phase 1.2 form field labels are Hindi-only static text — translate to
  i18n keys in the next i18n step (chrome already switches fully).
