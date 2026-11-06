import {captionWorkspace} from './caption.js';
import {esc,effective,storyUrl,fieldDisabled} from './components.js';
import {founderDirection} from './direction.js';

/** One workspace across Develop and the legacy caption route; no second writing surface. */
export function developWorkspace(state,story,{renderSourceNotes=()=>'',renderDecision=()=>'',renderChecks=()=>''}={}){
 const working=effective(story);
 return `${captionWorkspace(state,story,{renderChecks})}<details class="develop-notes editorial-panel writing-notes"><summary>Story direction & private notes</summary>${founderDirection(story,{showAngle:false})}<p><a class="text-link" href="${storyUrl(story.id,'music')}">Music & media direction →</a></p><label class="field-label" for="editor-notes">Editor’s working notes</label><textarea id="editor-notes" data-draft-field="notes" data-story="${esc(story.id)}" rows="4" placeholder="Source questions, image decisions…" ${fieldDisabled(story)}>${esc(working.notes||'')}</textarea>${renderSourceNotes(story)}${story.origin==='n8n_development'?renderDecision(story):''}</details>`;
}
