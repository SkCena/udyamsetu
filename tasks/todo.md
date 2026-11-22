# UdyamSetu tasks — Phase 1.1

- [x] Task 1: Private repo SkCena/udyamsetu created
  - Acceptance: repo exists, private=true
  - Verify: repo_manager.py check → Created: SkCena/udyamsetu (private=True)
- [x] Task 2: SPEC.md + CAPABILITY-MAP.md + README + LICENSE
  - Acceptance: spec covers objective, stack, commands, structure, style, tests, boundaries, success criteria, out-of-scope, open questions
- [x] Task 3: Shared GST core JS + Kotlin + vectors
  - Acceptance: both implementations pass all shared vectors
  - Verify: node core/gst.test.js → 114 passed, 0 failed; kotlinc+java GstTest → 111 passed, 0 failed
- [x] Task 4: Site Setup + Billing (PWA)
  - Acceptance: setup persists, billing totals from core, print + WhatsApp, credit/debit notes
  - Verify: node site/app.test.js → 78 passed, 0 failed; node --check clean on all JS files
- [ ] Task 5: Android app + CI workflow — STOPPED, see tasks/plan.md Risks
- [ ] Task 6: Push Phase 1.1 to main + verify head commit
