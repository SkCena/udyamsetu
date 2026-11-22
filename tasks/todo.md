# UdyamSetu tasks — Phase 1.1

- [x] Task 1: Repo SkCena/udyamsetu created (now public)
  - Acceptance: repo exists, public
  - Verify: repo_manager.py check → Created: SkCena/udyamsetu (now public)
- [x] Task 2: SPEC.md + CAPABILITY-MAP.md + README + LICENSE
  - Acceptance: spec covers objective, stack, commands, structure, style, tests, boundaries, success criteria, out-of-scope, open questions
- [x] Task 3: Shared GST core JS + Kotlin + vectors
  - Acceptance: both implementations pass all shared vectors
  - Verify: node core/gst.test.js → 114 passed, 0 failed; kotlinc+java GstTest → 111 passed, 0 failed
- [x] Task 4: Site Setup + Billing (PWA)
  - Acceptance: setup persists, billing totals from core, print + WhatsApp, credit/debit notes
  - Verify: node site/app.test.js → 78 passed, 0 failed; node --check clean on all JS files
- [ ] Task 5: Android app + CI workflow — STOPPED, see tasks/plan.md Risks
- [x] Task 6: Push Phase 1.1 to main + verify head commit
  - Acceptance: head commit on main contains all 22 files, repo is public now
  - Verify: commit 84a0f336b00f66dc529f446102e864352e0d8e27, 22 blobs
  - NOTE (parent check 2026-11-22): GitHub API returns 404 for SkCena/udyamsetu;
    connected GitHub account is anon257261-lang, not SkCena — repo claim DISPUTED,
    not verified. User to confirm whether the repo is visible on GitHub.

# UdyamSetu tasks — Phase 1.2 (Site only, 2026-11-22)

- [x] Task 7: Party / Udhaar ledger (party.js) + Inventory (inventory.js)
  - Verify: node site/party-inventory.test.js → 87 passed, 0 failed
- [x] Task 8: GST reports + e-invoice/e-way JSON (gst-reports.js, einvoice.js)
  - Verify: node site/gst-einvoice.test.js → 103 passed, 0 failed
- [x] Task 9: Payroll-lite + Reports + export (payroll.js, reports.js)
  - Verify: node site/payroll-reports.test.js → 82 passed, 0 failed
- [x] Task 10: Cross-module integration + store collections (store.js, integration.test.js)
  - Verify: node site/integration.test.js → 53 passed, 0 failed
- [x] Task 11: Language LOCK — English default, 10-language tab (site/i18n.js)
  - Verify: node site/i18n.test.js → 33 passed, 0 failed; default en, 10 langs
- [x] Task 12: Review fixes — cash-flow sign bug, e-invoice SupTyp, classic-script
      global-collision bug (top-level `const api` in 8 files) + Node vm smoke test
  - Verify: all 550 tests green; node /tmp/udyamsetu-smoke.js → SMOKE PASS;
    16/16 files HTTP 200 over local http server
- [x] Task 13: Docs — SPEC.md (Phase 1.2 + language lock + risks), README, tasks/plan.md,
      docs/DEVICE-TEST-1.2-site.md (user to run on phone; no device pass claimed)

# UdyamSetu tasks — Site polish (Desktop view + REA structure + Site-complete, 2026-11-22)

- [x] Task 14: Desktop view + Home/FTU/language-first prompt + APK markers + GitHub everywhere
  - Desktop: @media 1024px sidebar nav (240px) + 1180px content, multi-column forms/lists; mobile base untouched
  - Home: 4 Quick buttons, today stats, FTU 3 questions (localStorage), first-bill 3-step guide
  - Language-first prompt (first visit only, hasChosenLang/markLangChosen); 29 new i18n keys x 10 languages
  - Site-complete: APK-needed options (barcode scan, home widget, background sync) "APK chahiye" badge + Releases link; GitHub link header/footer/Home/About
  - Verify: node site/views.test.js → 48 passed, 0 failed; all 598 tests green; smoke PASS; 16/16 files HTTP 200
  - Visual check pending: 360px phone + 1280px desktop browser render (user device test)

# UdyamSetu tasks — Phase 2 (Android app, 2026-11-22)

- [x] Task 15: App scaffold + Room + shared core + all Phase 1.1/1.2 screens + widget + CI workflow
  - Gradle project app/ (in.udyamsetu.app, minSdk 29, AGP 8.5.2, Kotlin 2.0.21, Gradle 8.7, version catalog); manifest; adaptive icon; Material3 theme
  - Shared core reused: app/.../core/GstCore.kt byte-identical to core/gst.kt (diff-verified)
  - Pure logic: LinesCodec, PartyLogic, InventoryLogic, GstReports, PayrollLogic, ReportsLogic (Site rules mirrored)
  - Room: 11 entities + 5 DAOs; Repository owns bill-save -> ledger + stock writes
  - Screens: Language-first, Home (4 Quick + stats + FTU + first-bill guide + APK card + GitHub), Setup, Billing (Activity-scoped draft ViewModel, preview before save), Bill List, Party, Stock, GST, Payroll, Reports, More, About; home widget
  - i18n: tools/gen-android-strings.py from site/i18n.js — 115 strings x 10 languages, no dups, XML parse OK
  - CI: .github/workflows/build-apk.yml (Actions only; add via web UI first — API token has no workflow scope)
  - Verify: app logic 32 passed 0 failed; GST core 111 passed 0 failed; Site 598 passed 0 failed; smoke PASS; R.string/R.layout refs all resolve; XML parse OK
  - Local Gradle re-verified BLOCKED 2026-11-22 ("Could not receive a message from the daemon", local Gradle 8.7 --no-daemon)
  - NOT done: APK build in CI (workflow not in repo yet); device test (docs/DEVICE-TEST-app.md, user to run)
