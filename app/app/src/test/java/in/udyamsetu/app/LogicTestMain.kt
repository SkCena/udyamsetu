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
import `in`.udyamsetu.app.logic.billTotalsForType
import `in`.udyamsetu.app.logic.calcExclusive
import `in`.udyamsetu.app.logic.calcInclusive
import `in`.udyamsetu.app.logic.cashFlow
import `in`.udyamsetu.app.logic.csvCell
import `in`.udyamsetu.app.logic.decodeBackup
import `in`.udyamsetu.app.logic.decodeLines
import `in`.udyamsetu.app.logic.decryptBackup
import `in`.udyamsetu.app.logic.docNumberPrefix
import `in`.udyamsetu.app.logic.dueReminders
import `in`.udyamsetu.app.logic.encodeBackup
import `in`.udyamsetu.app.logic.encodeLines
import `in`.udyamsetu.app.logic.encryptBackup
import `in`.udyamsetu.app.logic.BackupData
import `in`.udyamsetu.app.logic.InvoiceBackup
import `in`.udyamsetu.app.logic.PartyBackup
import `in`.udyamsetu.app.logic.ProfileBackup
import `in`.udyamsetu.app.logic.expiringBatches
import `in`.udyamsetu.app.logic.extractGstFromTotal
import `in`.udyamsetu.app.logic.findPartyByName
import `in`.udyamsetu.app.logic.gstr1Summary
import `in`.udyamsetu.app.logic.gstr3bSummary
import `in`.udyamsetu.app.logic.isGstDoc
import `in`.udyamsetu.app.logic.isSaleDoc
import `in`.udyamsetu.app.logic.lowStock
import `in`.udyamsetu.app.logic.negateTotals
import `in`.udyamsetu.app.logic.partyBalance
import `in`.udyamsetu.app.logic.calcPayslip
import `in`.udyamsetu.app.logic.BasicCalcState
import `in`.udyamsetu.app.logic.EmployeeRow
import `in`.udyamsetu.app.logic.INVOICE_TEMPLATES
import `in`.udyamsetu.app.logic.basicCalcFormat
import `in`.udyamsetu.app.logic.basicCalcPress
import `in`.udyamsetu.app.logic.isInvoiceTemplate
import `in`.udyamsetu.app.logic.profitLoss
import `in`.udyamsetu.app.logic.purchaseSummary
import `in`.udyamsetu.app.logic.reconcile2A2B
import `in`.udyamsetu.app.logic.PortalRow
import `in`.udyamsetu.app.logic.salesSummary
import `in`.udyamsetu.app.logic.shareTextForDoc
import `in`.udyamsetu.app.logic.signedTotals
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

private fun sampleInvoice(number: String, date: String, total: Long, taxable: Long, cgst: Long, sgst: Long, igst: Long, type: String = "invoice") =
    SavedInvoice(
        number = number, date = date, partyName = "Ramesh", partyGstin = null,
        buyerState = "21", intraState = true, type = type, status = "saved",
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

    // Bill party resolve: bill save pe party naam se milni chahiye —
    // bade/chhote akshar ya aas-paas ki khaali jagah se farak nahi padta.
    // (Isi resolve se saveInvoice ko party milti hai aur ledger entry banti hai.)
    val billParties = listOf(PartyRow("p1", "Ramesh Kumar"), PartyRow("p2", "Sita Devi"))
    eq("party.find.exact", findPartyByName(billParties, "Ramesh Kumar")?.id, "p1")
    eq("party.find.case", findPartyByName(billParties, "ramesh kumar")?.id, "p1")
    eq("party.find.spaces", findPartyByName(billParties, "  Ramesh Kumar  ")?.id, "p1")
    eq("party.find.missing", findPartyByName(billParties, "Mohan"), null)
    eq("party.find.blank", findPartyByName(billParties, "   "), null)
    eq("party.find.empty-list", findPartyByName(emptyList(), "Ramesh"), null)

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

    // GST calculator: exclusive adds tax, inclusive splits it back out.
    val ex = calcExclusive(10000L, 18.0)
    eq("calc.ex.gst", ex.gstPaise, 1800L)
    eq("calc.ex.total", ex.totalPaise, 11800L)
    eq("calc.ex.base", ex.basePaise, 10000L)
    val inc = calcInclusive(11800L, 18.0)
    eq("calc.in.base", inc.basePaise, 10000L)
    eq("calc.in.gst", inc.gstPaise, 1800L)
    eq("calc.in.total", inc.totalPaise, 11800L)
    val inc5 = calcInclusive(1000L, 5.0)
    eq("calc.in5.base", inc5.basePaise, 952L)
    eq("calc.in5.gst", inc5.gstPaise, 48L)
    eq("calc.in5.sum", inc5.basePaise + inc5.gstPaise, 1000L)
    eq("calc.extract", extractGstFromTotal(11800L, 18.0).gstPaise, 1800L)
    eq("calc.zero", calcExclusive(0L, 18.0).totalPaise, 0L)
    var threwCalc = false
    try { calcExclusive(100L, 30.0) } catch (_: IllegalArgumentException) { threwCalc = true }
    eq("calc.bad-rate", threwCalc, true)
    var threwNeg = false
    try { calcInclusive(-100L, 18.0) } catch (_: IllegalArgumentException) { threwNeg = true }
    eq("calc.negative", threwNeg, true)

    // Bill types: tax rules follow the document type.
    val gstLines = listOf(BillLine(2, 10000, 0, 18.0, "1001", "Rice"))
    eq("type.invoice.tax", billTotalsForType(gstLines, true, "invoice").cgstPaise, 1800L)
    eq("type.nongst.tax", billTotalsForType(gstLines, true, "non-gst").cgstPaise, 0L)
    eq("type.nongst.total", billTotalsForType(gstLines, true, "non-gst").roundedTotalPaise, 20000L)
    eq("type.receipt.tax", billTotalsForType(gstLines, true, "receipt").igstPaise, 0L)
    eq("type.estimate.eq-invoice", billTotalsForType(gstLines, true, "estimate").roundedTotalPaise,
        billTotalsForType(gstLines, true, "invoice").roundedTotalPaise)
    eq("type.credit.negative", billTotalsForType(gstLines, true, "credit-note").roundedTotalPaise, -23600L)
    eq("type.debit.positive", billTotalsForType(gstLines, true, "debit-note").roundedTotalPaise, 23600L)
    eq("type.signed.debit", signedTotals(billTotals(gstLines, true), "debit-note").roundedTotalPaise, 23600L)
    eq("type.prefix.est", docNumberPrefix("estimate", "INV"), "EST")
    eq("type.prefix.rcp", docNumberPrefix("receipt", "INV"), "RCP")
    eq("type.prefix.inv", docNumberPrefix("invoice", "INV"), "INV")
    eq("type.isSale.est", isSaleDoc("estimate"), false)
    eq("type.isSale.nongst", isSaleDoc("non-gst"), true)
    eq("type.isGst.receipt", isGstDoc("receipt"), false)
    eq("type.isGst.note", isGstDoc("credit-note"), true)
    val share = shareTextForDoc("GST Bill", "INV/2026-27/0001", "Sharma Store", "Ramesh", 23600L, "shop@upi")
    eq("type.share.has-number", share.contains("INV/2026-27/0001"), true)
    eq("type.share.has-total", share.contains("₹236.00"), true)
    eq("type.share.has-upi", share.contains("shop@upi"), true)
    val shareCredit = shareTextForDoc("Credit Note", "INV/2026-27/0002", "Sharma Store", "Ramesh", -23600L, "")
    eq("type.share.credit-neg", shareCredit.contains("-₹236.00"), true)

    // New types stay out of GST returns; non-GST still counts as a sale.
    val mixed = listOf(
        sampleInvoice("INV/2026-27/0001", "2026-11-01", 11800L, 10000L, 900L, 900L, 0L),
        sampleInvoice("EST/2026-27/0001", "2026-11-01", 11800L, 10000L, 900L, 900L, 0L, "estimate"),
        sampleInvoice("INV/2026-27/0002", "2026-11-02", 5000L, 5000L, 0L, 0L, 0L, "non-gst"),
        sampleInvoice("RCP/2026-27/0001", "2026-11-02", 5000L, 5000L, 0L, 0L, 0L, "receipt"),
    )
    eq("gstr1.excludes-estimate", gstr1Summary(mixed).totals.taxablePaise, 10000L)
    eq("gstr1.count-only-invoice", gstr1Summary(mixed).invoiceCount, 1)
    eq("sales.includes-nongst", salesSummary(mixed).totalPaise, 16800L)
    eq("sales.count", salesSummary(mixed).count, 2)
    val rec2 = reconcile2A2B(mixed, listOf(PortalRow("INV/2026-27/0001", null, 10000L, 1800L)))
    eq("reconcile.ignores-estimate", rec2.missingInPortal, emptyList<String>())

    // Drive backup: codec round-trip (incl. '|' / '%' / newline in names)
    // + passphrase encryption round-trip + wrong passphrase fails.
    val backup = BackupData(
        profile = ProfileBackup(name = "Sharma | Store %\nLtd", gstin = "22AAAAA0000A1Z5", nextSeq = 7),
        parties = listOf(PartyBackup("p1", "Ramesh | Kumar", "99999", null, "21", "customer", 1000L)),
        invoices = listOf(
            InvoiceBackup(
                id = "inv-1", number = "INV/2026-27/0001", date = "2026-11-01",
                partyName = "Ramesh", buyerState = "21", intraState = true,
                type = "invoice", fy = "2026-27",
                linesEncoded = encodeLines(listOf(BillLine(1, 10000, 0, 18.0, "1001", "Rice | Basmati"))),
                taxablePaise = 10000L, cgstPaise = 900L, sgstPaise = 900L,
                igstPaise = 0L, totalPaise = 11800L, roundedTotalPaise = 11800L, roundOffPaise = 0L,
            ),
        ),
    )
    val encoded = encodeBackup(backup)
    eq("backup.roundtrip", decodeBackup(encoded), backup)
    val encrypted = encryptBackup(encoded.toByteArray(Charsets.UTF_8), "my-secret-pass")
    val decrypted = String(decryptBackup(encrypted, "my-secret-pass"), Charsets.UTF_8)
    eq("backup.encrypt-roundtrip", decrypted, encoded)
    var threwPass = false
    try { decryptBackup(encrypted, "wrong-pass") } catch (_: Exception) { threwPass = true }
    eq("backup.wrong-pass-fails", threwPass, true)
    var threwHeader = false
    try { decodeBackup("NOT-A-BACKUP|1\n") } catch (_: IllegalArgumentException) { threwHeader = true }
    eq("backup.bad-header", threwHeader, true)
    var threwVersion = false
    try { decodeBackup("UDYAMSETU-BACKUP|99\n") } catch (_: IllegalArgumentException) { threwVersion = true }
    eq("backup.bad-version", threwVersion, true)

    // Basic calculator (standalone, not GST) — mirrors site/basiccalc.js.
    fun pressSeq(keys: List<String>): BasicCalcState {
        var s = BasicCalcState()
        for (k in keys) s = basicCalcPress(s, k)
        return s
    }
    eq("basiccalc.starts-at-0", BasicCalcState().entry, "0")
    eq("basiccalc.type-digits", pressSeq(listOf("1", "2", "3")).entry, "123")
    eq("basiccalc.leading-zero", pressSeq(listOf("0", "5")).entry, "5")
    eq("basiccalc.decimal", pressSeq(listOf("1", ".", "5")).entry, "1.5")
    eq("basiccalc.one-dot-only", pressSeq(listOf("1", ".", ".", "5")).entry, "1.5")
    eq("basiccalc.add", pressSeq(listOf("1", "2", "+", "3", "=")).entry, "15")
    eq("basiccalc.subtract", pressSeq(listOf("9", "-", "4", "=")).entry, "5")
    eq("basiccalc.multiply", pressSeq(listOf("6", "×", "7", "=")).entry, "42")
    eq("basiccalc.divide", pressSeq(listOf("8", "÷", "2", "=")).entry, "4")
    eq("basiccalc.no-0.1-0.2-artefact", pressSeq(listOf("0", ".", "1", "+", "0", ".", "2", "=")).entry, "0.3")
    eq("basiccalc.chained-ops", pressSeq(listOf("2", "+", "3", "×", "4", "=")).entry, "20")
    eq("basiccalc.percent", pressSeq(listOf("5", "0", "%")).entry, "0.5")
    eq("basiccalc.percent-after-op", pressSeq(listOf("2", "0", "0", "+", "1", "0", "%", "=")).entry, "200.1")
    eq("basiccalc.backspace", pressSeq(listOf("1", "2", "3", "back")).entry, "12")
    eq("basiccalc.backspace-to-zero", pressSeq(listOf("5", "back")).entry, "0")
    eq("basiccalc.clear", pressSeq(listOf("9", "+", "1", "C")).entry, "0")
    eq("basiccalc.divide-by-zero", pressSeq(listOf("5", "÷", "0", "=")).entry, "Error")
    eq("basiccalc.digit-after-error", pressSeq(listOf("5", "÷", "0", "=", "7")).entry, "7")
    eq("basiccalc.equals-without-op", pressSeq(listOf("4", "2", "=")).entry, "42")
    eq("basiccalc.history-sum", pressSeq(listOf("1", "2", "+", "3", "=")).history, "12 + 3 =")
    eq("basiccalc.history-pending", pressSeq(listOf("1", "2", "+")).history, "12 +")
    eq("basiccalc.double-zero", pressSeq(listOf("1", "00")).entry, "100")
    eq("basiccalc.format-trims-tail", basicCalcFormat(2.0 / 3.0), "0.6666666667")

    // Invoice templates (look only) + share text — mirrors site/invoice.js.
    eq("templates.list", INVOICE_TEMPLATES, listOf("classic", "modern", "minimal", "thermal"))
    eq("templates.classic-valid", isInvoiceTemplate("classic"), true)
    eq("templates.bogus-invalid", isInvoiceTemplate("fancy"), false)
    val shareTpl = shareTextForDoc(
        typeLabel = "GST Bill", number = "INV/2026-27/0001",
        shopName = "Sharma Kirana Store", partyName = "Ramesh Kumar",
        totalPaise = 117800L, upiId = "sharma@upi",
    )
    eq("share.has-number", shareTpl.contains("INV/2026-27/0001"), true)
    eq("share.has-party", shareTpl.contains("Ramesh Kumar"), true)
    eq("share.has-total", shareTpl.contains("₹1178.00"), true)
    eq("share.has-upi", shareTpl.contains("Pay via UPI: sharma@upi"), true)

    println("Logic tests: $pass passed, $fail failed")
    if (failures.isNotEmpty()) {
        failures.forEach { println("FAIL: $it") }
        kotlin.system.exitProcess(1)
    }
}
