// UdyamSetu — Party / Udhaar. Ledger truth = site/party.js sign convention:
// positive balance = party owes us, negative = we owe them. Tapping a party
// opens its statement AND lets you bill / record a payment from there
// (context se kaam — party se seedha bill, wapas jaake dhoondhna nahi).
package `in`.udyamsetu.app.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.navigation.NavHostController
import `in`.udyamsetu.app.R
import `in`.udyamsetu.app.data.LedgerEntryEntity
import `in`.udyamsetu.app.data.PartyEntity
import `in`.udyamsetu.app.logic.LedgerRow
import `in`.udyamsetu.app.logic.PartyRow
import `in`.udyamsetu.app.logic.partyBalance
import `in`.udyamsetu.app.logic.statement
import java.util.UUID

@Composable
fun PartyScreen(vm: AppViewModel, nav: NavHostController) {
    val parties by vm.repo.observeParties().collectAsState(initial = emptyList())
    var name by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var selected by remember { mutableStateOf<PartyEntity?>(null) }
    var amount by remember { mutableStateOf("") }
    var entryKind by remember { mutableStateOf("payment") }

    LazyColumn(modifier = Modifier.padding(16.dp)) {
        item {
            SectionTitle(stringResource(R.string.party_title))
            HintText(stringResource(R.string.hint_party))
            LabeledField(stringResource(R.string.party_name), name, { name = it }, stringResource(R.string.party_name_ph))
            LabeledField(stringResource(R.string.biz_phone), phone, { phone = it })
            BigButton("+ Add party") {
                if (name.isNotBlank()) {
                    // Fire-and-forget save through the ViewModel scope.
                    vm.saveParty(PartyEntity(id = UUID.randomUUID().toString(), name = name.trim(), phone = phone.trim()))
                    name = ""; phone = ""
                }
            }
        }
        items(parties) { party ->
            PartyCard(vm, party, selected == party,
                onSelect = { selected = if (selected == party) null else party },
                onBill = {
                    vm.updateDraft(vm.draft.value.copy(partyName = party.name, partyGstin = party.gstin ?: "", buyerState = party.state.ifBlank { "21" }))
                    nav.navigate(Routes.BILLING)
                },
                amount = amount, onAmount = { amount = it },
                entryKind = entryKind, onKind = { entryKind = it },
            )
        }
    }
}

@Composable
private fun PartyCard(
    vm: AppViewModel,
    party: PartyEntity,
    expanded: Boolean,
    onSelect: () -> Unit,
    onBill: () -> Unit,
    amount: String,
    onAmount: (String) -> Unit,
    entryKind: String,
    onKind: (String) -> Unit,
) {
    val entries by vm.repo.observeLedger(party.id).collectAsState(initial = emptyList())
    val balance = partyBalance(
        PartyRow(party.id, party.name, party.openingBalancePaise),
        entries.map { LedgerRow(it.id, it.partyId, it.date, it.kind, it.amountPaise) },
    )
    Card(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text(party.name, fontWeight = FontWeight.Bold)
            Text("Balance: ${formatRupees(balance)}")
            OutlinedButton(onClick = onSelect) { Text(if (expanded) "Hide" else "Statement") }
            OutlinedButton(onClick = onBill) { Text(stringResource(R.string.quick_bill)) }
            if (expanded) {
                val rows = statement(
                    PartyRow(party.id, party.name, party.openingBalancePaise),
                    entries.map { LedgerRow(it.id, it.partyId, it.date, it.kind, it.amountPaise) },
                )
                for (row in rows) {
                    Text("${row.entry.date} • ${row.entry.kind} ${formatRupees(row.entry.amountPaise)} → ${formatRupees(row.runningBalancePaise)}")
                }
                LabeledField("Amount ₹", amount, onAmount)
                RowButtons(entryKind, onKind)
                Button(onClick = {
                    val rupees = amount.toDoubleOrNull() ?: return@Button
                    val paise = (rupees * 100).toLong()
                    // Customer payment received = negative delta (balance down).
                    // Udhaar given = positive delta (balance up).
                    val signed = if (entryKind == "payment") -paise else paise
                    vm.saveLedgerEntry(
                        LedgerEntryEntity(
                            id = UUID.randomUUID().toString(), partyId = party.id,
                            date = vm.repo.todayIso(), kind = entryKind,
                            amountPaise = signed,
                        ),
                    )
                    onAmount("")
                }) { Text("Save entry") }
            }
        }
    }
}

@Composable
private fun RowButtons(kind: String, onKind: (String) -> Unit) {
    androidx.compose.foundation.layout.Row {
        OutlinedButton(onClick = { onKind("payment") }) { Text(if (kind == "payment") "Payment ✓" else "Payment") }
        OutlinedButton(onClick = { onKind("udhaar") }) { Text(if (kind == "udhaar") "Udhaar ✓" else "Udhaar") }
    }
}
