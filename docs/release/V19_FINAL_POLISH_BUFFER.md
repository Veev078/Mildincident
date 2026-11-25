# V19 final polish and Buffer handoff — November 17, 2026

Local implementation; not deployed. No live workflow, credential, policy,
provider post or founder record was changed.

## Founder experience

- Build, Refine and Approve / Buffer are distinct buttons with a clear active state.
- Posts have a three-dot Pin / Archive / Move to Trash menu. Confirmed Trash and
  Restore append organization history in the existing database. Captions, photos,
  research, approvals, provider mappings and earlier pin/archive choices survive.
- Preview post shows large 4:5 slides, arrows, clickable indicators, keyboard/touch
  navigation and caption access. Provenance, permissions and framing remain in
  collapsed details. Preview does not crop or replace production files.

## What is operational locally

`StudioBufferDrafts` connects the existing immutable approval requests to
`prepareAndSend`, `DraftLedger` and read-only reconciliation. It does not introduce
a second publishing engine. The outbox uses the existing private research database
and its ordinary SQLite backups.

The founder reviews the caption and slides, then explicitly confirms one unscheduled
draft. Checks bind current native factual/rights/final-caption approval, source and
package versions, exact caption/order/channel and the final-file manifest. The
existing preparer verifies decoded 1080 × 1350 JPEGs, hashes and per-image rights
evidence. The core audits previous handoffs, commits intent before one external
create, preserves the returned ID and verifies independent draft read-back.
Duplicate clicks/revisions/restarts cannot create another draft; uncertainty never
automatically retries. Known IDs can be checked read-only. Unknown IDs need the
existing native/provider audit. Preflight rejection and uncertain delivery differ.
Browser-supplied paths, adapters, provider IDs and publication flags are rejected.

**Live sending stays disabled.** No production transport, credential loader or
environment enable switch is shipped. A separately reviewed native adapter must
prove draft-only behavior and shared writer protection. A local SQLite claim does
not govern independent native workflow writers.

## Actual native inspection and remaining repair

Read-only inspection confirmed these existing active paths; none was changed:

| Component | Workflow | Active version |
| --- | --- | --- |
| Production/render/signoff | `YdW8V9Qxl2qn5mC8` | `1b722e51-1d26-42d0-ba03-8f658690fed0` |
| Final approval | `rhZU4CyF5t0kYMzz` | `32219a9c-e855-4c2a-af46-ea6db1d3199e` |
| Media staging | `f0LkxPxzvqh3zyUQ` | `d4d97422-2eae-4bb6-88af-ee9b06d80f9a` |
| Release coordinator | `v5ThKs5ZYP3RhZop` | `464d3148-824e-45ad-b1a1-f94df89177a8` |
| Guarded handoff | `Q02tRHMtZ90Kib18` | `553385b9-6882-4c9b-9056-a9feda13d80b` |
| Manual import | `BzMqQS8lfkwN7peQ` | `c6c0d049-57bf-4d18-b687-aa9745988fc4` |

The MILDINCIDENT Instagram channel was readable, not disconnected and not locked.
That proves account access, not a successful transfer.

Manual/guarded send paths still trust the create response instead of an independent
read. Their insert/read claims are not atomic across paths and duplicate checks are
version-scoped. The coordinator also supports queuing. There is no verified importer
for Studio's changed captions/local photos into canonical native production packages;
opening legacy forms does not transfer those edits.

An internal handoff secret appeared in read-only tool output. No value is copied
here or into Git. A separately approved narrow rotation must update both
`Buffer Normalize Handoff` and `Buffer Validate Approved Package` in
`Q02tRHMtZ90Kib18`, preserving provider credentials and unrelated workflows.

## Verification and next release

- Syntax check and 602 regression tests pass, including corruption, rights,
  stale review, destination/publication flags, HTTP origin, uncertainty and restart.
- Actual desktop/mobile browsers verify six retained Jack photographs, Preview,
  confirmed Trash/Restore and unchanged caption/order/hashes/approval history.
  Hase, Miami, Sophy, Lost & Found and Marcie remain accessible from retained data.
  No hosted acquisition or new photographs are claimed.
- Full HTTP/browser draft journey at 1440/390 pixels passes with generated JPEGs
  and an injected provider: explicit confirmation, exact caption/order, one create,
  independent simulated read-back, reload/restart and read-only status checking.
  **This is not native/Buffer acceptance.**
- Actual rendered before/after screenshots: `.local/v19-polish/`. Separately labeled
  simulated Buffer screenshots: `.local/buffer-browser/`. Private assets stay ignored.

Next approval: one code-only release of the pushed commit, preserving the disk and
ordinary backup/rollback controls. Keep sending disabled. Then prepare one coordinated
native repair: exact Studio-content acceptance into the existing production process,
the shared claim/read-back contracts in `docs/PRODUCTION_REVIEW.md`, ordered staged
JPEG verification, a draft-only Studio entry and the narrow internal-secret rotation.
Only after those prerequisites may a separately approved real unscheduled draft run.
Never reset history, erase a claim or resend an uncertain outcome as rollback.


The later [coordinated Buffer integration](V19_BUFFER_COORDINATED_RELEASE.md) implements the previously missing native transfer, shared reservation and delivery-readback path locally. Its separate live approvals remain outstanding.
