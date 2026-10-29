# Product-wide friction review

This prioritization uses the existing audit and source records; no second inventory or Halloween-specific rebuild was needed. Benefit/effort/risk are engineering judgments, not measured claims of a tenfold speedup.

| Friction | Priority / benefit | Implemented response | Remaining boundary |
| --- | --- | --- | --- |
| Context lost across research, package, images, caption and provider pages | High benefit, medium effort, low production risk locally | One story workspace with seven tabs, existing notes, source ID and context-aware next action | Authenticated deployment and reviewed write-back are pending |
| Unclear preparation vs sent/published status | High benefit, medium effort | Separate observation/manual/Instagram states; existing and unmapped provider IDs visible | Independent Instagram confirmation still needed |
| Caption/sequence edits require repeated backend navigation | High benefit, medium effort | Private autosave, caption checks, image comparison and accessible ordering beside research | Local proposals are not silently synced to production |
| Source refresh or tabs can overwrite work | High benefit, medium effort | Source digest, optimistic versions, history, explicit rebase and export rescue | Snapshot freshness still requires refresh; no invented real-time lock |
| Rights clues are scattered or treated as permission | High benefit, low effort | Per-image provenance/dialogs/filters, persistent pending indicators and context-specific next steps | Human permissions decision remains necessary |
| Source/caption/music checks repeated manually | Medium benefit, medium effort | Reusable citation identity, caption lint and story/selected-photo-metadata music ranking | No facts, pixels, audio or licenses are automatically verified |
| Analytics shows nothing or invents numbers from sent flags | Medium benefit, medium effort | Actual metric observations with units/samples, missing values, publishing history and bottlenecks | Small/missing data limits comparisons; no causal or timing claims |
| Buffer uncertainty permits repeat sends | Highest production safety priority, higher integration risk | Existing guard patches plus evidence-bound claim transition protocol strengthened locally | Remote conditional-update semantics and every create path must be validated before deployment |

## Journey after the sprint

Open the editorial desk → search/filter an existing story → inspect its dossier and original notes → review candidate provenance → compare/select/reorder a local sequence → edit caption beside source checks → retain or propose music → download a revision-bound proposal → review against the existing n8n production package. Provider history and reported archive outcomes remain available in the same workspace.

The transition from an approved proposal into n8n/export/Buffer is deliberately a separate reviewed integration. No mock button claims that it happened. The highest-value next deployment decision is authenticated staging of this frontend; the highest-value backend prerequisite remains a proven shared claim on the actual n8n deployment.

Second-pass changes completed after first browser success: mobile intrinsic-width fixes, preservation/display of existing source notes, stale draft and removed-image recovery, history/restore, unsaved edit rescue, flush-before-refresh, truthful refresh errors, unavailable-proposal controls, unmapped-post visibility, and refreshed editorial checks after local saves.
