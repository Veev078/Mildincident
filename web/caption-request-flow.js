import {WRITING_DIRECTION_LABELS} from './writing-directions.js';
/** Browser presentation only. Stable native identifiers and server policy are preserved. */
export const CAPTION_IMPROVEMENTS=WRITING_DIRECTION_LABELS;
export const captionRequestPending=proposal=>['queued','running','dispatching','generating','uncertain','dispatch_uncertain','queue_uncertain'].includes(proposal?.state);
export const captionRequestLabel=proposal=>({prepared:'Ready to review',queued:'Request queued',running:'Draft in progress',dispatching:'Starting · awaiting confirmation',generating:'Draft in progress',completed:'New draft received',failed:'Draft request failed',uncertain:'Outcome needs checking',dispatch_uncertain:'Outcome needs checking',queue_uncertain:'Outcome needs checking',disabled:'Future starts disabled',expired:'Request expired',rejected:'Request needs review'}[proposal?.state]||'Request status unconfirmed');
export function captionRequestProposal(story,state={}){
 const server=story.captionGeneration?.pilot?.proposal,local=state.captionProposals?.[story.id];
 if(server&&!local)return server;
 if(server&&local&&server.id!==local.id){const a=Date.parse(server.createdAt||server.expiresAt),b=Date.parse(local.createdAt||local.expiresAt);return Number.isFinite(a)&&Number.isFinite(b)&&a>b?server:local;}
 if(server&&local&&server.id===local.id&&['queued','running','completed','failed','uncertain','dispatch_uncertain','queue_uncertain'].includes(server.state))return server;
 return local||server||null;
}
export function canConfirmCaption(story,proposal){
 const pilot=story.captionGeneration?.pilot;
 return pilot?.enabled===true&&pilot.state==='available'&&proposal?.state==='prepared'&&proposal.canConfirm===true&&!story.localDraft?.stale&&proposal.sourceRevision===story.revision&&proposal.workingVersion===(story.localDraft?.version||0)&&(!proposal.expiresAt||Date.parse(proposal.expiresAt)>Date.now());
}
