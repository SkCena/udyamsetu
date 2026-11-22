// UdyamSetu — shared Compose bits. No business logic here.
// Money is always formatted at the display edge, from integer paise.
package `in`.udyamsetu.app.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import `in`.udyamsetu.app.R

/** Doc-type -> translated label. Invoice / non-GST / estimate / receipt
 *  labels come from the shared strings (site/i18n.js); the two note
 *  labels are app-only (the Site has no label for them). */
fun docTypeLabelRes(type: String): Int = when (type) {
    "non-gst" -> R.string.doc_non_gst
    "estimate" -> R.string.doc_estimate
    "credit-note" -> R.string.doc_type_credit_note
    "debit-note" -> R.string.doc_type_debit_note
    "receipt" -> R.string.doc_receipt
    else -> R.string.doc_invoice
}

/** Paise -> "₹236.00" (negative keeps the minus sign). */
fun formatRupees(paise: Long): String {
    val sign = if (paise < 0) "-" else ""
    val abs = kotlin.math.abs(paise)
    return "$sign₹${abs / 100}.${(abs % 100).toString().padStart(2, '0')}"
}

/** Brand navy + gold (premium, no green). Same values as Theme.kt and
 *  res/values/colors.xml (navy_800 / navy_900 / gold). */
val NAVY = Color(0xFF1B2A4A)
val NAVY_DARK = Color(0xFF16233D)
val GOLD = Color(0xFFC9A227)
val GOLD_LIGHT = Color(0xFFD4AF37)

@Composable
fun SectionTitle(text: String) {
    Text(
        text = text,
        fontSize = 18.sp,
        fontWeight = FontWeight.Bold,
        modifier = Modifier.padding(top = 16.dp, bottom = 8.dp),
    )
}

@Composable
fun HintText(text: String) {
    Text(text = text, fontSize = 13.sp, color = Color.Gray)
}

@Composable
// NOTE: onClick is the LAST parameter on purpose — every call site uses
// the trailing-lambda form BigButton("...") { ... }, and a trailing lambda
// only binds to the last parameter. (With `enabled` last, the lambda had
// nowhere to go and compileDebugKotlin failed on every BigButton call.)
fun BigButton(text: String, enabled: Boolean = true, onClick: () -> Unit) {
    Button(
        onClick = onClick,
        enabled = enabled,
        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
    ) { Text(text) }
}

@Composable
fun LabeledField(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String = "",
    singleLine: Boolean = true,
) {
    Column(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
        Text(text = label, fontSize = 13.sp, fontWeight = FontWeight.Medium)
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            placeholder = { if (placeholder.isNotEmpty()) Text(placeholder) },
            singleLine = singleLine,
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

/** Empty-state guide — never a blank screen (Easy-UI: shimmer + guide). */
@Composable
fun EmptyGuide(text: String, actionText: String, onAction: () -> Unit) {
    Column(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
        Text(text = text, fontSize = 14.sp, color = Color.Gray)
        Spacer(Modifier.height(8.dp))
        TextButton(onClick = onAction) { Text(actionText) }
    }
}

/** Indian state codes used by the Site (seller / buyer state). */
val INDIAN_STATES = listOf(
    "01" to "Jammu & Kashmir", "02" to "Himachal Pradesh", "03" to "Punjab",
    "04" to "Chandigarh", "05" to "Uttarakhand", "06" to "Haryana",
    "07" to "Delhi", "08" to "Rajasthan", "09" to "Uttar Pradesh",
    "10" to "Bihar", "11" to "Sikkim", "12" to "Arunachal Pradesh",
    "13" to "Nagaland", "14" to "Manipur", "15" to "Mizoram",
    "16" to "Tripura", "17" to "Meghalaya", "18" to "Assam",
    "19" to "West Bengal", "20" to "Jharkhand", "21" to "Odisha",
    "22" to "Chhattisgarh", "23" to "Madhya Pradesh", "24" to "Gujarat",
    "25" to "Daman & Diu", "26" to "Dadra & Nagar Haveli", "27" to "Maharashtra",
    "28" to "Andhra Pradesh", "29" to "Karnataka", "30" to "Goa",
    "31" to "Lakshadweep", "32" to "Kerala", "33" to "Tamil Nadu",
    "34" to "Puducherry", "35" to "Andaman & Nicobar", "36" to "Telangana",
    "37" to "Andhra Pradesh (New)",
)

fun stateName(code: String): String =
    INDIAN_STATES.firstOrNull { it.first == code }?.second ?: code
