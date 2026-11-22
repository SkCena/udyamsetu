// UdyamSetu — Google Drive backup (Android-only; the codec + encryption
// live in logic/BackupLogic.kt so host tests cover them).
// Flow: optional Google sign-in (Drive appDataFolder scope) -> the whole
// database is snapshotted, encrypted with the user's passphrase, and
// uploaded as one file into the app's private Drive folder. Restore does
// the reverse (latest file, same passphrase). No backup ever happens
// without the user tapping the button, and the passphrase is never stored.
// Setup: the Google Cloud OAuth client id goes in
// res/values/drive_config.xml (drive_oauth_client_id). Until it is filled,
// isDriveConfigured() is false and the Backup screen shows "Setup pending"
// — the rest of the app works normally. No secret is in the repo.
package `in`.udyamsetu.app.data

import android.content.Context
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInAccount
import com.google.android.gms.auth.api.signin.GoogleSignInClient
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.Scope
import com.google.api.client.extensions.android.http.AndroidHttp
import com.google.api.client.googleapis.extensions.android.gms.auth.GoogleAccountCredential
import com.google.api.client.json.gson.GsonFactory
import com.google.api.services.drive.Drive
import com.google.api.services.drive.DriveScopes
import com.google.api.services.drive.model.File
import `in`.udyamsetu.app.R
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream

const val BACKUP_FILE_PREFIX = "udyamsetu-backup"
const val BACKUP_MIME_TYPE = "application/octet-stream"

/** True only when the OAuth client id placeholder has been filled in. */
fun isDriveConfigured(context: Context): Boolean =
    context.getString(R.string.drive_oauth_client_id).isNotBlank()

fun googleSignInClient(context: Context): GoogleSignInClient {
    val options = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
        .requestEmail()
        .requestScopes(Scope(DriveScopes.DRIVE_APPDATA))
        .build()
    return GoogleSignIn.getClient(context, options)
}

fun lastSignedInAccount(context: Context): GoogleSignInAccount? =
    GoogleSignIn.getLastSignedInAccount(context)

fun signOut(context: Context) {
    googleSignInClient(context).signOut()
}

/** Drive client for a signed-in account (appDataFolder scope only). */
fun driveService(context: Context, account: GoogleSignInAccount): Drive {
    val credential = GoogleAccountCredential.usingOAuth2(
        context, listOf(DriveScopes.DRIVE_APPDATA),
    ).apply { selectedAccount = account.account }
    return Drive.Builder(
        AndroidHttp.newCompatibleTransport(),
        GsonFactory.getDefaultInstance(),
        credential,
    ).setApplicationName("UdyamSetu").build()
}

/** Upload encrypted bytes as a new file in the appDataFolder. Returns the file id. */
suspend fun uploadBackupBytes(drive: Drive, name: String, bytes: ByteArray): String =
    withContext(Dispatchers.IO) {
        val meta = File().apply {
            this.name = name
            parents = listOf("appDataFolder")
        }
        val content = com.google.api.client.http.ByteArrayContent(BACKUP_MIME_TYPE, bytes)
        drive.files().create(meta, content).setFields("id").execute().id
    }

/** Download the newest backup file, or null when none exists yet. */
suspend fun downloadLatestBackup(drive: Drive): Pair<String, ByteArray>? =
    withContext(Dispatchers.IO) {
        val list = drive.files().list()
            .setSpaces("appDataFolder")
            .setQ("name contains '$BACKUP_FILE_PREFIX'")
            .setOrderBy("createdTime desc")
            .setPageSize(1)
            .setFields("files(id,name)")
            .execute()
        val file = list.files?.firstOrNull() ?: return@withContext null
        val out = ByteArrayOutputStream()
        drive.files().get(file.id).executeMediaAndDownloadTo(out)
        file.name to out.toByteArray()
    }
