# One private preparation entry, separate from publishing

## Root cause and decision

The live n8n publish endpoint rejected the coordinator because it statically references unpublished production, public-staging and Buffer-writing workflows. The recorded HTTP400 names nine Execute Workflow nodes referring to three unpublished workers. An action allowlist does not remove those dependencies. Disabled publishing branches are still part of that graph. No more coordinator activation attempts are proposed.

Create **one new native workflow, “MILDINCIDENT · Private Post Preparation”**, extracted from the existing reviewed preparation branches. This is a private entry into the same preparation records and contracts, not another publishing engine. It has **zero Execute Workflow nodes, zero child-workflow dependencies and one JWT-authenticated POST webhook**, `/webhook/mildincident-studio-private-preparation`.

The existing production worker, release coordinator, import, staging and guarded writer remain inactive and unchanged. The already-active final-review service and recurring AI remain unchanged. The new entry does not call them.

## Exact local package

Native graph SHA256: **`c7382ab166a80ced3c21adc12135d53e9532f87cadc0a9cc0da31bb10fe2774b`**.

The private artifact is `.local/private-preparation-entry/reviewed.json`. `scripts/prepare-private-entry.mjs` reproduces it offline from the pinned source graphs; real credential bindings stay in ignored private artifacts. The builder never accesses a network.

Source execution checksums:

| Reviewed source | SHA256 |
|---|---|
| Production preparation | `6bde4ce1c040dff3b80e7c552b465f96f7f59c284afd1cdc8acb05a913308be9` |
| Restricted coordinator | `0788f879789a54063e162535e294d2fd68ece98fb9f0e75297890a0c9e435769` |
| Existing guarded worker, read branch only | `70df0298d8e13b27c147d45bdddc1b99bfc5308d39d68225f4ae1e1e0ec1f1d3` |

The new graph contains 66 nodes. Existing JWT credential, issuer/audience, short expiry, request ID and canonical body digest validation are retained. Only `review`, `file` and `connection` actions are accepted. The original permission, concept-approval, exact-content, source-custody, conditional reservation, package-version, prior-handoff and history checks remain. Initial package creation uses the existing assembler and studio reservation; the obsolete legacy branch is replaced by an explicit denial. Internal child triggers become authenticated in-graph adapters. Private JPEG reads retain their existing Drive download/hash/size/version checks. The existing Buffer credential is used solely by the fixed `get_channel` node.

No renderer, final fact/rights approval, public staging, Buffer creation, scheduling or AI operation is included. A preparation receipt confirms the saved native caption and slide plan; **it does not mean JPEGs are rendered or publication rights are cleared**.

Studio gains a private-policy `privatePreparation: {id,version,sha256}` binding. The route is fixed in code, not a caller-supplied URL. All six original publishing graph pins remain mandatory: old coordinator and writers must be inactive; the existing final-review service retains its prior active state. Studio verifies the new active saved version/checksum and closed graph before requests. Receipt lookup and uncertain-result reconciliation use the new workflow ID. Existing publishing paths and duplicate ledgers are preserved. Default policy remains disabled; no live policy was installed.

## Evidence and limits

- The captured deployed workflow-create OpenAPI schema accepts the proposal offline.
- Exhaustive node inventory and reachability reject even a disconnected Execute Workflow node, extra trigger, generic HTTP node, AI node or writable Buffer tool. There is no child workflow for n8n to require published; the exact dependency failure is eliminated structurally.
- Focused replay uses sanitized copies of the actual native node configurations and existing Studio services. It exercises JWT signature/body binding, native Code/Crypto/IF/DataTable parameters, first-package and existing-package preparation, exact ordered caption transfer, refreshed receipt reconciliation, history preservation, duplicate clicks, and a competing publishing claim. Publishing actions are rejected. The provider response and data-table engine are simulated; **this is not n8n Cloud acceptance**.
- Read-only live checks confirm original workflow hashes/states and recurring AI unchanged. No installation, activation, policy change, Buffer write or paid call occurred in this build.

The same read-only check found eligible unsent, concept-approved packages (including *The Town in The Truman Show Is Real*). Jack and Duo already have prior handoffs and remain blocked by their existing claims. Artemis, Hase and Miami are still concept-pending; their photographs appearing in Studio does not imply concept or publication approval. The first private preparation must use an eligible post explicitly chosen by the founder, with valid saved caption and selection; it must not clear any of these blockers automatically.

The remaining live proof is actual n8n creation/publication, existing-credential channel read, then ONE founder-confirmed Studio preparation and independently reloaded native receipt. A schema/credential/runtime failure stops acceptance without retrying the preparation. Checksums are never normalized away or silently replaced.

## One coordinated approval requested

Approve the code commit accompanying this proposal and the exact native graph above, together, for:

1. Verify current offsite backup, private-policy recovery and the captured inactive publishing baselines. No changes to old workflows or credentials. Verify no unresolved Studio/native operation before proceeding.
2. Create the single reviewed entry in the same project as its existing tables and credentials, initially inactive. Require the exact persisted checksum and full node/connection/settings/credential read-back before activation. No substitute graph or automatic format correction.
3. Deploy only the accompanying Studio code commit to the existing Render service/disk. Preserve sessions, drafts, source files, approvals, claims, token retirement and recurring AI policy. Use the current code rollback route.
4. Bind the existing private JWT authentication to the new entry without printing/retransferring it. Stage and verify preparation-only policy with `nativeReview=true` and all other operations false, all original pins retained, plus the new entry pin. Activate only the new entry and enable this restricted scope for supervised acceptance.
5. Verify canonical HTTPS health200/private-access401 and the real read-only `get_channel` connection. The founder selects ONE eligible canonical, concept-approved, unsent post in Studio and confirms its exact saved caption/order once. Existing durable intent and shared claims prevent duplicate preparation. Do not choose an already delivered Jack package or bypass an unresolved handoff merely to obtain a receipt.
6. Verify the correlated execution, package version, caption and sequence by refreshing native records. Preserve earlier package history and local writing. Disable the temporary preparation policy/new entry after acceptance; no existing worker restoration is needed because none changed. On failure disable/deactivate the new entry, restore the prior disabled private policy, retain all evidence/history and reconcile without resubmitting. Code rollback is code-only and must never restore retired tokens.

This approval permits one private preparation, not a final approval or Buffer draft. No recurring preparation expansion, public media or publishing is included.

## Shortest content path

Artemis II originals remain unacquired; NASA previews do not count. The shortest founder-assisted fallback is the [Apollo 8 Earthrise original](https://commons.wikimedia.org/wiki/File:NASA-Apollo8-Dec24-Earthrise.jpg): download “Original file” in the founder's browser and supply that JPEG with its source link privately. The previously inspected record reports 2400×2400, 311263bytes and SHA1 `92da62a94a30ee77a36261ca31df40d0342cf0ec`; supplied bytes must actually match, decode and be visually inspected. Record NASA/Bill Anders, 24 December1968 and the image-specific public-domain evidence. This is a **single-image post** supported by the current native contract, not a padded carousel. The existing carousel validator requires 3–10 images, so the previous two-frame Artemis proposal is not currently eligible as a carousel.

Supplying files privately lets us verify real bytes without another blocked download. Studio's “Attach a private preview” preserves uploaded bytes but does not establish source-acquisition evidence, production-file mapping or rights. It must not be represented as automatic production ingestion. Match the supplied original to its source and the existing native original/Drive custody process before rendering final 1080×1350 files. No source evidence or permission is manufactured. Founder concept/content/rights approval and separate authorization for one unscheduled Buffer draft remain necessary.
