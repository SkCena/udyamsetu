// UdyamSetu shared GST core — Android (Kotlin) implementation.
// Pure functions only. All money in integer paise (Long). No Android APIs here.
// Mirror: core/gst.js must produce identical results for the same inputs.
// Test vectors: core/gst-test-vectors.json
package `in`.udyamsetu.app.core

import kotlin.math.roundToLong

val GST_SLABS: List<Double> = listOf(0.0, 0.1, 0.25, 1.5, 3.0, 5.0, 12.0, 18.0, 28.0)

data class InvoiceLineInput(
    val qty: Int,
    val unitPricePaise: Long,
    val discountPct: Int = 0,
    val taxRatePct: Double,
    val intraState: Boolean,
)

data class LineCalc(
    val grossPaise: Long,
    val discountPaise: Long,
    val taxablePaise: Long,
    val taxPaise: Long,
    val cgstPaise: Long,
    val sgstPaise: Long,
    val igstPaise: Long,
)

data class InvoiceCalc(
    val lines: List<LineCalc>,
    val taxablePaise: Long,
    val cgstPaise: Long,
    val sgstPaise: Long,
    val igstPaise: Long,
    val totalPaise: Long,
    val roundedTotalPaise: Long,
    val roundOffPaise: Long,
)

/** Round half-up for non-negative values: round(n / d). */
fun roundDiv(n: Long, d: Long): Long {
    require(n >= 0) { "roundDiv: negative input" }
    return (2 * n + d) / (2 * d)
}

fun isValidRate(ratePct: Double): Boolean = GST_SLABS.contains(ratePct)

/**
 * One invoice line. Discount is applied BEFORE tax. Tax is rounded half-up
 * to the paise. Intra-state: tax splits CGST/SGST (CGST gets the half paise
 * on odd tax). Inter-state: full tax is IGST.
 */
fun calcLine(line: InvoiceLineInput): LineCalc {
    require(line.qty > 0) { "qty must be a positive integer" }
    require(line.unitPricePaise >= 0) { "unitPricePaise must be non-negative" }
    require(line.discountPct in 0..100) { "discountPct must be 0..100" }
    require(isValidRate(line.taxRatePct)) { "unsupported GST rate: ${line.taxRatePct}" }
    val gross = line.qty.toLong() * line.unitPricePaise
    val discount = roundDiv(gross * line.discountPct, 100)
    val taxable = gross - discount
    val rateBps = (line.taxRatePct * 100).roundToLong()
    val tax = roundDiv(taxable * rateBps, 10_000)
    val cgst: Long
    val sgst: Long
    val igst: Long
    if (line.intraState) {
        cgst = roundDiv(tax, 2)
        sgst = tax - cgst
        igst = 0
    } else {
        cgst = 0; sgst = 0; igst = tax
    }
    return LineCalc(gross, discount, taxable, tax, cgst, sgst, igst)
}

/** Sum lines into an invoice total; round the grand total to the nearest rupee. */
fun calcInvoice(lines: List<InvoiceLineInput>): InvoiceCalc {
    require(lines.isNotEmpty()) { "invoice needs at least one line" }
    val calc = lines.map(::calcLine)
    val taxable = calc.sumOf { it.taxablePaise }
    val cgst = calc.sumOf { it.cgstPaise }
    val sgst = calc.sumOf { it.sgstPaise }
    val igst = calc.sumOf { it.igstPaise }
    val total = taxable + cgst + sgst + igst
    val rounded = (total.toDouble() / 100).roundToLong() * 100
    return InvoiceCalc(calc, taxable, cgst, sgst, igst, total, rounded, rounded - total)
}

/** Format paise as Indian rupees, e.g. 23600 -> "₹236.00". */
fun formatINR(paise: Long): String {
    val sign = if (paise < 0) "-" else ""
    val abs = kotlin.math.abs(paise)
    return sign + "₹" + (abs / 100).toString() + "." + (abs % 100).toString().padStart(2, '0')
}

/** GSTIN: 15 chars, state 01-37, PAN, entity, 'Z', base36-mod36 check digit. */
fun isValidGSTIN(gstin: String): Boolean {
    if (!Regex("^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$").matches(gstin)) return false
    val state = gstin.substring(0, 2).toInt()
    if (state < 1 || state > 37) return false
    fun value(c: Char): Int = if (c in '0'..'9') c - '0' else c - 'A' + 10
    var sum = 0
    for (i in 0 until 14) {
        val factor = if (i % 2 == 0) 1 else 2
        val p = value(gstin[i]) * factor
        sum += p / 36 + p % 36
    }
    val check = (36 - sum % 36) % 36
    val expected = if (check < 10) ('0' + check) else ('A' + check - 10)
    return gstin[14] == expected
}

/** HSN code: 4, 6 or 8 digits. */
fun isValidHSN(hsn: String): Boolean =
    Regex("^\\d{4}$|^\\d{6}$|^\\d{8}$").matches(hsn)

/** Invoice number: PREFIX/FY/0001, sequence zero-padded to 4. */
fun invoiceNumber(prefix: String, fy: String, seq: Int): String {
    require(Regex("^[A-Z]{2,10}$").matches(prefix)) { "bad invoice prefix" }
    require(Regex("^\\d{4}-\\d{2}$").matches(fy)) { "bad financial year" }
    require(seq >= 1) { "bad sequence" }
    return "$prefix/$fy/${seq.toString().padStart(4, '0')}"
}
