# V16 native compatibility repair — local, no paid execution

The two failures from [execution 2363](V16_LIVE_VISION_ACCEPTANCE.md) are repaired locally. An offline replay through the real n8n parameter normalizer, expression evaluator and OpenAI v2.3 response operation reaches the intercepted request boundary with **one nonempty text message and six real inline JPEG inputs**. No request was sent to OpenAI, no grant was issued and no live workflow was changed.

## Root cause and exact changes

1. **Routing:** the expression sandbox rejects `Object.prototype`, including `Object.prototype.hasOwnProperty.call`. The repaired IF expression uses `Object.keys(...).includes('photoAssessment')`. An explicit `try/catch` sends malformed JSON into photo validation: n8n otherwise suppresses some parse errors as `undefined`, which IF treats as false and could route toward research. Null/false/empty photo payloads still enter validation and fail there. Caption/story contexts keep their existing route. The added IF node now has an error output to the existing failure handler; all original nodes remain unchanged.
2. **Messages:** `responses` is a native `fixedCollection`; `responses.values` must be an array of message objects. During workflow initialization, `NodeHelpers.getNodeParameters` adds defaults **before** expression resolution. It iterated the 59-character expression string as 59 collection entries, producing empty text defaults. The repair supplies seven structural rows, with expressions only in the text `content` and each image's `imageUrl` field. Image type, role and detail are explicit. The node's URL field contains inline `data:image/jpeg;base64,...` bytes, not an external source URL.
3. **Delivery fingerprint:** n8n expands default parameters in the execution snapshot. Dispatch continues to require the complete exact **saved** graph checksum. Import can separately bind the complete exact **expanded execution** checksum and native `workflowVersionId`; both are private approval metadata retained on the existing job ledger. No fields are stripped or ignored, and a version cannot substitute for a checksum. Wrong saved content, expanded content or execution version is rejected. Older same-representation fixtures remain compatible.

The builder binds the structural row count to the approved image count (one to six; six by default). Validation rejects a different count before the model. Text, image bytes, image order, manifest, GPT-5.4, high-detail image setting, 1,200-token output maximum, low reasoning, `store:false`, absent tools and disabled node retries are preserved. There are no new provider credentials or alternate AI engines.

## Compatibility evidence

The connected n8n schema reports OpenAI node **typeVersion 2.3** and IF **2.2**. Application version, node typeVersion and package release are different identifiers. The isolated replay uses retained official `@n8n/n8n-nodes-langchain@2.46.6` code and its declared `n8n-workflow@2.46.5` dependency; it does not claim an attested Cloud binary build.

Unlike the earlier formatter-only VM check, this proof runs workflow parameter normalization **before** the real n8n evaluator, then calls the native response operation and captures its complete constructed request before transport. It reproduces the exact prototype error and the **entire** captured photo-node parameter object, including all 59 empty messages, from execution 2363. The corrected representation passes those same stages.

The execution-context adapter supplies parameter lookup through n8n's real workflow expression resolver, an empty connected-tools binding for the tool-free photo node, and a transport that captures and throws before networking. Unused optional dependencies fail closed. Socket/HTTP/fetch access is blocked and live credential environment variables are removed. This verifies serialization and the request boundary, not Cloud credentials, provider acceptance or photographic judgment.

The proof replays the **six actual Jack inputs retained in execution 2363**, not generated photographs. The old authorization is inspected only at its historical timestamp in an isolated validator replay; it is never reissued, claimed, queued or dispatched.

| Check | Actual result |
| --- | --- |
| Native collection after default expansion | Seven rows: one nonempty text, six image rows |
| Provider-bound content | Six `input_image` blocks containing real JPEG bytes |
| Hashes, dimensions and order | Every image matches its prepared input; all six fully decode |
| Actual dimensions | Two 211×320, two 320×211, one 384×252, one 384×254 |
| Byte bound | 12,922–15,221 bytes per image; all within 16,000 |
| Manifest SHA256 | `220ad6d03125e3b7a9fe5e3afbf6e461c4fd056dacc5dee0941ab7a9184277db` unchanged |
| Prepared message SHA256 | `de30d4b4aedfa315c0f71f03250d36cbc3b26fccefa6a58e8c1142354c5fc8a7` unchanged |
| Final provider request SHA256 | `547ba6eee61033a183c5c5ebab7ad5cadcc82ae2dae399a83d97f4afb187d02d` |
| Expected versus native request | Byte-for-byte identical JSON bodies |
| Model executions / network requests / grants / live mutations | **0 / 0 / 0 / 0** |

The normalized node-message JSON has hash `a8c437cf15ddabd00e7486b66ebbb8db512421db4c327896abc8cb5c3d67358e` because the native schema changes object-property order. Its field values, prompt and image sequence are identical; the actual provider body is byte-identical to formatting the original prepared messages. This does not alter or bypass either graph checksum.

Source fingerprints: response operation `1dbeeaf50c356472123eabf4616a48b35f4ec7878e2fe420412306ebfe9ea584`; native response formatter `871fed6b970869c362d870804302c44f3d8ed147b2694480031f2db061d41842`. Private source packages, execution, images and full report remain ignored under `.local/`.

## Review-only next graph

The offline proof prepares a **fresh** job `e9c7c302-72d1-489d-9f6b-b14c64082657` and approval identity `0593717f-a75a-468f-ba76-c3c83a703473`. These are unused identifiers, not a live grant.

- Proposed saved-graph SHA256: `6bd077f4c945b5501741f0aaaf1b74a5da0775ef0e6cda2ba5b5feee5fc4716d`.
- Expected expanded-execution SHA256: `b929ad9ff9333dfc4fde5c712c488672ad165b9c43310fd5be067e7a2b84f757`.
- Baseline: original recurring worker version `673685e5-71af-4b24-a50d-ae06d5799841`, graph `0e1777e5785f703bd9a77593af01912a820eed0cb9c30ea9c50721ee4bc91cf6`.

The expanded representation is prepared from execution 2363's observed defaults for unchanged original nodes and the reproduced native normalization for the repaired photo node. It is an exact review artifact, **not** permission to accept other defaults or a claim of live read-back. Full private graphs/review are in `.local/v16-compat/proof/`; replay-only graphs using consumed identities must never be installed. Re-running into that directory preserves its unused review identifiers and requires matching baseline/graph checksums. A fresh output directory prepares a new review package.

Before a paid acceptance, the repaired delivery reader must be present in the execution environment (current hosted Studio still runs the earlier release), installation must pass full saved-graph read-back, and the actual installed version must be pinned alongside the reviewed execution checksum. Any mismatch stops the run. The failed job 2363 and consumed grant remain historical; future readiness must reconcile its terminal error explicitly rather than silently exempt another `generating` row.

No separate Cloud workflow was needed for this offline proof. A credential-free Cloud compatibility workflow would require separate approval before creation/execution if desired. One real six-image model response, source-bound Studio import and qualitative carousel review still require a fresh bounded paid approval. No launcher from either failed attempt is reusable.

## Reproduce privately

The application lockfile/dependencies are unchanged. Isolated dependency setup:

```sh
npm install --prefix .local/v16-compat/runtime --cache /tmp/mildincident-npm-cache --ignore-scripts --no-audit --no-fund --save-exact n8n-workflow@2.46.5 lodash@4.18.1
```

The retained official langchain package is `.local/v12-g/retry-audit/source/package`. If unavailable, obtain the exact package with `npm pack @n8n/n8n-nodes-langchain@2.46.6 --ignore-scripts` into a private directory and extract it there. Do not install the full n8n stack into the Studio application. Supply the private execution 2363 and matching baseline files locally; never paste them or commit them.

```sh
env -u N8N_API_KEY -u BUFFER_ACCESS_TOKEN npm run test:photo-native -- \
  --runtime .local/v16-compat/runtime \
  --langchain .local/v12-g/retry-audit/source/package \
  --baseline .local/v16-compat/worker-baseline.json \
  --execution .local/v16-live-vision/actual-execution.json \
  --out .local/v16-compat/proof
```

Errors report only a stage/code, never image data, request bodies or credentials. The normal generated-fixture regressions additionally verify one/three/six-image counts, malformed routing, strict saved/runtime checks, persistence, stale-result protection and no retry after lost responses. Syntax checks and all **502 existing regression tests** pass. No UI was changed; no new hosted browser or paid visual-quality result is claimed.
