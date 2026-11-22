// UdyamSetu — invoice lines codec + totals (pure Kotlin, no Android APIs).
// The Room invoice stores lines as one string; this codec is the only place
// that knows the format, so the format can change without touching screens.
// Format: one line per invoice line, fields separated by '|':
//   qty | unitPricePaise | discountPct | taxRatePct | hsn | name
// '|' and '\n' inside a name are escaped as %7C / %0A. taxRatePct keeps its
// decimal form (e.g. 18.0). Totals always come from the shared core
// (core/GstCore.kt) — never recomputed by hand here.
package `in`.udyamsetu.app.logic

import `in`.udyamsetu.app.core.InvoiceCalc
import `in`.udyamsetu.app.core.InvoiceLineInput
import `in`.udyamsetu.app.core.calcInvoice
import `in`.udyamsetu.app.core.isValidHSN
import `in`.udyamsetu.app.core.isValidRate

data class BillLine(
    val qty: Int,
    val unitPricePaise: Long,
    val discountPct: Int = 0,
    val taxRatePct: Double,
    val hsn: String = "",
    val name: String = "",
)

fun BillLine.toInput(intraState: Boolean): InvoiceLineInput =
    InvoiceLineInput(qty, unitPricePaise, discountPct, taxRatePct, intraState)

fun encodeLines(lines: List<BillLine>): String =
    lines.joinToString("\n") { l ->
        val name = l.name.replace("%", "%25").replace("|", "%7C").replace("\n", "%0A")
        "${l.qty}|${l.unitPricePaise}|${l.discountPct}|${l.taxRatePct}|${l.hsn}|$name"
    }

fun decodeLines(raw: String): List<BillLine> {
    if (raw.isBlank()) return emptyList()
    return raw.lines().filter { it.isNotBlank() }.map { row ->
        val parts = row.split("|")
        require(parts.size == 6) { "bad bill line: $row" }
        val name = parts[5].replace("%0A", "\n").replace("%7C", "|").replace("%25", "%")
        BillLine(
            qty = parts[0].toInt(),
            unitPricePaise = parts[1].toLong(),
            discountPct = parts[2].toInt(),
            taxRatePct = parts[3].toDouble(),
            hsn = parts[4],
            name = name,
        )
    }
}

/** Validate a draft the way the Site does (invoice.js validateLine). */
fun validateBillLine(line: BillLine): List<String> {
    val errors = mutableListOf<String>()
    if (line.qty <= 0) errors += "qty"
    if (line.unitPricePaise < 0) errors += "price"
    if (line.discountPct !in 0..100) errors += "discount"
    if (!isValidRate(line.taxRatePct)) errors += "rate"
    if (line.hsn.isNotEmpty() && !isValidHSN(line.hsn)) errors += "hsn"
    return errors
}

/** Totals for a draft, straight from the shared core. */
fun billTotals(lines: List<BillLine>, intraState: Boolean): InvoiceCalc {
    require(lines.isNotEmpty()) { "invoice needs at least one line" }
    return calcInvoice(lines.map { it.toInput(intraState) })
}

/** Credit/debit note = the original invoice's totals negated (Site rule). */
fun negateTotals(calc: InvoiceCalc): InvoiceCalc = calc.copy(
    taxablePaise = -calc.taxablePaise,
    cgstPaise = -calc.cgstPaise,
    sgstPaise = -calc.sgstPaise,
    igstPaise = -calc.igstPaise,
    totalPaise = -calc.totalPaise,
    roundedTotalPaise = -calc.roundedTotalPaise,
    roundOffPaise = -calc.roundOffPaise,
)
