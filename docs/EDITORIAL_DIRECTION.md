# Editorial direction workspace

`src/editorial-direction.js` translates the supplied inspiration-account research into **optional, reviewable local creative tools**. It does not turn the reference into instructions to publish, grant rights, predict growth or ban a format.

The source is the user-provided “Deep dive: inspo accounts — what works, what doesn’t, and how to build it into mildincident,” dated October 28, 2026. Its post examples and numerical claims were not re-fetched. Likes divided by follower counts are not reach-based engagement; the account sizes, post ages, formats and observation windows are not controlled comparisons. Its account-timezone guesses do not establish a verified MILDINCIDENT posting schedule.

## Creative brief API

`validateCreativeBrief(brief, story)` strictly validates writes and returns a new normalized object. It throws `HandoffError` with code `INVALID_CREATIVE_BRIEF` for unsupported input. No caller-owned object is mutated.

All fields are optional:

| Field | Allowed value |
| --- | --- |
| `hookType` | Empty/unset, `hidden_connection`, `true_form`, `secret_backstory`, `character_wardrobe`, `bizarre_fact`, `curated_list`, `timely_timeless` |
| `angle` | Up to 700 Unicode code points |
| `visualIntent` | Up to 1,200 code points; the editor’s intent, not a machine image assessment |
| `captionApproach` | `sentence_case`, `lowercase`, `retain_source` |
| `sequenceRoles` | At most 20 `{assetId, role, note?}` annotations; roles are `question`, `context`, `evidence`, `payoff`; notes up to 500 code points |
| `ratings` | Known keys `hook`, `visual`, `shareability`, `timelessness`; null or integer 1–5 |
| `notes` | Up to 4,000 code points; useful line breaks/tabs retained |
| `sourceLaneIds` | Unique IDs from the seven discovery lanes below |

Role annotations must reference images in the **current story’s media**, including unselected candidates. A single image gets at most one primary role annotation. Foreign IDs, duplicate annotations, unknown keys, invalid scores, unsupported enum values and control characters are rejected. An empty hook is supported by the frontend’s initial state.

The brief is an editor-owned local proposal. It does not update an approved caption, reorder a live package, clear an image, or create a draft/post. The parent API retains its source revision, local version and append-only history requirements.

## Read projection and stale state

`buildEditorialDirection(story, {creativeBrief})` returns:

- The dated, unverified reference and its metric/timing limitations.
- Seven hook choices, each framed as a question plus the original evidence needed to support an answer. Choosing a hook never generates a surprising factual claim.
- Broader source lanes with useful, encoded Brave search suggestions, example websites, a selected flag, and explicit per-image rights guidance.
- Caption guidance that invites concise source-led writing without silently changing names/quotations, mechanically imposing a three-sentence rule, or banning single images, video or longer captions.
- Sequence-role annotations and review issues. Unassigned selected images retain `role: null`; no role or visual quality is inferred from pixels. Current unselected annotations remain available for comparison.
- Four editor self-ratings. The mean remains null until all four are numeric. A high mean never authorizes publication, proves shareability or predicts reach.

The explicit options brief takes precedence over `story.creativeBrief`. Missing-source annotations in an earlier valid saved brief are retained in `sequence.roles` with `available: false`, `selected: false` and a review issue. They do not crash the whole workspace GET or disappear silently. The strict write validator still requires explicit repair against current media. Malformed historical brief fields produce `INVALID_STORED_CREATIVE_BRIEF`; the function does not overwrite the stored object.

The sequence model supports a single image, carousel or video and does not impose a minimum slide count. Question/context/evidence/payoff are narrative prompts for human review, not required categories that every story must fill.

## Discovery beyond institutional archives

| Lane ID | Focus and example leads |
| --- | --- |
| `photographer_portfolios` | Original photographer archives, portfolios and contact details; Magnum, Derek Ridgers, David Godlis |
| `independent_magazines` | Credited photography and interviews; Dazed, AnOther, The Face, 032c |
| `fashion_character` | Clothing as culture, identity and character; AnOther, The Face, i-D |
| `film_stills` | Production stills and original film materials; BFI, Academy, Criterion |
| `music_nightlife` | Scenes, audiences and performers through photographer-led records; Ridgers, Godlis, Museum of Youth Culture |
| `contemporary_visuals` | Current photography, visual art and moving-image projects; It’s Nice That, Nowness, IGNANT |
| `artist_studios` | Follow credited artist profiles to the creator’s own project/statement/studio; Art21 and Colossal as discovery starting points |

These sites are examples, **not connected services, verified current search results, available licensed images, or endorsed ingestion endpoints**. Search queries use the story title/subject and, for portfolios, a recorded selected-photo creator. Clicking a search opens an external search; the server does not fetch arbitrary source URLs. Photograph, artwork, magazine and film-still rights still require review per image; downloaded or public-facing material is not automatically reusable.

No empirical reference metrics are loaded into analytics. No image-pixel, audio or source-content analysis is performed. No best posting time, automatic schedule or performance threshold is produced.

## Validation

Nine focused tests cover valid empty/default briefs, preserved unselected annotations, foreign/duplicate IDs, invalid scores and enums, bounded notes/control characters, seven evidence-led hooks, safe discovery links, partial/full self-ratings, stale removed-image annotations and sparse/malformed historical reads.

```sh
node --test --test-isolation=none test/editorial-direction.test.js
```

The tests use synthetic local metadata. Local feature integration does not deploy or activate a production workflow; production rollout still requires founder approval.
