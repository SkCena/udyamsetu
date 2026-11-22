// UdyamSetu — Bill List. Saved invoices, newest first. Tapping a bill
// shows its lines + totals; credit/debit notes are shown signed (negative).
package `in`.udyamsetu.app.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Card
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import `in`.udyamsetu.app.data.InvoiceEntity
import `in`.udyamsetu.app.logic.decodeLines
import `in`.udyamsetu.app.logic.shareTextForDoc

@Composable
fun BillListScreen(vm: AppViewModel, nav: NavHostController) {
    val invoices by vm.repo.observeInvoices().collectAsState(initial = emptyList())
    val profile by vm.profile.collectAsState(initial = null)
    var selected by remember { mutableStateOf<InvoiceEntity?>(null) }
    LazyColumn(modifier = Modifier.padding(16.dp)) {
        item { SectionTitle(stringResource(R.string.list_title)) }
        if (invoices.isEmpty()) {
            item {
                EmptyGuide(stringResource(R.string.no_invoices), stringResource(R.string.quick_bill)) {
                    nav.navigate(Routes.BILLING)
                }
            }
        }
        items(invoices) { inv ->
            Card(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Text("${inv.number} — ${inv.partyName}", fontWeight = FontWeight.Bold)
                    Text("${inv.date} • ${stringResource(docTypeLabelRes(inv.type))} • ${formatRupees(inv.roundedTotalPaise)}")
                    TextButton(onClick = { selected = if (selected == inv) null else inv }) {
                        Text(if (selected == inv) "Hide" else "Details")
                    }
                    if (selected == inv) {
                        for (line in decodeLines(inv.linesJson)) {
                            Text("• ${line.name} × ${line.qty} — ${formatRupees(line.unitPricePaise)} (${line.taxRatePct}% GST)")
                        }
                        Text("${stringResource(R.string.taxable)} ${formatRupees(inv.taxablePaise)}")
                        // Same share row as after saving a bill.
                        ShareButtons(
                            shareText = shareTextForDoc(
                                typeLabel = stringResource(docTypeLabelRes(inv.type)),
                                number = inv.number,
                                shopName = profile?.name ?: "",
                                partyName = inv.partyName,
                                totalPaise = inv.roundedTotalPaise,
                                upiId = profile?.upiId ?: "",
                            ),
                            subject = "${stringResource(docTypeLabelRes(inv.type))} ${inv.number}",
                        )
                    }
                }
            }
        }
    }
}
