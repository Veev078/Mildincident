// One founder journey; retained deep links resolve to the same working surfaces.
const aliases={overview:'build',images:'build',carousel:'build',caption:'refine',publishing:'approve'};
export const storyStage=tab=>Object.hasOwn(aliases,tab)?aliases[tab]:['build','refine','approve','research','direction','music'].includes(tab)?tab:'build';
export const storyStages=[['build','Build'],['refine','Refine'],['approve','Preview']];
export const photoLabel=(asset,index=0)=>asset?.shortLabel||`Photograph ${String(index+1).padStart(2,'0')}`;
