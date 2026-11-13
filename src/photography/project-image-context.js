/** Source-specific correspondence, never pixel inspection. These exact project
 * paths and Hase/Rabbit naming were observed on the artist/publisher pages. */
export function projectImageContext(identity,{url,sourceUrl,caption,materialType,relation}){
 const has=(s,word)=>new RegExp('(?:^|[^a-z])'+word+'(?:$|[^a-z])','i').test(s||'');
 const subject=identity.subject||'';
 if(relation==='page_cover'||!has(subject,'hase')||!has(subject,'gelitin')&&!has(subject,'gelatin'))return null;
 const image=new URL(url),source=new URL(sourceUrl);
 const artistFile=/^(?:www\.)?gelitin\.net$/.test(image.hostname)&&image.pathname.startsWith('/cache/projects/hase/');
 const artistCaption=artistFile&&/\b(?:rabbit|bunny|hase)\b/i.test(caption);
 const artworkCaption=source.hostname==='www.artsy.net'&&source.pathname==='/artwork/gelatin-slash-gelitin-hase-2006'&&/\bhase\b/i.test(caption)&&/\b(?:gelitin|gelatin)\b/i.test(caption);
 if(!artistCaption&&!artworkCaption)return null;
 return {relation:['design_documentation','publication_cover','publication_spread','installation'].includes(materialType)?'context_documentation':'subject_caption_match',basis:artistCaption?'original_artist_project_path_and_individual_caption':'exact_artwork_record_and_individual_caption',project:'Hase',maker:'Gelitin / Gelatin',photographerVerified:false,identityVerified:false};
}
