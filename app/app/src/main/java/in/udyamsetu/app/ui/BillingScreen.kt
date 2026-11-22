// UdyamSetu — New Bill. The draft lives in the Activity-scoped ViewModel,
// so switching tabs never loses it (compose_tab_state_hoisting).
// Flow: Party -> Items -> PREVIEW -> Save (3-tap bill target: the bill
// starts in 3 taps from Home; preview is the mistake-catching step before
// save). Totals always come from the shared core, never hand-computed.
package `in`.udyamsetu.app.ui

import android.content.Intent
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.navigation.NavHostController
import `in`.udyamsetu.app.R
import `in`.udyamsetu.app.logic.billTotals
import `in`.udyamsetu.app.logic.validateBillLine

@Composable
fun BillingScreen(vm: AppViewModel, nav: NavHostController) {
    val context = LocalContext.current
    val draft by vm.draft.collectAsState()
    val profile by vm.profile.collectAsState(initial = null)
    val message by vm.billMessage.collectAsState()
    var showPreview by remember { mutableStateOf(false) }
    var savedNumber by remember { mutableStateOf("") }

    val lines = draft.lines.mapNotNull { it.toBillLine() }
    val intraState = profile?.let { draft.buyerState == it.sellerState } ?: true
    val totals = runCatching { if (lines.isNotEmpty()) billTotals(lines, intraState) else null }.getOrNull()
    val lineErrors = draft.lines.flatMap { validateBillLine(it.toBillLine() ?: return@flatMap listOf("line")) }

    LazyColumn(modifier = Modifier.padding(16.dp)) {
        item {
            SectionTitle(stringResource(R.string.billing_title))
            if ((profile?.name ?: "").isBlank()) {
                HintText(stringResource(R.string.setup_warn))
            }
            LabeledField(stringResource(R.string.party_name), draft.partyName, { vm.updateDraft(draft.copy(partyName = it)) }, stringResource(R.string.party_name_ph))
            LabeledField(stringResource(R.string.party_gstin), draft.partyGstin, { vm.updateDraft(draft.copy(partyGstin = it.uppercase())) })
            LabeledField(stringResource(R.string.buyer_state), draft.buyerState, { vm.updateDraft(draft.copy(buyerState = it)) })
            Text("${stringResource(R.string.tax_kind)} ${if (intraState) "CGST + SGST" else "IGST"}")
        }
        item { SectionTitle(stringResource(R.string.lines_title)) }
        draft.lines.forEachIndexed { index, line ->
            item {
                Card(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
                    Column(modifier = Modifier.padding(8.dp)) {
                        LabeledField(stringResource(R.string.item_name_ph), line.name, { updateLine(vm, draft, index, line.copy(name = it)) })
                        Row {
                            Column(modifier = Modifier.weight(1f).padding(end = 4.dp)) {
                                LabeledField("Qty", line.qty, { updateLine(vm, draft, index, line.copy(qty = it)) })
                            }
                            Column(modifier = Modifier.weight(1f).padding(start = 4.dp)) {
                                LabeledField("₹ / unit", line.unitPriceRupees, { updateLine(vm, draft, index, line.copy(unitPriceRupees = it)) })
                            }
                        }
                        Row {
                            Column(modifier = Modifier.weight(1f).padding(end = 4.dp)) {
                                LabeledField("Disc %", line.discountPct, { updateLine(vm, draft, index, line.copy(discountPct = it)) })
                            }
                            Column(modifier = Modifier.weight(1f).padding(start = 4.dp)) {
                                LabeledField("GST %", line.taxRatePct, { updateLine(vm, draft, index, line.copy(taxRatePct = it)) })
                            }
                        }
                        LabeledField("HSN", line.hsn, { updateLine(vm, draft, index, line.copy(hsn = it)) })
                    }
                }
            }
        }
        item {
            OutlinedButton(onClick = { vm.updateDraft(draft.copy(lines = draft.lines + DraftLine())) }) {
                Text(stringResource(R.string.add_line))
            }
            if (totals != null) {
                Text("${stringResource(R.string.taxable)}: ${formatRupees(totals.taxablePaise)}")
                if (intraState) {
                    Text("CGST: ${formatRupees(totals.cgstPaise)}  SGST: ${formatRupees(totals.sgstPaise)}")
                } else {
                    Text("IGST: ${formatRupees(totals.igstPaise)}")
                }
                Text("${stringResource(R.string.round_off)}: ${formatRupees(totals.roundOffPaise)}")
                Text(
                    "${stringResource(R.string.grand_total)}: ${formatRupees(totals.roundedTotalPaise)}",
                    fontWeight = FontWeight.Bold,
                )
            }
            if (lineErrors.isNotEmpty()) Text(stringResource(R.string.bill_invalid))
            // Preview BEFORE save — the mistake-catching step.
            BigButton(stringResource(R.string.preview_before_save)) { showPreview = true }
            if (showPreview && totals != null) {
                Card(modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp)) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Text(profile?.name ?: "", fontWeight = FontWeight.Bold)
                        Text("Party: ${draft.partyName} (${stateName(draft.buyerState)})")
                        Text("Lines: ${lines.size} — ${stringResource(R.string.taxable)} ${formatRupees(totals.taxablePaise)}")
                        Text("${stringResource(R.string.grand_total)}: ${formatRupees(totals.roundedTotalPaise)}", fontWeight = FontWeight.Bold)
                        Text("Type: ${draft.type}")
                    }
                }
            }
            Row(modifier = Modifier.fillMaxWidth()) {
                OutlinedButton(onClick = { vm.clearDraft() }, modifier = Modifier.weight(1f).padding(end = 4.dp)) {
                    Text(stringResource(R.string.clear_form))
                }
                Button(
                    onClick = {
                        vm.saveDraftBill { number -> savedNumber = number }
                    },
                    enabled = lines.isNotEmpty() && lineErrors.isEmpty() && draft.partyName.isNotBlank(),
                    modifier = Modifier.weight(1f).padding(start = 4.dp),
                ) { Text(stringResource(R.string.save_invoice)) }
            }
            if (savedNumber.isNotEmpty()) {
                Text(stringResource(R.string.invoice_saved))
                OutlinedButton(onClick = {
                    val intent = Intent(Intent.ACTION_SEND).apply {
                        type = "text/plain"
                        putExtra(Intent.EXTRA_TEXT, "Bill $savedNumber — Total ${totals?.let { formatRupees(it.roundedTotalPaise) } ?: ""}")
                    }
                    context.startActivity(Intent.createChooser(intent, "Share bill"))
                }) { Text(stringResource(R.string.whatsapp)) }
            }
            if (message == "setup-first") Text(stringResource(R.string.setup_warn))
        }
    }
}

private fun updateLine(vm: AppViewModel, draft: DraftBill, index: Int, line: DraftLine) {
    val lines = draft.lines.toMutableList()
    lines[index] = line
    vm.updateDraft(draft.copy(lines = lines))
}
