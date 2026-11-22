// UdyamSetu — Room entities. Mirrors the Site store collections
// (site/store.js: profile, invoices, parties, ledger, items, batches,
// movements, employees, attendance, advances, expenses) so Site <-> App
// data means the same thing. All money in integer paise, never float rupees.
package `in`.udyamsetu.app.data

import androidx.room.Entity
import androidx.room.PrimaryKey

/** Business profile — one row, id always 1. Matches site DEFAULT_PROFILE. */
@Entity(tableName = "profile")
data class ProfileEntity(
    @PrimaryKey val id: Int = 1,
    val name: String = "",
    val gstin: String? = null,
    val phone: String = "",
    val address: String = "",
    val logoDataUrl: String? = null,
    val upiId: String = "",
    val invoicePrefix: String = "INV",
    val nextSeq: Int = 1,
    /** Seller state code, e.g. "21" (Odisha). */
    val sellerState: String = "21",
    /** FTU answers, saved as plain text: shop type / GST yes-no / what you sell. */
    val shopType: String = "",
    val sellsWhat: String = "",
)

/** Party (customer / supplier). Sign convention — see logic/PartyLogic.kt:
 *  positive balance = party owes us (receivable), negative = we owe them. */
@Entity(tableName = "parties")
data class PartyEntity(
    @PrimaryKey val id: String,
    val name: String,
    val phone: String = "",
    val gstin: String? = null,
    val state: String = "",
    val kind: String = "customer", // customer | supplier
    val openingBalancePaise: Long = 0L,
)

/** One ledger entry — signed delta to the party balance. */
@Entity(tableName = "ledger")
data class LedgerEntryEntity(
    @PrimaryKey val id: String,
    val partyId: String,
    /** YYYY-MM-DD */
    val date: String,
    /** udhaar | payment | credit-sale | purchase | opening */
    val kind: String,
    val amountPaise: Long,
    val note: String = "",
)

/** Stock item. */
@Entity(tableName = "items")
data class ItemEntity(
    @PrimaryKey val id: String,
    val name: String,
    val hsn: String = "",
    val unit: String = "pcs",
    val taxRatePct: Double = 0.0,
    val purchasePricePaise: Long = 0L,
    val salePricePaise: Long = 0L,
    val reorderLevel: Int = 0,
    val godown: String = "Main",
)

/** Batch (batch no + expiry) for an item. */
@Entity(tableName = "batches")
data class BatchEntity(
    @PrimaryKey val id: String,
    val itemId: String,
    val batchNo: String,
    /** YYYY-MM-DD, "" when no expiry */
    val expiry: String = "",
    val qty: Int = 0,
)

/** Stock movement — in/out. stockQty = sum(in) - sum(out). */
@Entity(tableName = "movements")
data class MovementEntity(
    @PrimaryKey val id: String,
    val itemId: String,
    val batchId: String = "",
    val date: String,
    /** in | out */
    val kind: String,
    val qty: Int,
    val godown: String = "Main",
    /** invoice number / note that caused this movement */
    val ref: String = "",
)

/**
 * Saved invoice. Lines are stored as JSON (one string) — the invoice is
 * one document, like the Site model; line math lives in the shared core
 * (core/GstCore.kt) and logic/InvoiceTotals.kt, never in SQL.
 * type: invoice | credit-note | debit-note. status: saved | draft.
 */
@Entity(tableName = "invoices")
data class InvoiceEntity(
    @PrimaryKey val id: String,
    val number: String,
    val date: String,
    val partyId: String = "",
    val partyName: String,
    val partyGstin: String? = null,
    val buyerState: String,
    val intraState: Boolean,
    val type: String = "invoice",
    val status: String = "saved",
    /** Financial year, e.g. "2026-27" */
    val fy: String,
    val linesJson: String,
    val taxablePaise: Long,
    val cgstPaise: Long,
    val sgstPaise: Long,
    val igstPaise: Long,
    val totalPaise: Long,
    val roundedTotalPaise: Long,
    val roundOffPaise: Long,
)

/** Employee (payroll-lite). */
@Entity(tableName = "employees")
data class EmployeeEntity(
    @PrimaryKey val id: String,
    val name: String,
    val monthlySalaryPaise: Long,
    val pfPct: Double = 0.0,
    val esiPct: Double = 0.0,
    val ptPaise: Long = 0L,
    val tdsPaise: Long = 0L,
)

/** Attendance: present days out of total days in a month. */
@Entity(tableName = "attendance")
data class AttendanceEntity(
    @PrimaryKey val id: String,
    val employeeId: String,
    /** YYYY-MM */
    val month: String,
    val presentDays: Int,
    val totalDays: Int,
)

/** Salary advance given to an employee in a month. */
@Entity(tableName = "advances")
data class AdvanceEntity(
    @PrimaryKey val id: String,
    val employeeId: String,
    val month: String,
    val amountPaise: Long,
)

/** Business expense (for reports / P&L). */
@Entity(tableName = "expenses")
data class ExpenseEntity(
    @PrimaryKey val id: String,
    val date: String,
    val category: String,
    val amountPaise: Long,
    val note: String = "",
)
