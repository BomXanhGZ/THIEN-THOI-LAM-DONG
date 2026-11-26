import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { contentDraft, persistDraft } from '../src/editor.ts';
import type { ContentSnapshot, PendingImage } from '../src/editor.ts';
import { parsePosts, parseSite, siteImagePaths, SITE_IMAGE_KEYS } from '../src/content.ts';
import type { PostsData } from '../src/content.ts';
import { clearContentCache, deleteProjectImage, projectImageUrl } from '../src/github.ts';

const originalFetch = globalThis.fetch;
const publishedSite = parseSite(JSON.parse(await readFile(new URL('../data/site.json', import.meta.url), 'utf8')));
const publishedPosts = parsePosts(JSON.parse(await readFile(new URL('../data/posts.json', import.meta.url), 'utf8')));
// Editor tests use fixtures so legitimate admin edits or an empty project list cannot break CI.
const site = parseSite({ schemaVersion: 1, company: { name: 'Công ty kiểm thử', description: '', about: '', experience: '', phone: '', email: '', address: '' },
  services: [], media: { logo: 'public/images/logo.png', hero: 'public/images/5.png', about: 'public/images/f.png', logoLayout: 'board' } });
const posts: PostsData = { schemaVersion: 1, posts: [{ id: 'fixture', slug: 'fixture', title: 'Công trình kiểm thử', summary: '', content: '',
  images: [{ path: 'public/images/1.png', alt: '' }], featured: false, createdAt: '2026-11-26T00:00:00Z', updatedAt: '2026-11-26T00:00:00Z' }] };
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

test('published content references existing image files', async () => {
  const images = [...siteImagePaths(publishedSite), ...publishedPosts.posts.flatMap((post) => post.images.map((image) => image.path))];
  for (const path of new Set(images)) {
    const bytes = await readFile(new URL(`../${path}`, import.meta.url));
    assert.ok(bytes.length > 0, path);
  }
});

test('site images upload before site JSON, survive a failed save, and are not uploaded again on retry', async () => {
  let snapshot = initial();
  let draft = contentDraft(snapshot);
  const pending = new Map<string, PendingImage>();
  assert.ok(draft.site.media);
  for (const key of SITE_IMAGE_KEYS) {
    const placeholder = `pending:${key}`;
    draft.site.media[key] = placeholder;
    pending.set(placeholder, { file: new File(['photo'], `${key}.png`, { type: 'image/png' }), url: `blob:${key}` });
  }
  let uploads = 0;
  let saves = 0;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    assert.equal(init?.method, 'PUT');
    if (url.includes('/contents/public/images/projects/site-assets/')) {
      uploads += 1;
      return response({ content: { sha: `photo-${uploads}` } }, 201);
    }
    assert.ok(url.endsWith('/data/site.json'));
    const body = JSON.parse(String(init.body));
    const value = JSON.parse(Buffer.from(body.content, 'base64').toString('utf8'));
    assert.ok(siteImagePaths(value).every((path) => path.startsWith('public/images/projects/site-assets/')));
    assert.equal(body.sha, 'site-old');
    saves += 1;
    return saves === 1 ? response({}, 409) : response({ content: { sha: 'site-new' } }, 201);
  };
  const save = () => persistDraft({ snapshot, draft, pending, token: 'fixture',
    acknowledge: (next, nextDraft) => { snapshot = next; draft = nextDraft; },
    uploaded: (placeholder) => { pending.delete(placeholder); },
  });
  await assert.rejects(save(), /xung đột/);
  assert.equal(uploads, 3);
  assert.equal(pending.size, 0);
  assert.equal(snapshot.site.sha, 'site-old');
  assert.ok(siteImagePaths(draft.site).every((path) => path.startsWith('public/images/projects/site-assets/')));
  const result = await save();
  assert.equal(result.snapshot.site.sha, 'site-new');
  assert.equal(uploads, 3);
  assert.equal(saves, 2);
});

test('site image removal is valid and malformed media is rejected before writing', async () => {
  const empty = structuredClone(site);
  empty.media = { logo: '', hero: '', about: '', logoLayout: 'contain' };
  assert.deepEqual(siteImagePaths(parseSite(empty)), []);
  const invalid = structuredClone(empty) as unknown as Record<string, unknown>;
  invalid.media = { ...empty.media, logoLayout: 'unsafe' };
  assert.throws(() => parseSite(invalid), /không hợp lệ/);
  const snapshot = initial();
  const draft = contentDraft(snapshot);
  draft.site.media = { logo: 'pending:logo', hero: 'https://example.com/x.png', about: '' };
  globalThis.fetch = async () => { throw new Error('No writes expected'); };
  await assert.rejects(persistDraft({ snapshot, draft, pending: new Map([['pending:logo', { file: new File(['photo'], 'logo.png', { type: 'image/png' }), url: 'blob:logo' }]]), token: 'fixture', acknowledge: () => {}, uploaded: () => {} }), /không hợp lệ/);
});
