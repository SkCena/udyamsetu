// UdyamSetu — GST reports pure logic. Mirrors site/gst-reports.js.
// Outputs are DRAFTS — the app does not file. GSTR-1/3B JSON downloads are
// DRAFT until Phase 1.3 (CA pilot). ITC is user-entered from portal 2B;
// the app never guesses ITC (default 0).
package `in`.udyamsetu.app.logic

import `in`.udyamsetu.app.core.calcLine
import `in`.udyamsetu.app.core.InvoiceLineInput

/** One saved invoice, in the shape the reports need (Room -> this). */
data class SavedInvoice(
    val number: String,
    val date: String, // YYYY-MM-DD
    val partyName: String,
    val partyGstin: String?,
    val buyerState: String,
    val intraState: Boolean,
    /** invoice | credit-note | debit-note | non-gst | estimate | receipt.
     *  Only invoice + notes enter GST returns; non-gst is a real sale with
     *  zero tax (sales reports only); estimate / receipt never enter any
     *  report (see gstr1Summary / salesSummary filters). */
    val type: String,
    val status: String, // saved | draft
    val fy: String,
    val lines: List<BillLine>,
    val taxablePaise: Long,
    val cgstPaise: Long,
    val sgstPaise: Long,
    val igstPaise: Long,
    val roundedTotalPaise: Long,
)

data class TaxHeads(
    val taxablePaise: Long = 0L,
    val igstPaise: Long = 0L,
    val cgstPaise: Long = 0L,
    val sgstPaise: Long = 0L,
) {
    operator fun plus(o: TaxHeads) = TaxHeads(
        taxablePaise + o.taxablePaise, igstPaise + o.igstPaise,
        cgstPaise + o.cgstPaise, sgstPaise + o.sgstPaise,
    )
}

fun headsOf(inv: SavedInvoice) =
    TaxHeads(inv.taxablePaise, inv.igstPaise, inv.cgstPaise, inv.sgstPaise)

data class B2bRow(val ctin: String, val partyName: String, val invoices: List<SavedInvoice>)
data class B2clRow(val state: String, val invoices: List<SavedInvoice>)
data class B2csRow(
    val state: String, val ratePct: Double,
    val taxablePaise: Long, val igstPaise: Long,
    val cgstPaise: Long, val sgstPaise: Long, val count: Int,
)
data class CdnrRow(
    val ctin: String?, val party: String, val noteNumber: String, val date: String,
    val noteType: String, // C | D
    val taxablePaise: Long, val taxPaise: Long, val roundedTotalPaise: Long,
)

data class Gstr1Summary(
    val b2b: List<B2bRow>, val b2cl: List<B2clRow>, val b2cs: List<B2csRow>,
    val cdnr: List<CdnrRow>, val totals: TaxHeads, val invoiceCount: Int,
)

const val B2CL_THRESHOLD_PAISE: Long = 25_000_000L // Rs 2,50,000

fun gstr1Summary(invoices: List<SavedInvoice>, fy: String? = null, month: String? = null): Gstr1Summary {
    val saved = invoices.filter {
        it.status == "saved" && (fy == null || it.fy == fy) &&
            (month == null || it.date.startsWith(month))
    }
    val b2b = mutableMapOf<String, MutableList<SavedInvoice>>()
    val b2cl = mutableMapOf<String, MutableList<SavedInvoice>>()
    val b2cs = mutableMapOf<String, B2csRow>()
    val cdnr = mutableListOf<CdnrRow>()
    var totals = TaxHeads()
    var count = 0
    for (inv in saved) {
        // Estimates and receipts are not sales; non-GST bills carry no GST
        // — none of them belongs in a GST return, not even in the totals.
        if (inv.type == "estimate" || inv.type == "receipt" || inv.type == "non-gst") continue
        totals += headsOf(inv)
        if (inv.type == "credit-note" || inv.type == "debit-note") {
            cdnr += CdnrRow(
                ctin = inv.partyGstin, party = inv.partyName, noteNumber = inv.number,
                date = inv.date, noteType = if (inv.type == "credit-note") "C" else "D",
                taxablePaise = inv.taxablePaise,
                taxPaise = inv.igstPaise + inv.cgstPaise + inv.sgstPaise,
                roundedTotalPaise = inv.roundedTotalPaise,
            )
            continue
        }
        if (inv.type != "invoice") continue
        count++
        when {
            inv.partyGstin != null ->
                b2b.getOrPut(inv.partyGstin) { mutableListOf() } += inv
            !inv.intraState && inv.roundedTotalPaise > B2CL_THRESHOLD_PAISE ->
                b2cl.getOrPut(inv.buyerState) { mutableListOf() } += inv
            else -> {
                // B2CS: aggregate line-wise by buyer state + line rate.
                for (line in inv.lines) {
                    val calc = calcLine(
                        InvoiceLineInput(line.qty, line.unitPricePaise, line.discountPct, line.taxRatePct, inv.intraState),
                    )
                    val key = "${inv.buyerState}|${line.taxRatePct}"
                    val prev = b2cs[key]
                    b2cs[key] = B2csRow(
                        state = inv.buyerState, ratePct = line.taxRatePct,
                        taxablePaise = (prev?.taxablePaise ?: 0L) + calc.taxablePaise,
                        igstPaise = (prev?.igstPaise ?: 0L) + calc.igstPaise,
                        cgstPaise = (prev?.cgstPaise ?: 0L) + calc.cgstPaise,
                        sgstPaise = (prev?.sgstPaise ?: 0L) + calc.sgstPaise,
                        count = (prev?.count ?: 0) + 1,
                    )
                }
            }
        }
    }
    return Gstr1Summary(
        b2b = b2b.map { (ctin, list) -> B2bRow(ctin, list.first().partyName, list) },
        b2cl = b2cl.map { (state, list) -> B2clRow(state, list) },
        b2cs = b2cs.values.toList(),
        cdnr = cdnr, totals = totals, invoiceCount = count,
    )
}

data class Gstr3bSummary(
    val outward: TaxHeads,
    val itc: TaxHeads,
    /** Net payable per head, never negative. */
    val netPayable: TaxHeads,
)

/** ITC is user-entered (portal 2B). Net payable = max(0, outward - ITC). */
fun gstr3bSummary(
    invoices: List<SavedInvoice>,
    itcInput: TaxHeads = TaxHeads(),
    fy: String? = null,
    month: String? = null,
): Gstr3bSummary {
    val saved = invoices.filter {
        it.status == "saved" && (it.type == "invoice" || it.type == "credit-note" || it.type == "debit-note") &&
            (fy == null || it.fy == fy) && (month == null || it.date.startsWith(month))
    }
    var outward = TaxHeads()
    for (inv in saved) outward += headsOf(inv)
    fun net(o: Long, i: Long) = maxOf(0L, o - i)
    return Gstr3bSummary(
        outward = outward, itc = itcInput,
        netPayable = TaxHeads(
            taxablePaise = 0L,
            igstPaise = net(outward.igstPaise, itcInput.igstPaise),
            cgstPaise = net(outward.cgstPaise, itcInput.cgstPaise),
            sgstPaise = net(outward.sgstPaise, itcInput.sgstPaise),
        ),
    )
}

/** 2A/2B reconciliation: match our invoices against portal 2B rows by number. */
data class PortalRow(val number: String, val gstin: String?, val taxablePaise: Long, val taxPaise: Long)
data class ReconcileResult(
    val matched: List<String>,
    val missingInPortal: List<String>,
    val extraInPortal: List<String>,
    val mismatched: List<String>,
)

fun reconcile2A2B(own: List<SavedInvoice>, portal: List<PortalRow>): ReconcileResult {
    // Only GST documents ever appear on the portal — an estimate, a
    // receipt or a non-GST bill can never match a portal row.
    val ownByNumber = own.filter { it.status == "saved" && isGstDoc(it.type) }.associateBy { it.number }
    val portalByNumber = portal.associateBy { it.number }
    val matched = mutableListOf<String>()
    val missing = mutableListOf<String>()
    val mismatched = mutableListOf<String>()
    for ((num, inv) in ownByNumber) {
        val p = portalByNumber[num]
        when {
            p == null -> missing += num
            p.taxablePaise != inv.taxablePaise -> mismatched += num
            else -> matched += num
        }
    }
    val extra = portalByNumber.keys.filter { it !in ownByNumber }
    return ReconcileResult(matched, missing, extra, mismatched)
}
