import sharp from 'sharp';
const hex=bits=>{let n=0n;for(const bit of bits)n=(n<<1n)|BigInt(bit);return n.toString(16).padStart(16,'0');};
/** Decodes actual private pixels. Similarity is advisory; it proves neither provenance nor visual quality. */
export async function fingerprint(bytes){
 const make=()=>sharp(bytes,{limitInputPixels:40000000}).rotate().flatten({background:'#ffffff'}).greyscale();
 const d=await make().resize(9,8,{fit:'fill'}).raw().toBuffer();const dbits=[];for(let y=0;y<8;y++)for(let x=0;x<8;x++)dbits.push(d[y*9+x]>d[y*9+x+1]?1:0);
 const pixels=await make().resize(32,32,{fit:'fill'}).raw().toBuffer();const coefficients=[];
 for(let v=0;v<8;v++)for(let u=0;u<8;u++){let sum=0;for(let y=0;y<32;y++)for(let x=0;x<32;x++)sum+=pixels[y*32+x]*Math.cos((2*x+1)*u*Math.PI/64)*Math.cos((2*y+1)*v*Math.PI/64);coefficients.push(sum);}
 const sorted=coefficients.slice(1).sort((a,b)=>a-b),median=sorted[31];return {version:'dhash-phash-v1',dhash:hex(dbits),phash:hex(coefficients.map((c,i)=>i&&c>median?1:0)),basis:'decoded_private_pixels',aestheticAssessment:'not_performed',rightsGranted:false};
}
export function hashDistance(a,b){if(!/^[a-f0-9]{16}$/.test(a||'')||!/^[a-f0-9]{16}$/.test(b||''))return null;let n=BigInt('0x'+a)^BigInt('0x'+b),count=0;while(n){count++;n&=n-1n;}return count;}
export function possibleVariants(media){const out=[];for(let a=0;a<media.length;a++)for(let b=a+1;b<media.length;b++){const x=media[a].localPreview?.fingerprint,y=media[b].localPreview?.fingerprint;if(!x||!y||x.version!==y.version)continue;const distances=[hashDistance(x.dhash,y.dhash),hashDistance(x.phash,y.phash)].filter(d=>d!==null);if(distances.length&&Math.min(...distances)<=6)out.push({assetIds:[media[a].id,media[b].id],basis:'perceptual_hash_resemblance',advisory:true,automaticAction:'none',identityVerified:false});}return out;}
