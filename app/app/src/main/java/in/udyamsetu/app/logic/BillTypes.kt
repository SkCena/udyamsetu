// UdyamSetu — document types for billing (pure Kotlin, no Android APIs).
// One draft can be any of these; the totals rule follows the type:
//   invoice     GST bill — tax as per line rates (CGST+SGST / IGST).
//   non-gst     Non-GST bill — same lines, tax forced to zero.
//   estimate    Estimate / quotation — totals shown like a GST bill, but it
//               is NOT a sale: no stock change, no ledger entry, and it
//               never enters GSTR-1/3B or sales reports.
//   credit-note Return / reduction — totals negated (negative document).
//   debit-note  Extra charge — totals stay POSITIVE (it adds to what the
//               buyer owes). The old code negated debit notes too; that
//               contradicted the app's own note hint and the GSTR-1 CDNR
//               rule, so it is fixed here (see signedTotals).
//   receipt     Payment receipt — a payment record, not a sale: tax zero,
//               no stock change, no ledger entry, no GST filing effect.
// The type string is stored on the Room invoice (type column) so old saved
// bills keep working — new types only add values, never rename old ones.
package `in`.udyamsetu.app.logic

import `in`.udyamsetu.app.core.InvoiceCalc

const val DOC_INVOICE = "invoice"
const val DOC_NON_GST = "non-gst"
const val DOC_ESTIMATE = "estimate"
const val DOC_CREDIT_NOTE = "credit-note"
const val DOC_DEBIT_NOTE = "debit-note"
const val DOC_RECEIPT = "receipt"

/** All types the billing screen offers, in display order. */
val DOC_TYPES = listOf(
    DOC_INVOICE, DOC_NON_GST, DOC_ESTIMATE,
    DOC_CREDIT_NOTE, DOC_DEBIT_NOTE, DOC_RECEIPT,
)

/** A real sale (stock out + party ledger + sales reports). */
fun isSaleDoc(type: String): Boolean =
    type == DOC_INVOICE || type == DOC_NON_GST

/** Enters GST returns (GSTR-1 totals / CDNR, GSTR-3B outward). */
fun isGstDoc(type: String): Boolean =
    type == DOC_INVOICE || type == DOC_CREDIT_NOTE || type == DOC_DEBIT_NOTE

/** Number-series prefix: estimates and receipts get their own series so
 *  the GST invoice series never has gaps from non-invoices. */
fun docNumberPrefix(type: String, invoicePrefix: String): String = when (type) {
    DOC_ESTIMATE -> "EST"
    DOC_RECEIPT -> "RCP"
    else -> invoicePrefix
}

/**
 * Totals for a draft of the given type. Non-GST and receipt documents
 * force every line rate to 0 (tax zero); estimates keep the GST math so
 * the customer sees the same total the bill would have; notes are signed
 * by signedTotals (credit-note negative, debit-note positive).
 */
fun billTotalsForType(lines: List<BillLine>, intraState: Boolean, type: String): InvoiceCalc {
    require(lines.isNotEmpty()) { "invoice needs at least one line" }
    val taxedLines = when (type) {
        DOC_NON_GST, DOC_RECEIPT -> lines.map { it.copy(taxRatePct = 0.0) }
        else -> lines
    }
    val calc = billTotals(taxedLines, intraState)
    return signedTotals(calc, type)
}

/** Sign rule for notes. Only a credit note negates; a debit note is a
 *  positive extra charge. */
fun signedTotals(calc: InvoiceCalc, type: String): InvoiceCalc =
    if (type == DOC_CREDIT_NOTE) negateTotals(calc) else calc

/**
 * Shareable text for a saved document. The caller passes the already
 * translated type label (and an optional note line, e.g. for an estimate),
 * so this stays language-free. `totalPaise` is the signed rounded total
 * (negative for a credit note).
 */
fun shareTextForDoc(
    typeLabel: String,
    number: String,
    shopName: String,
    partyName: String,
    totalPaise: Long,
    upiId: String,
    note: String = "",
): String {
    val sb = StringBuilder()
    sb.append("$typeLabel $number — $shopName\n")
    sb.append("Party: $partyName\n")
    sb.append("Total: ${formatDocTotal(totalPaise)}")
    if (note.isNotEmpty()) sb.append("\n$note")
    if (upiId.isNotEmpty()) sb.append("\nPay via UPI: $upiId")
    sb.append("\n— sent from UdyamSetu (free)")
    return sb.toString()
}

private fun formatDocTotal(totalPaise: Long): String {
    val sign = if (totalPaise < 0) "-" else ""
    val abs = kotlin.math.abs(totalPaise)
    return "$sign₹${abs / 100}.${(abs % 100).toString().padStart(2, '0')}"
}
