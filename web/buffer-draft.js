import {esc,effective,postMediaFor,image,storyUrl} from './components.js';

export function bufferDraftPanel(story,{compact=false}={}){
 const delivery=story.bufferDraft||{state:'blocked',message:'Sending from Studio is not enabled. Complete approval in the existing workflow.'};
 return `<section class="buffer-draft-status" data-buffer-status role="status"><h4>${delivery.state==='confirmed_draft'?'Buffer draft verified':delivery.state==='needs_reconciliation'?'Check delivery':'Send to Buffer'}</h4><p class="small">${esc(delivery.message)}</p>${delivery.postId&&!compact?`<p class="small">Buffer post ID: <code>${esc(delivery.postId)}</code></p>`:''}${delivery.canSend?`<button class="button button-dark" data-buffer-action="review" data-story="${esc(story.id)}">Send to Buffer</button>`:''}${delivery.canCheck?`<button class="small-button" data-buffer-action="check" data-story="${esc(story.id)}">Check delivery status</button>`:''}</section>`;
}

// Present delivery requirements in the final post review, without granting approvals.
export function bufferDeliveryIssues(delivery={}){
 const codes=(delivery.blockers||[]).map(b=>b.code||''),issues=[];
 if(codes.some(c=>/RIGHTS|PERMISSION/.test(c)))issues.push('Some selected photos have no verified usage basis. Record valid evidence or choose replacements before sending.');
 if(codes.some(c=>/JPEG|ASSET|MEDIA|FILE/.test(c)))issues.push('The finished slide files still need verification. Previews alone are not delivery-ready files.');
 if(codes.some(c=>/BUFFER_CONNECTION|NOT_AUTHORIZED/.test(c)))issues.push('Buffer draft delivery is switched off. It needs a separately authorized activation before this post can be sent.');
 if(codes.some(c=>/FACT|CAPTION_APPROVAL/.test(c)))issues.push('The exact caption and factual checks are not yet cleared for delivery.');
 const known=/RIGHTS|PERMISSION|JPEG|ASSET|MEDIA|FILE|BUFFER_CONNECTION|NOT_AUTHORIZED|FACT|CAPTION_APPROVAL/;
 if(codes.some(c=>!known.test(c)))issues.push('The saved post and current delivery evidence still need to match before sending.');
 if(!issues.length)issues.push(delivery.message||'Delivery readiness has not been verified. Nothing has been sent.');
 return issues;
}

export function bufferConfirmDialog(story,delivery){
 const assets=postMediaFor(story),draft=effective(story);
 if(delivery.ready!==true)return `<div class="dialog-heading"><div><p class="eyebrow">Unscheduled draft only</p><h2>Send this post to Buffer</h2></div><button class="icon-button" data-action="close-dialog" aria-label="Close final post review">×</button></div><p>Nothing has been sent. These items need attention before you can confirm this draft.</p><ol class="buffer-confirm-slides" aria-label="Selected slide order">${assets.map((a,i)=>`<li>${image(a,{compact:true,storyId:story.id,index:i})}<span>${i===0?'Cover':`Slide ${i+1}`}</span></li>`).join('')}</ol><details open><summary>Caption</summary><p class="body-copy">${esc(draft.caption)}</p></details><section role="status" aria-label="Before sending"><h3>Before sending</h3><ul>${bufferDeliveryIssues(delivery).map(issue=>`<li>${esc(issue)}</li>`).join('')}</ul></section><div class="dialog-actions"><a class="button button-light" href="${storyUrl(story.id,'build')}">Choose replacement photos</a><button class="button button-light" data-action="close-dialog">Keep editing</button></div>`;
 return `<div class="dialog-heading"><div><p class="eyebrow">Unscheduled draft only</p><h2>${delivery.completion?'Approve & send this post?':'Send this post to Buffer?'}</h2></div><button class="icon-button" data-action="close-dialog" aria-label="Cancel Buffer handoff">×</button></div><p>One draft for MILDINCIDENT. You will review it in Buffer before scheduling or publishing.</p><ol class="buffer-confirm-slides" aria-label="Final slide order">${assets.map((a,i)=>`<li>${image(a,{compact:true,storyId:story.id,index:i})}<span>${i===0?'Cover':`Slide ${i+1}`}</span></li>`).join('')}</ol><details open><summary>Final caption</summary><p class="body-copy">${esc(draft.caption)}</p></details><p class="small muted">${delivery.fileCount} final JPEG files verified. Your caption and slide order must still match the approved version when sent.</p>${delivery.completion?'<p><label><input type="checkbox" data-final-post-reviewed> I have checked the facts, credits, caption and finished slides.</label></p>':''}<div class="dialog-actions"><button class="button button-light" data-action="close-dialog">Keep editing</button><button class="button button-dark" ${delivery.completion?'data-post-completion="confirm"':'data-buffer-action="send"'} data-story="${esc(story.id)}">Confirm Buffer draft</button></div>`;
}

export function nativeReviewControls(story){
 const n=story.nativePublishing,t=story.nativeReviewTransfer,pending=['dispatching','running','uncertain'].includes(t?.state);
 if(pending)return `<p class="small" role="status">${t.state==='uncertain'?'Preparation needs confirmation. Your saved version is preserved; do not submit it again.':'Preparing this post in the existing approval workflow.'}</p><button class="small-button" data-native-review="check" data-story="${esc(story.id)}">Check preparation</button>`;
 if(n?.approveAvailable)return `<p class="small">Finished slides are ready. Preview the post before approving.</p><button class="button button-dark" data-native-review="review-approval" data-story="${esc(story.id)}">Approve post</button>`;
 if(t?.state==='native_review_saved'&&n?.nativeContentCurrent)return '<p class="small" role="status">The native copy matches your caption and slide order. Nothing has been sent.</p>';
 if(n?.reviewAvailable&&t?.filesPrepared===true&&!n.finalFilesVerified)return '<p class="small">The finished slides are saved in production. Check their private previews before approving.</p><button class="small-button" data-native-review="check" data-story="'+esc(story.id)+'">Check finished slides</button>';
 if(!n?.reviewAvailable)return n?.preparationReason?`<p class="small" role="status">${esc(n.preparationReason)} Your saved edit is preserved.</p>`:'';
 if(story.production?.package?.finalApprovalStatus==='approved'&&story.bufferDraft?.canSend)return '';
 return `${t?.state==='native_review_saved'&&t.filesPrepared===false?'<p class="small" role="status">Caption and slide order saved. Finished files and delivery readiness are checked before sending.</p>':''}<button class="button button-dark" data-native-review="review-transfer" data-story="${esc(story.id)}">Prepare for approval</button><p class="small muted">Saves the exact caption and slide order privately. Nothing is sent.</p>`;
}

export function nativeReviewDialog(story,approval=false){
 const assets=postMediaFor(story),d=effective(story);
 return `<div class="dialog-heading"><div><p class="eyebrow">${approval?'Final review':'Prepare this post'}</p><h2>${approval?'Approve this exact post?':'Prepare the caption and slides?'}</h2></div><button class="icon-button" data-action="close-dialog" aria-label="Cancel preparation">×</button></div><p>${approval?'Confirm only after inspecting the finished slides, sources and caption.':'Save this exact caption and slide order in your private production records. This does not render final files, approve image usage or create a Buffer draft.'}</p><ol class="buffer-confirm-slides">${assets.map((a,i)=>`<li>${image(a,{compact:true,storyId:story.id,index:i})}<span>${i===0?'Cover':`Slide ${i+1}`}</span></li>`).join('')}</ol><details open><summary>Caption</summary><p class="body-copy">${esc(d.caption)}</p></details>${approval?'<p><label><input type="checkbox" data-native-facts> I checked the facts, sources, credits and caption.</label></p><p><label><input type="checkbox" data-native-slides> I reviewed these finished slides in this order.</label></p>':''}<div class="dialog-actions"><button class="button button-light" data-action="close-dialog">Keep editing</button><button class="button button-dark" data-native-review="${approval?'approve':'submit'}" data-story="${esc(story.id)}">${approval?'Confirm post approval':'Confirm preparation'}</button></div>`;
}
