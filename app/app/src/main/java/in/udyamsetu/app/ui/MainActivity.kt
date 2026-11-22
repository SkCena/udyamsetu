// UdyamSetu — MainActivity. One activity, Compose NavHost.
// The AppViewModel is created HERE (Activity scope) and passed down, so
// tab switches never lose the draft bill / language / FTU state.
// Language: the chosen locale is applied in attachBaseContext; changing it
// recreates the activity so strings reload from res/values-<lang>.
package `in`.udyamsetu.app.ui

import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.MoreHoriz
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.filled.Receipt
import androidx.compose.material.icons.filled.Store
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import `in`.udyamsetu.app.R
import `in`.udyamsetu.app.ui.theme.UdyamSetuTheme
import java.util.Locale

object Routes {
    const val LANGUAGE = "language"
    const val HOME = "home"
    const val SETUP = "setup"
    const val BILLING = "billing"
    const val BILLS = "bills"
    const val PARTY = "party"
    const val STOCK = "stock"
    const val GST = "gst"
    const val PAYROLL = "payroll"
    const val REPORTS = "reports"
    const val MORE = "more"
    const val ABOUT = "about"
    const val CALCULATOR = "calculator"
    const val BASIC_CALC = "basiccalc"
    const val GUIDE = "guide"
    const val BACKUP = "backup"
}

fun applyLocale(context: Context, lang: String): Context {
    val locale = Locale.forLanguageTag(lang)
    Locale.setDefault(locale)
    val config = Configuration(context.resources.configuration)
    config.setLocale(locale)
    return context.createConfigurationContext(config)
}

class MainActivity : ComponentActivity() {
    private val vm: AppViewModel by viewModels()
    // The NavHostController, so a widget tap (onNewIntent) can navigate
    // even when the app is already open. The home widget sends
    // "udyamsetu.route" = "billing" — before this, the extra was ignored
    // and the widget just opened Home.
    private var navRef: NavHostController? = null

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        if (intent.getStringExtra("udyamsetu.route") == "billing") {
            navRef?.navigate(Routes.BILLING)
        }
    }

    override fun attachBaseContext(newBase: Context) {
        // Language lives in plain SharedPreferences (written by
        // AppViewModel.setLanguage) so it can be read synchronously here
        // and applied before the first frame. Default: English.
        val lang = newBase.getSharedPreferences("udyamsetu_lang", Context.MODE_PRIVATE)
            .getString("lang", "en") ?: "en"
        super.attachBaseContext(applyLocale(newBase, lang))
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Saved theme, read synchronously so the first frame already uses
        // it (see AppViewModel.setThemeMode). Default: System.
        val savedTheme = getSharedPreferences("udyamsetu_theme", Context.MODE_PRIVATE)
            .getString("theme_mode", "system") ?: "system"
        vm.applyThemeMode(savedTheme)
        // Saved colour scheme, same synchronous pattern. Default: navy-gold.
        val savedScheme = getSharedPreferences("udyamsetu_theme", Context.MODE_PRIVATE)
            .getString("theme_scheme", "navy-gold") ?: "navy-gold"
        vm.applyThemeScheme(savedScheme)
        // Saved invoice template, same pattern. Default: classic.
        val savedTemplate = getSharedPreferences("udyamsetu_theme", Context.MODE_PRIVATE)
            .getString("invoice_template", "classic") ?: "classic"
        vm.applyInvoiceTemplate(savedTemplate)
        setContent {
            val themeMode by vm.themeMode.collectAsState()
            val themeScheme by vm.themeScheme.collectAsState()
            val darkTheme = when (themeMode) {
                "dark" -> true
                "light" -> false
                else -> isSystemInDarkTheme()
            }
            UdyamSetuTheme(darkTheme = darkTheme, scheme = themeScheme) {
                val langChosen by vm.langChosen.collectAsState()
                val nav = rememberNavController()
                navRef = nav
                // Widget deep-link: the home widget opens straight into New
                // Bill (see onNewIntent for the already-open case).
                val widgetRoute = intent.getStringExtra("udyamsetu.route")
                val start = when {
                    widgetRoute == "billing" -> Routes.BILLING
                    langChosen -> Routes.HOME
                    else -> Routes.LANGUAGE
                }
                Scaffold(
                    bottomBar = { BottomNav(nav) },
                ) { inner ->
                    NavHost(
                        navController = nav,
                        startDestination = start,
                        modifier = Modifier.padding(inner),
                    ) {
                        composable(Routes.LANGUAGE) { LanguageScreen(vm) { nav.navigate(Routes.HOME) } }
                        composable(Routes.HOME) { HomeScreen(vm, nav) }
                        composable(Routes.SETUP) { SetupScreen(vm, nav) }
                        composable(Routes.BILLING) { BillingScreen(vm, nav) }
                        composable(Routes.BILLS) { BillListScreen(vm, nav) }
                        composable(Routes.PARTY) { PartyScreen(vm, nav) }
                        composable(Routes.STOCK) { StockScreen(vm, nav) }
                        composable(Routes.GST) { GstScreen(vm, nav) }
                        composable(Routes.PAYROLL) { PayrollScreen(vm, nav) }
                        composable(Routes.REPORTS) { ReportsScreen(vm, nav) }
                        composable(Routes.MORE) { MoreScreen(vm, nav) }
                        composable(Routes.ABOUT) { AboutScreen(vm, nav) }
                        composable(Routes.CALCULATOR) { CalculatorScreen(vm, nav) }
                        composable(Routes.BASIC_CALC) { BasicCalcScreen(vm, nav) }
                        composable(Routes.GUIDE) { GuideScreen(vm, nav) }
                        composable(Routes.BACKUP) { BackupScreen(vm, nav) }
                    }
                }
            }
        }
    }
}

@Composable
fun BottomNav(nav: NavHostController) {
    val backStack by nav.currentBackStackEntryAsState()
    val current = backStack?.destination?.route
    val items = listOf(
        Triple(Routes.HOME, R.string.tab_home, Icons.Filled.Home),
        Triple(Routes.BILLS, R.string.tab_bills, Icons.Filled.Receipt),
        Triple(Routes.PARTY, R.string.tab_party, Icons.Filled.People),
        Triple(Routes.STOCK, R.string.tab_stock, Icons.Filled.Store),
        Triple(Routes.MORE, R.string.tab_more, Icons.Filled.MoreHoriz),
    )
    NavigationBar {
        for ((route, label, icon) in items) {
            NavigationBarItem(
                selected = current == route,
                onClick = {
                    nav.navigate(route) {
                        popUpTo(Routes.HOME) { saveState = true }
                        launchSingleTop = true
                        restoreState = true
                    }
                },
                icon = { Icon(icon, contentDescription = null) },
                label = { Text(stringResource(label)) },
            )
        }
    }
}
