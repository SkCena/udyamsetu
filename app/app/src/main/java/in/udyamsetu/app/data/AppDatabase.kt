// UdyamSetu — Room database + DAOs. Offline-first: everything is local,
// no server, no account. One database, version 1.
package `in`.udyamsetu.app.data

import android.content.Context
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase
import kotlinx.coroutines.flow.Flow

@Dao
interface ProfileDao {
    @Query("SELECT * FROM profile WHERE id = 1")
    fun observe(): Flow<ProfileEntity?>

    @Query("SELECT * FROM profile WHERE id = 1")
    suspend fun get(): ProfileEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun save(profile: ProfileEntity)
}

@Dao
interface PartyDao {
    @Query("SELECT * FROM parties ORDER BY name")
    fun observeAll(): Flow<List<PartyEntity>>

    @Query("SELECT * FROM parties WHERE id = :id")
    suspend fun get(id: String): PartyEntity?

    @Query("SELECT * FROM parties ORDER BY name")
    suspend fun allParties(): List<PartyEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun save(party: PartyEntity)

    @Query("SELECT * FROM ledger WHERE partyId = :partyId ORDER BY date, id")
    fun observeLedger(partyId: String): Flow<List<LedgerEntryEntity>>

    @Query("SELECT * FROM ledger ORDER BY date, id")
    suspend fun allLedger(): List<LedgerEntryEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun saveEntry(entry: LedgerEntryEntity)
}

@Dao
interface ItemDao {
    @Query("SELECT * FROM items ORDER BY name")
    fun observeAll(): Flow<List<ItemEntity>>

    @Query("SELECT * FROM items WHERE id = :id")
    suspend fun get(id: String): ItemEntity?

    @Query("SELECT * FROM items ORDER BY name")
    suspend fun allItems(): List<ItemEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun save(item: ItemEntity)

    @Query("SELECT * FROM movements WHERE itemId = :itemId ORDER BY date, id")
    suspend fun movements(itemId: String): List<MovementEntity>

    @Query("SELECT * FROM movements ORDER BY date, id")
    suspend fun allMovements(): List<MovementEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun saveMovement(m: MovementEntity)

    @Query("SELECT * FROM batches WHERE itemId = :itemId ORDER BY expiry")
    suspend fun batches(itemId: String): List<BatchEntity>

    @Query("SELECT * FROM batches ORDER BY expiry")
    suspend fun allBatches(): List<BatchEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun saveBatch(b: BatchEntity)
}

@Dao
interface InvoiceDao {
    @Query("SELECT * FROM invoices ORDER BY date DESC, number DESC")
    fun observeAll(): Flow<List<InvoiceEntity>>

    @Query("SELECT * FROM invoices WHERE id = :id")
    suspend fun get(id: String): InvoiceEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun save(invoice: InvoiceEntity)

    @Query("SELECT * FROM invoices WHERE status = 'saved' ORDER BY date, number")
    suspend fun saved(): List<InvoiceEntity>
}

@Dao
interface PayrollDao {
    @Query("SELECT * FROM employees ORDER BY name")
    fun observeEmployees(): Flow<List<EmployeeEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun saveEmployee(e: EmployeeEntity)

    @Query("SELECT * FROM attendance WHERE employeeId = :employeeId AND month = :month")
    suspend fun attendance(employeeId: String, month: String): AttendanceEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun saveAttendance(a: AttendanceEntity)

    @Query("SELECT * FROM advances WHERE employeeId = :employeeId AND month = :month")
    suspend fun advances(employeeId: String, month: String): List<AdvanceEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun saveAdvance(a: AdvanceEntity)

    @Query("SELECT * FROM expenses ORDER BY date DESC")
    fun observeExpenses(): Flow<List<ExpenseEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun saveExpense(e: ExpenseEntity)
}

@Database(
    entities = [
        ProfileEntity::class, PartyEntity::class, LedgerEntryEntity::class,
        ItemEntity::class, BatchEntity::class, MovementEntity::class,
        InvoiceEntity::class, EmployeeEntity::class, AttendanceEntity::class,
        AdvanceEntity::class, ExpenseEntity::class,
    ],
    version = 1,
    exportSchema = false,
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun profileDao(): ProfileDao
    abstract fun partyDao(): PartyDao
    abstract fun itemDao(): ItemDao
    abstract fun invoiceDao(): InvoiceDao
    abstract fun payrollDao(): PayrollDao

    companion object {
        @Volatile
        private var instance: AppDatabase? = null

        fun get(context: Context): AppDatabase =
            instance ?: synchronized(this) {
                instance ?: Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "udyamsetu.db",
                ).build().also { instance = it }
            }
    }
}
