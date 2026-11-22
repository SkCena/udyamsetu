// UdyamSetu — More. Setup, GST, Salary, Reports, Language, About.
package `in`.udyamsetu.app.ui

import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
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
            BigButton(stringResource(R.string.lang_prompt_title)) { nav.navigate(Routes.LANGUAGE) }
            BigButton(stringResource(R.string.tab_about)) { nav.navigate(Routes.ABOUT) }
        }
    }
}
