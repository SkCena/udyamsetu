// UdyamSetu — Backup (Google Drive, optional). Without login everything
// keeps working on the phone; backup only copies the database to the
// user's own Drive app folder, encrypted with a passphrase only the user
// knows. Until the OAuth client id is set in res/values/drive_config.xml
// this screen shows "Setup pending" and does nothing else.
// Sign-in is Google Sign-In with the Drive appDataFolder scope; the
// passphrase is never stored and never leaves the phone except inside the
// encrypted backup bytes.
package `in`.udyamsetu.app.ui

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.navigation.NavHostController
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.common.api.ApiException
import `in`.udyamsetu.app.R
import `in`.udyamsetu.app.data.BACKUP_FILE_PREFIX
import `in`.udyamsetu.app.data.downloadLatestBackup
import `in`.udyamsetu.app.data.driveService
import `in`.udyamsetu.app.data.googleSignInClient
import `in`.udyamsetu.app.data.isDriveConfigured
import `in`.udyamsetu.app.data.lastSignedInAccount
import `in`.udyamsetu.app.data.signOut
import `in`.udyamsetu.app.data.uploadBackupBytes
import `in`.udyamsetu.app.logic.decodeBackup
import `in`.udyamsetu.app.logic.decryptBackup
import `in`.udyamsetu.app.logic.encodeBackup
import `in`.udyamsetu.app.logic.encryptBackup
import kotlinx.coroutines.launch

@Composable
fun BackupScreen(vm: AppViewModel, nav: NavHostController) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var account by remember { mutableStateOf(lastSignedInAccount(context)) }
    var passphrase by remember { mutableStateOf("") }
    var status by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }

    val doneText = stringResource(R.string.drive_saved)
    val restoredText = stringResource(R.string.drive_restored)
    val noBackupText = stringResource(R.string.drive_no_backups)
    val wrongPassText = stringResource(R.string.backup_wrong_pass)
    val errorText = stringResource(R.string.drive_failed)
    val passShortText = stringResource(R.string.backup_pass_short)

    val signInLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.StartActivityForResult(),
    ) { result ->
        runCatching {
            val task = GoogleSignIn.getSignedInAccountFromIntent(result.data)
            account = task.getResult(ApiException::class.java)
            status = ""
        }.onFailure { status = errorText }
    }

    LazyColumn(modifier = Modifier.padding(16.dp)) {
        item {
            SectionTitle(stringResource(R.string.drive_title))
            HintText(stringResource(R.string.drive_hint))
            if (!isDriveConfigured(context)) {
                Text(stringResource(R.string.backup_setup_pending), modifier = Modifier.padding(top = 12.dp))
                Text(stringResource(R.string.backup_setup_note), modifier = Modifier.padding(top = 4.dp))
                return@item
            }
            if (account == null) {
                BigButton(stringResource(R.string.drive_sign_in)) {
                    signInLauncher.launch(googleSignInClient(context).signInIntent)
                }
            } else {
                Text("${stringResource(R.string.backup_signed_in_as)}${account?.email ?: ""}", modifier = Modifier.padding(vertical = 8.dp))
                Column(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
                    Text(text = stringResource(R.string.drive_passphrase), modifier = Modifier.padding(bottom = 4.dp))
                    OutlinedTextField(
                        value = passphrase,
                        onValueChange = { passphrase = it },
                        placeholder = { Text(stringResource(R.string.drive_passphrase_hint)) },
                        visualTransformation = PasswordVisualTransformation(),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
                BigButton(stringResource(R.string.drive_backup_now), enabled = !busy) {
                    if (passphrase.length < 4) {
                        status = passShortText
                        return@BigButton
                    }
                    val acc = account ?: return@BigButton
                    busy = true
                    scope.launch {
                        runCatching {
                            val data = vm.repo.backupSnapshot()
                            val bytes = encryptBackup(
                                encodeBackup(data).toByteArray(Charsets.UTF_8),
                                passphrase,
                            )
                            val name = "$BACKUP_FILE_PREFIX-${vm.repo.todayIso()}.bin"
                            uploadBackupBytes(driveService(context, acc), name, bytes)
                            status = doneText
                        }.onFailure { status = errorText }
                        busy = false
                    }
                }
                BigButton(stringResource(R.string.drive_restore), enabled = !busy) {
                    if (passphrase.length < 4) {
                        status = passShortText
                        return@BigButton
                    }
                    val acc = account ?: return@BigButton
                    busy = true
                    scope.launch {
                        runCatching {
                            val found = downloadLatestBackup(driveService(context, acc))
                            if (found == null) {
                                status = noBackupText
                            } else {
                                val plain = decryptBackup(found.second, passphrase)
                                val data = decodeBackup(String(plain, Charsets.UTF_8))
                                vm.repo.restoreBackupData(data)
                                status = restoredText
                            }
                        }.onFailure { e ->
                            status = if (e is javax.crypto.AEADBadTagException) wrongPassText else errorText
                        }
                        busy = false
                    }
                }
                BigButton(stringResource(R.string.drive_sign_out)) {
                    signOut(context)
                    account = null
                    status = ""
                }
            }
            if (status.isNotEmpty()) Text(status, modifier = Modifier.padding(top = 8.dp))
        }
    }
}
