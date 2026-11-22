// UdyamSetu — Reports + export. Sales / purchase / cash-flow / P&L.
// Tally CSV is BETA — CA pilot pending, never "CA-ready". Export shares
// via the system share sheet; nothing leaves the phone without the user.
package `in`.udyamsetu.app.ui

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
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
import `in`.udyamsetu.app.logic.cashFlow
import `in`.udyamsetu.app.logic.profitLoss
import `in`.udyamsetu.app.logic.purchaseSummary
import `in`.udyamsetu.app.logic.salesSummary
import `in`.udyamsetu.app.logic.tallyCsv

@Composable
fun ReportsScreen(vm: AppViewModel, nav: NavHostController) {
    val context = LocalContext.current
    var salesTotal by remember { mutableStateOf(0L) }
    var purchaseTotal by remember { mutableStateOf(0L) }
    var cashIn by remember { mutableStateOf(0L) }
    var cashOut by remember { mutableStateOf(0L) }
    var grossProfit by remember { mutableStateOf(0L) }
    var csv by remember { mutableStateOf("") }

    LaunchedEffect(Unit) {
        runCatching {
            val invoices = vm.repo.savedInvoices()
            val entries = vm.repo.allLedgerRows()
            salesTotal = salesSummary(invoices).totalPaise
            purchaseTotal = purchaseSummary(entries).totalPaise
            val flow = cashFlow(entries)
            cashIn = flow.cashInPaise; cashOut = flow.cashOutPaise
            grossProfit = profitLoss(invoices, entries, 0L).grossProfitPaise
            csv = tallyCsv(invoices)
        }
    }

    LazyColumn(modifier = Modifier.padding(16.dp)) {
        item {
            SectionTitle(stringResource(R.string.reports_title))
            HintText(stringResource(R.string.hint_reports))
            Card(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Text("Sales: ${formatRupees(salesTotal)}", fontWeight = FontWeight.Bold)
                    Text("Purchases: ${formatRupees(purchaseTotal)}")
                    Text("Cash in: ${formatRupees(cashIn)} • Cash out: ${formatRupees(cashOut)}")
                    Text("Gross profit: ${formatRupees(grossProfit)}", fontWeight = FontWeight.Bold)
                }
            }
            OutlinedButton(onClick = {
                val intent = Intent(Intent.ACTION_SEND).apply {
                    type = "text/csv"
                    putExtra(Intent.EXTRA_TEXT, csv)
                    putExtra(Intent.EXTRA_SUBJECT, "UdyamSetu Tally export (BETA)")
                }
                context.startActivity(Intent.createChooser(intent, "Share Tally CSV (BETA)"))
            }) { Text("Share Tally CSV (BETA)") }
            Button(onClick = {
                // Share the real summary numbers (was a placeholder text).
                val summary = "UdyamSetu summary\n" +
                    "Sales: ${formatRupees(salesTotal)}\n" +
                    "Purchases: ${formatRupees(purchaseTotal)}\n" +
                    "Cash in: ${formatRupees(cashIn)} • Cash out: ${formatRupees(cashOut)}\n" +
                    "Gross profit: ${formatRupees(grossProfit)}\n" +
                    "— sent from UdyamSetu (free)"
                val intent = Intent(Intent.ACTION_SEND).apply {
                    type = "text/plain"
                    putExtra(Intent.EXTRA_TEXT, summary)
                }
                context.startActivity(Intent.createChooser(intent, "Share"))
            }) { Text("Share summary") }
            // CA pilot note: the Tally export is BETA until a real CA test passes.
            Card(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Text(stringResource(R.string.ca_pilot_title), fontWeight = FontWeight.Bold)
                    Text(stringResource(R.string.ca_pilot_note))
                    TextButton(onClick = {
                        context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://github.com/SkCena/udyamsetu/blob/main/docs/CA-PILOT.md")))
                    }) { Text("CA-PILOT.md") }
                }
            }
        }
    }
}
