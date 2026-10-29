export interface LocalDraft {
  baseRevision: string;
  version: number;
  updatedAt: string;
  stale?: boolean;
  caption?: string;
  notes?: string;
  selectedAssetIds?: string[];
  musicSelection?: { track: string; artist: string } | null;
}
export interface DraftPatch extends Omit<LocalDraft, 'version' | 'updatedAt' | 'stale'> { expectedVersion: number }
export interface RebaseRequest { expectedVersion: number; previousRevision: string; currentRevision: string; confirm: 'keep_local_after_review'; selectedAssetIds?: string[] }
export interface SourceObservation {
  kind: 'live_snapshot'; observedAt: string; stale: boolean; refreshing?: boolean;
  warnings: string[]; productionMutationsEnabled: false;
  refreshError?: {code: string; message: string} | null;
}
export interface MediaCandidate {
  id: string; title: string; creator: string; sourceUrl: string; previewUrl: string;
  license: string; rightsStatus: string; provider: string; width: number | null; height: number | null; selected: boolean;
}
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
