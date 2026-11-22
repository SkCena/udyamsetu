// UdyamSetu — Language-first screen. Shown on first launch, before Home.
// English is the default; the user picks any of the 10 languages and the
// choice is saved (never asked again). Same list as site/i18n.js.
package `in`.udyamsetu.app.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import `in`.udyamsetu.app.R

data class AppLanguage(val code: String, val name: String, val native: String)

val APP_LANGUAGES = listOf(
    AppLanguage("en", "English", "English"),
    AppLanguage("hi", "Hindi", "हिन्दी"),
    AppLanguage("bn", "Bengali", "বাংলা"),
    AppLanguage("te", "Telugu", "తెలుగు"),
    AppLanguage("mr", "Marathi", "मराठी"),
    AppLanguage("ta", "Tamil", "தமிழ்"),
    AppLanguage("gu", "Gujarati", "ગુજરાતી"),
    AppLanguage("pa", "Punjabi", "ਪੰਜਾਬੀ"),
    AppLanguage("or", "Odia", "ଓଡ଼ିଆ"),
    AppLanguage("ur", "Urdu", "اردو"),
)

@Composable
fun LanguageScreen(vm: AppViewModel, onDone: () -> Unit) {
    val current by vm.lang.collectAsState()
    var picked by remember { mutableStateOf(current) }
    Column(modifier = Modifier.padding(16.dp)) {
        Text(
            text = stringResource(R.string.lang_prompt_title),
            fontSize = 22.sp,
            fontWeight = FontWeight.Bold,
        )
        Text(
            text = stringResource(R.string.lang_prompt_hint),
            modifier = Modifier.padding(top = 8.dp, bottom = 16.dp),
        )
        LazyColumn(modifier = Modifier.weight(1f)) {
            items(APP_LANGUAGES) { lang ->
                val selected = lang.code == picked
                Button(
                    onClick = { picked = lang.code },
                    modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                ) {
                    Text("${lang.native} — ${lang.name}${if (selected) " ✓" else ""}")
                }
            }
        }
        Button(
            onClick = {
                vm.setLanguage(picked)
                onDone()
            },
            modifier = Modifier.fillMaxWidth(),
        ) { Text(stringResource(R.string.lang_continue)) }
    }
}
