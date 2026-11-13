/** Source-specific correspondence, never pixel inspection. These exact project
 * paths and Hase/Rabbit naming were observed on the artist/publisher pages. */
export function projectImageContext(identity,{url,sourceUrl,caption,materialType,relation}){
 const has=(s,word)=>new RegExp('(?:^|[^a-z])'+word+'(?:$|[^a-z])','i').test(s||'');
 const subject=identity.subject||'';
 if(relation==='page_cover')return null;
 let image,source;try{image=new URL(url);source=new URL(sourceUrl);}catch{return null;}
 if(/\bkarabo\b/i.test(subject)&&/\bmooki\b/i.test(subject)&&/dog pound days/i.test(subject)&&source.hostname==='www.itsnicethat.com'&&source.pathname==='/articles/karabo-mooki-dog-pound-days-photography-project-170624'&&image.hostname==='m.itsnicethat.com'&&/^\/original_images\/Karabo_Mooki_Dogg_Pound_Days_/i.test(image.pathname))return {relation:'subject_caption_match',basis:'exact_publisher_project_and_individual_image_filename',project:'Dog Pound Days',maker:'Karabo Mooki',photographerVerified:false,identityVerified:false};
 if(!has(subject,'hase')||!has(subject,'gelitin')&&!has(subject,'gelatin'))return null;
 const artistFile=/^(?:www\.)?gelitin\.net$/.test(image.hostname)&&image.pathname.startsWith('/cache/projects/hase/');
 // Windowseat explicitly captions hase1 as the original sketch. The artist's
 // responsive filename is the same source artwork, not another photograph.
 if(artistFile&&/^hase1_(?:700|1400_w1400_cx0)\.jpg$/i.test(image.pathname.split('/').at(-1)))return {relation:'context_documentation',materialType:'design_documentation',basis:'source_identifies_original_hase_sketch',project:'Hase',maker:'Gelitin / Gelatin',photographerVerified:false,identityVerified:false};
 const namedSource=/^(?:www\.)?gelitin\.net$/.test(source.hostname)&&source.pathname==='/projects/hase/'||/^(?:www\.)?windowseat\.ph$/.test(source.hostname)&&source.pathname==='/giant-pink-bunny-in-italy/';
 const artistCaption=artistFile&&(/\b(?:rabbit|bunny|hase)\b/i.test(caption)||namedSource);
 const artworkCaption=source.hostname==='www.artsy.net'&&source.pathname==='/artwork/gelatin-slash-gelitin-hase-2006'&&/\bhase\b/i.test(caption)&&/\b(?:gelitin|gelatin)\b/i.test(caption);
 if(!artistCaption&&!artworkCaption)return null;
 const documentation=['design_documentation','publication_cover','publication_spread'].includes(materialType)||materialType==='installation'&&identity.projectKind!=='installation';
 return {relation:documentation?'context_documentation':'subject_caption_match',basis:artistCaption?/\b(?:rabbit|bunny|hase)\b/i.test(caption)?'original_artist_project_path_and_individual_caption':'original_artist_project_path_on_named_source':'exact_artwork_record_and_individual_caption',project:'Hase',maker:'Gelitin / Gelatin',photographerVerified:false,identityVerified:false};
}
