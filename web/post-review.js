import {nativeReviewControls} from './buffer-draft.js';
import {esc,effective,postMediaFor,storyUrl,external,proposalControl} from './components.js';
import {reviewPath} from './review-path.js';
import {postPreview} from './post-preview.js';

export function postReview(story,state={}){
 const photos=postMediaFor(story),w=effective(story),p=story.publishing||{},n=story.nativePublishing,t=story.nativeReviewTransfer,d=story.bufferDraft,c=story.postCompletion;
 const previous=['buffer_sent','buffer_scheduled','buffer_unscheduled_draft','instagram_posted_verified'].includes(p.observed)||p.requiresReview;
 const transferPending=['dispatching','running','uncertain'].includes(t?.state),stale=story.localDraft?.stale;
 let status='Draft',message='',action='';
 const button=(label,attrs)=>`<button class="button button-dark" ${attrs} data-story="${esc(story.id)}">${label}</button>`;
 if(d?.canCheck){status=d.state==='confirmed_draft'?'In Buffer':'Checking delivery';message=d.message;action=button('Check delivery','data-buffer-action="check"');}
 else if(['sending','needs_reconciliation','confirmed_draft'].includes(d?.state)){status='Delivery recorded';message=d.message||'Check the recorded delivery before another send.';action=button('View delivery','data-post-inspector="delivery"');}
 else if(previous){status='Earlier delivery recorded';message='Check the existing Buffer post before another send.';action=button('View delivery','data-post-inspector="delivery"');}
 else if(c?.pending&&c.canResume){status='Final confirmation recorded';message='Continue this approved delivery; no second confirmation is needed.';action=button('Continue delivery','data-post-completion="advance"');}
 else if(stale){status='Changes to compare';message='Your saved version is safe. Compare the source changes first.';action=`<a class="button button-dark" href="${storyUrl(story.id,'refine')}">Compare changes</a>`;}
 else if(!photos.length){message='Choose your photographs first.';action=`<a class="button button-dark" href="${storyUrl(story.id,'build')}">Choose photographs</a>`;}
 else if(!w.caption.trim()){message='Add the caption to finish this post.';action=`<a class="button button-dark" href="${storyUrl(story.id,'refine')}">Write caption</a>`;}
 else if(c?.pending){status='Final confirmation recorded';message=c.canResume?'Continue the approved delivery; no second confirmation is needed.':'Delivery needs checking. The original confirmation is preserved.';action=button(c.canResume?'Continue delivery':'View delivery',c.canResume?'data-post-completion="advance"':'data-post-inspector="delivery"');}
 else {status=transferPending?'Finishing post':t?.state==='native_review_saved'&&n?.nativeContentCurrent?'Preparation verified':'Draft';message=transferPending?'Your existing request is saved. Finish Post resumes it without submitting another.':'Finish the caption and slides together, then confirm one unscheduled Buffer draft.';action=button('Finish Post','data-post-completion="finish"');}

 return `<section class="post-review post-final" aria-label="Your post" data-story-task="review"><header class="review-heading"><h2 class="sr-only">Your post.</h2><button class="text-button" data-post-inspector="sources" data-story="${esc(story.id)}">Post details</button></header><div class="review-desk"><div class="review-visual"><div data-post-preview-slot>${photos.length?postPreview(story,state.postSlides?.[story.id]||0):'<div class="review-no-photo"><p>Choose the photographs first.</p></div>'}</div><nav class="review-edit-links"><a href="${storyUrl(story.id,'build')}">Edit slides</a><a href="${storyUrl(story.id,'refine')}">Edit caption</a></nav></div><aside class="review-preparation"><span class="review-state">${esc(status)}</span><p class="completion-next" role="status">${esc(message)}</p><section class="review-transfer">${action}</section></aside></div></section>`;
}

// One contextual inspector; no parallel checklist or technical handoff on the post.
export function postInspector(story,section='sources'){
 if(!['sources','delivery'].includes(section))section='sources';
 const path=reviewPath(story);
 const sections={sources:'Sources',delivery:'Delivery & history'};
 const tabs=Object.entries(sections).map(([key,label])=>`<button class="filter-chip ${section===key?'active':''}" data-post-inspector="${key}" data-story="${esc(story.id)}" aria-pressed="${section===key}">${label}</button>`).join('');
 const sources=`<h3>Facts & attribution</h3>${story.production?.package?.sourceClaimsReviewed?'<p>Factual review is recorded in the current package.</p>':'<p>Source links support review; they do not mark the claims as verified. Confirm the facts with the final post.</p>'}<ul>${(story.research||[]).map(c=>`<li><p>${esc(c.claim)}</p>${external(c.url,c.sourceName||'Original source')}</li>`).join('')}</ul><nav class="review-edit-links"><a href="${storyUrl(story.id,'research')}">Full research</a><a href="${storyUrl(story.id,'direction')}">Creative direction</a><a href="${storyUrl(story.id,'music')}">Music</a><button class="text-button" data-action="rehearse-story" data-story="${esc(story.id)}">Full-screen preview</button>${proposalControl(story,'Download working copy')}<button class="text-button" data-action="draft-history" data-story="${esc(story.id)}">Version history</button></nav>`;
 const delivery=`<h3>Delivery</h3><p>${esc(story.bufferDraft?.message||'No confirmed Buffer draft for this edit.')}</p>${story.bufferDraft?.postId?`<p>Recorded Buffer ID: <code>${esc(story.bufferDraft.postId)}</code></p>`:''}<p>${esc(story.nativeReviewTransfer?.state||'No preparation transfer recorded.')}</p><h3>Recorded requirements</h3><ul>${path.requirements.map(r=>`<li>${esc(r.label)} · ${r.recorded?'Recorded':'Not recorded'}</li>`).join('')}</ul>${story.approvalRequest?`<a href="/api/stories/${encodeURIComponent(story.id)}/approval-requests/${encodeURIComponent(story.approvalRequest.id)}" download>Download saved review copy</a>`:''}${nativeReviewControls(story)}<p><a href="/api/stories/${encodeURIComponent(story.id)}/production-packet" download>Export post evidence</a></p><h3>Advanced details</h3><ul>${path.tasks.map(t=>`<li><strong>${esc(t.label)}</strong><p>${esc(t.detail)}</p></li>`).join('')}</ul>`;
 return `<div class="dialog-heading"><h2>Post details</h2><button class="icon-button" data-action="close-dialog" aria-label="Close post details">×</button></div><nav class="filter-chips" aria-label="Post details">${tabs}</nav><div class="post-inspector-body">${section==='delivery'?delivery:sources}</div>`;
}
