# Open MILDINCIDENT on your computer

1. Install **Node.js 24.19.0** from https://nodejs.org/download/release/v24.19.0/ (Windows/macOS installer for your computer). It includes npm. Restart your terminal after installation. Confirm `node --version` prints `v24.19.0`.
2. Download the staging branch using GitHub **Code → Download ZIP**, then extract it. The branch is `staging/release-readiness-20261029`, not main. Open Terminal/PowerShell in the extracted folder containing `package.json`.
3. Run `npm ci --omit=dev`.
4. Copy `.env.example` to `.env.local` and open the copy in a text editor. Enter your existing real `N8N_API_KEY` and `BUFFER_ACCESS_TOKEN` after the equals signs. Leave PORT=4174. Keep this file private; it is ignored by Git. Do not paste credentials into terminal commands. Cloud environment bindings do not automatically transfer to your computer, and proxy placeholders are not real credentials. No additional Buffer token is needed.
5. Run `npm run workspace:local`. Leave the terminal open. Wait for “Read-only workspace refreshed”, then open **http://127.0.0.1:4174/** in your browser. Stop with Ctrl+C.

Git alternative to ZIP:

```sh
git clone --branch staging/release-readiness-20261029 --single-branch https://github.com/Veev078/Mildincident.git
cd Mildincident
npm ci --omit=dev
npm run workspace:local
```

Configure `.env.local` before the final command when you want actual source data. The n8n hostname is already fixed in the application; no N8N_URL or Cloudinary credentials are required. Internet access to that n8n host and api.buffer.com is required. No Render account is involved.

## Without credentials

You can omit `.env.local` and start the HTTP server. A fresh GitHub download has **no private snapshot**: the interface reports source unavailable, and story browsing/editing, carousels, music and analytics have no content. It does not insert demo stories. A previously populated local cache can be inspected without working credentials; refresh then fails and the old cache is retained. Both API credentials are required for a fresh complete refresh. There is no n8n-only refresh mode.

## Safety and saved work

The workspace uses fixed n8n GETs and fixed read-only Buffer GraphQL queries. Startup/refresh cannot update workflows, create drafts, schedule, publish or delete production data. Caption/image-order/notes/music edits save only in `.local/workspace/`, with local history; proposal downloads do not apply to production. Preserve that entire directory when moving computers. Opening the separate “Existing Founder Studio” external link enters the existing production application, outside this local app's guarantees.

Real archival thumbnail delivery remains unresolved and some pictures may be unavailable on your network. Music is editorial direction, not audio playback; there is no video editor. These limitations do not prevent viewing the dashboard and text content.

If port 4174 is busy, set PORT=4175 in `.env.local`, restart and open http://127.0.0.1:4175/. If refresh fails, check that both existing credentials are entered correctly; the app will not log their values. Do not rotate Buffer tokens just to try startup.
