// UdyamSetu — Business Setup. Fill once; the details appear on every bill.
// GSTIN is optional and validated (checksum) when given. 5-minute setup.
package `in`.udyamsetu.app.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.navigation.NavHostController
import `in`.udyamsetu.app.R
import `in`.udyamsetu.app.data.ProfileEntity

@Composable
fun SetupScreen(vm: AppViewModel, nav: NavHostController) {
    val profile by vm.profile.collectAsState(initial = null)
    var name by remember { mutableStateOf("") }
    var gstin by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var address by remember { mutableStateOf("") }
    var upi by remember { mutableStateOf("") }
    var prefix by remember { mutableStateOf("INV") }
    var sellerState by remember { mutableStateOf("21") }
    var loaded by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf("") }
    var errors by remember { mutableStateOf(emptyList<String>()) }

    // Prefill once when the profile loads (never overwrite typing).
    if (profile != null && !loaded) {
        val p = profile!!
        name = p.name; gstin = p.gstin ?: ""; phone = p.phone
        address = p.address; upi = p.upiId; prefix = p.invoicePrefix
        sellerState = p.sellerState
        loaded = true
    }

    LazyColumn(modifier = Modifier.padding(16.dp)) {
        item {
            SectionTitle(stringResource(R.string.setup_title))
            HintText(stringResource(R.string.setup_hint))
            LabeledField(stringResource(R.string.biz_name), name, { name = it }, stringResource(R.string.biz_name_ph))
            LabeledField(stringResource(R.string.biz_gstin), gstin, { gstin = it.uppercase() }, stringResource(R.string.biz_gstin_ph))
            LabeledField(stringResource(R.string.biz_phone), phone, { phone = it })
            LabeledField(stringResource(R.string.biz_address), address, { address = it }, stringResource(R.string.biz_address_ph), singleLine = false)
            LabeledField(stringResource(R.string.upi_label), upi, { upi = it })
            LabeledField(stringResource(R.string.inv_prefix), prefix, { prefix = it.uppercase() })
            LabeledField(stringResource(R.string.seller_state), sellerState, { sellerState = it })
            if (errors.isNotEmpty()) {
                Text(stringResource(R.string.setup_invalid))
                if ("gstin" in errors) Text(stringResource(R.string.gstin_error))
            }
            if (message.isNotEmpty()) Text(message)
            BigButton(stringResource(R.string.save_setup)) {
                val nextSeq = profile?.nextSeq ?: 1
                vm.saveProfile(
                    ProfileEntity(
                        name = name.trim(), gstin = gstin.trim().ifBlank { null },
                        phone = phone.trim(), address = address.trim(), upiId = upi.trim(),
                        invoicePrefix = prefix.trim().ifBlank { "INV" },
                        nextSeq = nextSeq, sellerState = sellerState.trim(),
                    ),
                ) { errs ->
                    errors = errs
                    message = if (errs.isEmpty()) "saved" else ""
                }
            }
            if (message == "saved") Text(stringResource(R.string.setup_saved))
        }
    }
}
