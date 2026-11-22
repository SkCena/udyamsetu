// UdyamSetu — Reports pure logic. Mirrors site/reports.js.
// SIGN RULES (Site parity — the ledger is the truth):
//   * Cash flow counts only REAL cash: ledger payment entries.
//     Customer payment received (negative delta) = cash IN.
//     Supplier payment made (positive delta) = cash OUT.
//     Credit sales / credit purchases are NOT cash — they move the ledger,
//     not the cash box. Invoices alone never count as cash.
//   * purchaseSummary returns the purchase value as a POSITIVE cost.
package `in`.udyamsetu.app.logic

data class Summary(val count: Int, val taxablePaise: Long, val totalPaise: Long)

fun salesSummary(invoices: List<SavedInvoice>, from: String? = null, to: String? = null): Summary {
    val list = invoices.filter {
        it.status == "saved" && it.type == "invoice" &&
            (from == null || it.date >= from) && (to == null || it.date <= to)
    }
    return Summary(list.size, list.sumOf { it.taxablePaise }, list.sumOf { it.roundedTotalPaise })
}

fun purchaseSummary(entries: List<LedgerRow>, from: String? = null, to: String? = null): Summary {
    // Supplier credit purchases are negative deltas; report as positive cost.
    val list = entries.filter {
        it.kind == "purchase" &&
            (from == null || it.date >= from) && (to == null || it.date <= to)
    }
    return Summary(list.size, 0L, -list.sumOf { it.amountPaise })
}

data class CashFlow(val cashInPaise: Long, val cashOutPaise: Long) {
    val netPaise: Long get() = cashInPaise - cashOutPaise
}

fun cashFlow(entries: List<LedgerRow>, from: String? = null, to: String? = null): CashFlow {
    var cashIn = 0L
    var cashOut = 0L
    for (e in entries) {
        if (e.kind != "payment") continue
        if (from != null && e.date < from) continue
        if (to != null && e.date > to) continue
        if (e.amountPaise < 0) cashIn += -e.amountPaise else cashOut += e.amountPaise
    }
    return CashFlow(cashIn, cashOut)
}

data class ProfitLoss(
    val salesPaise: Long,
    val purchaseCostPaise: Long,
    val expensePaise: Long,
    val grossProfitPaise: Long,
)

fun profitLoss(
    invoices: List<SavedInvoice>,
    entries: List<LedgerRow>,
    expensePaise: Long,
): ProfitLoss {
    val sales = salesSummary(invoices)
    val purchases = purchaseSummary(entries)
    val gross = sales.totalPaise - purchases.totalPaise
    return ProfitLoss(sales.totalPaise, purchases.totalPaise, expensePaise, gross - expensePaise)
}

/** CSV cell escaping (quotes, commas, newlines). */
fun csvCell(value: String): String {
    val needsQuotes = value.contains(',') || value.contains('"') || value.contains('\n')
    val escaped = value.replace("\"", "\"\"")
    return if (needsQuotes) "\"$escaped\"" else escaped
}

/** Tally-compatible CSV (BETA — CA pilot pending, NOT "CA-ready"). */
fun tallyCsv(invoices: List<SavedInvoice>): String {
    val sb = StringBuilder()
    sb.append("Date,Voucher No,Party,Type,Taxable,CGST,SGST,IGST,Total\n")
    for (inv in invoices.filter { it.status == "saved" }.sortedBy { it.date }) {
        sb.append(
            listOf(
                inv.date, inv.number, inv.partyName, inv.type,
                (inv.taxablePaise / 100.0).toString(),
                (inv.cgstPaise / 100.0).toString(),
                (inv.sgstPaise / 100.0).toString(),
                (inv.igstPaise / 100.0).toString(),
                (inv.roundedTotalPaise / 100.0).toString(),
            ).joinToString(",") { csvCell(it) },
        ).append("\n")
    }
    return sb.toString()
}
