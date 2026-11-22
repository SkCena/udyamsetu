# Device Test — UdyamSetu Site 1.1 (Setup + Billing)

**Status: HEADLESS-ONLY so far. This card is NOT passed until the user runs it
on the phone and reports.** Node tests are green (see bottom), but no step
below has been verified on a real device.

## How to open the site on the phone

Option A (simplest): the parent agent sends the site link / files.
Option B (local): on a computer on the same Wi-Fi, run from the repo root:

```
python3 -m http.server 8123
```

Then open `http://<computer-ip>:8123/site/index.html` in Chrome on the phone.
`file://` open also works for viewing, but the service worker (offline mode)
only registers over http(s), so use Option B for the offline test (step 8).

## Test 1 — Setup saves and survives reload
1. Open the site. Tap **Setup**.
2. Fill: Name `Sharma Kirana Store`, GSTIN `22AAAAA0000A1ZC`, Phone `9876543210`,
   Address `Main Road, Bhubaneswar`, UPI `sharma@upi`, Prefix `INV`, Next `1`,
   State `Odisha (21)`.
3. Tap **Setup Save Karein**.
4. Expected: `Setup save ho gaya ✓`.
5. Close the tab completely, reopen the site.
6. Expected: Setup still shows all values above. (If empty, storage failed — report it.)

## Test 2 — Bad GSTIN shows an error
1. Setup → GSTIN field: type `27AAAPL1234C1ZF` (wrong check digit).
2. Expected: red error `GSTIN galat hai…` appears; saving is blocked.
3. Fix it back to `22AAAAA0000A1ZC`, save again. Expected: saves fine.

## Test 3 — Intra-state invoice (Odisha → Odisha)
1. Tap **Naya Bill**. Party `Ramesh Kumar`, buyer state `Odisha (21)`.
2. Item: name `Rice`, HSN `1001`, Qty `2`, Price `100`, Disc `0`, GST `18%`.
3. Expected live totals: Taxable `₹200.00`, CGST `₹18.00`, SGST `₹18.00`,
   Grand Total `₹236.00`. Tax label must read `CGST + SGST`.
4. Tap **Bill Save Karein**.
5. Expected: bill number `INV/2026-27/0001` shown; bill appears in **Bill List**.

## Test 4 — Inter-state invoice (Odisha → Maharashtra)
1. **Naya Bill**. Party `Mumbai Buyer`, buyer state `Maharashtra (27)`.
2. Same item: `Rice`, `1001`, Qty `2`, Price `100`, Disc `0`, GST `18%`.
3. Expected: Tax label `IGST`, IGST `₹36.00`, CGST/SGST `₹0.00`,
   Grand Total `₹236.00`.
4. Save. Expected: number `INV/2026-27/0002`.

## Test 5 — Round-off (hand-check)
1. **Naya Bill**. Party `Round Test`, buyer state `Odisha (21)`.
2. Item: name `Sugar`, HSN `1701`, Qty `3`, Price `99.99`, Disc `0`, GST `5%`.
3. Expected: Taxable `₹299.97`, CGST `₹7.50`, SGST `₹7.50`,
   Total `₹314.97`, Round off `+₹0.03`, Grand Total `₹315.00`.
4. Save. Expected: number `INV/2026-27/0003`.

## Test 6 — Draft does NOT consume a number
1. **Naya Bill**. Party `Draft Party`, buyer state `Odisha (21)`.
   Item `Rice`, `1001`, Qty `1`, Price `100`, GST `18%`.
2. Tap **Draft Save** (NOT Bill Save).
3. Expected: `Draft save ho gaya ✓ (number abhi nahi laga)`; list shows a `DRAFT` row.
4. Make another real bill (Test 3 item again) and save it.
5. Expected: its number is `INV/2026-27/0004` — NOT `0005`. (Draft took no number.)

## Test 7 — Credit note + debit note
1. Bill List → open `INV/2026-27/0001` (Ramesh, ₹236.00).
2. Tap **Credit Note banayein**. The form opens prefilled, banner shows the
   original number. Save the bill.
3. Expected: new entry with `Credit Note` badge, total `−₹236.00`,
   linked to `INV/2026-27/0001`.
4. Open `INV/2026-27/0001` again → **Debit Note banayein** → save.
5. Expected: new entry with `Debit Note` badge, total `+₹236.00`, same link.

## Test 8 — Print (A4 + 80mm) and WhatsApp
1. Open any saved bill → **Print — A4** → print preview must show a clean
   A4 invoice (shop name, GSTIN, items table, totals, UPI). Print to PDF.
2. Back → **Print — 80mm** → preview must be narrow (thermal width),
   no cut-off text.
3. Tap **WhatsApp par bhejein** → WhatsApp opens with text containing the
   bill number, date, party name and total.
4. Expected: all three work. (On the phone, "Print" uses the system print /
   Save-as-PDF sheet — that is the Phase 1.1 PDF route.)

## Test 9 — Offline (needs http open, not file://)
1. Load the site once over http (Option B above), wait 5 seconds.
2. Turn on **Airplane mode**.
3. Close the tab, reopen the same URL.
4. Expected: site opens, Setup data and Bill List are still there, and a new
   bill can be made and saved while offline.

## Test 10 — Language toggle
1. Tap **English** (top right). Expected: tabs/buttons/labels turn English.
2. Tap **हिंदी**. Expected: back to Hindi. (Item-row labels stay bilingual.)

## Report back (one line each is enough)
- Which test number failed, if any, and what the phone showed instead.
- Phone + browser (e.g. POCO M4 Pro, Chrome).
- Screenshot of any wrong total or broken layout.

## Headless results (already green, NOT a device pass)
- `node core/gst.test.js` — 114 passed, 0 failed.
- `node site/app.test.js` — 78 passed, 0 failed (store round-trip, numbering,
  credit/debit notes, validation, WhatsApp text, shared GST vectors I01/I02/I03).
- `node --check` clean on all site JS. All 40 element ids used by `app.js`
  exist in `index.html`; all 42 i18n keys exist in both Hindi and English.
- Served over local http: all 9 site/core files return HTTP 200.
