// UdyamSetu — New Bill. The draft lives in the Activity-scoped ViewModel,
// so switching tabs never loses it (compose_tab_state_hoisting).
// Flow: Party -> Items -> PREVIEW -> Save (3-tap bill target: the bill
// starts in 3 taps from Home; preview is the mistake-catching step before
// save). Totals always come from the shared core, per document type
// (logic/BillTypes.kt) — never hand-computed.
// Document types: GST bill, non-GST bill, estimate/quotation, credit note,
// debit note, receipt. A non-GST bill and a receipt carry zero tax; an
// estimate is not a sale (no stock change, no GST filing); a credit note
// negates, a debit note stays positive.
package `in`.udyamsetu.app.ui

import android.content.Intent
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.navigation.NavHostController
import `in`.udyamsetu.app.R
import `in`.udyamsetu.app.logic.DOC_TYPES
import `in`.udyamsetu.app.logic.billTotalsForType
import `in`.udyamsetu.app.logic.shareTextForDoc
import `in`.udyamsetu.app.logic.validateBillLine

@Composable
fun BillingScreen(vm: AppViewModel, nav: NavHostController) {
    val context = LocalContext.current
    val draft by vm.draft.collectAsState()
    val profile by vm.profile.collectAsState(initial = null)
    val message by vm.billMessage.collectAsState()
    var showPreview by remember { mutableStateOf(false) }
    var savedNumber by remember { mutableStateOf("") }
    var savedTotalPaise by remember { mutableStateOf<Long?>(null) }
    var savedTypeLabel by remember { mutableStateOf("") }
    var savedType by remember { mutableStateOf("invoice") }
    var savedPartyName by remember { mutableStateOf("") }

    val lines = draft.lines.mapNotNull { it.toBillLine() }
    val intraState = profile?.let { draft.buyerState == it.sellerState } ?: true
    val totals = runCatching { if (lines.isNotEmpty()) billTotalsForType(lines, intraState, draft.type) else null }.getOrNull()
    val lineErrors = draft.lines.flatMap { validateBillLine(it.toBillLine() ?: return@flatMap listOf("line")) }
    val typeLabel = stringResource(docTypeLabelRes(draft.type))
    val estimateNote = stringResource(R.string.doc_estimate_note)
    val saveLabel = when (draft.type) {
        "estimate" -> stringResource(R.string.save_estimate)
        "receipt" -> stringResource(R.string.save_receipt)
        "credit-note" -> stringResource(R.string.credit_note)
        "debit-note" -> stringResource(R.string.debit_note)
        else -> stringResource(R.string.save_invoice)
    }

    LazyColumn(modifier = Modifier.padding(16.dp)) {
        item {
            SectionTitle(if (draft.type == "invoice") stringResource(R.string.billing_title) else typeLabel)
            if ((profile?.name ?: "").isBlank()) {
                HintText(stringResource(R.string.setup_warn))
            }
            SectionTitle(stringResource(R.string.doc_type_label))
            for (type in DOC_TYPES) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { vm.updateDraft(draft.copy(type = type)) }
                        .padding(vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    RadioButton(
                        selected = draft.type == type,
                        onClick = { vm.updateDraft(draft.copy(type = type)) },
                    )
                    Text(
                        text = stringResource(docTypeLabelRes(type)),
                        modifier = Modifier.padding(start = 8.dp),
                    )
                }
            }
            when (draft.type) {
                "non-gst" -> HintText(stringResource(R.string.doc_non_gst_note))
                "estimate" -> HintText(stringResource(R.string.doc_estimate_note))
                "receipt" -> HintText(stringResource(R.string.doc_receipt_note))
            }
            LabeledField(stringResource(R.string.party_name), draft.partyName, { vm.updateDraft(draft.copy(partyName = it)) }, stringResource(R.string.party_name_ph))
            LabeledField(stringResource(R.string.party_gstin), draft.partyGstin, { vm.updateDraft(draft.copy(partyGstin = it.uppercase())) })
            LabeledField(stringResource(R.string.buyer_state), draft.buyerState, { vm.updateDraft(draft.copy(buyerState = it)) })
            if (draft.type != "non-gst" && draft.type != "receipt") {
                Text("${stringResource(R.string.tax_kind)} ${if (intraState) "CGST + SGST" else "IGST"}")
            }
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
                val taxTotal = totals.cgstPaise + totals.sgstPaise + totals.igstPaise
                if (taxTotal != 0L) {
                    if (intraState) {
                        Text("CGST: ${formatRupees(totals.cgstPaise)}  SGST: ${formatRupees(totals.sgstPaise)}")
                    } else {
                        Text("IGST: ${formatRupees(totals.igstPaise)}")
                    }
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
                        Text("Type: $typeLabel")
                    }
                }
            }
            Row(modifier = Modifier.fillMaxWidth()) {
                OutlinedButton(onClick = { vm.clearDraft() }, modifier = Modifier.weight(1f).padding(end = 4.dp)) {
                    Text(stringResource(R.string.clear_form))
                }
                Button(
                    onClick = {
                        // Capture the totals BEFORE save: saveDraftBill clears
                        // the draft, so the share sheet below needs its own copy.
                        val totalsNow = totals
                        val labelNow = typeLabel
                        val typeNow = draft.type
                        val partyNow = draft.partyName
                        vm.saveDraftBill { number ->
                            savedNumber = number
                            savedTotalPaise = totalsNow?.roundedTotalPaise
                            savedTypeLabel = labelNow
                            savedType = typeNow
                            savedPartyName = partyNow
                        }
                    },
                    enabled = lines.isNotEmpty() && lineErrors.isEmpty() && draft.partyName.isNotBlank(),
                    modifier = Modifier.weight(1f).padding(start = 4.dp),
                ) { Text(saveLabel) }
            }
            if (savedNumber.isNotEmpty()) {
                Text(stringResource(R.string.invoice_saved))
                OutlinedButton(onClick = {
                    val shareText = shareTextForDoc(
                        typeLabel = savedTypeLabel,
                        number = savedNumber,
                        shopName = profile?.name ?: "",
                        partyName = savedPartyName,
                        totalPaise = savedTotalPaise ?: 0L,
                        upiId = profile?.upiId ?: "",
                        note = if (savedType == "estimate") estimateNote else "",
                    )
                    val intent = Intent(Intent.ACTION_SEND).apply {
                        type = "text/plain"
                        putExtra(Intent.EXTRA_TEXT, shareText)
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
