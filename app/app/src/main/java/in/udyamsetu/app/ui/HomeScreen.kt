// UdyamSetu — Home. The Easy-UI home: 4 big Quick buttons, today's stats
// from real data, FTU (3 questions), first-bill guide, APK card, GitHub link.
// Onboarding talks about benefit ("udhaar yaad rahega"), not features.
package `in`.udyamsetu.app.ui

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import androidx.compose.ui.unit.sp
import androidx.navigation.NavHostController
import `in`.udyamsetu.app.R
import androidx.compose.runtime.LaunchedEffect
import `in`.udyamsetu.app.logic.lowStock
import `in`.udyamsetu.app.logic.partyBalance

@Composable
fun HomeScreen(vm: AppViewModel, nav: NavHostController) {
    val context = LocalContext.current
    val profile by vm.profile.collectAsState(initial = null)
    val ftu by vm.ftu.collectAsState()
    var todaySales by remember { mutableStateOf(0L) }
    var udhaarTotal by remember { mutableStateOf(0L) }
    var lowStockCount by remember { mutableStateOf(0) }
    var billCount by remember { mutableStateOf(0) }

    // Stats are best-effort: if a read fails, Home still renders.
    LaunchedEffect(Unit) {
        runCatching {
            val invoices = vm.repo.savedInvoices()
            val today = vm.repo.todayIso()
            // Today's sale = real sales only (GST + non-GST bills, notes
            // signed); estimates and receipts are not sales.
            val salesTypes = setOf("invoice", "non-gst", "credit-note", "debit-note")
            todaySales = invoices.filter { it.date == today && it.type in salesTypes }.sumOf { it.roundedTotalPaise }
            billCount = invoices.size
            val parties = vm.repo.allPartyRows()
            val entries = vm.repo.allLedgerRows()
            udhaarTotal = parties.sumOf { maxOf(0L, partyBalance(it, entries)) }
            val items = vm.repo.itemRows()
            val movements = vm.repo.allMovements()
            lowStockCount = lowStock(items, movements).size
        }
    }

    LazyColumn(modifier = Modifier.padding(16.dp)) {
        item {
            Text(text = stringResource(R.string.home_title), fontSize = 22.sp, fontWeight = FontWeight.Bold)
            Text(text = stringResource(R.string.home_hint), modifier = Modifier.padding(top = 4.dp, bottom = 12.dp))
        }
        item {
            Row(modifier = Modifier.fillMaxWidth()) {
                Button(onClick = { nav.navigate(Routes.BILLING) }, modifier = Modifier.weight(1f).padding(4.dp)) {
                    Text(stringResource(R.string.quick_bill))
                }
                Button(onClick = { nav.navigate(Routes.PARTY) }, modifier = Modifier.weight(1f).padding(4.dp)) {
                    Text(stringResource(R.string.quick_udhaar))
                }
            }
            Row(modifier = Modifier.fillMaxWidth()) {
                Button(onClick = { nav.navigate(Routes.STOCK) }, modifier = Modifier.weight(1f).padding(4.dp)) {
                    Text(stringResource(R.string.quick_stock))
                }
                Button(onClick = { nav.navigate(Routes.PARTY) }, modifier = Modifier.weight(1f).padding(4.dp)) {
                    Text(stringResource(R.string.quick_payment))
                }
            }
            Row(modifier = Modifier.fillMaxWidth()) {
                Button(onClick = { nav.navigate(Routes.CALCULATOR) }, modifier = Modifier.weight(1f).padding(4.dp)) {
                    Text(stringResource(R.string.tab_calculator))
                }
                Button(onClick = { nav.navigate(Routes.GUIDE) }, modifier = Modifier.weight(1f).padding(4.dp)) {
                    Text(stringResource(R.string.tab_guide))
                }
            }
        }
        item {
            Card(modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp)) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Text("${stringResource(R.string.stat_sales)}: ${formatRupees(todaySales)}", fontWeight = FontWeight.Bold)
                    Text("${stringResource(R.string.stat_udhaar)}: ${formatRupees(udhaarTotal)}")
                    Text("${stringResource(R.string.stat_low_stock)}: $lowStockCount")
                    Text("Bills: $billCount")
                }
            }
        }
        // FTU — 3 small questions, saved once.
        item {
            var shopType by remember { mutableStateOf(ftu.shopType) }
            var gst by remember { mutableStateOf(ftu.gstRegistered) }
            var sells by remember { mutableStateOf(ftu.sellsWhat) }
            Card(modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp)) {
                Column(modifier = Modifier.padding(12.dp)) {
                    SectionTitle(stringResource(R.string.ftu_title))
                    LabeledField(stringResource(R.string.ftu_shop_type), shopType, { shopType = it })
                    LabeledField(stringResource(R.string.ftu_gst), gst, { gst = it })
                    LabeledField(stringResource(R.string.ftu_sell), sells, { sells = it })
                    Button(onClick = { vm.saveFtu(FtuAnswers(shopType, gst, sells)) }) {
                        Text(stringResource(R.string.ftu_save))
                    }
                }
            }
        }
        // First-bill guide — shown until the first bill is saved.
        // The WHOLE card is tappable (device test: tapping the card did
        // nothing before — only the small Setup button worked). Tap starts
        // the guided first bill: Setup first when the shop name is missing,
        // otherwise straight into New Bill.
        if (billCount == 0) {
            item {
                val startFirstBill = {
                    if ((profile?.name ?: "").isBlank()) nav.navigate(Routes.SETUP)
                    else nav.navigate(Routes.BILLING)
                }
                Card(
                    onClick = startFirstBill,
                    modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
                ) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Text(stringResource(R.string.first_bill_title), fontWeight = FontWeight.Bold)
                        Text(stringResource(R.string.guide_step1))
                        Text(stringResource(R.string.guide_step2))
                        Text(stringResource(R.string.guide_step3))
                        Button(onClick = startFirstBill) {
                            Text(stringResource(R.string.first_bill_start))
                        }
                    }
                }
            }
        }
        // APK-needed options — clearly badged, with the Releases link.
        item {
            Card(modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp)) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Text(stringResource(R.string.apk_title), fontWeight = FontWeight.Bold)
                    Text(stringResource(R.string.apk_note))
                    Text("• Barcode scan — ${stringResource(R.string.apk_needed)}")
                    Text("• Home widget — ${stringResource(R.string.apk_needed)}")
                    Text("• Background sync — ${stringResource(R.string.apk_needed)}")
                    TextButton(onClick = {
                        context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://github.com/SkCena/udyamsetu/releases")))
                    }) { Text(stringResource(R.string.github_link)) }
                }
            }
        }
        // Star prompt (support): polite, dismissible — same card as More.
        item { StarCard(vm) }
        item {
            TextButton(onClick = { nav.navigate(Routes.ABOUT) }) {
                Text(stringResource(R.string.tab_about))
            }
            Text(text = profile?.name ?: "", modifier = Modifier.padding(horizontal = 8.dp))
        }
    }
}
