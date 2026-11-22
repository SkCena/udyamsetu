// UdyamSetu — GST Guide. Short, verified basics in clean cards — nothing
// messy, nothing guessed. Facts: GST slabs and the GSTR-1/3B due dates are
// the standard rules (monthly GSTR-1 11th, GSTR-3B 20th; QRMP 13th and
// 22nd/24th); e-invoice above ₹5 crore turnover and e-way bill above
// ₹50,000 goods value are the notified thresholds. Anything the app does
// not verify is marked "check on the portal".
package `in`.udyamsetu.app.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.Card
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.navigation.NavHostController
import `in`.udyamsetu.app.R

@Composable
fun GuideScreen(vm: AppViewModel, nav: NavHostController) {
    LazyColumn(modifier = Modifier.padding(16.dp)) {
        item {
            SectionTitle(stringResource(R.string.guide_title))
            HintText(stringResource(R.string.guide_hint))
        }
        // Six sections from the shared strings (site/i18n.js) — same text
        // as the Site guide, including the GSTR-9 annual return.
        for ((titleRes, bodyRes) in listOf(
            R.string.guide_s1_title to R.string.guide_body1,
            R.string.guide_s2_title to R.string.guide_body2,
            R.string.guide_s3_title to R.string.guide_body3,
            R.string.guide_s4_title to R.string.guide_body4,
            R.string.guide_s5_title to R.string.guide_body5,
            R.string.guide_s6_title to R.string.guide_body6,
        )) {
            item {
                Card(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Text(stringResource(titleRes), fontWeight = FontWeight.Bold)
                        Text(stringResource(bodyRes), modifier = Modifier.padding(top = 4.dp))
                    }
                }
            }
        }
    }
}
