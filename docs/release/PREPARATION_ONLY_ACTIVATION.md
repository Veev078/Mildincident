# Narrow preparation-only activation

No UI change, live workflow change, policy enablement, paid call, public staging or Buffer write. Token rotation and live code `74a14fe` remain as verified.

The connection correction pins all existing graphs but requires only the coordinator and unchanged final-review service active. Production, guarded Buffer writer, legacy import and public staging remain inactive. Database child-workflow invocation is used through existing Execute Workflow nodes; actual Cloud execution still requires the separately approved read-only/preparation acceptance. No writer is activated to satisfy a client status check.

Explicit private policy scope: `preparation_only`; only `operations.nativeReview=true`, every other operation false. Preparation cannot set `singleWriterVerified`, grant final approval or enable Buffer creation. Provider/claim proofs are still required for any later publishing scope. This removes the circular requirement that provider proof already exist before it can be checked read-only.

Amended coordinator: disable `Founder Finalize and Send`; allow only authenticated `review`, `file`, `connection` actions before acknowledgement or branching. JWT credentials, other nodes, connections and existing safety checks remain. Exact reviewed artifact is private at `.local/preparation-only/coordinator.json`.

- Coordinator baseline version `34c645f7-8faa-47df-a14f-5274f288c9a8`, SHA `6c96f33e0ab65670be0bfed4d1e4002e37f8402e90adec7ff0750aaff9c1de9e`.
- Amended preparation coordinator SHA `5f61274c2d415c445c56a269fa14576193a1d05539743182df92e3c011376ddf`.
- Previously reviewed production preparation SHA remains `7490c0f8aa328ace8ac8e2bc4c980062c8edc51936b0459459d0ca9f844261d1`, baseline version `e2424436-6bf6-4f49-aa27-52eb16bd9fc8`, baseline SHA `1d1e492a4b567bc8a6c92065ab043d4fe3a183dec4ada6e639d78349e1cd2a30`.

Approval needed: code-only deploy of the connection correction; install those two exact graphs with snapshots/current-version checks/persisted read-back; activate only the narrowed coordinator; stage and enable preparation-only policy with exact pins, no acceptance/create grant. Verify existing native connection read, then one explicitly chosen private preparation. On failure disable policy, deactivate coordinator and restore captured inactive graphs/settings. Restore private policy binding, preserve history, and retain the rotated Artemis token. Recurring AI is untouched.

Targeted isolated checks: 12 tests pass, including the real Studio connection against simulated inactive children, read-only provider check, rejected final approval, and action allowlist/legacy-disable checks. This is not live Cloud/provider acceptance.

Content: Artemis originals remain unacquired. Apollo 8 Earthrise is a supported public-domain fallback: NASA/Bill Anders, AS08-14-2383, 24 December 1968; the [file record](https://commons.wikimedia.org/wiki/File:NASA-Apollo8-Dec24-Earthrise.jpg) identifies a 2400×2400 original and NASA public-domain terms. Original-file requests to both NASA and Wikimedia return HTTP 403 in this environment. No file hash, private acquisition, completed production package or rights decision is invented. Hosted acquisition or founder-provided originals are required before exact final content/hash approval can be requested. No repeated Shell setup is proposed for ordinary use.
