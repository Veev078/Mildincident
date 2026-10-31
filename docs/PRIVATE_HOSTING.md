# V11: manually update the existing service only

After reviewing the tested SHA supplied with the V11 release:

1. Download a verified private backup from the existing Studio and keep an offsite copy. Preserve the persistent disk, authentication databases, draft/research histories and current environment variables.
2. Open the **existing** MILDINCIDENT Render Web Service. Confirm the development branch is `development/photography-review-20261029` and auto-deploy remains off.
3. Choose **Manual Deploy → Deploy a specific commit**, using the exact final verified SHA. If only Deploy latest commit is offered, first confirm the branch still points at that SHA. Do not apply the Blueprint or create another service.
4. Verify Live/health, sign-in and a separate unauthenticated browser (private API must return 401). Check Discover's honest empty/history views and compact activity; open an existing story, save direction/caption/order, refresh and sign out/in to confirm persistence. Check readiness and existing provider IDs without sending anything.
5. Preserve n8n read-only delivery and generation-disabled behavior. These local changes do not require workflow activation, new secrets or a Buffer operation. The added research-equivalence tables initialize additively; original records are retained.
6. If rollback is needed, manually redeploy the prior known working code commit while preserving the disk and histories. Do not restore or overwrite databases against a running process; follow the established stopped-writer restore procedure only if data recovery is separately needed.

This is a manual procedure for the existing service, **not a deployment performed by Codex**. The older initial-provisioning material below is historical setup guidance, not a direction to recreate a service during V11.

---

# Existing Render service: login patch deployment

The founder now reports a running Render service with a login CSRF failure. The section below preserves the earlier pre-deployment assessment as historical context. This patch has been verified with isolated fixtures, not deployed by Codex.

1. Open Render Dashboard → the **existing MILDINCIDENT Web Service**. Confirm its GitHub branch is `development/photography-review-20261029` and keep automatic deployment disabled. Preserve existing environment variables, credentials, disk and data directory.
2. Select **Manual Deploy → Deploy a specific commit** and paste the tested fix SHA provided with the release response. If that option is unavailable, verify the fix is still the branch's latest commit before choosing **Deploy latest commit**. No Blueprint/service recreation, cache clearing or credential rotation is required. The commit includes `[skip render]` to prevent automatic deployment.
3. Wait for the deployment to show **Live**, then open the existing HTTPS `/login` in a fresh tab. `/favicon.ico` must return204 with no `Location` or `Set-Cookie`. Repeated `/login` GETs with the existing login cookie must preserve its nonce.
4. Sign in with the existing password; the original form should now submit successfully even after favicon requests or opening another sign-in tab. Check the Studio opens and unauthenticated `/api/workspace` still returns401 in a separate private browser window.

No deployment was triggered as part of preparing this patch. No n8n activation or production write is needed.

---

# Private Studio deployment readiness

Prepared October 30, 2026 (America/New_York), continuing the full [product constitution](PRODUCT_CONSTITUTION.md). No hosting has been deployed. Current assessment: **NOT READY for a live deployment until provider price/schema checks, account configuration and owner approval are complete.** The application implementation passes private-hosting fixtures; that is not provider validation.

## Recommended first host

Use one paid Render Node Web Service with one 10GB persistent disk. The existing Render↔GitHub connection makes this the simplest candidate. [render.yaml](../render.yaml) is a review-only Blueprint targeting `development/photography-review-20261029`; automatic deploys are disabled. Create a NEW uniquely named service, preserving any existing service and n8n production.

Planning allowance: **$10–$20/month additional hosting/storage**, not a current verified quote. The official [pricing page](https://render.com/pricing) returned403 in the restricted Codex environment. Current compute/disk prices, workspace fees, bandwidth allowances, taxes and Blueprint schema have NOT been verified; do not apply the template until checked. If the quoted total exceeds$20/month, stop for a different approved configuration. Existing n8n subscription and separately authorized OpenAI/Brave usage are excluded. No new paid API execution occurred.

The prepared app needs persistent local filesystem semantics for SQLite/media; an ephemeral free service or static-only host is unsuitable for this configuration. A 512MiB instance is a candidate for a single-founder pilot: isolated 40MP JPEG/WebP processing with two simultaneous scrypt checks and backup verification measured 117–134MiB peak RSS, using 256MiB Node heap, one hosted upload at a time and bounded Sharp cache. This is synthetic workload evidence, not a hosted load guarantee. Check actual memory after deployment before increasing usage.

## Exact configuration to review and approve

| Setting | Value |
| --- | --- |
| Branch | `development/photography-review-20261029` |
| Node | 24.19.0 (supported range 24.17..<25) |
| Build | `npm ci --omit=dev` — no frontend build step |
| Start | `npm run workspace` |
| Listener | `0.0.0.0:$PORT` in hosted mode;4174/loopback remains the local default |
| Liveness | `/healthz`, no private data; all application data requires sign-in |
| Disk mount | `/var/data` |
| Data root | `STUDIO_DATA_DIR=/var/data/mildincident` |
| Public origin | `STUDIO_PUBLIC_ORIGIN=https://YOUR-EXACT-SERVICE-HOST` — no path |
| Authentication | `STUDIO_MODE=hosted`, `STUDIO_PASSWORD_HASH` generated with `npm run studio:password` |
| Native API | Existing `N8N_API_KEY`, supplied only through the hosting provider's secret settings |
| Initial mode | Native read-only; generation/queue/activation/publishing disabled |
| Optional provider | Buffer credentials are unnecessary for this research milestone; missing provider observations remain unknown |

The Codex proxy credential binding is not a transferable key value. The owner must securely bind the existing real n8n key in Render; do not rotate it or paste it into Git/chat. Generate the Studio verifier in a private terminal and enter only the verifier in the provider's secret field. The password itself is never stored. No credentials are present in the Blueprint or `.env.hosted.example`.

## Deployment steps after explicit approval

1. Verify current Render pricing and Blueprint fields from the official site/account quote. Authorize one service/disk within the approved monthly limit. Render account deployment tools are not exposed in this Codex session; the owner can apply the prepared Blueprint using the existing GitHub connection, or authorize a supported Render account connection for assisted deployment.
2. Review the Blueprint, choose the unique service name, and set the exact HTTPS origin and secret settings above before starting. Keep auto-deploy off. Do not add any n8n activation/dispatch automation.
3. Deploy the prepared branch. Open the HTTPS URL: it must show the sign-in page; unauthenticated `/api/workspace` must return 401. Verify TLS and cookie flags on the actual host. Direct HTTP is redirected; the managed edge must overwrite `X-Forwarded-Proto` and keep the backend listener private. The app never trusts a forwarded host or user identity. Validate this on the actual provider before use.
4. Sign in. Existing authoritative stories and native development results load server-side without a ZIP transfer. The two historical results (executions 2254/2258) belong in **Recovered history**; the queue must not pretend they are new discoveries. Backend polling reads every 120 seconds with backoff; it never starts a model.
5. Review a photograph, save feedback, edit a caption and reload. Restart the service and confirm the session, native delivery state, founder feedback, caption and uploaded preview survive. This actual-volume/TLS test remains unperformed until deployment is approved.
6. Download a verified private backup, keep it outside the hosting disk and test recovery in an isolated folder. Missing earlier private revisions cannot be reconstructed from n8n. If private working state from this checkout needs migration, approve its secure transfer to the owner-selected volume; preserve existing data first. Git contains no private state.

## Backup and recovery

Daily backups retain three verified **managed** snapshots under the persistent data root. Manual CLI backups are never automatically pruned. Verification/hashing and downloads stream files; backups use SQLite's snapshot API. Each DB is consistent, but the entire workspace is not a cross-DB transaction. Estimated source size and a free-space reserve are checked before starting a backup. Failed operations preserve source data.

The authenticated **Download private backup** action saves pending editorial edits, creates a verified snapshot and streams a private tar.gz. **Download last verified copy** remains available if a new backup fails. Archives contain confidential source/working records; credentials/session DB are not included, but private source records can contain sensitive native review references. Never put archives in GitHub.

**Automated offsite backup is not configured.** Same-disk snapshots protect against ordinary application mistakes, not loss of the provider's volume. Keep owner-downloaded offsite copies for the pilot; approve a separate offsite destination before unattended operation. More images/versions require monitoring disk usage and backup capacity.

Offline restore: stop ALL Studio writers, extract a chosen backup separately, and run `npm run workspace:restore -- "/path/to/mildincident-private-workspace"` with `STUDIO_DATA_DIR` set to the target data root. The same existing restore helper verifies hashes/SQLite, stages the copy and preserves the complete previous workspace. It refuses open/recovery journals and the running service. On a provider, use a reviewed maintenance process with the web process stopped; do not run restore against an active service or blindly copy files over it. Provider-specific maintenance access still needs verification.

## What is proven and what still needs approval

- **Real read-only native delivery:** 2254/2258 successful executions independently observed; two proposals/eight photo references imported to a separate proof store, reread idempotently and reopened after restart. One unmatched historical job quarantined. Original workspace and production were untouched.
- **Development hosted workflow:** HTTPS fixture sign-in→native queued/completed result→image review/feedback→caption/decision→private backup→cold restart→logout; native writes/paid calls zero. This proves code integration, not a newly generated cultural story or real host deployment.
- **Paid generation:** disabled. A separately approved bounded development execution can be delivered to the private Studio without manual JSON. Current source access/pricing, saved worker version, per-run budget and new generation approval must be checked first; historical one-shot approvals are consumed.
- **Production:** no active n8n workflow edits/activation, Buffer mutation, schema migration, posting or scheduling. Existing production authority and the complete canonical roadmap remain unchanged.
