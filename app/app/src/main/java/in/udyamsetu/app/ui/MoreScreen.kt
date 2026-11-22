// UdyamSetu — More. Sections, not a pile of buttons: Tools, Business,
// App. Theme = Light/Dark/System + five premium colour schemes (no
// green). Star prompt here too. Smooth on low-end phones: no heavy
// effects — items fade/slide in once via animateItem, the star card
// shrinks away on dismiss, and taps get the standard Material ripple.
package `in`.udyamsetu.app.ui

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Assessment
import androidx.compose.material.icons.filled.Backup
import androidx.compose.material.icons.filled.Calculate
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Language
import androidx.compose.material.icons.filled.MenuBook
import androidx.compose.material.icons.filled.Receipt
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Work
import androidx.compose.material3.Card
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavHostController
import `in`.udyamsetu.app.R
import `in`.udyamsetu.app.ui.theme.schemeDot

@Composable
private fun MoreRow(icon: ImageVector, label: String, onClick: () -> Unit) {
    Card(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 13.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary,
            )
            Text(
                text = label,
                fontSize = 16.sp,
                modifier = Modifier.weight(1f).padding(start = 12.dp),
            )
            Icon(
                imageVector = Icons.Filled.ChevronRight,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun MoreScreen(vm: AppViewModel, nav: NavHostController) {
    val themeMode by vm.themeMode.collectAsState()
    val themeScheme by vm.themeScheme.collectAsState()
    LazyColumn(modifier = Modifier.padding(horizontal = 16.dp)) {
        item(modifier = Modifier.animateItem()) {
            SectionTitle(stringResource(R.string.tab_more))
        }
        item(modifier = Modifier.animateItem()) {
            Text(
                text = stringResource(R.string.more_tools),
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.padding(top = 8.dp, bottom = 4.dp),
            )
        }
        item(modifier = Modifier.animateItem()) { MoreRow(Icons.Filled.Calculate, stringResource(R.string.tab_calculator)) { nav.navigate(Routes.CALCULATOR) } }
        item(modifier = Modifier.animateItem()) { MoreRow(Icons.Filled.Calculate, stringResource(R.string.tab_basic_calc)) { nav.navigate(Routes.BASIC_CALC) } }
        item(modifier = Modifier.animateItem()) { MoreRow(Icons.Filled.MenuBook, stringResource(R.string.tab_guide)) { nav.navigate(Routes.GUIDE) } }
        item(modifier = Modifier.animateItem()) { MoreRow(Icons.Filled.Backup, stringResource(R.string.tab_backup)) { nav.navigate(Routes.BACKUP) } }
        item(modifier = Modifier.animateItem()) {
            Text(
                text = stringResource(R.string.more_business),
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.padding(top = 12.dp, bottom = 4.dp),
            )
        }
        item(modifier = Modifier.animateItem()) { MoreRow(Icons.Filled.Settings, stringResource(R.string.tab_setup)) { nav.navigate(Routes.SETUP) } }
        item(modifier = Modifier.animateItem()) { MoreRow(Icons.Filled.Receipt, stringResource(R.string.tab_gst)) { nav.navigate(Routes.GST) } }
        item(modifier = Modifier.animateItem()) { MoreRow(Icons.Filled.Work, stringResource(R.string.tab_payroll)) { nav.navigate(Routes.PAYROLL) } }
        item(modifier = Modifier.animateItem()) { MoreRow(Icons.Filled.Assessment, stringResource(R.string.tab_reports)) { nav.navigate(Routes.REPORTS) } }
        item(modifier = Modifier.animateItem()) {
            Text(
                text = stringResource(R.string.more_app),
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.padding(top = 12.dp, bottom = 4.dp),
            )
        }
        item(modifier = Modifier.animateItem()) { MoreRow(Icons.Filled.Language, stringResource(R.string.lang_prompt_title)) { nav.navigate(Routes.LANGUAGE) } }
        item(modifier = Modifier.animateItem()) { MoreRow(Icons.Filled.Info, stringResource(R.string.tab_about)) { nav.navigate(Routes.ABOUT) } }
        // Star prompt (same card as Home — dismissing it here hides it
        // everywhere; the choice is saved in AppViewModel).
        item(modifier = Modifier.animateItem()) { StarCard(vm) }
        // Theme: Light / Dark / System + colour scheme.
        item(modifier = Modifier.animateItem()) {
            SectionTitle(stringResource(R.string.theme_title))
            Text(
                text = stringResource(R.string.theme_mode_title),
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.padding(bottom = 4.dp),
            )
            for ((value, label) in listOf(
                "system" to R.string.theme_system,
                "light" to R.string.theme_light,
                "dark" to R.string.theme_dark,
            )) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { vm.setThemeMode(value) }
                        .padding(vertical = 2.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    RadioButton(
                        selected = themeMode == value,
                        onClick = { vm.setThemeMode(value) },
                    )
                    Text(
                        text = stringResource(label),
                        modifier = Modifier.padding(start = 8.dp),
                    )
                }
            }
            Text(
                text = stringResource(R.string.theme_scheme),
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.padding(top = 12.dp, bottom = 4.dp),
            )
            for ((scheme, label) in listOf(
                "navy-gold" to R.string.scheme_navy_gold,
                "midnight" to R.string.scheme_midnight,
                "indigo" to R.string.scheme_indigo,
                "copper" to R.string.scheme_copper,
                "amber" to R.string.scheme_amber,
            )) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { vm.setThemeScheme(scheme) }
                        .padding(vertical = 2.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    RadioButton(
                        selected = themeScheme == scheme,
                        onClick = { vm.setThemeScheme(scheme) },
                    )
                    Box(
                        modifier = Modifier
                            .padding(start = 8.dp)
                            .size(18.dp)
                            .clip(CircleShape)
                            .background(schemeDot(scheme)),
                    )
                    Text(
                        text = stringResource(label),
                        modifier = Modifier.padding(start = 8.dp),
                    )
                }
            }
        }
        item(modifier = Modifier.animateItem()) {
            Text(
                text = stringResource(R.string.credit),
                fontSize = 13.sp,
                modifier = Modifier.padding(vertical = 16.dp),
            )
        }
    }
}
