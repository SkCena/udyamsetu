// UdyamSetu — Activity-scoped ViewModel.
//
// compose_tab_state_hoisting: long-running work and anything the user
// expects to survive a tab switch lives HERE, not in a tab composable.
// The draft bill, the language choice and the FTU answers are hoisted;
// screens only receive display state and callbacks. Short-lived visual
// state (a text field's focus, a dialog open flag) may stay in remember.
package `in`.udyamsetu.app.ui

import android.app.Application
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import `in`.udyamsetu.app.core.isValidGSTIN
import `in`.udyamsetu.app.data.AppDatabase
import `in`.udyamsetu.app.data.ProfileEntity
import `in`.udyamsetu.app.data.Repository
import `in`.udyamsetu.app.logic.BillLine
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch

val Application.dataStore by preferencesDataStore(name = "udyamsetu_prefs")

private val LANG_KEY = stringPreferencesKey("lang")
private val LANG_CHOSEN_KEY = stringPreferencesKey("lang_chosen")
private val FTU_KEY = stringPreferencesKey("ftu")
private val THEME_KEY = stringPreferencesKey("theme")

/** Theme modes: "system" (device setting, default) | "light" | "dark". */
val THEME_MODES = listOf("system", "light", "dark")

data class FtuAnswers(
    val shopType: String = "",
    val gstRegistered: String = "",
    val sellsWhat: String = "",
)

data class DraftLine(
    val name: String = "",
    val qty: String = "1",
    val unitPriceRupees: String = "",
    val discountPct: String = "0",
    val taxRatePct: String = "18",
    val hsn: String = "",
)

data class DraftBill(
    val partyName: String = "",
    val partyGstin: String = "",
    val buyerState: String = "21",
    val lines: List<DraftLine> = listOf(DraftLine()),
    /** "invoice" | "non-gst" | "estimate" | "credit-note" | "debit-note" | "receipt"
     *  (see logic/BillTypes.kt for what each type means for totals, stock
     *  and GST reports). */
    val type: String = "invoice",
    val againstNumber: String = "",
)

fun DraftLine.toBillLine(): BillLine? {
    val qty = qty.toIntOrNull() ?: return null
    val price = unitPriceRupees.toDoubleOrNull() ?: return null
    val discount = discountPct.toIntOrNull() ?: return null
    val rate = taxRatePct.toDoubleOrNull() ?: return null
    return BillLine(qty, (price * 100).toLong(), discount, rate, hsn, name)
}

class AppViewModel(app: Application) : AndroidViewModel(app) {
    private val db = AppDatabase.get(app)
    val repo = Repository(db)

    // --- Language (English default; 10 languages in res/values-*) --------
    private val _lang = MutableStateFlow("en")
    val lang: StateFlow<String> = _lang.asStateFlow()
    private val _langChosen = MutableStateFlow(false)
    val langChosen: StateFlow<Boolean> = _langChosen.asStateFlow()

    // --- FTU (3 questions, saved) ----------------------------------------
    private val _ftu = MutableStateFlow(FtuAnswers())
    val ftu: StateFlow<FtuAnswers> = _ftu.asStateFlow()

    // --- Theme ("system" default; saved, survives restarts) ---------------
    private val _themeMode = MutableStateFlow("system")
    val themeMode: StateFlow<String> = _themeMode.asStateFlow()

    // --- Draft bill (hoisted: survives tab switches) ----------------------
    private val _draft = MutableStateFlow(DraftBill())
    val draft: StateFlow<DraftBill> = _draft.asStateFlow()
    private val _billMessage = MutableStateFlow("")
    val billMessage: StateFlow<String> = _billMessage.asStateFlow()

    // --- Profile -----------------------------------------------------------
    val profile: Flow<ProfileEntity?> = repo.observeProfile()

    init {
        viewModelScope.launch {
            val prefs = getApplication<Application>().dataStore.data.first()
            _lang.value = prefs[LANG_KEY] ?: "en"
            _langChosen.value = prefs[LANG_CHOSEN_KEY] == "1"
            val ftuRaw = prefs[FTU_KEY] ?: ""
            if (ftuRaw.isNotEmpty()) {
                val parts = ftuRaw.split("|")
                if (parts.size == 3) _ftu.value = FtuAnswers(parts[0], parts[1], parts[2])
            }
            val theme = prefs[THEME_KEY] ?: "system"
            if (theme in THEME_MODES) _themeMode.value = theme
        }
    }

    /** Theme choice: saves to DataStore and applies at once. */
    fun setThemeMode(mode: String) {
        val safe = if (mode in THEME_MODES) mode else "system"
        _themeMode.value = safe
        // Plain SharedPreferences copy: MainActivity reads it
        // synchronously at launch so the first frame already uses the
        // saved theme (DataStore is async). Same pattern as language.
        getApplication<Application>()
            .getSharedPreferences("udyamsetu_theme", android.content.Context.MODE_PRIVATE)
            .edit().putString("theme_mode", safe).apply()
        viewModelScope.launch {
            getApplication<Application>().dataStore.edit { it[THEME_KEY] = safe }
        }
    }

    /** Sync seed from the SharedPreferences mirror, read in onCreate. */
    fun applyThemeMode(mode: String) {
        if (mode in THEME_MODES) _themeMode.value = mode
    }

    fun setLanguage(code: String) {
        _lang.value = code
        _langChosen.value = true
        // Plain SharedPreferences copy: attachBaseContext reads it
        // synchronously at the next launch so strings load in the right
        // language from the first frame (DataStore is async).
        getApplication<Application>()
            .getSharedPreferences("udyamsetu_lang", android.content.Context.MODE_PRIVATE)
            .edit().putString("lang", code).apply()
        viewModelScope.launch {
            getApplication<Application>().dataStore.edit {
                it[LANG_KEY] = code
                it[LANG_CHOSEN_KEY] = "1"
            }
        }
    }

    fun saveFtu(answers: FtuAnswers) {
        _ftu.value = answers
        viewModelScope.launch {
            getApplication<Application>().dataStore.edit {
                it[FTU_KEY] = "${answers.shopType}|${answers.gstRegistered}|${answers.sellsWhat}"
            }
        }
    }

    fun updateDraft(draft: DraftBill) {
        _draft.value = draft
    }

    fun clearDraft() {
        _draft.value = DraftBill()
    }

    // Small fire-and-forget saves used by the screens (Room writes must
    // never happen on the UI thread, so they go through viewModelScope).
    fun saveParty(party: `in`.udyamsetu.app.data.PartyEntity) {
        viewModelScope.launch { repo.saveParty(party) }
    }

    fun saveLedgerEntry(entry: `in`.udyamsetu.app.data.LedgerEntryEntity) {
        viewModelScope.launch { repo.saveLedgerEntry(entry) }
    }

    fun saveItem(item: `in`.udyamsetu.app.data.ItemEntity) {
        viewModelScope.launch { repo.saveItem(item) }
    }

    fun saveEmployee(e: `in`.udyamsetu.app.data.EmployeeEntity) {
        viewModelScope.launch { repo.saveEmployee(e) }
    }

    fun saveExpense(e: `in`.udyamsetu.app.data.ExpenseEntity) {
        viewModelScope.launch { repo.saveExpense(e) }
    }

    fun saveProfile(profile: ProfileEntity, onDone: (List<String>) -> Unit) {
        val errors = mutableListOf<String>()
        if (profile.name.isBlank()) errors += "name"
        if (!profile.gstin.isNullOrBlank() && !isValidGSTIN(profile.gstin)) errors += "gstin"
        if (errors.isNotEmpty()) {
            onDone(errors)
            return
        }
        viewModelScope.launch {
            repo.saveProfile(profile)
            onDone(emptyList())
        }
    }

    /** Save the hoisted draft as a real bill. Returns the number, or "". */
    fun saveDraftBill(onDone: (String) -> Unit) {
        val draft = _draft.value
        viewModelScope.launch {
            val profile = repo.getProfile()
            if (profile.name.isBlank()) {
                _billMessage.value = "setup-first"
                onDone("")
                return@launch
            }
            val lines = draft.lines.mapNotNull { it.toBillLine() }
            if (lines.isEmpty() || draft.partyName.isBlank()) {
                _billMessage.value = "bill-invalid"
                onDone("")
                return@launch
            }
            val number = repo.saveInvoice(
                profile = profile,
                party = null, // party lookup by name happens in the Party screen;
                // a bill without a saved party still saves (walk-in customer).
                lines = lines,
                buyerState = draft.buyerState,
                date = repo.todayIso(),
                type = draft.type,
            )
            _billMessage.value = "saved:$number"
            clearDraft()
            onDone(number)
        }
    }
}
