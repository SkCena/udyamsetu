// UdyamSetu — Basic calculator screen (standalone, NOT the GST
// calculator). Keypad: + - × ÷, %, backspace, clear, big display.
// All math is pure logic (logic/BasicCalcLogic.kt); this screen only
// reads key presses and shows the display.
package `in`.udyamsetu.app.ui

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
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavHostController
import `in`.udyamsetu.app.R
import `in`.udyamsetu.app.logic.BasicCalcState
import `in`.udyamsetu.app.logic.basicCalcPress

private val CALC_ROWS: List<List<String>> = listOf(
    listOf("C", "back", "%", "÷"),
    listOf("7", "8", "9", "×"),
    listOf("4", "5", "6", "-"),
    listOf("1", "2", "3", "+"),
    listOf("0", "00", ".", "="),
)

@Composable
fun BasicCalcScreen(vm: AppViewModel, nav: NavHostController) {
    var state by remember { mutableStateOf(BasicCalcState()) }
    LazyColumn(modifier = Modifier.padding(16.dp)) {
        item {
            SectionTitle(stringResource(R.string.basic_calc_title))
            HintText(stringResource(R.string.basic_calc_hint))
            Card(modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp)) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Text(
                        text = state.history,
                        fontSize = 13.sp,
                        modifier = Modifier.fillMaxWidth(),
                        textAlign = TextAlign.End,
                    )
                    Text(
                        text = state.entry,
                        fontSize = 32.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.fillMaxWidth(),
                        textAlign = TextAlign.End,
                    )
                }
            }
            for (row in CALC_ROWS) {
                Row(modifier = Modifier.fillMaxWidth()) {
                    for (key in row) {
                        val label = if (key == "back") "⌫" else key
                        val isOp = key in listOf("+", "-", "×", "÷", "%")
                        val isEq = key == "="
                        val mod = Modifier.weight(1f).padding(4.dp)
                        if (isEq) {
                            Button(
                                onClick = { state = basicCalcPress(state, key) },
                                modifier = mod,
                            ) { Text(label, fontSize = 22.sp) }
                        } else if (isOp) {
                            OutlinedButton(
                                onClick = { state = basicCalcPress(state, key) },
                                modifier = mod,
                            ) { Text(label, fontSize = 22.sp, fontWeight = FontWeight.Bold) }
                        } else {
                            OutlinedButton(
                                onClick = { state = basicCalcPress(state, key) },
                                modifier = mod,
                            ) { Text(label, fontSize = 22.sp) }
                        }
                    }
                }
            }
        }
    }
}
