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

/**
 * App theme wrapper. Pass darkTheme explicitly from the saved setting
 * (MainActivity resolves "system" / "light" / "dark"); default follows
 * the device setting.
 */
@Composable
fun UdyamSetuTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkColors else LightColors,
        content = content,
    )
}
