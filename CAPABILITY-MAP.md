# Capability Map: UdyamSetu

| Module id | Responsibility | Depends on |
|---|---|---|
| business-profile | Business setup: name, GSTIN, logo, UPI, invoice series | — |
| billing | Invoices, credit/debit notes, GST math, PDF, share | business-profile |
| party-ledger | Customers/suppliers, udhaar, reminders | billing |
| inventory | Items, stock, godown, batch/expiry, barcode | billing |
| gst-reports | GSTR-1/3B JSON, 2A/2B reconciliation, e-invoice/e-way JSON | billing, inventory |
| payroll-lite | Employees, salary, PF/ESI/PT/TDS basics, payslip | business-profile |
| reports-export | Sales/purchase/P&L/Balance Sheet, CA-ready export | billing, inventory, gst-reports |
| sync-backup | Encrypted backup file, Drive app-folder backup | all above |
| exam-prep | Mock tests, PYQ, plan (Phase 3a) | — |
| photo-editor | Pro photo edit, layers, print-ready (Phase 3b) | — |

Build order: business-profile → billing → party-ledger, inventory →
gst-reports → payroll-lite → reports-export → sync-backup → exam-prep →
photo-editor

Shared core (`core/`): GST math + data model, implemented in JS (Site) and
Kotlin (App) from the same test vectors. Both surfaces share field names.
