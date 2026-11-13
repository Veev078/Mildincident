/** Operational classifications, not claims that a source or image does not exist. */
export function photoSourceFailure(code,{supportedNow=false}={}){
 if(!code)return null;
 if(code==='SOURCE_READER_UNAVAILABLE'&&supportedNow)return {kind:'unsupported_reader',label:'Source connection now available',message:'This earlier search stopped before any website was contacted. Studio now supports the recorded sources. Find more photos will make a new source check; your saved photographs stay unchanged.'};
 if(code==='SOURCE_READER_UNAVAILABLE')return {kind:'unsupported_reader',label:'Source connection needed',message:'This search stopped because its source connection was unavailable. No website was contacted. Changing the photo direction will not fix this. Keep editing with your saved photographs; they are unchanged.'};
 const http=String(code).match(/^(?:SOURCE|ARCHIVE)_HTTP_(\d{3})$/),status=http?Number(http[1]):null;
 if([401,403].includes(status))return {kind:'access_denied',httpStatus:status,label:'Source blocked access',message:'The source refused Studio’s request (HTTP '+status+'). This does not mean the photographs are missing. Your saved photographs are unchanged.'};
 if([404,410].includes(status))return {kind:'page_missing',httpStatus:status,label:'Original page not found',message:'The recorded page is no longer available at that address (HTTP '+status+'). Another recorded project source may still work. Your saved photographs are unchanged.'};
 if(status>=300&&status<400)return {kind:'redirect',httpStatus:status,label:'Original page moved',message:'The recorded page returned a redirect (HTTP '+status+'). Studio did not follow an unverified destination. Your saved photographs are unchanged.'};
 if(['SOURCE_NOT_HTML','SOURCE_TOO_LARGE'].includes(code))return {kind:'unreadable_page',label:'Source could not be read',message:'The source returned a page format or size Studio cannot safely read. Your saved photographs are unchanged.'};
 return {kind:'request_failed',label:'Source request did not complete',message:'Studio could not confirm a readable source response. This request will not be repeated automatically. Your saved photographs are unchanged.'};
}
