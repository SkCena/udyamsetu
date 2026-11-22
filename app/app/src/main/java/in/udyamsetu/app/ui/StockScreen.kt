// UdyamSetu — Stock / Inventory. Items, stock in/out, low-stock + expiry
// alerts, godown, batches. Saving a bill auto-decrements stock (Repository).
package `in`.udyamsetu.app.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Card
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
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
import `in`.udyamsetu.app.data.ItemEntity
import `in`.udyamsetu.app.data.MovementEntity
import `in`.udyamsetu.app.logic.ItemRow
import `in`.udyamsetu.app.logic.MovementRow
import `in`.udyamsetu.app.logic.expiringBatches
import `in`.udyamsetu.app.logic.lowStock
import `in`.udyamsetu.app.logic.stockQty
import java.util.UUID

@Composable
fun StockScreen(vm: AppViewModel, nav: NavHostController) {
    val items by vm.repo.observeItems().collectAsState(initial = emptyList())
    var name by remember { mutableStateOf("") }
    var hsn by remember { mutableStateOf("") }
    var salePrice by remember { mutableStateOf("") }
    var reorder by remember { mutableStateOf("0") }
    var movements by remember { mutableStateOf(emptyList<MovementRow>()) }
    var batches by remember { mutableStateOf(emptyList<`in`.udyamsetu.app.logic.BatchRow>()) }

    LaunchedEffect(Unit) {
        runCatching {
            movements = vm.repo.allMovements()
            batches = vm.repo.allBatches().map {
                `in`.udyamsetu.app.logic.BatchRow(it.id, it.itemId, it.batchNo, it.expiry, it.qty)
            }
        }
    }

    val rows = items.map { ItemRow(it.id, it.name, it.hsn, it.reorderLevel) }
    val low = lowStock(rows, movements)
    val expiring = expiringBatches(batches, 30, vm.repo.todayIso())

    LazyColumn(modifier = Modifier.padding(16.dp)) {
        item {
            SectionTitle(stringResource(R.string.stock_title))
            HintText(stringResource(R.string.hint_stock))
            if (low.isNotEmpty()) Text("Low stock: ${low.joinToString { it.name }}", fontWeight = FontWeight.Bold)
            if (expiring.isNotEmpty()) Text("Expiring soon: ${expiring.joinToString { "${it.batchNo} (${it.expiry})" }}")
            LabeledField(stringResource(R.string.item_name_ph), name, { name = it })
            LabeledField("HSN", hsn, { hsn = it })
            LabeledField("Sale price ₹", salePrice, { salePrice = it })
            LabeledField("Reorder level", reorder, { reorder = it })
            BigButton("+ Add item") {
                if (name.isNotBlank()) {
                    vm.saveItem(
                        ItemEntity(
                            id = UUID.randomUUID().toString(), name = name.trim(),
                            hsn = hsn.trim(), salePricePaise = ((salePrice.toDoubleOrNull() ?: 0.0) * 100).toLong(),
                            reorderLevel = reorder.toIntOrNull() ?: 0,
                        ),
                    )
                    name = ""; hsn = ""; salePrice = ""; reorder = "0"
                }
            }
        }
        items(items) { item ->
            val qty = stockQty(item.id, movements)
            Card(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Text(item.name, fontWeight = FontWeight.Bold)
                    Text("Stock: $qty ${item.unit} • Godown: ${item.godown} • HSN: ${item.hsn}")
                    Text("Sale: ${formatRupees(item.salePricePaise)}")
                }
            }
        }
    }
}
