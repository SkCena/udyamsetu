// UdyamSetu — Inventory pure logic. Mirrors site/inventory.js.
// stockQty = sum(in) - sum(out). Saving a bill auto-decrements stock for
// items matched by HSN first, then exact name (case-insensitive).
package `in`.udyamsetu.app.logic

data class ItemRow(
    val id: String,
    val name: String,
    val hsn: String = "",
    val reorderLevel: Int = 0,
)

data class BatchRow(
    val id: String,
    val itemId: String,
    val batchNo: String,
    val expiry: String = "", // YYYY-MM-DD, "" = no expiry
    val qty: Int = 0,
)

data class MovementRow(
    val id: String,
    val itemId: String,
    val batchId: String = "",
    val date: String,
    val kind: String, // in | out
    val qty: Int,
    val godown: String = "Main",
    /** invoice number / note that caused this movement */
    val ref: String = "",
)

fun stockQty(itemId: String, movements: List<MovementRow>): Int =
    movements.filter { it.itemId == itemId }
        .sumOf { if (it.kind == "in") it.qty else -it.qty }

fun stockByGodown(itemId: String, movements: List<MovementRow>): Map<String, Int> =
    movements.filter { it.itemId == itemId }
        .groupBy { it.godown }
        .mapValues { (_, ms) -> ms.sumOf { if (it.kind == "in") it.qty else -it.qty } }

fun batchQty(batchId: String, movements: List<MovementRow>): Int =
    movements.filter { it.batchId == batchId }
        .sumOf { if (it.kind == "in") it.qty else -it.qty }

fun lowStock(items: List<ItemRow>, movements: List<MovementRow>): List<ItemRow> =
    items.filter { stockQty(it.id, movements) <= it.reorderLevel }

/** Batches expiring within [withinDays] of [asOfDate] (YYYY-MM-DD). */
fun expiringBatches(
    batches: List<BatchRow>,
    withinDays: Int,
    asOfDate: String,
): List<BatchRow> {
    fun toDays(s: String): Int {
        val p = s.split("-").map { it.toInt() }
        val y = if (p[1] <= 2) p[0] - 1 else p[0]
        val m = if (p[1] <= 2) p[1] + 12 else p[1]
        return 365 * y + y / 4 - y / 100 + y / 400 + (153 * (m + 1)) / 5 + p[2]
    }
    val asOf = toDays(asOfDate)
    return batches.filter {
        it.expiry.isNotEmpty() && toDays(it.expiry) in asOf..(asOf + withinDays)
    }.sortedBy { it.expiry }
}

/**
 * Movements to record when a bill is saved: for each bill line, find the
 * item by HSN first, then by exact name (case-insensitive), and take the
 * line qty out of stock. Lines with no matching item produce no movement
 * (the bill still saves — stock only tracks known items).
 */
fun applyInvoiceToStock(
    lines: List<BillLine>,
    items: List<ItemRow>,
    invoiceNumber: String,
    date: String,
): List<MovementRow> {
    val out = mutableListOf<MovementRow>()
    for ((index, line) in lines.withIndex()) {
        val item = if (line.hsn.isNotEmpty()) items.firstOrNull { it.hsn == line.hsn }
            ?: items.firstOrNull { it.name.equals(line.name, ignoreCase = true) }
        else items.firstOrNull { it.name.equals(line.name, ignoreCase = true) }
        if (item != null) {
            out += MovementRow(
                id = "mv-$invoiceNumber-$index",
                itemId = item.id,
                date = date,
                kind = "out",
                qty = line.qty,
                ref = invoiceNumber,
            )
        }
    }
    return out
}
