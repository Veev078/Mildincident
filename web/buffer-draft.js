import {esc,effective,mediaFor,image} from './components.js';

export function bufferDraftPanel(story){
 const delivery=story.bufferDraft||{state:'blocked',message:'Sending from Studio is not enabled. Complete approval in the existing workflow.'};
 return `<section class="buffer-draft-status" data-buffer-status role="status"><h4>${delivery.state==='confirmed_draft'?'Buffer draft verified':delivery.state==='needs_reconciliation'?'Check delivery':'Send to Buffer'}</h4><p class="small">${esc(delivery.message)}</p>${delivery.postId?`<p class="small">Buffer post ID: <code>${esc(delivery.postId)}</code></p>`:''}${delivery.canSend?`<button class="button button-dark" data-buffer-action="review" data-story="${esc(story.id)}">Send to Buffer</button>`:''}${delivery.canCheck?`<button class="small-button" data-buffer-action="check" data-story="${esc(story.id)}">Check delivery status</button>`:''}</section>`;
}

export function bufferConfirmDialog(story,delivery){
 const assets=mediaFor(story),draft=effective(story);
 return `<div class="dialog-heading"><div><p class="eyebrow">Unscheduled draft only</p><h2>Send this post to Buffer?</h2></div><button class="icon-button" data-action="close-dialog" aria-label="Cancel Buffer handoff">×</button></div><p>One draft for MILDINCIDENT. You will review it in Buffer before scheduling or publishing.</p><ol class="buffer-confirm-slides" aria-label="Final slide order">${assets.map((a,i)=>`<li>${image(a,{compact:true,storyId:story.id,index:i})}<span>${i===0?'Cover':`Slide ${i+1}`}</span></li>`).join('')}</ol><details open><summary>Final caption</summary><p class="body-copy">${esc(draft.caption)}</p></details><p class="small muted">${delivery.fileCount} final JPEG files verified. Your caption and slide order must still match the approved version when sent.</p><div class="dialog-actions"><button class="button button-light" data-action="close-dialog">Keep editing</button><button class="button button-dark" data-buffer-action="send" data-story="${esc(story.id)}">Confirm Buffer draft</button></div>`;
}
