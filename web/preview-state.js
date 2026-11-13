export function previewKind(asset){return asset?.localPreview?.sha256?'saved':'reference';}
export function previewFailureMessage(kind,{compact=false}={}){
 if(kind==='saved')return compact?'Saved preview unavailable':'The saved preview could not load. Its file record is preserved. Open Details to check it.';
 return compact?'Reference unavailable':'This source preview could not load. No photograph is saved for this reference.';
}
