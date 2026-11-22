// UdyamSetu — app theme. Premium deep-navy + gold Material3 light + dark
// schemes. No green anywhere: the old teal brand is gone (see colors.xml).
// Gold is the accent; on dark backgrounds the light gold stays readable,
// and on light backgrounds a darker gold is used for text so contrast holds.
// No screen sets its own colours, so switching the scheme here themes the
// whole app.
package `in`.udyamsetu.app.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// Brand navy + gold — same values as NAVY_DARK / NAVY / GOLD in
// ui/Common.kt and res/values/colors.xml (navy_900 / navy_800 / gold).
private val Navy900 = Color(0xFF16233D)
private val Navy800 = Color(0xFF1B2A4A)
private val Navy700 = Color(0xFF24365E)
private val Navy100 = Color(0xFFE8EDF5)
private val Gold = Color(0xFFC9A227)
private val GoldLight = Color(0xFFD4AF37)
private val GoldDark = Color(0xFF8C6D1F)
private val GoldPale = Color(0xFFF5EED3)

private val LightColors = lightColorScheme(
    primary = Navy800,
    onPrimary = Color.White,
    primaryContainer = Navy100,
    onPrimaryContainer = Navy900,
    secondary = GoldDark,
    onSecondary = Color.White,
    secondaryContainer = GoldPale,
    onSecondaryContainer = Color(0xFF5C4A12),
    tertiary = Gold,
    onTertiary = Navy900,
    background = Color(0xFFF8F9FC),
    onBackground = Color(0xFF1A202C),
    surface = Color(0xFFF8F9FC),
    onSurface = Color(0xFF1A202C),
    surfaceVariant = Navy100,
    onSurfaceVariant = Color(0xFF4A5568),
    outline = Color(0xFF7A8699),
)

private val DarkColors = darkColorScheme(
    primary = GoldLight,
    onPrimary = Navy900,
    primaryContainer = Navy700,
    onPrimaryContainer = GoldPale,
    secondary = Gold,
    onSecondary = Navy900,
    secondaryContainer = Navy700,
    onSecondaryContainer = GoldPale,
    tertiary = GoldLight,
    onTertiary = Navy900,
    background = Color(0xFF121A2C),
    onBackground = Color(0xFFE8EDF5),
    surface = Color(0xFF121A2C),
    onSurface = Color(0xFFE8EDF5),
    surfaceVariant = Navy700,
    onSurfaceVariant = Color(0xFFC3CEDF),
    outline = Color(0xFF8A97AD),
)

// Colour schemes: navy-gold (default, the schemes above) + midnight,
// royal indigo, copper rose, charcoal amber. Premium, no green anywhere.
// Light + dark both work inside every scheme. The Site uses the same
// five schemes (styles.css, data-scheme) with the same accent colours.
private fun lightScheme(
    primary: Color,
    primaryContainer: Color,
    secondary: Color,
    tertiary: Color,
) = lightColorScheme(
    primary = primary,
    onPrimary = Color.White,
    primaryContainer = primaryContainer,
    onPrimaryContainer = primary,
    secondary = secondary,
    onSecondary = Color.White,
    secondaryContainer = primaryContainer,
    onSecondaryContainer = primary,
    tertiary = tertiary,
    onTertiary = primary,
    background = Color(0xFFF8F9FC),
    onBackground = Color(0xFF1A202C),
    surface = Color(0xFFF8F9FC),
    onSurface = Color(0xFF1A202C),
    surfaceVariant = primaryContainer,
    onSurfaceVariant = Color(0xFF4A5568),
    outline = Color(0xFF7A8699),
)

private fun darkScheme(
    primary: Color,
    primaryContainer: Color,
    secondary: Color,
    tertiary: Color,
    background: Color,
    surface: Color,
) = darkColorScheme(
    primary = primary,
    onPrimary = Navy900,
    primaryContainer = primaryContainer,
    onPrimaryContainer = tertiary,
    secondary = secondary,
    onSecondary = Navy900,
    secondaryContainer = primaryContainer,
    onSecondaryContainer = tertiary,
    tertiary = tertiary,
    onTertiary = Navy900,
    background = background,
    onBackground = Color(0xFFE8EDF5),
    surface = surface,
    onSurface = Color(0xFFE8EDF5),
    surfaceVariant = primaryContainer,
    onSurfaceVariant = Color(0xFFC3CEDF),
    outline = Color(0xFF8A97AD),
)

/** Scheme name -> (light scheme, dark scheme). "navy-gold" is the default. */
fun schemeColors(scheme: String, darkTheme: Boolean): androidx.compose.material3.ColorScheme {
    if (!darkTheme) {
        return when (scheme) {
            "midnight" -> lightScheme(Color(0xFF1E293B), Color(0xFFE8EDF5), Color(0xFF64748B), Color(0xFF8FA3C7))
            "indigo" -> lightScheme(Color(0xFF3730A3), Color(0xFFEDEBFE), Color(0xFF5B54D6), Color(0xFF7C74E8))
            "copper" -> lightScheme(Color(0xFF6B3A1F), Color(0xFFF7E8DC), Color(0xFFB4653A), Color(0xFFC08A5A))
            "amber" -> lightScheme(Color(0xFF3F2E04), Color(0xFFFEF3C7), Color(0xFFB45309), Color(0xFFD97706))
            else -> LightColors
        }
    }
    return when (scheme) {
        "midnight" -> darkScheme(Color(0xFFA9BCE0), Color(0xFF1E293B), Color(0xFF8FA3C7), Color(0xFFC7D3EA), Color(0xFF0A0F1C), Color(0xFF131C2E))
        "indigo" -> darkScheme(Color(0xFFA5A0F0), Color(0xFF262052), Color(0xFF7C74E8), Color(0xFFCFCBFA), Color(0xFF12102A), Color(0xFF1D1938))
        "copper" -> darkScheme(Color(0xFFD99A6C), Color(0xFF3A2417), Color(0xFFB4653A), Color(0xFFF0C9A8), Color(0xFF17100B), Color(0xFF241A12))
        "amber" -> darkScheme(Color(0xFFFBBF24), Color(0xFF3A2A05), Color(0xFFD97706), Color(0xFFFDE68A), Color(0xFF141007), Color(0xFF1F1908))
        else -> DarkColors
    }
}

/** The dot colour shown next to each scheme name in the picker. */
fun schemeDot(scheme: String): Color = when (scheme) {
    "midnight" -> Color(0xFF8FA3C7)
    "indigo" -> Color(0xFF5B54D6)
    "copper" -> Color(0xFFB4653A)
    "amber" -> Color(0xFFD97706)
    else -> Gold
}

/**
 * App theme wrapper. Pass darkTheme explicitly from the saved setting
 * (MainActivity resolves "system" / "light" / "dark"); default follows
 * the device setting. Scheme is the saved colour theme ("navy-gold"
 * default) — see AppViewModel.setThemeScheme.
 */
@Composable
fun UdyamSetuTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    scheme: String = "navy-gold",
    content: @Composable () -> Unit,
) {
    MaterialTheme(
        colorScheme = schemeColors(scheme, darkTheme),
        content = content,
    )
}
