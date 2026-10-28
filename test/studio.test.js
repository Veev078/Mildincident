import test from 'node:test';
import assert from 'node:assert/strict';
import { createStudioServer } from '../src/studio.js';
import { halloweenStories } from '../src/launch-brief.js';

test('serves the historical launch brief and stylesheet, rejects writes, and never serves private files', async t => {
  const server = createStudioServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const response = await fetch(origin);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Historical brief/);
  assert.match(html, /has not been verified in this session/);
  for (const story of halloweenStories) assert.ok(html.includes(story.storyId));
  assert.equal((html.match(/class="story"/g) || []).length, 4);
  assert.match(response.headers.get('content-security-policy'), /form-action 'none'/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const css = await fetch(`${origin}/studio.css`);
  assert.equal(css.status, 200);
  assert.match(await css.text(), /@media/);
  assert.equal((await fetch(origin, { method: 'POST', body: '{}' })).status, 405);
  assert.equal((await fetch(`${origin}/.local/draft-ledger.sqlite`)).status, 404);
  assert.equal((await fetch(`${origin}/src/handoff.js`)).status, 404);
});
