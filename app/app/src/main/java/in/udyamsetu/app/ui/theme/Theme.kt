// UdyamSetu — app theme. Teal-based Material3 light + dark schemes.
// The dark scheme keeps the same teal brand: the primary becomes a light
// teal so it stays readable on the dark background, and the dark teal
// becomes the primary container. No screen sets its own colours, so
// switching the scheme here themes the whole app.
package `in`.udyamsetu.app.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// Brand teals — same values as TEAL_DARK / TEAL in ui/Common.kt and
// res/values/colors.xml (teal_700 / teal_100).
private val Teal700 = Color(0xFF0F766E)
private val Teal500 = Color(0xFF14B8A6)
private val Teal300 = Color(0xFF5EEAD4)
private val Teal100 = Color(0xFFCCFBF1)
private val Teal900 = Color(0xFF134E4A)
private val Teal950 = Color(0xFF042F2E)

private val LightColors = lightColorScheme(
    primary = Teal700,
    onPrimary = Color.White,
    primaryContainer = Teal100,
    onPrimaryContainer = Teal900,
    secondary = Teal500,
    onSecondary = Color.White,
    secondaryContainer = Teal100,
    onSecondaryContainer = Teal900,
    background = Color(0xFFFFFBFF),
    onBackground = Color(0xFF191C1C),
    surface = Color(0xFFFFFBFF),
    onSurface = Color(0xFF191C1C),
    surfaceVariant = Color(0xFFDAE5E3),
    onSurfaceVariant = Color(0xFF3F4948),
    outline = Color(0xFF6F7979),
)

private val DarkColors = darkColorScheme(
    primary = Teal300,
    onPrimary = Teal950,
    primaryContainer = Teal700,
    onPrimaryContainer = Teal100,
    secondary = Teal300,
    onSecondary = Teal950,
    secondaryContainer = Teal700,
    onSecondaryContainer = Teal100,
    background = Color(0xFF191C1C),
    onBackground = Color(0xFFE0E3E2),
    surface = Color(0xFF191C1C),
    onSurface = Color(0xFFE0E3E2),
    surfaceVariant = Color(0xFF3F4948),
    onSurfaceVariant = Color(0xFFBFC9C8),
    outline = Color(0xFF899393),
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
