import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { contentDraft, persistDraft } from '../src/editor.ts';
import type { ContentSnapshot, PendingImage } from '../src/editor.ts';
import { parsePosts, parseSite } from '../src/content.ts';
import { clearContentCache, deleteProjectImage, projectImageUrl } from '../src/github.ts';

const originalFetch = globalThis.fetch;
const site = parseSite(JSON.parse(await readFile(new URL('../data/site.json', import.meta.url), 'utf8')));
const posts = parsePosts(JSON.parse(await readFile(new URL('../data/posts.json', import.meta.url), 'utf8')));
function initial(): ContentSnapshot {
  return structuredClone({ site: { data: site, sha: 'site-old' }, posts: { data: posts, sha: 'posts-old' } });
}
function response(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
}
afterEach(() => { globalThis.fetch = originalFetch; clearContentCache(); });

test('unchanged content is not written, and validation precedes all uploads and writes', async () => {
  globalThis.fetch = async () => { throw new Error('Unexpected write'); };
  const snapshot = initial();
  const unchanged = contentDraft(snapshot);
  const options = { snapshot, draft: unchanged, pending: new Map<string, PendingImage>(), token: 'fixture', acknowledge: () => {}, uploaded: () => {} };
  assert.deepEqual((await persistDraft(options)).snapshot, snapshot);
  const invalid = contentDraft(snapshot);
  invalid.site.company.name = 'New company';
  invalid.posts.posts[0].title = '';
  await assert.rejects(persistDraft({ ...options, draft: invalid }), /không hợp lệ/);
});

test('retry after partial JSON success retains the updated SHA and does not rewrite saved company data', async () => {
  let snapshot = initial();
  let draft = contentDraft(snapshot);
  draft.site.company.about += ' Updated.';
  draft.posts.posts[0].summary += ' Updated.';
  const writes: string[] = [];
  let conflict = true;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    assert.equal(init?.method, 'PUT');
    writes.push(url);
    const body = JSON.parse(String(init.body));
    if (url.endsWith('/data/site.json')) {
      assert.equal(body.sha, 'site-old');
      return response({ content: { sha: 'site-new' } }, 201);
    }
    assert.equal(body.sha, 'posts-old');
    return conflict ? response({}, 409) : response({ content: { sha: 'posts-new' } }, 201);
  };
  const save = () => persistDraft({ snapshot, draft, pending: new Map(), token: 'fixture',
    acknowledge: (next, nextDraft) => { snapshot = next; draft = nextDraft; }, uploaded: () => {},
  });
  await assert.rejects(save(), /xung đột/);
  assert.equal(snapshot.site.sha, 'site-new');
  assert.notEqual(draft.posts.posts[0].summary, snapshot.posts.data.posts[0].summary);
  conflict = false;
  const result = await save();
  assert.equal(result.snapshot.posts.sha, 'posts-new');
  assert.equal(writes.filter((url) => url.endsWith('/data/site.json')).length, 1);
  assert.equal(writes.filter((url) => url.endsWith('/data/posts.json')).length, 2);
});

test('successful staged images survive a failed save and are not uploaded again on retry', async () => {
  let snapshot = initial();
  let draft = contentDraft(snapshot);
  draft.posts.posts[0].images.push({ path: 'pending:test-photo', alt: 'Ảnh thực tế' });
  const pending = new Map<string, PendingImage>([['pending:test-photo', { file: new File(['image'], 'test.jpg', { type: 'image/jpeg' }), url: 'blob:fixture' }]]);
  let uploads = 0;
  let saves = 0;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    assert.equal(init?.method, 'PUT');
    if (url.includes('/contents/public/images/projects/')) {
      uploads += 1;
      return response({ content: { sha: 'photo-sha' } }, 201);
    }
    saves += 1;
    return saves === 1 ? response({}, 403) : response({ content: { sha: 'posts-new' } }, 201);
  };
  const save = () => persistDraft({ snapshot, draft, pending, token: 'fixture',
    acknowledge: (next, nextDraft) => { snapshot = next; draft = nextDraft; },
    uploaded: (placeholder) => { pending.delete(placeholder); },
  });
  await assert.rejects(save(), /từ chối/);
  assert.equal(uploads, 1);
  assert.equal(pending.size, 0);
  assert.ok(draft.posts.posts[0].images.at(-1)?.path.startsWith('public/images/projects/'));
  await save();
  assert.equal(uploads, 1);
  assert.equal(saves, 2);
});

test('supplied root image paths render but cannot be deleted using the upload cleanup API', async () => {
  assert.match(projectImageUrl('public/images/logo.png'), /\/main\/public\/images\/logo.png$/);
  globalThis.fetch = async () => { throw new Error('No delete expected'); };
  await assert.rejects(deleteProjectImage({ path: 'public/images/logo.png', sha: 'fixture' }, 'fixture'), /không hợp lệ/);
  for (const path of ['public/images/../secret.jpg', 'public/images//a.png', 'https://example.com/a.jpg']) {
    assert.throws(() => projectImageUrl(path), /không hợp lệ/);
  }
});

test('all supplied image references exist and published texts have intact Vietnamese', async () => {
  assert.equal(site.company.name, 'Thiên Thời Lâm Đồng');
  assert.equal(site.company.phone, '0388 600 880');
  assert.equal(site.company.phoneSecondary, '0337 200 880');
  const images = [...Object.values(site.media || {}), ...posts.posts.flatMap((post) => post.images.map((image) => image.path))];
  for (const path of new Set(images)) {
    const bytes = await readFile(new URL(`../${path}`, import.meta.url));
    assert.ok(bytes.length > 0, path);
  }
});
