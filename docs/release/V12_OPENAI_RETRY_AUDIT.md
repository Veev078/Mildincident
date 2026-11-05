# OpenAI v2.3 request-transport audit — blocked pending deployed-runtime evidence

November5,2026, America/New_York. Focused investigation only. No workflow installation/activation, permit, model request, search, production mutation or deployment was performed.

## What is verified

The actual saved worker6CkqfYc4Pyd4k8vi still contains OpenAI app-node typeVersion2.3 Research Candidates and Draft Editorial Concept, not OpenAI Chat Model nodes. It remains inactive at saved version e6fe10d3-c7a7-482b-9fd1-cd24c681b145, active version null. Fresh readback matches the preflight rollback graph exactly. Existing prepared graph SHA256 remains1ec55f308813b28b63248dd999b1c8dfebb981ff5b49ae398ba3a0e41f4481e3. No replacement graph is presented as safe for execution.

Authoritative published source inspected:

- [@n8n/n8n-nodes-langchain2.46.6](https://www.npmjs.com/package/@n8n/n8n-nodes-langchain/v/2.46.6): dist/nodes/vendors/OpenAi/OpenAi.node.js maps2.3 to OpenAiV2; v2/actions/router.js invokes text/response.operation.js once per input item. This is a package release number, not the app-node typeVersion or an attested Cloud build.
- The response operation calls transport/index.js apiRequest('POST','/responses'). apiRequest calls this.helpers.requestWithAuthentication('openAiApi',options). It does **not** construct the official OpenAI SDK client. Therefore assuming SDK default retries was not a supported diagnosis for this inspected path.
- [n8n-core2.16.1](https://www.npmjs.com/package/n8n-core/v/2.16.1), execution-engine/node-execution-context/utils/request-helper-functions.js: requestWithAuthentication → proxyRequestToAxios → invokeAxios → Axios. The inspected invokeAxios has no generic429/5xx/connection/timeout retry loop. POST redirects are disabled by the inspected request conversion by default.
- [Axios1.15.0](https://www.npmjs.com/package/axios/v/1.15.0) is the inspected core dependency. The inspected axios-config.js sets defaults/agents/vendor headers and a request interceptor; it does not install a response retry interceptor.
- Public OpenAiApi credential source was separately inspected from n8n's GitHub master snapshot. It uses static Authorization/organization/custom headers, allows a custom base URL, and declares no preAuthentication method. This snapshot is not an attestation of deployed credential code or secret credential values.

## Replay paths that must remain distinct

1. Node retryOnFail: disabled on both saved and prepared model nodes. This does not establish helper behavior.
2. Legacy authenticated helper: after an error it can repeat the request if forced preAuthentication returns replacement data. With the inspected static API-key credential declaration there is no such method; the failure fixture supplies no refresh data on the ordinary path. OAuth parents take separate paths and were not treated as static OpenAI authentication.
3. invokeAxios: a separate digest-auth401/nonce path can make another request when sendImmediately=false. Ordinary inspected OpenAI static bearer authentication does not request digest authentication.
4. The v2 response operation can issue additional POSTs in its external function-tool continuation loop. Built-in web search results are not function_call items. The reviewed graph has built-in search, no external function-tool connections, and no background-mode option. Nevertheless, an unexpected function_call response can enter the continuation loop even when no external tool was resolved. maxToolsIterations0 means unlimited, not disabled; the inspected node offers no supported zero-continuation setting. Do not substitute it as a zero-retry switch.
5. Background polling uses GETs when enabled; that is different from retrying the initial model POST. Background mode is not enabled in the reviewed nodes.

A naïve substitution with the modern httpRequestWithAuthentication helper is not proven equivalent: its inspected401 catch path can call httpRequest again even when preAuthentication supplies no replacement data. No HTTP-node swap, credential export, unsupported hidden option or custom gateway was implemented.

## Real local transport simulation

Reproducer: `node scripts/verify-openai-transport.cjs .local/v12-g/retry-audit`.

The test loads the actual published apiRequest module and extracts the actual published core requestWithAuthentication/invokeAxios functions. It uses real Axios1.15.0, a real loopback HTTP server, synthetic credentials and a clearly declared auth/config adaptation. This is a faithful transport boundary, **not** the complete n8n Cloud runtime. No provider hostname/key/model was contacted.

| Scenario | Axios attempts | HTTP requests received |
| --- | --- | --- |
| Success | 1 | 1 |
|429 with Retry-After | 1 | 1 |
|500 | 1 | 1 |
|503 | 1 | 1 |
|Connection reset before HTTP | 1 | 0; one TCP connection |
|Timeout | 1 | 1 |
|Interrupted response after request receipt | 1 | 1 |
|Forced credential-refresh negative control | **2** | **2** |
|Actual response-operation function-tool continuation negative control | **2** | **2** |

The final negative control executes the published response operation's actual execute function with synthetic parameter/body construction and its real continuation loop, through the same local transport. It deliberately supplies an unexpected function_call response. It demonstrates additional requests can be detected; it does not claim such a response happened in production. Socket counts alone are insufficient: two POSTs can reuse one TCP connection.

The first attempt at the negative-control assertion incorrectly expected two sockets; it was corrected to count Axios attempts and HTTP requests, accounting for keep-alive. The final nine scenarios pass. Existing durable permit/ambiguous dispatch tests also pass:26 tests from test/research-connection.test.js and test/editorial-engine-client.test.js. No paid retry was attempted.

Published-source hashes:

- OpenAI transport/index.js:11dffeebc776b9ecb9ff78939337e2613af2b39292afef1e9f7b08f7200f0bb0.
- Core request-helper-functions.js:63994aba707a928c66e3a98c1469d168730a00592b857b32958bde9549d703c5.

The reproducer checks these hashes before running. Source packages and reports remain ignored/private; no package dependency or lockfile in the application was changed. To reconstruct the fixture, use npm pack --ignore-scripts for the two exact published packages above, extract under source/ and core/, and install axios@1.15.0 with --ignore-scripts under fixture/ inside the supplied audit directory. The script never dispatches an n8n workflow.

## Exact remaining blocker and stop decision

The supported read-only interface confirms node typeVersion2.3, but **does not attest the deployed n8n/core/langchain/Axios package builds**. Public /rest/settings returned limited UI/auth settings with no build/version identifier. No decrypted credential access, Cloud process inspection, credential-base-URL attestation or global transport/proxy configuration was available. Neither published latest-package source nor a synthetic credential fixture can prove the deployed helper/authentication/proxy path.

Consequently, ordinary reference-build failure behavior is single-attempt, but deployed single-attempt behavior and unconditional one-POST-per-node behavior are **not proven**. The repair is not declared complete. No speculative replacement infrastructure or changed graph was produced. There is no fresh paid approval request yet.

The smallest next evidence needed is an authoritative Cloud build/package mapping (or deployed transport source hashes) plus non-secret confirmation of effective credential class/base-URL routing, refresh hooks and transport retry/interceptor configuration. Do not provide API keys/header values. A matching isolated full-node runtime can then test all failures and unexpected function responses. If a request-operation change is necessary, its exact body serialization/authentication/result shape and single-attempt behavior must be tested before producing a new graph SHA and requesting paid authorization.

Until then, the original acceptance job d7836190-8694-4609-a20b-84fbd26e501f stays unqueued and unspent; no live permit exists. Existing model/search budgets, source evidence, Muse prompts, job claims, rollback graph and all history are unchanged. No original-graph authorization is used to authorize a different graph or relaxed retry policy.
