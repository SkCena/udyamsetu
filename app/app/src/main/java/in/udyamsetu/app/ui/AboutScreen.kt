// UdyamSetu — About. Free, no paywall, no ads, data stays on the phone.
// The code is open source — the GitHub link is here for anyone who wants
// to read it, report a bug, or build it themselves.
package `in`.udyamsetu.app.ui

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.navigation.NavHostController
import `in`.udyamsetu.app.R

@Composable
fun AboutScreen(vm: AppViewModel, nav: NavHostController) {
    val context = LocalContext.current
    LazyColumn(modifier = Modifier.padding(16.dp)) {
        item {
            SectionTitle(stringResource(R.string.about_title))
            Text(stringResource(R.string.about_text))
            Text(
                stringResource(R.string.credit),
                modifier = Modifier.padding(top = 12.dp),
            )
            BigButton(stringResource(R.string.tab_backup)) { nav.navigate(Routes.BACKUP) }
            Column(modifier = Modifier.padding(top = 12.dp)) {
                Text(stringResource(R.string.github_title))
                Text(stringResource(R.string.github_note))
                TextButton(onClick = {
                    context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://github.com/SkCena/udyamsetu")))
                }) { Text(stringResource(R.string.github_link)) }
                TextButton(onClick = {
                    context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://github.com/SkCena/udyamsetu/releases")))
                }) { Text("APK — GitHub Releases") }
            }
        }
    }
}
