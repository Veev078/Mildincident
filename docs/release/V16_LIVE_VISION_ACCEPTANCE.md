# V16 live vision acceptance — execution 2363

Outcome: **failed before any model operation**. No AI assessment or carousel recommendation was produced. No repeat dispatch was attempted.

Subsequent local work: [the compatibility repair](V16_NATIVE_COMPATIBILITY_REPAIR.md) reproduces both failures through real n8n runtime components and verifies the corrected six-JPEG request offline. No new live workflow or paid execution occurred. The historical outcome below is unchanged.

## Approved and observed scope

The founder approved persisted graph SHA256 `74d2c44b62d292c805b6199a3ac396753830005f4b80456cb90c688b0f98fdae`, six previously prepared real Jack Nicholson images, one fresh 20-minute single-use photo grant, GPT-5.4 and 1,200 output tokens. No research, searches, image acquisition, caption drafting or publishing was authorized.

The corrected operator required the exact graph checksum before activation and dispatched job `ea73a9e3-448c-433c-9b25-3b321fe11ff3` once on photo-worker version `c12cd814-0a74-417e-930d-f901985edefa`. The native execution is `2363`.

The earlier historical job/execution-2252 exception remained limited to its exact unchanged record. Neither that row nor any unrelated native record was changed.

## Actual failure and model exposure

Execution 2363 has status `error`. It reached the existing authenticated dispatch validation, native job claim and claim verification, then failed at `Photo Visual Assessment?` with `ExpressionError: Cannot access "prototype" due to security concerns`. Its condition uses `Object.prototype.hasOwnProperty.call(...)`, which the deployed expression sandbox rejects.

Execution evidence shows zero runs of `Validate Photo Assessment`, `Assess Photo Pixels`, `Research Candidates` and `Draft Editorial Concept`. The model did not inspect any of the six images. There is no model response, recorded token usage or supported sequence recommendation. Expected model cost for this attempt is $0 because no model node ran; the provider's invoice is not exposed by n8n.

The recorded execution graph reveals a second concrete incompatibility: the persisted photo model's `responses.values` expression string was normalized into an array of **59 empty text messages**, rather than the intended one text message and six image inputs. Fixing only the gate would leave the actual image-input path broken.

n8n also expands default node parameters in its execution snapshot, which has SHA256 `e3fb92bc44703ba2931178f54f2707058f85438f0f3684669a63f51a15e6f340`. That runtime snapshot is not byte-identical to the saved/read-back graph. The existing result verifier expects the approved saved checksum on that snapshot; it cannot yet be claimed compatible. The saved checksum guard was preserved and passed before activation. Do not bypass it or silently treat the altered runtime input as approved.

## Restoration and reconciliation

The operator revoked the grant and consumed its single dispatch claim. It restored the original caption/story graph/settings and reconciled the recurring policy pin to saved/active version `673685e5-71af-4b24-a50d-ae06d5799841`. Independent API read-back confirms that worker is active with original graph SHA256 `0e1777e5785f703bd9a77593af01912a820eed0cb9c30ea9c50721ee4bc91cf6`, and no running or waiting worker executions.

The failed gate did not reach the native failure handler; the photo job row remains `generating` despite its terminal error execution. Preserve that row and its execution/claim history; do not reuse its job, consumed grant or either launcher. The operator left Studio starts disabled until this uncertainty could be reconciled.

A narrowly scoped Render command was prepared to verify execution 2363 and the restored graph/policy, append a confirmed pre-model failure to the local ledger, and release the maintenance pause only when no other Studio operation is unresolved. It uses the existing state/event methods and does not change native rows, policy contents, captions, photographs, selections or approvals. Its isolated test used generated storage and mocked read-only responses; that is cleanup verification, not real vision success.

Final hosted reconciliation: the founder supplied the guarded PASS for execution 2363: local failure reconciled, zero model calls, grant revoked, worker version `673685e5-71af-4b24-a50d-ae06d5799841`, `captionAvailable:true`, `storyAvailable:true`, history preserved and the native failed-job row untouched. Ordinary starts are restored. This is a hosted server-side availability check, not a new generation or hosted browser test.

## Minimum repair before another acceptance

Prepare a local compatibility patch in the existing photo-worker builder, rather than another engine or a broad audit:

1. Replace the photo gate with an equivalent own-property check supported by the deployed expression sandbox. Preserve routing of malformed photo contexts to validation and preserve caption/story behavior.
2. Supply the message collection in n8n's supported native structure, with explicitly bound text and image fields. Prove the actual runtime receives the six approved hash-bound JPEG inputs, rather than an expression string converted into defaults. Do not make a paid call to discover whether formatting works.
3. Reconcile saved-graph versus expanded runtime-snapshot verification using exact, reviewed evidence and version binding. Keep full persisted checksum verification; do not introduce a version-only or semantic-only checksum bypass.
4. Account for the confirmed failed photo job in future readiness without clearing its claim, falsifying native success or silently extending the historical-row exception. Review any necessary targeted native failure-state reconciliation separately.

Then prepare a new exact graph/checksum, fresh job/approval binding, bounded input/output review and restoration package for separate approval. No live repair or additional call is authorized by this failed attempt.

## Findings for V17

Real photographic acquisition is proven for the six Jack files; live AI visual assessment is not. Published formatter/fixture checks did not reproduce Cloud expression restrictions or collection normalization. The next compatibility test must exercise those actual behaviors before model spending.

Preserve the accepted UI and successful caption/story pipeline. V17 should connect source progression, actual decoded images, explicitly confirmed visual assessment and deliberate carousel selection in that order. Count references, saved images and model-inspected inputs separately. The [V17 plan](V17_PHOTO_INTELLIGENCE_PLAN.md) remains a proposal, not implementation authorization. No new photographs, factual visual judgments, AI quality findings or rights decisions were produced by execution 2363.
