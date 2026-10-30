# Studio / n8n photographic research

Development workflow: **MILDINCIDENT DEV — Studio Photographic Research v1**, ID `7Ju5AhcNJ9qkATwo`. Saved version `6a3f7f2e-8dcd-49de-8630-0a108e6105df` was independently read back **inactive**. It has never been executed by this sprint. No active sourcing, research, production, publishing or Buffer workflow was changed.

## What the development bridge does

Studio owns visual exploration, reference selection, frame-specific feedback and local editing. The native proof owns one bounded free archive request and returns source metadata. n8n remains the production authority; this is private research, not an alternate publishing path.

1. Open Discovery desk and start a new research direction. Historical demonstrations are regression material, not default discovery suggestions. Mark references for comparison if useful; none are mandatory.
2. Open **Continue research with n8n**, choose Commons / LOC / Art Institute, and download the private research packet. It contains the exact direction, trail, selected source identities and feedback. At most 20 references / 24,000 characters per packet; further research is resumable, not globally capped at that number.
3. After source access is permitted, open the **inactive development workflow** in n8n. In **Studio Research Packet**, replace `null` with the downloaded packet JSON. Leave the surrounding `return [{json:{packet:...}}];` structure intact. No credential is needed or included.
4. Execute it manually once. It has one GET, a 12-second HTTP timeout, no redirect/retry, no model, no table writer, no webhook or schedule. The same URL construction, reference guard and source normalizers are used by Studio. Cloud Code crypto availability and actual HTTP behavior still need this isolated test; local VM replay does not prove them.
5. Download the final **Return Private Research Receipt** JSON. Studio accepts one object or n8n's single-item JSON array/export wrapper. **Import private n8n result** creates a correlated child trail; the original findings and decisions stay saved. Repeat import is idempotent. A failed source remains unavailable, not an empty successful discovery.
6. Inspect actual photographs and source records, record judgments, follow credited creators/series, and use **Develop an editorial angle**. A reported execution ID, metadata, a catalogue name or an accessible URL does not establish image quality, identity, rights or factual correctness.

Imports require a packet exported from this private workspace. Packet digests establish content correlation, not authenticated native execution. Execution readback is not yet connected; imports explicitly remain unverified, and offline receipts are labeled. They never create production stories/assets/packages or grant rights.

## Required network change before live source testing

The enforced managed environment currently permits n8n/Buffer and package/GitHub hosts, but no archive hosts. Existing LOC denial was a proxy 403. Do not use n8n or another allowed host as a proxy workaround.

Proposed additional outbound hosts, preserving all current hosts, presets and credential bindings:

- API hosts: `commons.wikimedia.org`, `www.loc.gov`, `api.artic.edu`.
- Normal preview hosts: `upload.wikimedia.org`, `tile.loc.gov`, `www.artic.edu`.

This is a proposal, not an applied/published configuration change. The environment owner must approve the network change through the normal configuration workflow. No new API keys or paid subscription are needed for these adapters. LOC general photographs remains partial coverage, not full PPOC; Art Institute artist/work metadata is not automatically photographer/photograph metadata.

After approval, a managed-cloud check can fetch exactly one page and preserve it as a private Studio trail:

```sh
npm run research:live-check -- commons "your new photographic research direction"
```

Use `loc` or `aic` instead for another source. The command checks the available policy snapshot before calling the fixed API, makes no model/Buffer/n8n request and does not retry. Reports stay in ignored `.local/archive-live-checks/`. `RETRIEVED_METADATA` means metadata only; pixel inspection and editorial evaluation remain separate. A missing policy snapshot conservatively blocks this managed-cloud checker. It is not needed for normal local Studio browsing.

## Fresh discovery in the existing editorial worker

`buildEditorialDevelopmentEngine` now prepares a native seed-free continuation when all idea-bank leads are already tested, including when production history yields zero initial branches. It reruns the SAME native prompt builder with the same captured source reads, emptying only the exhausted idea bank. Original brand foundation, actual preset identity and territory logic remain intact. A changed fallback preset is rejected; a founder brief is never redirected this way.

The corrected worker is an offline proposal, not an update to the existing paid development worker. Budget remains one research call, at most one draft, two research tools, 3500/1800 output tokens and 30,000 input characters. No generation is authorized or enabled by this change. Native-source replay used partial captured context; scenarios with simulated seed selection are labeled. No new cultural candidate or photographic-quality outcome was generated or proven.
