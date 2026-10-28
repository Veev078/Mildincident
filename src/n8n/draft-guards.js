// Pure JavaScript functions can be embedded into existing n8n Code nodes.
// No filesystem, native package, secret, or database dependency is introduced in n8n.
export function unwrapBufferCreate(raw) {
  let result = raw?.content?.find(item => item.type === 'text')?.text ?? raw;
  if (typeof result === 'string') {
    try { result = JSON.parse(result); } catch { return {}; }
  }
  for (let i = 0; i < 4; i++) {
    if (!result || typeof result !== 'object') return {};
    const nested = result.post ?? result.data?.createPost ?? result.data?.post;
    if (!nested) break;
    result = nested;
  }
  return result || {};
}

export function candidateBufferId(raw) {
  const result = unwrapBufferCreate(raw);
  return typeof result.id === 'string' && /^[a-f0-9]{24}$/i.test(result.id) ? result.id : '';
}

export function captionIsInternalTest(caption) {
  return /INTERNAL[\s\S]{0,60}TEST|DO\s+NOT\s+PUBLISH/iu.test(String(caption || ''));
}

export function hasExistingStoryHandoff(rows, conceptId) {
  // Include reservations, uncertain outcomes and previous versions. Unknown states block.
  return rows.some(row => row.concept_id === conceptId && row.state !== 'abandoned');
}

export function verifyDraftReadback(expected, response) {
  const post = response?.data?.post;
  const issues = [];
  if (response?.errors?.length || !post) issues.push('BUFFER_READBACK_UNAVAILABLE');
  if (!post || post.id !== expected.id || post.channelId !== expected.channelId) issues.push('BUFFER_ID_OR_CHANNEL_MISMATCH');
  if (!post || post.status !== 'draft' || !Object.hasOwn(post, 'dueAt') || post.dueAt !== null || !Object.hasOwn(post, 'sentAt') || post.sentAt !== null) issues.push('BUFFER_NOT_UNSCHEDULED_DRAFT');
  if (!post || typeof post.text !== 'string' || post.text !== expected.caption) issues.push('BUFFER_CAPTION_MISMATCH');
  if (!Array.isArray(expected.urls) || expected.urls.length === 0 || !Array.isArray(post?.assets) || post.assets.length !== expected.urls.length ||
    !post.assets.every((asset, index) => asset.source === expected.urls[index])) issues.push('BUFFER_MEDIA_ORDER_MISMATCH');
  return { verified: issues.length === 0, candidate_buffer_id: expected.id || '', issues,
    verification_source: 'independent_provider_readback', media_evidence: 'ordered_source_url_match' };
}
