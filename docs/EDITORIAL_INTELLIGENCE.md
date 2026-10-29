# Editorial intelligence and performance calculations

These modules provide local decision support for the new workspace. They read supplied data and return results; they do not fetch sources, download images, change n8n records, merge concepts, grant rights, schedule posts or publish content. Existing stories and saved preferences remain authoritative.

## Source and caption tools

`src/editorial-intelligence.js` exports:

- `canonicalizeSourceUrl(url)`: accepts credential-free HTTPS references, normalizes the URL and removes known campaign/click-tracking parameters. Meaningful query parameters, image filenames, parameter order and fragments remain distinct. It does not resolve redirects, remove image identifiers or assert that a source is safe to ingest server-side.
- `deduplicateCitations(research)`: groups canonical references while retaining all distinct recorded claim/type pairs and source names. Original `verified_fact` labels are recorded history, not verification performed by this module. Invalid references are flagged without echoing credential-bearing URLs.
- `lintCaption(caption, {research})`: counts Unicode code points against the local 2,200 limit; detects internal-test markers, unfinished placeholders, dossier labels and production instructions. Dates and categorical wording trigger source reminders. A lint pass is not a fact check, a rights decision or publication approval.
- `findDuplicateStories(stories)`: returns candidate pairs with a 0–1 overlap score and explicit shared-title/context reasons. Exact meaningful titles match strongly; other suggestions require at least two shared title terms and the configured threshold. It never merges records or infers identity from a generic category alone.
- `rankSoundtracks(story, catalog, {limit})`: ranks active curated tracks from the actual title, subject, hook, caption and **selected** photo titles/creators. Theme/mood/era matches are explained. Saved music direction is retained even when absent from the current catalog, and artist variety is preferred. Unrelated material receives no arbitrary generic recommendations. Every result explicitly says availability and music licensing are unverified; no pixel or audio analysis occurs.
- `analyzeStory(story, {catalog})`: combines caption, citation, soundtrack and selected-image rights diagnostics. Missing image IDs count as unresolved, and metadata suggesting public domain does not complete rights review.

These heuristics deliberately expose reasons and limits. They are intended to shorten editorial review, not replace it. Track recommendations do not query Instagram audio availability.

## Analytics contracts

`calculateAnalytics({posts, stories, performanceRows, observedAt, timezone})` in `src/analytics.js` returns:

- `coverage`: observed rows/posts, duplicate or conflicting post IDs, sent editorial posts, usable metric coverage and unresolved story/post mappings.
- `metrics`: per-name/unit values with `available`, `sampleSize`, observed post IDs and sources. Missing measurements stay `null`; numeric zero is a real measurement. Count-like measures sum only observed values, and rate/percentage measures return a mean of observed post-level values. Incompatible units never combine.
- `publishing`: Buffer-reported sent/draft/scheduled/error counts, New York day buckets, internal-test counts, observed first/last send times and median gaps. Missing sent times do not fall back to planned schedule times. Provider-reported Instagram links remain separate from caller-supplied independent verification.
- `bottlenecks` and `stages`: current story counts only. Duplicate blocker entries on one story count once. No stage duration is fabricated from a current snapshot.
- `categories`: comparisons for explicitly mapped editorial posts, excluding ambiguous multi-story ownership. Metrics remain conditional on the measured sample; no causal recommendation or universal performance ranking is generated.

Marked internal-test posts and unsent items are excluded from editorial performance totals, while publishing counts still reveal that the provider marked an internal test sent. Identical repeated post records do not double-count. Conflicting repeated IDs are excluded until reconciled.

`performanceRows` accepts explicitly linked observations: `{postId|buffer_post_id|post_id, metrics:[{name, value, unit, type?}]}`. Direct provider values take precedence over duplicate imported observations. Unmapped performance rows are not silently treated as verified posts. Strings such as `"0"`, null and non-finite numbers are not numeric measurements.

Default reach, impressions, likes, comments, shares and saves are returned as unavailable until actually measured. No engagement rate is inferred from missing components. Summed post reach is not deduplicated audience reach. Current snapshot counts do not establish how long a production stage took, and observed posting gaps do not establish the best time to publish.

## Validation and deployment

The two targeted suites contain **14 passing tests**, including meaningful URL identity, duplicate candidates, caption hazards, saved/metadata-ranked soundtrack selection, pending rights, missing-vs-zero metrics, unit/rate aggregation, marked test exclusion, New York date boundaries, ambiguous mappings and repeated-provider records.

Run:

```sh
node --test --test-isolation=none test/editorial-intelligence.test.js test/analytics.test.js
```

Tests use synthetic local records, not production mutations or invented live performance. Application integration uses real captured/authorized data when supplied by the backend. Production frontend or workflow deployment still requires founder approval; adding these pure local calculations does not activate any production write.
