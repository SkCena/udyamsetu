// AUTO-GENERATED from core/gst-test-vectors.json — do not edit by hand.
// Regenerate: python3 tools/gen-kt-test.py
package `in`.udyamsetu.app.core

private var passCount = 0
private var failCount = 0
private val failures = mutableListOf<String>()

private fun eq(name: String, actual: Any?, expected: Any?) {
    if (actual == expected) passCount++ else { failCount++; failures += "$name: expected=$expected actual=$actual" }
}

private fun line(input: InvoiceLineInput, exp: LineCalc, name: String) {
    val got = calcLine(input)
    eq("$name.grossPaise", got.grossPaise, exp.grossPaise)
    eq("$name.discountPaise", got.discountPaise, exp.discountPaise)
    eq("$name.taxablePaise", got.taxablePaise, exp.taxablePaise)
    eq("$name.taxPaise", got.taxPaise, exp.taxPaise)
    eq("$name.cgstPaise", got.cgstPaise, exp.cgstPaise)
    eq("$name.sgstPaise", got.sgstPaise, exp.sgstPaise)
    eq("$name.igstPaise", got.igstPaise, exp.igstPaise)
}

fun main() {
    line(InvoiceLineInput(qty=2, unitPricePaise=10000L, discountPct=0, taxRatePct=18.0, intraState=true), LineCalc(20000L, 0L, 20000L, 3600L, 1800L, 1800L, 0L), "L01-intra-18")
    line(InvoiceLineInput(qty=2, unitPricePaise=10000L, discountPct=0, taxRatePct=18.0, intraState=false), LineCalc(20000L, 0L, 20000L, 3600L, 0L, 0L, 3600L), "L01b-inter-18")
    line(InvoiceLineInput(qty=1, unitPricePaise=100000L, discountPct=10, taxRatePct=12.0, intraState=true), LineCalc(100000L, 10000L, 90000L, 10800L, 5400L, 5400L, 0L), "L02-discount-12")
    line(InvoiceLineInput(qty=3, unitPricePaise=9999L, discountPct=0, taxRatePct=5.0, intraState=true), LineCalc(29997L, 0L, 29997L, 1500L, 750L, 750L, 0L), "L03-5pct-rounding")
    line(InvoiceLineInput(qty=5, unitPricePaise=20000L, discountPct=0, taxRatePct=0.0, intraState=true), LineCalc(100000L, 0L, 100000L, 0L, 0L, 0L, 0L), "L04-zero-tax")
    line(InvoiceLineInput(qty=1, unitPricePaise=50000L, discountPct=0, taxRatePct=28.0, intraState=false), LineCalc(50000L, 0L, 50000L, 14000L, 0L, 0L, 14000L), "L05-28-inter")
    line(InvoiceLineInput(qty=1, unitPricePaise=30020L, discountPct=0, taxRatePct=5.0, intraState=true), LineCalc(30020L, 0L, 30020L, 1501L, 751L, 750L, 0L), "L06-odd-split")
    line(InvoiceLineInput(qty=2, unitPricePaise=15000L, discountPct=5, taxRatePct=3.0, intraState=true), LineCalc(30000L, 1500L, 28500L, 855L, 428L, 427L, 0L), "L07-3pct")
    line(InvoiceLineInput(qty=1, unitPricePaise=10000L, discountPct=100, taxRatePct=18.0, intraState=true), LineCalc(10000L, 10000L, 0L, 0L, 0L, 0L, 0L), "L08-100pct-discount")
    run { val got = calcInvoice(listOf(InvoiceLineInput(qty=2, unitPricePaise=10000L, discountPct=0, taxRatePct=18.0, intraState=true), InvoiceLineInput(qty=3, unitPricePaise=9999L, discountPct=0, taxRatePct=5.0, intraState=true))); eq("I01-two-lines-intra.taxablePaise", got.taxablePaise, 49997L); eq("I01-two-lines-intra.cgstPaise", got.cgstPaise, 2550L); eq("I01-two-lines-intra.sgstPaise", got.sgstPaise, 2550L); eq("I01-two-lines-intra.igstPaise", got.igstPaise, 0L); eq("I01-two-lines-intra.totalPaise", got.totalPaise, 55097L); eq("I01-two-lines-intra.roundedTotalPaise", got.roundedTotalPaise, 55100L); eq("I01-two-lines-intra.roundOffPaise", got.roundOffPaise, 3L) }
    run { val got = calcInvoice(listOf(InvoiceLineInput(qty=1, unitPricePaise=10033L, discountPct=0, taxRatePct=5.0, intraState=true))); eq("I02-single-roundoff-neg.taxablePaise", got.taxablePaise, 10033L); eq("I02-single-roundoff-neg.cgstPaise", got.cgstPaise, 251L); eq("I02-single-roundoff-neg.sgstPaise", got.sgstPaise, 251L); eq("I02-single-roundoff-neg.igstPaise", got.igstPaise, 0L); eq("I02-single-roundoff-neg.totalPaise", got.totalPaise, 10535L); eq("I02-single-roundoff-neg.roundedTotalPaise", got.roundedTotalPaise, 10500L); eq("I02-single-roundoff-neg.roundOffPaise", got.roundOffPaise, -35L) }
    run { val got = calcInvoice(listOf(InvoiceLineInput(qty=2, unitPricePaise=10000L, discountPct=0, taxRatePct=18.0, intraState=false), InvoiceLineInput(qty=1, unitPricePaise=50000L, discountPct=0, taxRatePct=28.0, intraState=false))); eq("I03-inter-mix.taxablePaise", got.taxablePaise, 70000L); eq("I03-inter-mix.cgstPaise", got.cgstPaise, 0L); eq("I03-inter-mix.sgstPaise", got.sgstPaise, 0L); eq("I03-inter-mix.igstPaise", got.igstPaise, 17600L); eq("I03-inter-mix.totalPaise", got.totalPaise, 87600L); eq("I03-inter-mix.roundedTotalPaise", got.roundedTotalPaise, 87600L); eq("I03-inter-mix.roundOffPaise", got.roundOffPaise, 0L) }
    eq("gstin 27AAAPL1234C1ZE", isValidGSTIN("27AAAPL1234C1ZE"), true)
    eq("gstin 22AAAAA0000A1ZC", isValidGSTIN("22AAAAA0000A1ZC"), true)
    eq("gstin 08ABCDE1234F1Z0", isValidGSTIN("08ABCDE1234F1Z0"), true)
    eq("gstin 27AAAPL1234C1ZF", isValidGSTIN("27AAAPL1234C1ZF"), false)
    eq("gstin 27AAAPL1234C1Z", isValidGSTIN("27AAAPL1234C1Z"), false)
    eq("gstin 27aaapl1234c1ze", isValidGSTIN("27aaapl1234c1ze"), false)
    eq("gstin 99AAAPL1234C1ZE", isValidGSTIN("99AAAPL1234C1ZE"), false)
    eq("gstin (empty)", isValidGSTIN(""), false)
    eq("hsn 1001", isValidHSN("1001"), true)
    eq("hsn 100110", isValidHSN("100110"), true)
    eq("hsn 10011010", isValidHSN("10011010"), true)
    eq("hsn 100", isValidHSN("100"), false)
    eq("hsn 10011", isValidHSN("10011"), false)
    eq("hsn ABCD", isValidHSN("ABCD"), false)
    eq("hsn ", isValidHSN(""), false)
    eq("invNo INV/2026-27/0001", invoiceNumber("INV", "2026-27", 1), "INV/2026-27/0001")
    eq("invNo INV/2026-27/0042", invoiceNumber("INV", "2026-27", 42), "INV/2026-27/0042")
    eq("invNo BILL/2026-27/10000", invoiceNumber("BILL", "2026-27", 10000), "BILL/2026-27/10000")
    eq("formatINR 23600", formatINR(23600L), "₹236.00")
    eq("formatINR 0", formatINR(0L), "₹0.00")
    eq("formatINR -550", formatINR(-550L), "-₹5.50")
    eq("formatINR 100800", formatINR(100800L), "₹1008.00")
    for ((name, fn) in listOf("bad rate 25" to { calcLine(InvoiceLineInput(1, 100L, 0, 25.0, true)) }, "qty 0" to { calcLine(InvoiceLineInput(0, 100L, 0, 18.0, true)) }, "discount 101" to { calcLine(InvoiceLineInput(1, 100L, 101, 18.0, true)) }, "empty invoice" to { calcInvoice(emptyList()) }, "bad prefix" to { invoiceNumber("inv", "2026-27", 1) })) {
        try { fn(); failCount++; failures += "$name: expected throw, got a value" } catch (e: IllegalArgumentException) { passCount++ }
    }
    println("GST Kotlin tests: $passCount passed, $failCount failed")
    if (failures.isNotEmpty()) { println("\nFAILURES:\n" + failures.joinToString("\n")); kotlin.system.exitProcess(1) }
}
