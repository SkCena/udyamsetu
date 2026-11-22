// UdyamSetu — JUnit unit tests for CI (testDebugUnitTest).
// Same rules as LogicTestMain (host main) — both must stay green.
package `in`.udyamsetu.app

import `in`.udyamsetu.app.logic.BillLine
import `in`.udyamsetu.app.logic.EmployeeRow
import `in`.udyamsetu.app.logic.LedgerRow
import `in`.udyamsetu.app.logic.PartyRow
import `in`.udyamsetu.app.logic.billTotals
import `in`.udyamsetu.app.logic.billTotalsForType
import `in`.udyamsetu.app.logic.calcExclusive
import `in`.udyamsetu.app.logic.calcInclusive
import `in`.udyamsetu.app.logic.calcPayslip
import `in`.udyamsetu.app.logic.cashFlow
import `in`.udyamsetu.app.logic.decodeBackup
import `in`.udyamsetu.app.logic.decodeLines
import `in`.udyamsetu.app.logic.decryptBackup
import `in`.udyamsetu.app.logic.encodeBackup
import `in`.udyamsetu.app.logic.encodeLines
import `in`.udyamsetu.app.logic.encryptBackup
import `in`.udyamsetu.app.logic.BackupData
import `in`.udyamsetu.app.logic.ProfileBackup
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

    @Test
    fun calculatorExclusiveAddsTax() {
        val r = calcExclusive(10000L, 18.0)
        assertEquals(1800L, r.gstPaise)
        assertEquals(11800L, r.totalPaise)
    }

    @Test
    fun calculatorInclusiveSplitsTax() {
        val r = calcInclusive(11800L, 18.0)
        assertEquals(10000L, r.basePaise)
        assertEquals(1800L, r.gstPaise)
        assertEquals(11800L, r.totalPaise)
    }

    @Test
    fun billTypeNonGstHasZeroTax() {
        val totals = billTotalsForType(listOf(BillLine(2, 10000, 0, 18.0)), true, "non-gst")
        assertEquals(0L, totals.cgstPaise)
        assertEquals(20000L, totals.roundedTotalPaise)
    }

    @Test
    fun billTypeCreditNoteNegatesDebitNoteStaysPositive() {
        val lines = listOf(BillLine(1, 10000, 0, 18.0))
        assertEquals(-11800L, billTotalsForType(lines, true, "credit-note").roundedTotalPaise)
        assertEquals(11800L, billTotalsForType(lines, true, "debit-note").roundedTotalPaise)
    }

    @Test
    fun backupCodecAndEncryptionRoundTrip() {
        val data = BackupData(profile = ProfileBackup(name = "Sharma | Store", nextSeq = 7))
        val encoded = encodeBackup(data)
        assertEquals(data, decodeBackup(encoded))
        val encrypted = encryptBackup(encoded.toByteArray(Charsets.UTF_8), "pass-1234")
        assertEquals(encoded, String(decryptBackup(encrypted, "pass-1234"), Charsets.UTF_8))
        var threw = false
        try {
            decryptBackup(encrypted, "wrong")
        } catch (_: Exception) {
            threw = true
        }
        assertTrue(threw)
    }
}
