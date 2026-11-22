// UdyamSetu — More. Setup, GST, Salary, Reports, Language, About, Theme.
package `in`.udyamsetu.app.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.navigation.NavHostController
import `in`.udyamsetu.app.R

@Composable
fun MoreScreen(vm: AppViewModel, nav: NavHostController) {
    LazyColumn(modifier = Modifier.padding(16.dp)) {
        item { SectionTitle(stringResource(R.string.tab_more)) }
        item {
            BigButton(stringResource(R.string.tab_setup)) { nav.navigate(Routes.SETUP) }
            BigButton(stringResource(R.string.tab_gst)) { nav.navigate(Routes.GST) }
            BigButton(stringResource(R.string.tab_payroll)) { nav.navigate(Routes.PAYROLL) }
            BigButton(stringResource(R.string.tab_reports)) { nav.navigate(Routes.REPORTS) }
            BigButton(stringResource(R.string.tab_calculator)) { nav.navigate(Routes.CALCULATOR) }
            BigButton(stringResource(R.string.tab_guide)) { nav.navigate(Routes.GUIDE) }
            BigButton(stringResource(R.string.tab_backup)) { nav.navigate(Routes.BACKUP) }
            BigButton(stringResource(R.string.lang_prompt_title)) { nav.navigate(Routes.LANGUAGE) }
            BigButton(stringResource(R.string.tab_about)) { nav.navigate(Routes.ABOUT) }
        }
        item { SectionTitle(stringResource(R.string.theme_title)) }
        item {
            val mode by vm.themeMode.collectAsState()
            for ((value, label) in listOf(
                "system" to R.string.theme_system,
                "light" to R.string.theme_light,
                "dark" to R.string.theme_dark,
            )) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { vm.setThemeMode(value) }
                        .padding(vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    RadioButton(
                        selected = mode == value,
                        onClick = { vm.setThemeMode(value) },
                    )
                    Text(
                        text = stringResource(label),
                        modifier = Modifier.padding(start = 8.dp),
                    )
                }
            }
        }
    }
}
