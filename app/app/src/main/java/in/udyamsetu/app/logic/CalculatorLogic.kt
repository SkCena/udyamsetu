// UdyamSetu — GST calculator logic (pure Kotlin, no Android APIs).
// All money in integer paise. Two directions:
//   exclusive: amount (without GST) + rate -> GST amount + total.
//   inclusive: total (GST included) + rate -> amount without GST + GST.
// Rounding is half-up to the paise (same rule as the shared GST core).
package `in`.udyamsetu.app.logic

import kotlin.math.roundToLong

data class GstCalcResult(
    /** Amount without GST, paise. */
    val basePaise: Long,
    /** GST amount, paise. */
    val gstPaise: Long,
    /** Total including GST, paise. */
    val totalPaise: Long,
)

/** GST rates the calculator offers (the main slabs). */
val CALC_RATES: List<Double> = listOf(0.0, 5.0, 12.0, 18.0, 28.0)

private fun checkCalcInput(amountPaise: Long, ratePct: Double) {
    require(amountPaise >= 0) { "amount must be non-negative" }
    require(ratePct in 0.0..28.0) { "GST rate must be 0..28" }
}

/**
 * Exclusive: the amount has NO GST yet. GST = amount * rate / 100,
 * rounded half-up; total = amount + GST.
 */
fun calcExclusive(amountPaise: Long, ratePct: Double): GstCalcResult {
    checkCalcInput(amountPaise, ratePct)
    val gst = ((amountPaise.toDouble() * ratePct) / 100.0).roundToLong()
    return GstCalcResult(amountPaise, gst, amountPaise + gst)
}

/**
 * Inclusive: the total ALREADY includes GST. Base = total * 100 /
 * (100 + rate), rounded half-up; GST = total - base, so base + GST
 * always equals the total exactly.
 */
fun calcInclusive(totalPaise: Long, ratePct: Double): GstCalcResult {
    checkCalcInput(totalPaise, ratePct)
    val base = ((totalPaise.toDouble() * 100.0) / (100.0 + ratePct)).roundToLong()
    return GstCalcResult(base, totalPaise - base, totalPaise)
}

/** Reverse calc: how much GST sits inside a GST-inclusive total. */
fun extractGstFromTotal(totalPaise: Long, ratePct: Double): GstCalcResult =
    calcInclusive(totalPaise, ratePct)
