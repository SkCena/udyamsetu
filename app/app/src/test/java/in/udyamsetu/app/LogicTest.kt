// UdyamSetu — JUnit unit tests for CI (testDebugUnitTest).
// Same rules as LogicTestMain (host main) — both must stay green.
package `in`.udyamsetu.app

import `in`.udyamsetu.app.logic.BillLine
import `in`.udyamsetu.app.logic.EmployeeRow
import `in`.udyamsetu.app.logic.LedgerRow
import `in`.udyamsetu.app.logic.PartyRow
import `in`.udyamsetu.app.logic.billTotals
import `in`.udyamsetu.app.logic.calcPayslip
import `in`.udyamsetu.app.logic.cashFlow
import `in`.udyamsetu.app.logic.decodeLines
import `in`.udyamsetu.app.logic.encodeLines
import `in`.udyamsetu.app.logic.partyBalance
import `in`.udyamsetu.app.logic.stockQty
import `in`.udyamsetu.app.logic.MovementRow
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class LogicTest {
    @Test
    fun codecRoundTrip() {
        val lines = listOf(BillLine(2, 10000, 0, 18.0, "1001", "Rice | Basmati"))
        assertEquals(lines, decodeLines(encodeLines(lines)))
    }

    @Test
    fun billTotalsMatchCore() {
        val totals = billTotals(listOf(BillLine(2, 10000, 0, 18.0)), true)
        assertEquals(20000L, totals.taxablePaise)
        assertEquals(23600L, totals.roundedTotalPaise)
    }

    @Test
    fun partyBalanceSignConvention() {
        val party = PartyRow("p1", "Ramesh", 1000L)
        val entries = listOf(
            LedgerRow("e1", "p1", "2026-11-01", "credit-sale", 5000L),
            LedgerRow("e2", "p1", "2026-11-02", "payment", -2000L),
        )
        assertEquals(4000L, partyBalance(party, entries))
    }

    @Test
    fun stockQtyInMinusOut() {
        val moves = listOf(
            MovementRow("m1", "i1", "", "2026-11-01", "in", 20),
            MovementRow("m2", "i1", "", "2026-11-02", "out", 8),
        )
        assertEquals(12, stockQty("i1", moves))
    }

    @Test
    fun payslipProRata() {
        val slip = calcPayslip(EmployeeRow("e1", "Sita", 3000000L, pfPct = 12.0), 26, 30, "2026-11")
        assertEquals(2600000L, slip.grossPaise)
        assertEquals(312000L, slip.pfPaise)
    }

    @Test
    fun cashFlowCountsOnlyRealCash() {
        val ledger = listOf(
            LedgerRow("l1", "p1", "2026-11-01", "payment", -2000L),
            LedgerRow("l2", "p1", "2026-11-02", "payment", 3000L),
            LedgerRow("l3", "p1", "2026-11-03", "credit-sale", 9000L),
        )
        val flow = cashFlow(ledger)
        assertEquals(2000L, flow.cashInPaise)
        assertEquals(3000L, flow.cashOutPaise)
        assertTrue(flow.netPaise == -1000L)
    }
}
