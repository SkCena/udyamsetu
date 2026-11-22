// UdyamSetu Site — Google Drive backup config (PLACEHOLDER).
// Fill in your own OAuth client id to enable Drive backup. Nothing secret
// goes here — a client id is public; the client SECRET must never be in
// a web app or in this repo.
//
// Setup steps (5 minutes, free):
//   1. Go to Google Cloud Console (console.cloud.google.com) and make a
//      project (any name, e.g. "UdyamSetu").
//   2. APIs & Services > Library: enable "Google Drive API".
//   3. APIs & Services > Credentials > Create Credentials > OAuth client ID
//      > Application type: "Web application".
//   4. Authorized JavaScript origins: add your site origin, e.g.
//      https://<your-username>.github.io (and http://localhost:8000 to test).
//      No redirect URI is needed (this app uses the token flow, no server).
//   5. Copy the client id (ends with .apps.googleusercontent.com) and paste
//      it below. Then reload the site — the Drive Backup section in the
//      Reports tab will show the sign-in button.
//
// Without a client id, Drive backup shows "Setup pending" and the rest of
// the site works normally. Login is optional; backups are encrypted with
// your own passphrase before upload.
'use strict';
window.UdyamSetuDriveConfig = {
  clientId: '', // <-- paste your OAuth client id here, e.g. '123456789012-abc.apps.googleusercontent.com'
};
