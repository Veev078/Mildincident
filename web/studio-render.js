/** Preserve live image elements when changing selections, tabs or controls.
 * A template is inert: replacement markup cannot start duplicate image loads
 * before the existing, decoded image nodes have been moved into it. */
export function renderStudio(root,html){
 const images=new Map();for(const img of root.querySelectorAll('img[data-image-key]')){const key=img.dataset.imageKey;if(!images.has(key))images.set(key,[]);images.get(key).push(img);}
 const template=document.createElement('template');template.innerHTML=html;
 for(const img of template.content.querySelectorAll('img[data-image-key]')){
  const previous=images.get(img.dataset.imageKey)?.shift();if(!previous)continue;
  const oldPhoto=previous.closest('.photo'),photo=img.closest('.photo');
  if(oldPhoto?.classList.contains('preview-failed')){photo?.classList.add('preview-failed');const status=photo?.querySelector('.preview-status');if(status)status.textContent=oldPhoto.querySelector('.preview-status')?.textContent||'Preview unavailable';const retry=photo?.querySelector('.preview-retry');if(retry)retry.hidden=false;}
  // Do not assign src/srcset again: that restarts loading in some browsers.
  previous.alt=img.alt;previous.loading=img.loading;previous.className=img.className;
  img.replaceWith(previous);
  if(previous.complete&&previous.naturalWidth>0)photo?.querySelector('.preview-status')?.replaceChildren();
 }
 root.replaceChildren(template.content);
}
