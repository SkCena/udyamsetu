// UdyamSetu — Repository: the single place screens talk to Room.
// It converts Room entities to the pure-logic row types (logic/*) and back,
// and owns the cross-table writes the Site does in one place:
// saving a bill also writes the party ledger entry (credit sale) and the
// stock movements (HSN/name match). Screens never touch DAOs directly.
package `in`.udyamsetu.app.data

import `in`.udyamsetu.app.core.calcInvoice
import `in`.udyamsetu.app.core.invoiceNumber
import `in`.udyamsetu.app.logic.BillLine
import `in`.udyamsetu.app.logic.LedgerRow
import `in`.udyamsetu.app.logic.MovementRow
import `in`.udyamsetu.app.logic.PartyRow
import `in`.udyamsetu.app.logic.SavedInvoice
import `in`.udyamsetu.app.logic.applyInvoiceToStock
import `in`.udyamsetu.app.logic.decodeLines
import `in`.udyamsetu.app.logic.encodeLines
import `in`.udyamsetu.app.logic.negateTotals
import `in`.udyamsetu.app.logic.toInput
import kotlinx.coroutines.flow.Flow
import java.time.LocalDate
import java.time.format.DateTimeFormatter

class Repository(private val db: AppDatabase) {
    private val profileDao get() = db.profileDao()
    private val partyDao get() = db.partyDao()
    private val itemDao get() = db.itemDao()
    private val invoiceDao get() = db.invoiceDao()
    private val payrollDao get() = db.payrollDao()

    fun todayIso(): String = LocalDate.now().format(DateTimeFormatter.ISO_DATE)

    fun currentFy(): String {
        val now = LocalDate.now()
        val startYear = if (now.monthValue >= 4) now.year else now.year - 1
        return "$startYear-${(startYear + 1).toString().takeLast(2)}"
    }

    // --- Profile / Setup -------------------------------------------------
    fun observeProfile(): Flow<ProfileEntity?> = profileDao.observe()
    suspend fun getProfile(): ProfileEntity = profileDao.get() ?: ProfileEntity()
    suspend fun saveProfile(p: ProfileEntity) = profileDao.save(p)

    // --- Parties / Udhaar -------------------------------------------------
    fun observeParties(): Flow<List<PartyEntity>> = partyDao.observeAll()
    suspend fun saveParty(p: PartyEntity) = partyDao.save(p)
    suspend fun saveLedgerEntry(e: LedgerEntryEntity) = partyDao.saveEntry(e)
    fun observeLedger(partyId: String): Flow<List<LedgerEntryEntity>> =
        partyDao.observeLedger(partyId)

    suspend fun allPartyRows(): List<PartyRow> =
        partyDao.allParties().map { PartyRow(it.id, it.name, it.openingBalancePaise) }

    suspend fun allLedgerRows(): List<LedgerRow> =
        partyDao.allLedger().map { LedgerRow(it.id, it.partyId, it.date, it.kind, it.amountPaise) }

    // --- Items / Stock ----------------------------------------------------
    fun observeItems(): Flow<List<ItemEntity>> = itemDao.observeAll()
    suspend fun saveItem(item: ItemEntity) = itemDao.save(item)
    suspend fun saveMovement(m: MovementEntity) = itemDao.saveMovement(m)
    suspend fun saveBatch(b: BatchEntity) = itemDao.saveBatch(b)
    suspend fun movementsFor(itemId: String): List<MovementRow> =
        itemDao.movements(itemId).map { MovementRow(it.id, it.itemId, it.batchId, it.date, it.kind, it.qty, it.godown) }

    suspend fun itemRows(): List<`in`.udyamsetu.app.logic.ItemRow> =
        itemDao.allItems().map { `in`.udyamsetu.app.logic.ItemRow(it.id, it.name, it.hsn, it.reorderLevel) }

    suspend fun allMovements(): List<MovementRow> =
        itemDao.allMovements().map { MovementRow(it.id, it.itemId, it.batchId, it.date, it.kind, it.qty, it.godown) }

    suspend fun allBatches() = itemDao.allBatches()

    // --- Invoices / Billing ------------------------------------------------
    fun observeInvoices(): Flow<List<InvoiceEntity>> = invoiceDao.observeAll()

    suspend fun savedInvoices(): List<SavedInvoice> =
        invoiceDao.saved().map { it.toSavedInvoice() }

    /**
     * Save a bill: totals from the shared core, invoice number from the
     * profile series (only on final save — drafts never consume a number),
     * ledger entry for a credit sale, stock movements for matched items.
     * Returns the saved invoice number.
     */
    suspend fun saveInvoice(
        profile: ProfileEntity,
        party: PartyEntity?,
        lines: List<BillLine>,
        buyerState: String,
        date: String,
        type: String = "invoice",
    ): String {
        val intraState = buyerState == profile.sellerState
        val calc = calcInvoice(lines.map { it.toInput(intraState) })
        val finalCalc = if (type == "credit-note" || type == "debit-note") negateTotals(calc) else calc
        val number = invoiceNumber(profile.invoicePrefix, currentFy(), profile.nextSeq)
        val id = "inv-$number"
        val entity = InvoiceEntity(
            id = id, number = number, date = date,
            partyId = party?.id ?: "", partyName = party?.name ?: "",
            partyGstin = party?.gstin, buyerState = buyerState,
            intraState = intraState, type = type, status = "saved",
            fy = currentFy(), linesJson = encodeLines(lines),
            taxablePaise = finalCalc.taxablePaise, cgstPaise = finalCalc.cgstPaise,
            sgstPaise = finalCalc.sgstPaise, igstPaise = finalCalc.igstPaise,
            totalPaise = finalCalc.totalPaise,
            roundedTotalPaise = finalCalc.roundedTotalPaise,
            roundOffPaise = finalCalc.roundOffPaise,
        )
        invoiceDao.save(entity)
        // Advance the series only on final save.
        profileDao.save(profile.copy(nextSeq = profile.nextSeq + 1))
        // Credit sale -> party owes us (positive delta). Notes are signed
        // by their negated totals, so the same rule holds.
        if (party != null && type == "invoice") {
            partyDao.saveEntry(
                LedgerEntryEntity(
                    id = "led-$id", partyId = party.id, date = date,
                    kind = "credit-sale", amountPaise = finalCalc.roundedTotalPaise,
                    note = number,
                ),
            )
        }
        // Stock: take matched items out.
        val items = itemDao.allItems()
        val movements = applyInvoiceToStock(
            lines,
            items.map { `in`.udyamsetu.app.logic.ItemRow(it.id, it.name, it.hsn, it.reorderLevel) },
            number, date,
        )
        for (m in movements) {
            itemDao.saveMovement(
                MovementEntity(id = m.id, itemId = m.itemId, date = m.date, kind = m.kind, qty = m.qty, ref = m.ref),
            )
        }
        return number
    }

    /** WhatsApp share text for a saved invoice (Site parity). */
    fun whatsappText(invoice: InvoiceEntity, profile: ProfileEntity): String {
        val total = "${invoice.roundedTotalPaise / 100}.${(invoice.roundedTotalPaise % 100).toString().padStart(2, '0')}"
        return "Bill ${invoice.number} — ${profile.name}\n" +
            "Party: ${invoice.partyName}\n" +
            "Total: ₹$total (incl. GST)\n" +
            (if (profile.upiId.isNotEmpty()) "Pay via UPI: ${profile.upiId}\n" else "") +
            "— sent from UdyamSetu (free)"
    }

    // --- Payroll / expenses ------------------------------------------------
    fun observeEmployees(): Flow<List<EmployeeEntity>> = payrollDao.observeEmployees()
    suspend fun saveEmployee(e: EmployeeEntity) = payrollDao.saveEmployee(e)
    suspend fun attendance(employeeId: String, month: String) = payrollDao.attendance(employeeId, month)
    suspend fun saveAttendance(a: AttendanceEntity) = payrollDao.saveAttendance(a)
    suspend fun advances(employeeId: String, month: String) = payrollDao.advances(employeeId, month)
    suspend fun saveAdvance(a: AdvanceEntity) = payrollDao.saveAdvance(a)
    fun observeExpenses(): Flow<List<ExpenseEntity>> = payrollDao.observeExpenses()
    suspend fun saveExpense(e: ExpenseEntity) = payrollDao.saveExpense(e)
}

fun InvoiceEntity.toSavedInvoice(): SavedInvoice = SavedInvoice(
    number = number, date = date, partyName = partyName, partyGstin = partyGstin,
    buyerState = buyerState, intraState = intraState, type = type, status = status,
    fy = fy, lines = decodeLines(linesJson),
    taxablePaise = taxablePaise, cgstPaise = cgstPaise, sgstPaise = sgstPaise,
    igstPaise = igstPaise, roundedTotalPaise = roundedTotalPaise,
)
