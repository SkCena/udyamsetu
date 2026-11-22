// UdyamSetu — GST Calculator. Two directions, same screen:
//   exclusive: amount (without GST) + rate -> GST + total.
//   inclusive: total (GST included) + rate -> amount without GST + GST.
// All math is pure logic (logic/CalculatorLogic.kt); this screen only
// reads the fields and shows the result.
package `in`.udyamsetu.app.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.Card
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
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
import `in`.udyamsetu.app.logic.CALC_RATES
import `in`.udyamsetu.app.logic.GstCalcResult
import `in`.udyamsetu.app.logic.calcExclusive
import `in`.udyamsetu.app.logic.calcInclusive

@Composable
fun CalculatorScreen(vm: AppViewModel, nav: NavHostController) {
    var amount by remember { mutableStateOf("") }
    var rate by remember { mutableStateOf(18.0) }
    var inclusive by remember { mutableStateOf(false) }
    var result by remember { mutableStateOf<GstCalcResult?>(null) }
    var error by remember { mutableStateOf(false) }

    LazyColumn(modifier = Modifier.padding(16.dp)) {
        item {
            SectionTitle(stringResource(R.string.calc_title))
            HintText(stringResource(R.string.calc_hint))
            LabeledField(stringResource(R.string.calc_amount), amount, { amount = it; result = null })
            Text(stringResource(R.string.calc_rate), modifier = Modifier.padding(top = 8.dp))
            Row(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
                for (r in CALC_RATES) {
                    val rateLabel = if (r == r.toInt().toDouble()) "${r.toInt()}%" else "$r%"
                    OutlinedButton(
                        onClick = { rate = r; result = null },
                        modifier = Modifier.weight(1f).padding(horizontal = 2.dp),
                    ) { Text(if (rate == r) "$rateLabel ✓" else rateLabel) }
                }
            }
            Row(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
                OutlinedButton(
                    onClick = { inclusive = false; result = null },
                    modifier = Modifier.weight(1f).padding(end = 4.dp),
                ) { Text(if (!inclusive) "${stringResource(R.string.calc_exclusive)} ✓" else stringResource(R.string.calc_exclusive)) }
                OutlinedButton(
                    onClick = { inclusive = true; result = null },
                    modifier = Modifier.weight(1f).padding(start = 4.dp),
                ) { Text(if (inclusive) "${stringResource(R.string.calc_inclusive)} ✓" else stringResource(R.string.calc_inclusive)) }
            }
            BigButton(stringResource(R.string.calc_calculate)) {
                val paise = ((amount.toDoubleOrNull() ?: -1.0) * 100).toLong()
                if (paise < 0) {
                    error = true
                    result = null
                } else {
                    error = false
                    result = runCatching {
                        if (inclusive) calcInclusive(paise, rate) else calcExclusive(paise, rate)
                    }.getOrNull()
                }
            }
            if (error) Text(stringResource(R.string.bill_invalid))
            result?.let { r ->
                val rateLabel = if (rate == rate.toInt().toDouble()) "${rate.toInt()}%" else "$rate%"
                Card(modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp)) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Text("${stringResource(R.string.calc_taxable)}: ${formatRupees(r.basePaise)}")
                        Text("${stringResource(R.string.calc_gst)} ($rateLabel): ${formatRupees(r.gstPaise)}", fontWeight = FontWeight.Bold)
                        Text("${stringResource(R.string.calc_total)}: ${formatRupees(r.totalPaise)}", fontWeight = FontWeight.Bold)
                    }
                }
            }
            // The standalone basic calculator lives on its own screen.
            TextButton(onClick = { nav.navigate(Routes.BASIC_CALC) }) {
                Text(stringResource(R.string.tab_basic_calc))
            }
        }
    }
}
