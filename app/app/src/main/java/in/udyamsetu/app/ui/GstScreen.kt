// UdyamSetu — GST reports. GSTR-1 (B2B / B2CL / B2CS / CDNR) + GSTR-3B
// summaries from saved invoices. Outputs are DRAFTS — the app does not
// file. ITC is entered by the user from portal 2B; the app never guesses it.
package `in`.udyamsetu.app.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.Card
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
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
import `in`.udyamsetu.app.logic.Gstr1Summary
import `in`.udyamsetu.app.logic.Gstr3bSummary
import `in`.udyamsetu.app.logic.TaxHeads
import `in`.udyamsetu.app.logic.gstr1Summary
import `in`.udyamsetu.app.logic.gstr3bSummary

@Composable
fun GstScreen(vm: AppViewModel, nav: NavHostController) {
    var gstr1 by remember { mutableStateOf<Gstr1Summary?>(null) }
    var gstr3b by remember { mutableStateOf<Gstr3bSummary?>(null) }
    var itcIgst by remember { mutableStateOf("0") }
    var itcCgst by remember { mutableStateOf("0") }
    var itcSgst by remember { mutableStateOf("0") }
    var month by remember { mutableStateOf("") }

    LaunchedEffect(month, itcIgst, itcCgst, itcSgst) {
        runCatching {
            val invoices = vm.repo.savedInvoices()
            gstr1 = gstr1Summary(invoices, month = month.ifBlank { null })
            val itc = TaxHeads(
                igstPaise = ((itcIgst.toDoubleOrNull() ?: 0.0) * 100).toLong(),
                cgstPaise = ((itcCgst.toDoubleOrNull() ?: 0.0) * 100).toLong(),
                sgstPaise = ((itcSgst.toDoubleOrNull() ?: 0.0) * 100).toLong(),
            )
            gstr3b = gstr3bSummary(invoices, itc, month = month.ifBlank { null })
        }
    }

    LazyColumn(modifier = Modifier.padding(16.dp)) {
        item {
            SectionTitle(stringResource(R.string.gst_title))
            HintText(stringResource(R.string.hint_gst))
            LabeledField("Month (YYYY-MM, blank = all)", month, { month = it })
            LabeledField("ITC IGST ₹ (from portal 2B)", itcIgst, { itcIgst = it })
            LabeledField("ITC CGST ₹ (from portal 2B)", itcCgst, { itcCgst = it })
            LabeledField("ITC SGST ₹ (from portal 2B)", itcSgst, { itcSgst = it })
        }
        gstr1?.let { s ->
            item {
                Card(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Text("GSTR-1 (DRAFT)", fontWeight = FontWeight.Bold)
                        Text("Invoices: ${s.invoiceCount}")
                        Text("B2B parties: ${s.b2b.size} • B2CL: ${s.b2cl.size} • B2CS rows: ${s.b2cs.size} • Notes: ${s.cdnr.size}")
                        Text("Taxable: ${formatRupees(s.totals.taxablePaise)}")
                        Text("IGST ${formatRupees(s.totals.igstPaise)} • CGST ${formatRupees(s.totals.cgstPaise)} • SGST ${formatRupees(s.totals.sgstPaise)}")
                    }
                }
            }
        }
        gstr3b?.let { s ->
            item {
                Card(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Text("GSTR-3B (DRAFT)", fontWeight = FontWeight.Bold)
                        Text("Outward — IGST ${formatRupees(s.outward.igstPaise)}, CGST ${formatRupees(s.outward.cgstPaise)}, SGST ${formatRupees(s.outward.sgstPaise)}")
                        Text("Net payable — IGST ${formatRupees(s.netPayable.igstPaise)}, CGST ${formatRupees(s.netPayable.cgstPaise)}, SGST ${formatRupees(s.netPayable.sgstPaise)}")
                    }
                }
            }
        }
    }
}
