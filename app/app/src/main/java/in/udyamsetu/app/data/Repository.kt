// UdyamSetu — Repository: the single place screens talk to Room.
// It converts Room entities to the pure-logic row types (logic/*) and back,
// and owns the cross-table writes the Site does in one place:
// saving a bill also writes the party ledger entry (credit sale) and the
// stock movements (HSN/name match). Screens never touch DAOs directly.
package `in`.udyamsetu.app.data

import `in`.udyamsetu.app.core.invoiceNumber
import `in`.udyamsetu.app.logic.AdvanceBackup
import `in`.udyamsetu.app.logic.AttendanceBackup
import `in`.udyamsetu.app.logic.BackupData
import `in`.udyamsetu.app.logic.BatchBackup
import `in`.udyamsetu.app.logic.BillLine
import `in`.udyamsetu.app.logic.DOC_ESTIMATE
import `in`.udyamsetu.app.logic.DOC_RECEIPT
import `in`.udyamsetu.app.logic.EmployeeBackup
import `in`.udyamsetu.app.logic.ExpenseBackup
import `in`.udyamsetu.app.logic.InvoiceBackup
import `in`.udyamsetu.app.logic.ItemBackup
import `in`.udyamsetu.app.logic.LedgerBackup
import `in`.udyamsetu.app.logic.LedgerRow
import `in`.udyamsetu.app.logic.MovementBackup
import `in`.udyamsetu.app.logic.MovementRow
import `in`.udyamsetu.app.logic.PartyBackup
import `in`.udyamsetu.app.logic.PartyRow
import `in`.udyamsetu.app.logic.ProfileBackup
import `in`.udyamsetu.app.logic.SavedInvoice
import `in`.udyamsetu.app.logic.applyInvoiceToStock
import `in`.udyamsetu.app.logic.billTotalsForType
import `in`.udyamsetu.app.logic.decodeLines
import `in`.udyamsetu.app.logic.docNumberPrefix
import `in`.udyamsetu.app.logic.encodeLines
import `in`.udyamsetu.app.logic.isSaleDoc
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
     * Save a bill: totals from the shared core, per document type
     * (logic/BillTypes.kt — non-GST / receipt force tax to zero, a credit
     * note negates, a debit note stays positive). Invoice number from the
     * profile series (only on final save — drafts never consume a number);
     * estimates and receipts use their own EST / RCP series. Ledger entry
     * for a credit sale (GST or non-GST bill). Stock movements for matched
     * items — only for real sales, never for an estimate / receipt.
     * Returns the saved document number.
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
        val finalCalc = billTotalsForType(lines, intraState, type)
        val number = invoiceNumber(docNumberPrefix(type, profile.invoicePrefix), currentFy(), profile.nextSeq)
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
        // by their negated totals, so the same rule holds. Estimates and
        // receipts are not sales — no ledger entry.
        if (party != null && isSaleDoc(type)) {
            partyDao.saveEntry(
                LedgerEntryEntity(
                    id = "led-$id", partyId = party.id, date = date,
                    kind = "credit-sale", amountPaise = finalCalc.roundedTotalPaise,
                    note = number,
                ),
            )
        }
        // Stock: take matched items out — only for real sales. An estimate
        // or a receipt must never change stock (same rule as before for
        // notes: their previous stock behaviour is left untouched).
        if (type != DOC_ESTIMATE && type != DOC_RECEIPT) {
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

    // --- Drive backup (snapshot / merge-restore) --------------------------
    /** Read the whole database into one BackupData (Drive upload input). */
    suspend fun backupSnapshot(): BackupData {
        val p = getProfile()
        return BackupData(
            profile = ProfileBackup(
                name = p.name, gstin = p.gstin, phone = p.phone,
                address = p.address, logoDataUrl = p.logoDataUrl,
                upiId = p.upiId, invoicePrefix = p.invoicePrefix,
                nextSeq = p.nextSeq, sellerState = p.sellerState,
                shopType = p.shopType, sellsWhat = p.sellsWhat,
            ),
            parties = partyDao.allParties().map {
                PartyBackup(it.id, it.name, it.phone, it.gstin, it.state, it.kind, it.openingBalancePaise)
            },
            ledger = partyDao.allLedger().map {
                LedgerBackup(it.id, it.partyId, it.date, it.kind, it.amountPaise, it.note)
            },
            items = itemDao.allItems().map {
                ItemBackup(it.id, it.name, it.hsn, it.unit, it.taxRatePct, it.purchasePricePaise, it.salePricePaise, it.reorderLevel, it.godown)
            },
            batches = itemDao.allBatches().map {
                BatchBackup(it.id, it.itemId, it.batchNo, it.expiry, it.qty)
            },
            movements = itemDao.allMovements().map {
                MovementBackup(it.id, it.itemId, it.batchId, it.date, it.kind, it.qty, it.godown, it.ref)
            },
            invoices = invoiceDao.all().map {
                InvoiceBackup(
                    id = it.id, number = it.number, date = it.date,
                    partyId = it.partyId, partyName = it.partyName,
                    partyGstin = it.partyGstin, buyerState = it.buyerState,
                    intraState = it.intraState, type = it.type, status = it.status,
                    fy = it.fy, linesEncoded = it.linesJson,
                    taxablePaise = it.taxablePaise, cgstPaise = it.cgstPaise,
                    sgstPaise = it.sgstPaise, igstPaise = it.igstPaise,
                    totalPaise = it.totalPaise,
                    roundedTotalPaise = it.roundedTotalPaise,
                    roundOffPaise = it.roundOffPaise,
                )
            },
            employees = payrollDao.allEmployees().map {
                EmployeeBackup(it.id, it.name, it.monthlySalaryPaise, it.pfPct, it.esiPct, it.ptPaise, it.tdsPaise)
            },
            attendance = payrollDao.allAttendance().map {
                AttendanceBackup(it.id, it.employeeId, it.month, it.presentDays, it.totalDays)
            },
            advances = payrollDao.allAdvances().map {
                AdvanceBackup(it.id, it.employeeId, it.month, it.amountPaise)
            },
            expenses = payrollDao.allExpenses().map {
                ExpenseBackup(it.id, it.date, it.category, it.amountPaise, it.note)
            },
        )
    }

    /**
     * Merge-restore a backup: every row is inserted with REPLACE, so
     * backup rows overwrite same-id rows and anything not in the backup
     * stays untouched. A restore never deletes.
     */
    suspend fun restoreBackupData(data: BackupData) {
        val p = data.profile
        profileDao.save(
            ProfileEntity(
                name = p.name, gstin = p.gstin, phone = p.phone,
                address = p.address, logoDataUrl = p.logoDataUrl,
                upiId = p.upiId, invoicePrefix = p.invoicePrefix,
                nextSeq = p.nextSeq, sellerState = p.sellerState,
                shopType = p.shopType, sellsWhat = p.sellsWhat,
            ),
        )
        for (row in data.parties) partyDao.save(PartyEntity(row.id, row.name, row.phone, row.gstin, row.state, row.kind, row.openingBalancePaise))
        for (row in data.ledger) partyDao.saveEntry(LedgerEntryEntity(row.id, row.partyId, row.date, row.kind, row.amountPaise, row.note))
        for (row in data.items) itemDao.save(ItemEntity(row.id, row.name, row.hsn, row.unit, row.taxRatePct, row.purchasePricePaise, row.salePricePaise, row.reorderLevel, row.godown))
        for (row in data.batches) itemDao.saveBatch(BatchEntity(row.id, row.itemId, row.batchNo, row.expiry, row.qty))
        for (row in data.movements) itemDao.saveMovement(MovementEntity(row.id, row.itemId, row.batchId, row.date, row.kind, row.qty, row.godown, row.ref))
        for (row in data.invoices) invoiceDao.save(
            InvoiceEntity(
                id = row.id, number = row.number, date = row.date,
                partyId = row.partyId, partyName = row.partyName,
                partyGstin = row.partyGstin, buyerState = row.buyerState,
                intraState = row.intraState, type = row.type, status = row.status,
                fy = row.fy, linesJson = row.linesEncoded,
                taxablePaise = row.taxablePaise, cgstPaise = row.cgstPaise,
                sgstPaise = row.sgstPaise, igstPaise = row.igstPaise,
                totalPaise = row.totalPaise,
                roundedTotalPaise = row.roundedTotalPaise,
                roundOffPaise = row.roundOffPaise,
            ),
        )
        for (row in data.employees) payrollDao.saveEmployee(EmployeeEntity(row.id, row.name, row.monthlySalaryPaise, row.pfPct, row.esiPct, row.ptPaise, row.tdsPaise))
        for (row in data.attendance) payrollDao.saveAttendance(AttendanceEntity(row.id, row.employeeId, row.month, row.presentDays, row.totalDays))
        for (row in data.advances) payrollDao.saveAdvance(AdvanceEntity(row.id, row.employeeId, row.month, row.amountPaise))
        for (row in data.expenses) payrollDao.saveExpense(ExpenseEntity(row.id, row.date, row.category, row.amountPaise, row.note))
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
