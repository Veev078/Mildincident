# Photo source retrieval repair

One local fix; no deployment, workflow changes, paid calls or rights grants.

## Findings and changes

- The old image reader rejected same-host redirects unless the exact destination was already a markup variant. The reader now permits bounded same-host relocation and exact www/non-www canonical aliases with the same path/query. Every hop still passes HTTPS syntax, all-answer public DNS screening, pinned TLS destination and connected-address checks. Unbound cross-host destinations remain denied.
- Equivalent expanded/compressed IPv6 strings could falsely fail the socket-address comparison. Compare canonical address values, and prefer a checked IPv4 answer when available, without retrying a failed request. Narrow documentation IPv4 exclusions to their actual /24 ranges rather than rejecting neighbouring public ranges.
- A source DNS/transport/security failure previously terminated the entire bounded search. It now records that failure and continues only to a different independently bound relevant source within the existing request budget. It never retries that URL or relaxes its guard. Content-integrity, story-change and budget errors still stop.
- Exact Commons File records can use the existing source-page acquisition path rather than an unrelated catalogue search. Category/search pages remain excluded. An explicit original-image link enclosing an image is preferred over its display thumbnail; no original URL is guessed.
- DNS failure, connection/timeout, denied HTTP access, unsafe redirect and missing original remain distinct outcomes. Existing progress polling and receipts are reused. A completed failed search offers an explicit in-Studio recheck; no Shell or paid AI is involved. Existing saved-file checks and append-only receipts remain.

## Evidence and limit

Focused acquisition/security tests exercise decoded generated files, source fallback, original-link extraction, private custody and preserved selections. These are simulations, not NASA photography.

An actual attempt through the production reader in the current Codex environment returned SOURCE_PINNED_TRANSPORT_UNAVAILABLE before making a source request: the inherited HTTPS proxy cannot establish a locally pinned destination. It was not bypassed. No genuine NASA original was acquired or decoded here. This does not establish Render's network configuration or the exact failure in a hosted receipt.

The precise hosted failure cannot be diagnosed conclusively from the founder's description alone; no current authenticated receipt was accessible in this session. Do not call it an HTTP 403 by assumption.

## Required hosted acceptance

After separate deployment approval, use Find more photos on one saved story with its exact NASA or Commons File source record. No n8n change, permit or model call is required. A pass requires a network-captured page, a source-bound original-file URL, successful image response, decoded dimensions, original SHA256, a private file that hash-checks, and a selectable Build asset. Inspect the actual photograph. References/thumbnails/generated fixtures are not a pass. Read the resulting receipt through Studio's source history; no founder Shell commands or external downloads are part of this journey. If Render also requires an unverified proxy, fail closed and report that specific runtime blocker.
