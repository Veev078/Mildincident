# V17 live-failure repair — local, not deployed

## Generation failure: execution 2365

Read-only inspection confirms webhook/workflow status `success`, but the **job failed** at Build Research Prompt with `RESEARCH_INPUT_BUDGET_EXCEEDED`. The failure handler closed it. Neither Research Candidates nor Draft Editorial Concept ran. Nothing was resubmitted.

The captured builder rendered **36,608 characters** against the existing **30,000-character combined prompt/instructions limit**. Native brand text contributed 8,685 characters and is preserved. The native request already included coverage exclusions; the development planner appended another history index, founder feedback, six publication leads and prior unselected research, then appended editorial instructions without a shared allocation. The captured table reads contained 54 brand rows, 96 research rows, 27 pipeline rows, 37 archive rows and nine development candidates. Their full serialized row sizes are **not** the model input size.

The repair budgets complete optional records around an immutable core: full founder direction, native brand/preset rules, factual/rights/cost rules, output schema and editorial selection instructions. Feedback, source leads, a deduplicated recent-subject index and prior leads receive weighted shares; unused space is redistributed. An oversized record cannot crowd out later useful records. JSON is never chopped. Omitted counts remain in native execution diagnostics. Full exclusion/feedback fields remain available to downstream checks. Mandatory overflow still fails before a model; the limit is unchanged.

| Offline replay using captured 2365 table/context inputs | Combined rendered characters | Result |
| --- | ---: | --- |
| Actual brief / saved Surprise Me direction | 29,999 | One bounded research message |
| Discovery kind, recomputed Prepare Context | 29,985 | One bounded research message |
| Current Surprise Me default with the same live-scale history | 29,985 | One bounded research message |

These are **local replays of real inputs, not AI generations**. The actual Research Candidates expressions were evaluated using the retained published `n8n-workflow` 2.46.5 runtime; rendered content/instructions match the repaired builder. Research remains GPT-5.4 / 3,500 output tokens / two tools; drafting remains GPT-5.4 / 1,800 output tokens. No request transport was invoked. This does not attest hidden Cloud retry behavior or prove future editorial quality.

Studio now accepts an exact correlated `status:failed` receipt as a confirmed failure, rather than calling it dispatch uncertainty. Read-only reconciliation can recover its safe cause even when execution status is success. It verifies the job/hash and imports only allowed failure codes, stage and absence/presence of model-node activity. Failed receipts persist through restart; stale reads cannot requeue them or cause another dispatch. Discover displays the actual failure and avoids a duplicate progress card. No request is retried automatically.

## Exact native proposal — separate approval required

- Worker: `6CkqfYc4Pyd4k8vi`.
- Read-only baseline: saved/active `673685e5-71af-4b24-a50d-ae06d5799841`, active, graph `0e1777e5785f703bd9a77593af01912a820eed0cb9c30ea9c50721ee4bc91cf6`.
- Proposed exact graph: **`b971c6f5f592334824a9e37eec9c851f103b5a1e7b11532bddef43264741ed5d`**.
- Offline constructor: `prepareResearchBudgetPatch` in `src/n8n/research-budget-patch.js`.
- Only four nodes change: Build Research Prompt; Prepare Development Failure; Fail Development Job; Return Development Failure.
- Caption-only bypass, model nodes/settings/credentials, table IDs/ownership filters, graph connections, workflow settings and authorization contracts are unchanged. No node retries, dispatch retries or new engine are added. Hidden transport retries remain unverified.
- Failure reporting adds a safe optional `failureCode`; the existing failed status and job/execution correlation remain authoritative. No new native columns are required.

The private baseline, proposed graph and execution/input proofs remain under ignored `.local/v17-live-fixes/`, not in Git. **No live graph, policy, grant, credential or execution was modified.** Installing this native proposal is necessary to fix hosted prompt construction; a Studio code deployment alone does not change Build Research Prompt.

## Rabbit: a missing reader, not a recorded HTTP denial

The founder's read-only Render receipt for `CON-261031DESK07`, request `1619c151-6545-4e9c-b6ac-acb3893cd7cc`, records `SOURCE_READER_UNAVAILABLE`, route `source_assisted`, with **zero source attempts, captures and images**. No source URL has a recorded HTTP failure. “Source unavailable” obscured that distinction.

Exact retained sources:

- [Guardian, Brainwaves](https://www.theguardian.com/artanddesign/2005/sep/29/art): factual context; no project gallery established by the public reader.
- [Artsy, Hase](https://www.artsy.net/artwork/gelatin-slash-gelitin-hase-2006): individual artwork image captions and `d7hftxdivxxvm.cloudfront.net` / `d32dm0rphc51dk.cloudfront.net` image routes observed.
- [Windowseat article](https://www.windowseat.ph/giant-pink-bunny-in-italy/): links directly to [Gelitin's original Hase project](https://www.gelitin.net/projects/hase/), embeds exact `www.gelitin.net/cache/projects/hase/` image URLs and a credited `c1.staticflickr.com` image reference.
- Original artist page: Hase/Rabbit/Coniglio, with individually described project photographs, construction documentation and a drawing. The drawing is not treated as a project photograph. Photograph dates/credits and rights uncertainty remain separate.

These links were followed using the public web reader, **not guessed**. Studio now supports these recorded page hosts and observed publisher/CDN relationships. A maker-named anchor plus a story-named project path can establish a legitimate next-source trail for a one-word collective. No arbitrary URL proxy or generic archive fallback was added. Exact embedded URLs, intact captured HTML, current story binding and existing six-file acquisition limits still guard decoding/storage.

Hase-specific source correspondence uses the exact artwork record or the artist's exact project-image path **and an individual project caption**. Repeated Hase captions do not cancel one another through the general distinctiveness heuristic. Unrelated work and drawings remain separate. This is source metadata correspondence, not AI visual inspection or rights clearance.

The interface distinguishes unsupported connections, HTTP denial, missing/moved pages, unreadable responses and uncertain requests. Historical missing-reader receipts remain unchanged; if their sources are now supported, Studio explains that a new source check is available. An observed mobile overlap in the empty selection panel is fixed. The accepted workstation design is preserved.

**Photographic evidence boundary:** new reader/progression/acquisition behavior passed isolated tests with explicitly generated image bytes. Public page/image references were found; **no new Rabbit photograph was privately decoded or saved in hosted Studio during this work**. Codex direct access to these photo hosts is restricted. The short read-only Render source-status check is pending; it does not repeat Find More Photos or mutate Studio. Do not claim that supported readers guarantee hosted HTTP/CDN access.

## Verification and release action

530 unit/regression tests and syntax checks pass. The isolated desktop/mobile writing/photo browser journey passes, including edits, comparison, source failure and selection preservation. Eight actual rendered before/after screenshots of retained failure evidence were captured at 1440 and 390 pixels; all carry a local-evidence banner. No hosted browser test is claimed.

1. With separate approval, release the repaired Studio commit to the existing Render service after the normal current-backup/disk/rollback checks. Preserve data and recurring AI configuration.
2. Separately approve the exact four-node native patch above. Capture worker/policy recovery material; pause future starts, require no unresolved operations, install/read back the full exact graph and stop on mismatch. Activate only its verified version; reconcile only the existing policy's worker-version/graph binding, preserving identity, credentials, history and limits. Verify ordinary caption/story availability before releasing starts. No model execution is included in installation approval.
3. If installation fails, restore the captured original graph/settings and active state, reconcile the policy to the actual restored version, and release starts only after verification. Never reuse/reset consumed claims or retry uncertain dispatches.
4. Inspect the read-only Rabbit source-status result, then deliberately run one new unpaid source check when ready; inspect original/decoded file hashes and relevance. Keep repeats, new references and genuinely new decoded photographs separate.
5. One fresh, founder-confirmed Surprise Me operation can then provide paid editorial acceptance, only with applicable authorization. The separate six-image vision operation needs a freshly reviewed graph derived from the new exact baseline and its own approval; do not reuse an old graph checksum or grant.
