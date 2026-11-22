// UdyamSetu — Party / Udhaar ledger, pure logic. Mirrors site/party.js.
// SIGN CONVENTION (canonical — the ledger is the truth, never flip a sign):
//   positive balance = party owes us (receivable), negative = we owe them.
//   LedgerEntry.amountPaise is a SIGNED delta:
//     customer udhaar / credit sale -> balance UP (positive delta)
//     customer payment received    -> balance DOWN (negative delta)
//     supplier purchase on credit  -> balance DOWN (negative delta)
//     supplier payment             -> balance UP towards 0 (positive delta)
// partyBalance / statement only SUM amountPaise; a wrong sign is a caller
// bug, never silently corrected here.
package `in`.udyamsetu.app.logic

data class PartyRow(
    val id: String,
    val name: String,
    val openingBalancePaise: Long = 0L,
)

data class LedgerRow(
    val id: String,
    val partyId: String,
    /** YYYY-MM-DD */
    val date: String,
    val kind: String,
    val amountPaise: Long,
)

data class StatementRow(
    val entry: LedgerRow,
    val runningBalancePaise: Long,
)

data class DueReminder(
    val party: PartyRow,
    val balancePaise: Long,
    val oldestUnpaidDate: String?,
    val daysDue: Int,
)

fun partyBalance(party: PartyRow, entries: List<LedgerRow>): Long =
    party.openingBalancePaise + entries.filter { it.partyId == party.id }.sumOf { it.amountPaise }

fun statement(party: PartyRow, entries: List<LedgerRow>): List<StatementRow> {
    var running = party.openingBalancePaise
    return entries.filter { it.partyId == party.id }
        .sortedWith(compareBy({ it.date }, { it.id }))
        .map { e -> running += e.amountPaise; StatementRow(e, running) }
}

/** Who owes us, as of a date. Only balance > 0 (receivable), biggest first. */
fun dueReminders(
    parties: List<PartyRow>,
    entries: List<LedgerRow>,
    asOfDate: String,
): List<DueReminder> {
    val days = { from: String, to: String ->
        // YYYY-MM-DD -> days since epoch, good enough for a due-age count.
        val p = from.split("-").map { it.toInt() }
        val q = to.split("-").map { it.toInt() }
        val epoch = { y: Int, m: Int, d: Int ->
            val yy = if (m <= 2) y - 1 else y
            val mm = if (m <= 2) m + 12 else m
            (365 * yy + yy / 4 - yy / 100 + yy / 400 + (153 * (mm + 1)) / 5 + d).toLong()
        }
        (epoch(q[0], q[1], q[2]) - epoch(p[0], p[1], p[2])).toInt()
    }
    return parties.mapNotNull { p ->
        val balance = partyBalance(p, entries)
        if (balance <= 0) return@mapNotNull null
        val oldest = entries.filter { it.partyId == p.id && it.amountPaise > 0 }
            .minOfOrNull { it.date }
        val daysDue = if (oldest != null) days(oldest, asOfDate) else 0
        DueReminder(p, balance, oldest, daysDue)
    }.sortedByDescending { it.balancePaise }
}

/** WhatsApp reminder text for one party (Site parity). */
fun reminderText(partyName: String, balancePaise: Long, shopName: String): String {
    val rupees = "${balancePaise / 100}.${(balancePaise % 100).toString().padStart(2, '0')}"
    return "Namaste $partyName, aapka udhaar ₹$rupees baki hai — $shopName"
}
