export interface LocalDraft {
  baseRevision: string;
  version: number;
  updatedAt: string;
  stale?: boolean;
  caption?: string;
  notes?: string;
  selectedAssetIds?: string[];
  musicSelection?: { track: string; artist: string } | null;
  creativeBrief?: CreativeBrief;
}
export interface CreativeBrief {
  hookType?: '' | 'hidden_connection' | 'true_form' | 'secret_backstory' | 'character_wardrobe' | 'bizarre_fact' | 'curated_list' | 'timely_timeless';
  angle?: string; visualIntent?: string; captionApproach?: 'sentence_case' | 'lowercase' | 'retain_source';
  sequenceRoles?: {assetId: string; role: 'question' | 'context' | 'evidence' | 'payoff'; note?: string}[];
  ratings?: {hook?: number | null; visual?: number | null; shareability?: number | null; timelessness?: number | null};
  notes?: string; sourceLaneIds?: string[];
}
export interface DraftPatch extends Omit<LocalDraft, 'version' | 'updatedAt' | 'stale'> { expectedVersion: number }
export interface RebaseRequest { expectedVersion: number; previousRevision: string; currentRevision: string; confirm: 'keep_local_after_review'; selectedAssetIds?: string[]; creativeBrief?: CreativeBrief }
export interface SourceObservation {
  kind: 'live_snapshot'; observedAt: string; stale: boolean; refreshing?: boolean;
  warnings: string[]; productionMutationsEnabled: false;
  refreshError?: {code: string; message: string} | null;
}
export interface ImageEditorialReview {
  decision: 'shortlist' | 'reject' | 'hold'; reason: string; version: number; updatedAt: string;
  localOnly: true; rightsGranted: false;
  history: {version: number; decision: string; reason: string; updatedAt: string}[];
}
export interface MediaCandidate {
  localReview?: ImageEditorialReview | null;
  id: string; title: string; creator: string; sourceUrl: string; previewUrl: string;
  license: string; rightsStatus: string; provider: string; width: number | null; height: number | null; selected: boolean;
  sourcePreviewUrl: string; previewOrigin: 'source' | 'local_upload'; localPreview: LocalPreview | null;
}
export interface LocalPreview { originalSha256:string; sha256:string; originalName:string; uploadedAt:string;
  width:number;height:number;originalWidth:number;originalHeight:number;originalFormat:string;
  localOnly:true;rightsGranted:false;identityVerified:false }
export interface EditorialStory {
  id: string; title: string; subject: string; hook: string; format: string; stage: string;
  approvalStatus: string; caption: string; packageVersion: number | null; revision: string;
  sourceNotes: string; productionNotes: string; sourceReviewNotes: string;
  selectedAssetIds: string[]; targetSlideCount: number; rightsStatus: string; sourceClaimsReviewed: boolean;
  blockers: string[]; research: { claim: string; claimType: string; sourceName: string; url: string }[];
  media: MediaCandidate[]; localDraft: LocalDraft | null;
  musicSelection: { track: string; artist: string } | null;
  publishing: { manualStatus: string; observed: string; auditComplete: boolean; postIds: string[];
    multipleHandoffs: boolean; instagramVerified: boolean; reportedInstagramLinks: { postId: string; url: string }[]; requiresReview: boolean };
}

/** Local tracking only; opening a native n8n form is not confirmation of an execution. */
export interface ResearchRequest {
  id: string; kind: 'discovery' | 'brief'; prompt: string; sourceUrl: string; createdAt: string;
  baselineIds: string[]; version: number; linkedStoryId: string | null; handoffUrl: string;
  events: {version: number; event: 'handoff_requested' | 'story_linked'; storyId: string | null; createdAt: string}[];
  executionConfirmed: false; productionApplied: false;
}
