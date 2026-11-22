// UdyamSetu — host-runnable logic tests (plain main, no JUnit needed).
// Run: kotlinc core/GstCore.kt logic/*.kt LogicTestMain.kt -include-runtime
//      -d /tmp/udyamsetu-logic-test.jar && java -jar /tmp/udyamsetu-logic-test.jar
// Mirrors the Site logic (party.js / inventory.js / gst-reports.js /
// payroll.js / reports.js) — same rules, Kotlin side.
package `in`.udyamsetu.app

import `in`.udyamsetu.app.logic.BillLine
import `in`.udyamsetu.app.logic.BatchRow
import `in`.udyamsetu.app.logic.ItemRow
import `in`.udyamsetu.app.logic.LedgerRow
import `in`.udyamsetu.app.logic.MovementRow
import `in`.udyamsetu.app.logic.PartyRow
import `in`.udyamsetu.app.logic.SavedInvoice
import `in`.udyamsetu.app.logic.TaxHeads
import `in`.udyamsetu.app.logic.applyInvoiceToStock
import `in`.udyamsetu.app.logic.billTotals
import `in`.udyamsetu.app.logic.cashFlow
import `in`.udyamsetu.app.logic.csvCell
import `in`.udyamsetu.app.logic.decodeLines
import `in`.udyamsetu.app.logic.dueReminders
import `in`.udyamsetu.app.logic.encodeLines
import `in`.udyamsetu.app.logic.expiringBatches
import `in`.udyamsetu.app.logic.gstr1Summary
import `in`.udyamsetu.app.logic.gstr3bSummary
import `in`.udyamsetu.app.logic.lowStock
import `in`.udyamsetu.app.logic.negateTotals
import `in`.udyamsetu.app.logic.partyBalance
import `in`.udyamsetu.app.logic.calcPayslip
import `in`.udyamsetu.app.logic.EmployeeRow
import `in`.udyamsetu.app.logic.profitLoss
import `in`.udyamsetu.app.logic.purchaseSummary
import `in`.udyamsetu.app.logic.reconcile2A2B
import `in`.udyamsetu.app.logic.PortalRow
import `in`.udyamsetu.app.logic.salesSummary
import `in`.udyamsetu.app.logic.statement
import `in`.udyamsetu.app.logic.stockQty
import `in`.udyamsetu.app.logic.tallyCsv
import `in`.udyamsetu.app.logic.validateBillLine

private var pass = 0
private var fail = 0
private val failures = mutableListOf<String>()

private fun eq(name: String, actual: Any?, expected: Any?) {
    if (actual == expected) pass++ else { fail++; failures += "$name: expected=$expected actual=$actual" }
}

private fun sampleInvoice(number: String, date: String, total: Long, taxable: Long, cgst: Long, sgst: Long, igst: Long) =
    SavedInvoice(
        number = number, date = date, partyName = "Ramesh", partyGstin = null,
        buyerState = "21", intraState = true, type = "invoice", status = "saved",
        fy = "2026-27", lines = listOf(BillLine(1, taxable, 0, 18.0)),
        taxablePaise = taxable, cgstPaise = cgst, sgstPaise = sgst, igstPaise = igst,
        roundedTotalPaise = total,
    )

fun main() {
    // LinesCodec round-trip (incl. '|' and '%' in names) + validation.
    val lines = listOf(
        BillLine(2, 10000, 0, 18.0, "1001", "Rice | Basmati 5kg"),
        BillLine(1, 5000, 10, 5.0, "2002", "100% Cotton"),
    )
    val decoded = decodeLines(encodeLines(lines))
    eq("codec.roundtrip", decoded, lines)
    eq("codec.validate.ok", validateBillLine(lines[0]), emptyList<String>())
    eq("codec.validate.bad-hsn", validateBillLine(lines[0].copy(hsn = "12")).isNotEmpty(), true)
    val totals = billTotals(lines, true)
    eq("totals.taxable", totals.taxablePaise, 24500L)
    eq("totals.rounded", totals.roundedTotalPaise, 28300L)
    eq("totals.negate", negateTotals(totals).roundedTotalPaise, -28300L)

    // Party ledger: sign convention is the truth.
    val party = PartyRow("p1", "Ramesh", 1000L)
    val entries = listOf(
        LedgerRow("e1", "p1", "2026-11-01", "credit-sale", 5000L),
        LedgerRow("e2", "p1", "2026-11-02", "payment", -2000L),
    )
    eq("party.balance", partyBalance(party, entries), 4000L)
    eq("party.statement.last", statement(party, entries).last().runningBalancePaise, 4000L)
    eq("party.due.count", dueReminders(listOf(party), entries, "2026-11-10").size, 1)
    eq("party.due.days", dueReminders(listOf(party), entries, "2026-11-10")[0].daysDue, 9)

    // Inventory.
    val items = listOf(ItemRow("i1", "Rice", "1001", 5), ItemRow("i2", "Sugar", "1701", 10))
    val moves = listOf(
        MovementRow("m1", "i1", "", "2026-11-01", "in", 20),
        MovementRow("m2", "i1", "", "2026-11-02", "out", 8),
        MovementRow("m3", "i2", "", "2026-11-01", "in", 3),
    )
    eq("stock.qty", stockQty("i1", moves), 12)
    eq("stock.low", lowStock(items, moves).map { it.id }, listOf("i2"))
    eq("stock.apply", applyInvoiceToStock(listOf(BillLine(2, 10000, 0, 18.0, "1001", "Rice")), items, "INV/2026-27/0001", "2026-11-03").size, 1)
    val batches = listOf(BatchRow("b1", "i1", "B1", "2026-11-20", 5), BatchRow("b2", "i1", "B2", "2027-01-01", 5))
    eq("stock.expiring", expiringBatches(batches, 30, "2026-11-10").map { it.id }, listOf("b1"))

    // GST reports.
    val invs = listOf(
        sampleInvoice("INV/2026-27/0001", "2026-11-01", 11800L, 10000L, 900L, 900L, 0L),
        sampleInvoice("INV/2026-27/0002", "2026-11-02", 5900L, 5000L, 450L, 450L, 0L),
    )
    val g1 = gstr1Summary(invs)
    eq("gstr1.count", g1.invoiceCount, 2)
    eq("gstr1.taxable", g1.totals.taxablePaise, 15000L)
    eq("gstr1.b2cs.rows", g1.b2cs.size, 1)
    val g3 = gstr3bSummary(invs, TaxHeads(igstPaise = 0, cgstPaise = 1000, sgstPaise = 1000))
    eq("gstr3b.net.cgst", g3.netPayable.cgstPaise, 350L)
    eq("gstr3b.net.igst", g3.netPayable.igstPaise, 0L)
    val rec = reconcile2A2B(invs, listOf(PortalRow("INV/2026-27/0001", null, 10000L, 1800L)))
    eq("reconcile.matched", rec.matched, listOf("INV/2026-27/0001"))
    eq("reconcile.missing", rec.missingInPortal, listOf("INV/2026-27/0002"))

    // Payroll: pro-rata gross, PF/ESI on gross, deductions never exceed gross.
    val emp = EmployeeRow("e1", "Sita", 3000000L, pfPct = 12.0, esiPct = 0.75)
    val slip = calcPayslip(emp, 26, 30, "2026-11")
    eq("payroll.gross", slip.grossPaise, 2600000L)
    eq("payroll.pf", slip.pfPaise, 312000L)
    eq("payroll.net", slip.netPaise, 2600000L - 312000L - 19500L)
    var threw = false
    try { calcPayslip(emp.copy(pfPct = 90.0, esiPct = 90.0), 30, 30, "2026-11") } catch (_: IllegalArgumentException) { threw = true }
    eq("payroll.deduction-cap", threw, true)

    // Reports: cash flow counts only real cash; purchases are positive cost.
    val ledger = listOf(
        LedgerRow("l1", "p1", "2026-11-01", "payment", -2000L), // customer paid us
        LedgerRow("l2", "p1", "2026-11-02", "payment", 3000L),  // we paid a supplier
        LedgerRow("l3", "p1", "2026-11-03", "purchase", -7000L), // credit purchase
        LedgerRow("l4", "p1", "2026-11-04", "credit-sale", 9000L), // NOT cash
    )
    val flow = cashFlow(ledger)
    eq("cash.in", flow.cashInPaise, 2000L)
    eq("cash.out", flow.cashOutPaise, 3000L)
    eq("purchase.cost", purchaseSummary(ledger).totalPaise, 7000L)
    eq("sales.total", salesSummary(invs).totalPaise, 17700L)
    eq("pl.gross", profitLoss(invs, ledger, 0L).grossProfitPaise, 17700L - 7000L)
    eq("csv.escape", csvCell("a,b\"c"), "\"a,b\"\"c\"")
    eq("tally.csv.header", tallyCsv(invs).lines().first(), "Date,Voucher No,Party,Type,Taxable,CGST,SGST,IGST,Total")

    println("Logic tests: $pass passed, $fail failed")
    if (failures.isNotEmpty()) {
        failures.forEach { println("FAIL: $it") }
        kotlin.system.exitProcess(1)
    }
}
