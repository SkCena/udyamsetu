// UdyamSetu — Basic calculator logic (pure Kotlin, no Android APIs).
// Standalone keypad calculator, NOT the GST calculator: + - × ÷, %,
// backspace, clear. Mirrors site/basiccalc.js key for key, so the two
// behave the same. Display formatting avoids 0.1+0.2 artefacts.
package `in`.udyamsetu.app.logic

import java.math.BigDecimal
import java.math.MathContext
import java.util.Locale
import kotlin.math.abs

data class BasicCalcState(
    /** Number being typed / the result, as shown. */
    val entry: String = "0",
    /** Left operand of a pending operation, or null. */
    val stored: Double? = null,
    /** Pending operator ('+', '-', '×', '÷'), or null. */
    val op: Char? = null,
    /** True when the next digit should start a new entry. */
    val fresh: Boolean = true,
    /** True after divide-by-zero; any digit key clears it. */
    val error: Boolean = false,
    /** One line shown above the display ("12 + 3 ="). */
    val history: String = "",
)

/** Format a number for the display: no 0.1+0.2 artefacts, no long tails. */
fun basicCalcFormat(n: Double): String {
    if (!n.isFinite() || n.isNaN()) return "Error"
    if (n == 0.0) return "0"
    val a = abs(n)
    if (a >= 1e12 || a < 1e-9) {
        return BigDecimal(n).round(MathContext(7)).toPlainString()
    }
    return "%.10f".format(Locale.US, n).trimEnd('0').trimEnd('.')
}

private fun basicCalcCompute(a: Double, op: Char, b: Double): Double = when (op) {
    '+' -> a + b
    '-' -> a - b
    '×' -> a * b
    '÷' -> if (b == 0.0) Double.NaN else a / b
    else -> b
}

/**
 * One key press. Keys: '0'..'9', '00', '.', '+', '-', '×', '÷', '%',
 * '=', 'C' (clear), 'back' (backspace).
 */
fun basicCalcPress(state: BasicCalcState, key: String): BasicCalcState {
    if (key == "C") return BasicCalcState()
    if (state.error) {
        if (key == "back" || key == "=" || key == "%" || key in listOf("+", "-", "×", "÷")) return state
        return basicCalcPress(BasicCalcState(), key)
    }
    var s = state
    if (key.length == 1 && key[0].isDigit() || key == "00" || key == ".") {
        if (s.fresh) {
            s = s.copy(
                entry = when {
                    key == "." -> "0."
                    key == "00" -> "0"
                    else -> key
                },
                fresh = false, history = "",
            )
        } else if (key == ".") {
            if (!s.entry.contains('.')) s = s.copy(entry = s.entry + ".")
        } else if (key == "00") {
            if (s.entry != "0" && s.entry.count { it.isDigit() } < 12) s = s.copy(entry = s.entry + "00")
        } else {
            if (s.entry == "0") {
                s = s.copy(entry = key)
            } else if (s.entry.count { it.isDigit() } < 12) {
                s = s.copy(entry = s.entry + key)
            }
        }
        return s
    }
    if (key == "back") {
        if (s.fresh) return s
        val cut = if (s.entry.length > 1) s.entry.dropLast(1) else "0"
        return s.copy(entry = if (cut == "-" || cut.isEmpty()) "0" else cut)
    }
    if (key == "%") {
        val v = s.entry.toDoubleOrNull()?.div(100.0) ?: return s
        return s.copy(entry = basicCalcFormat(v), fresh = true)
    }
    if (key in listOf("+", "-", "×", "÷")) {
        val op = key[0]
        val current = s.entry.toDoubleOrNull() ?: return s
        // Locals, not s.op/s.stored: smart cast cannot track a var's property.
        val pendingOp = s.op
        val pendingStored = s.stored
        if (pendingOp != null && pendingStored != null && !s.fresh) {
            val result = basicCalcCompute(pendingStored, pendingOp, current)
            if (!result.isFinite() || result.isNaN()) {
                return s.copy(entry = "Error", error = true, stored = null, op = null, fresh = true, history = "")
            }
            s = s.copy(stored = result, entry = basicCalcFormat(result))
        } else {
            s = s.copy(stored = current)
        }
        return s.copy(op = op, fresh = true, history = "${basicCalcFormat(s.stored!!)} $op")
    }
    if (key == "=") {
        // Locals, not s.stored/s.op: smart cast cannot track a var's property.
        val op = s.op ?: return s
        val stored = s.stored ?: return s
        val current = s.entry.toDoubleOrNull() ?: return s
        val result = basicCalcCompute(stored, op, current)
        if (!result.isFinite() || result.isNaN()) {
            return s.copy(entry = "Error", error = true, stored = null, op = null, fresh = true, history = "")
        }
        return s.copy(
            history = "${basicCalcFormat(stored)} $op ${basicCalcFormat(current)} =",
            entry = basicCalcFormat(result), stored = null, op = null, fresh = true,
        )
    }
    return s
}
