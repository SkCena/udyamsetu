// UdyamSetu — Drive backup codec + encryption (pure Kotlin, no Android APIs).
// The backup is one text document: a version header, then one section per
// Room table, one row per line, fields separated by '|'. '%' , '|' and
// newline inside a field are escaped exactly like LinesCodec (%25 / %7C /
// %0A) so a restore reads back exactly what was saved. Restore is a MERGE:
// rows are inserted with REPLACE, so backup rows overwrite same-id rows and
// anything not in the backup stays untouched — a restore never deletes.
// Encryption: passphrase-derived key (PBKDF2-HMAC-SHA256, 100k rounds) +
// AES-256-GCM. The passphrase is NEVER stored — lose it and the backup
// cannot be opened. Byte layout: salt(16) || iv(12) || ciphertext.
// javax.crypto is plain JDK here, so host unit tests cover this too.
package `in`.udyamsetu.app.logic

import javax.crypto.Cipher
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.PBEKeySpec
import javax.crypto.spec.SecretKeySpec

const val BACKUP_FORMAT_VERSION = 1
const val BACKUP_HEADER = "UDYAMSETU-BACKUP"

private fun esc(s: String): String =
    s.replace("%", "%25").replace("|", "%7C").replace("\n", "%0A")

private fun unesc(s: String): String =
    s.replace("%0A", "\n").replace("%7C", "|").replace("%25", "%")

private fun escOpt(s: String?): String = if (s == null) "" else esc(s)
private fun boolStr(b: Boolean): String = if (b) "1" else "0"

/** One row per table — full fields, so a restore loses nothing. */
data class ProfileBackup(
    val name: String = "",
    val gstin: String? = null,
    val phone: String = "",
    val address: String = "",
    val logoDataUrl: String? = null,
    val upiId: String = "",
    val invoicePrefix: String = "INV",
    val nextSeq: Int = 1,
    val sellerState: String = "21",
    val shopType: String = "",
    val sellsWhat: String = "",
)

data class PartyBackup(
    val id: String, val name: String, val phone: String = "",
    val gstin: String? = null, val state: String = "",
    val kind: String = "customer", val openingBalancePaise: Long = 0L,
)

data class LedgerBackup(
    val id: String, val partyId: String, val date: String,
    val kind: String, val amountPaise: Long, val note: String = "",
)

data class ItemBackup(
    val id: String, val name: String, val hsn: String = "",
    val unit: String = "pcs", val taxRatePct: Double = 0.0,
    val purchasePricePaise: Long = 0L, val salePricePaise: Long = 0L,
    val reorderLevel: Int = 0, val godown: String = "Main",
)

data class BatchBackup(
    val id: String, val itemId: String, val batchNo: String,
    val expiry: String = "", val qty: Int = 0,
)

data class MovementBackup(
    val id: String, val itemId: String, val batchId: String = "",
    val date: String, val kind: String, val qty: Int,
    val godown: String = "Main", val ref: String = "",
)

data class InvoiceBackup(
    val id: String, val number: String, val date: String,
    val partyId: String = "", val partyName: String,
    val partyGstin: String? = null, val buyerState: String,
    val intraState: Boolean, val type: String = "invoice",
    val status: String = "saved", val fy: String,
    /** Lines in LinesCodec format (already '|' / newline escaped). */
    val linesEncoded: String,
    val taxablePaise: Long, val cgstPaise: Long, val sgstPaise: Long,
    val igstPaise: Long, val totalPaise: Long,
    val roundedTotalPaise: Long, val roundOffPaise: Long,
)

data class EmployeeBackup(
    val id: String, val name: String, val monthlySalaryPaise: Long,
    val pfPct: Double = 0.0, val esiPct: Double = 0.0,
    val ptPaise: Long = 0L, val tdsPaise: Long = 0L,
)

data class AttendanceBackup(
    val id: String, val employeeId: String, val month: String,
    val presentDays: Int, val totalDays: Int,
)

data class AdvanceBackup(
    val id: String, val employeeId: String, val month: String,
    val amountPaise: Long,
)

data class ExpenseBackup(
    val id: String, val date: String, val category: String,
    val amountPaise: Long, val note: String = "",
)

/** The whole database, as one backup document. */
data class BackupData(
    val profile: ProfileBackup = ProfileBackup(),
    val parties: List<PartyBackup> = emptyList(),
    val ledger: List<LedgerBackup> = emptyList(),
    val items: List<ItemBackup> = emptyList(),
    val batches: List<BatchBackup> = emptyList(),
    val movements: List<MovementBackup> = emptyList(),
    val invoices: List<InvoiceBackup> = emptyList(),
    val employees: List<EmployeeBackup> = emptyList(),
    val attendance: List<AttendanceBackup> = emptyList(),
    val advances: List<AdvanceBackup> = emptyList(),
    val expenses: List<ExpenseBackup> = emptyList(),
)

fun encodeBackup(data: BackupData): String {
    val sb = StringBuilder()
    sb.append("$BACKUP_HEADER|$BACKUP_FORMAT_VERSION\n")
    val p = data.profile
    sb.append("[profile]\n")
    sb.append(
        listOf(
            esc(p.name), escOpt(p.gstin), esc(p.phone), esc(p.address),
            escOpt(p.logoDataUrl), esc(p.upiId), esc(p.invoicePrefix),
            p.nextSeq.toString(), esc(p.sellerState), esc(p.shopType), esc(p.sellsWhat),
        ).joinToString("|"),
    ).append("\n")
    fun section(name: String, rows: List<String>) {
        sb.append("[$name]\n")
        for (r in rows) sb.append(r).append("\n")
    }
    section("parties", data.parties.map {
        listOf(esc(it.id), esc(it.name), esc(it.phone), escOpt(it.gstin), esc(it.state), esc(it.kind), it.openingBalancePaise.toString()).joinToString("|")
    })
    section("ledger", data.ledger.map {
        listOf(esc(it.id), esc(it.partyId), esc(it.date), esc(it.kind), it.amountPaise.toString(), esc(it.note)).joinToString("|")
    })
    section("items", data.items.map {
        listOf(esc(it.id), esc(it.name), esc(it.hsn), esc(it.unit), it.taxRatePct.toString(), it.purchasePricePaise.toString(), it.salePricePaise.toString(), it.reorderLevel.toString(), esc(it.godown)).joinToString("|")
    })
    section("batches", data.batches.map {
        listOf(esc(it.id), esc(it.itemId), esc(it.batchNo), esc(it.expiry), it.qty.toString()).joinToString("|")
    })
    section("movements", data.movements.map {
        listOf(esc(it.id), esc(it.itemId), esc(it.batchId), esc(it.date), esc(it.kind), it.qty.toString(), esc(it.godown), esc(it.ref)).joinToString("|")
    })
    section("invoices", data.invoices.map {
        listOf(
            esc(it.id), esc(it.number), esc(it.date), esc(it.partyId), esc(it.partyName),
            escOpt(it.partyGstin), esc(it.buyerState), boolStr(it.intraState), esc(it.type),
            esc(it.status), esc(it.fy), esc(it.linesEncoded),
            it.taxablePaise.toString(), it.cgstPaise.toString(), it.sgstPaise.toString(),
            it.igstPaise.toString(), it.totalPaise.toString(),
            it.roundedTotalPaise.toString(), it.roundOffPaise.toString(),
        ).joinToString("|")
    })
    section("employees", data.employees.map {
        listOf(esc(it.id), esc(it.name), it.monthlySalaryPaise.toString(), it.pfPct.toString(), it.esiPct.toString(), it.ptPaise.toString(), it.tdsPaise.toString()).joinToString("|")
    })
    section("attendance", data.attendance.map {
        listOf(esc(it.id), esc(it.employeeId), esc(it.month), it.presentDays.toString(), it.totalDays.toString()).joinToString("|")
    })
    section("advances", data.advances.map {
        listOf(esc(it.id), esc(it.employeeId), esc(it.month), it.amountPaise.toString()).joinToString("|")
    })
    section("expenses", data.expenses.map {
        listOf(esc(it.id), esc(it.date), esc(it.category), it.amountPaise.toString(), esc(it.note)).joinToString("|")
    })
    return sb.toString()
}

fun decodeBackup(raw: String): BackupData {
    val lines = raw.lines()
    require(lines.isNotEmpty()) { "empty backup" }
    val header = lines[0].split("|")
    require(header.size == 2 && header[0] == BACKUP_HEADER) { "not a UdyamSetu backup" }
    require(header[1].toIntOrNull() == BACKUP_FORMAT_VERSION) { "unsupported backup version: ${header[1]}" }
    var section = ""
    var profile = ProfileBackup()
    val parties = mutableListOf<PartyBackup>()
    val ledger = mutableListOf<LedgerBackup>()
    val items = mutableListOf<ItemBackup>()
    val batches = mutableListOf<BatchBackup>()
    val movements = mutableListOf<MovementBackup>()
    val invoices = mutableListOf<InvoiceBackup>()
    val employees = mutableListOf<EmployeeBackup>()
    val attendance = mutableListOf<AttendanceBackup>()
    val advances = mutableListOf<AdvanceBackup>()
    val expenses = mutableListOf<ExpenseBackup>()
    fun parts(line: String, n: Int, what: String): List<String> {
        val p = line.split("|")
        require(p.size == n) { "bad backup row ($what): $line" }
        return p
    }
    for (line in lines.drop(1)) {
        if (line.isBlank()) continue
        if (line.startsWith("[") && line.endsWith("]")) {
            section = line.substring(1, line.length - 1)
            continue
        }
        when (section) {
            "profile" -> {
                val p = parts(line, 11, "profile")
                profile = ProfileBackup(
                    name = unesc(p[0]), gstin = unesc(p[1]).ifBlank { null },
                    phone = unesc(p[2]), address = unesc(p[3]),
                    logoDataUrl = unesc(p[4]).ifBlank { null },
                    upiId = unesc(p[5]), invoicePrefix = unesc(p[6]),
                    nextSeq = p[7].toInt(), sellerState = unesc(p[8]),
                    shopType = unesc(p[9]), sellsWhat = unesc(p[10]),
                )
            }
            "parties" -> {
                val p = parts(line, 7, "party")
                parties += PartyBackup(unesc(p[0]), unesc(p[1]), unesc(p[2]), unesc(p[3]).ifBlank { null }, unesc(p[4]), unesc(p[5]), p[6].toLong())
            }
            "ledger" -> {
                val p = parts(line, 6, "ledger")
                ledger += LedgerBackup(unesc(p[0]), unesc(p[1]), unesc(p[2]), unesc(p[3]), p[4].toLong(), unesc(p[5]))
            }
            "items" -> {
                val p = parts(line, 9, "item")
                items += ItemBackup(unesc(p[0]), unesc(p[1]), unesc(p[2]), unesc(p[3]), p[4].toDouble(), p[5].toLong(), p[6].toLong(), p[7].toInt(), unesc(p[8]))
            }
            "batches" -> {
                val p = parts(line, 5, "batch")
                batches += BatchBackup(unesc(p[0]), unesc(p[1]), unesc(p[2]), unesc(p[3]), p[4].toInt())
            }
            "movements" -> {
                val p = parts(line, 8, "movement")
                movements += MovementBackup(unesc(p[0]), unesc(p[1]), unesc(p[2]), unesc(p[3]), unesc(p[4]), p[5].toInt(), unesc(p[6]), unesc(p[7]))
            }
            "invoices" -> {
                val p = parts(line, 19, "invoice")
                invoices += InvoiceBackup(
                    id = unesc(p[0]), number = unesc(p[1]), date = unesc(p[2]),
                    partyId = unesc(p[3]), partyName = unesc(p[4]),
                    partyGstin = unesc(p[5]).ifBlank { null }, buyerState = unesc(p[6]),
                    intraState = p[7] == "1", type = unesc(p[8]), status = unesc(p[9]),
                    fy = unesc(p[10]), linesEncoded = unesc(p[11]),
                    taxablePaise = p[12].toLong(), cgstPaise = p[13].toLong(),
                    sgstPaise = p[14].toLong(), igstPaise = p[15].toLong(),
                    totalPaise = p[16].toLong(), roundedTotalPaise = p[17].toLong(),
                    roundOffPaise = p[18].toLong(),
                )
            }
            "employees" -> {
                val p = parts(line, 7, "employee")
                employees += EmployeeBackup(unesc(p[0]), unesc(p[1]), p[2].toLong(), p[3].toDouble(), p[4].toDouble(), p[5].toLong(), p[6].toLong())
            }
            "attendance" -> {
                val p = parts(line, 5, "attendance")
                attendance += AttendanceBackup(unesc(p[0]), unesc(p[1]), unesc(p[2]), p[3].toInt(), p[4].toInt())
            }
            "advances" -> {
                val p = parts(line, 4, "advance")
                advances += AdvanceBackup(unesc(p[0]), unesc(p[1]), unesc(p[2]), p[3].toLong())
            }
            "expenses" -> {
                val p = parts(line, 5, "expense")
                expenses += ExpenseBackup(unesc(p[0]), unesc(p[1]), unesc(p[2]), p[3].toLong(), unesc(p[4]))
            }
            else -> throw IllegalArgumentException("unknown backup section: $section")
        }
    }
    return BackupData(
        profile, parties, ledger, items, batches, movements,
        invoices, employees, attendance, advances, expenses,
    )
}

// --- Encryption ------------------------------------------------------------

private const val PBKDF2_ROUNDS = 100_000
private const val SALT_BYTES = 16
private const val IV_BYTES = 12
private const val GCM_TAG_BITS = 128

/** Encrypt backup bytes with a passphrase. Output: salt || iv || ciphertext. */
fun encryptBackup(plain: ByteArray, passphrase: String): ByteArray {
    require(passphrase.length >= 4) { "passphrase too short" }
    val salt = ByteArray(SALT_BYTES).also { java.security.SecureRandom().nextBytes(it) }
    val iv = ByteArray(IV_BYTES).also { java.security.SecureRandom().nextBytes(it) }
    val key = deriveKey(passphrase, salt)
    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
    cipher.init(Cipher.ENCRYPT_MODE, key, GCMParameterSpec(GCM_TAG_BITS, iv))
    val cipherText = cipher.doFinal(plain)
    return salt + iv + cipherText
}

/** Decrypt. Throws (AEADBadTagException / IllegalArgumentException) on a
 *  wrong passphrase or tampered bytes — callers show "wrong passphrase". */
fun decryptBackup(encrypted: ByteArray, passphrase: String): ByteArray {
    require(encrypted.size > SALT_BYTES + IV_BYTES) { "backup too short" }
    val salt = encrypted.copyOfRange(0, SALT_BYTES)
    val iv = encrypted.copyOfRange(SALT_BYTES, SALT_BYTES + IV_BYTES)
    val cipherText = encrypted.copyOfRange(SALT_BYTES + IV_BYTES, encrypted.size)
    val key = deriveKey(passphrase, salt)
    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
    cipher.init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(GCM_TAG_BITS, iv))
    return cipher.doFinal(cipherText)
}

private fun deriveKey(passphrase: String, salt: ByteArray): SecretKeySpec {
    val factory = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
    val spec = PBEKeySpec(passphrase.toCharArray(), salt, PBKDF2_ROUNDS, 256)
    return SecretKeySpec(factory.generateSecret(spec).encoded, "AES")
}
