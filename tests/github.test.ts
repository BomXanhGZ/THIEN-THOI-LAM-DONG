import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { parsePosts, parseSite } from '../src/content.ts';
import type { Project } from '../src/content.ts';
import {
  clearContentCache, deleteProjectImage, GitHubError, ImageUploadError,
  projectImageUrl, readPosts, readSite, savePosts, saveSite,
  uploadProjectImages, validateAdminToken,
} from '../src/github.ts';
import { getAdminToken, loginAdmin, logoutAdmin } from '../src/auth.ts';

const originalFetch = globalThis.fetch;
const posts = { schemaVersion: 1 as const, posts: [] as Project[] };
const site = parseSite(JSON.parse(await readFile(new URL('../data/site.json', import.meta.url), 'utf8')));
const testToken = 'github_pat_test_fixture';

afterEach(() => {
  globalThis.fetch = originalFetch;
  clearContentCache();
  logoutAdmin();
});

function json(value: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}

function fileResponse(value: unknown, sha = 'read-sha') {
  return json({ type: 'file', encoding: 'base64', content: Buffer.from(JSON.stringify(value), 'utf8').toString('base64'), sha }, 200, { etag: '"revision-1"' });
}

test('tracked data matches schema; 30 projects and many images are supported', async () => {
  parsePosts(JSON.parse(await readFile(new URL('../data/posts.json', import.meta.url), 'utf8')));
  parseSite(site);
  const many = Array.from({ length: 30 }, (_, index) => ({
    id: `project-${index}`, slug: `project-${index}`, title: `Fixture ${index}`,
    summary: '', content: 'Nội dung tiếng Việt 日本語', featured: false,
    images: Array.from({ length: 10 }, (_, image) => ({ path: `public/images/projects/project-${index}/${image}.webp`, alt: '' })),
    createdAt: '2026-11-17T00:00:00Z', updatedAt: '2026-11-17T00:00:00Z',
  }));
  assert.equal(parsePosts({ schemaVersion: 1, posts: many }).posts.length, 30);
  assert.throws(() => parsePosts({ schemaVersion: 1, posts: [many[0], many[0]] }), /duy nhất/);
  assert.throws(() => parsePosts({ schemaVersion: 1, posts: [{ ...many[0], images: [{ path: 'https://example.com/a.jpg', alt: '' }] }] }), /không hợp lệ/);
});

test('public JSON reads decode UTF-8, cache clones, and revalidate with ETag', async () => {
  let calls = 0;
  const urls: string[] = [];
  const value = { ...site, company: { ...site.company, name: 'THIEN-THOI-LAM-DONG — Điện nước 日本語' } };
  globalThis.fetch = async (input, init) => {
    calls += 1;
    const url = new URL(String(input));
    assert.match(url.pathname, /\/contents\/data\/site.json$/);
    assert.equal(url.searchParams.get('ref'), 'main');
    assert.match(url.searchParams.get('cache_bust') || '', /^[a-f0-9-]{36}$/);
    urls.push(url.href);
    assert.equal(init?.cache, 'no-store');
    const headers = new Headers(init?.headers);
    assert.equal(headers.has('Authorization'), false);
    if (calls === 2) {
      assert.equal(headers.get('If-None-Match'), '"revision-1"');
      return new Response(null, { status: 304 });
    }
    return fileResponse(value);
  };
  const first = await readSite();
  assert.equal(first.data.company.name, value.company.name);
  first.data.company.name = 'mutated draft';
  assert.equal((await readSite()).data.company.name, value.company.name);
  assert.equal(calls, 1);
  assert.equal((await readSite(true)).sha, 'read-sha');
  assert.equal(calls, 2);
  assert.notEqual(urls[0], urls[1]);
});

test('save uses the loaded SHA and branch, encodes UTF-8, then invalidates cache', async () => {
  let reads = 0;
  globalThis.fetch = async (_input, init) => {
    if (init?.method === 'PUT') {
      const body = JSON.parse(String(init.body));
      assert.equal(body.sha, 'read-sha');
      assert.equal(body.branch, 'main');
      assert.equal(new Headers(init.headers).get('Authorization'), `Bearer ${testToken}`);
      assert.deepEqual(JSON.parse(Buffer.from(body.content, 'base64').toString('utf8')), site);
      return json({ content: { sha: 'saved-sha' } }, 201);
    }
    reads += 1;
    return fileResponse(site);
  };
  await readSite();
  assert.equal((await saveSite(site, 'read-sha', testToken)).sha, 'saved-sha');
  await readSite();
  assert.equal(reads, 2);
});

test('missing token or SHA is rejected before sending any write', async () => {
  globalThis.fetch = async () => { throw new Error('Must not fetch'); };
  await assert.rejects(savePosts(posts, '', testToken), /SHA/);
  await assert.rejects(savePosts(posts, 'old-sha', ''), /đăng nhập/);
});

test('stale SHA conflicts are surfaced without retrying or overwriting', async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return json({}, 409); };
  await assert.rejects(savePosts(posts, 'stale-sha', testToken), (error: unknown) => error instanceof GitHubError && error.status === 409);
  assert.equal(calls, 1);
});

test('rate limits, denied access, expired tokens, invalid JSON and network errors are explicit', async () => {
  for (const status of [401, 403, 404, 422]) {
    globalThis.fetch = async () => json({}, status);
    await assert.rejects(readPosts(true), (error: unknown) => error instanceof GitHubError && error.status === status);
  }
  globalThis.fetch = async () => json({}, 403, { 'x-ratelimit-remaining': '0' });
  await assert.rejects(readPosts(true), /giới hạn/);
  globalThis.fetch = async () => { throw new TypeError('Network error'); };
  await assert.rejects(readPosts(true), /kết nối/);
  globalThis.fetch = async () => json({ type: 'file', encoding: 'base64', content: btoa('{broken'), sha: 'sha' });
  await assert.rejects(readPosts(true), /JSON UTF-8/);
  globalThis.fetch = async () => fileResponse({ schemaVersion: 99, posts: [] });
  await assert.rejects(readPosts(true), /không hợp lệ/);
});

function mockLogin(writeStatus = 201) {
  const calls: string[] = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    calls.push(url);
    assert.equal(new Headers(init?.headers).get('Authorization'), `Bearer ${testToken}`);
    if (url.endsWith('/user')) return json({ login: 'fixture-admin' });
    if (url.endsWith('/branches/main')) return json({ name: 'main' });
    if (url.endsWith('/git/blobs')) {
      assert.equal(init?.method, 'POST');
      assert.deepEqual(JSON.parse(String(init?.body)), { content: '', encoding: 'utf-8' });
      return json({ sha: 'empty-blob-sha' }, writeStatus);
    }
    return json({ private: false, permissions: { push: true } });
  };
  return calls;
}

test('login checks real token write permission, keeps token in memory, logout clears it', async () => {
  const calls = mockLogin();
  await loginAdmin(`  ${testToken}  `);
  assert.equal(getAdminToken(), testToken);
  assert.equal(calls.length, 4);
  assert.ok(calls.some((url) => url.endsWith('/git/blobs')));
  assert.ok(calls.every((url) => !url.includes(testToken)));
  logoutAdmin();
  assert.throws(getAdminToken, /đăng nhập/);
});

test('read-only token is refused even when repository permissions.push is true', async () => {
  mockLogin(403);
  await assert.rejects(loginAdmin(testToken), /Contents/);
  assert.throws(getAdminToken, /đăng nhập/);
});

test('classic tokens and private repositories cannot be used for this public website', async () => {
  await assert.rejects(validateAdminToken('classic-token-fixture'), /Fine-grained/);
  globalThis.fetch = async (input) => String(input).endsWith('/user') ? json({ login: 'fixture' }) : json({ private: true, permissions: { push: true } });
  await assert.rejects(validateAdminToken(testToken), /public/);
});

test('logout during token validation prevents a late login from restoring the session', async () => {
  let resolveUser!: (response: Response) => void;
  const pendingUser = new Promise<Response>((resolve) => { resolveUser = resolve; });
  const calls = mockLogin();
  const nextFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => String(input).endsWith('/user') ? pendingUser : nextFetch(input, init);
  const pendingLogin = loginAdmin(testToken);
  logoutAdmin();
  resolveUser(json({ login: 'fixture-admin' }));
  await assert.rejects(pendingLogin, /hủy/);
  assert.equal(calls.length, 3);
  assert.throws(getAdminToken, /đăng nhập/);
});

test('uploads use unique raw GitHub image paths and sequential writes', async () => {
  let inFlight = 0;
  const paths: string[] = [];
  globalThis.fetch = async (input, init) => {
    inFlight += 1;
    assert.equal(inFlight, 1);
    assert.equal(init?.method, 'PUT');
    const body = JSON.parse(String(init?.body));
    assert.equal(body.sha, undefined);
    assert.equal(body.branch, 'main');
    paths.push(String(input));
    await Promise.resolve();
    inFlight -= 1;
    return json({ content: { sha: `sha-${paths.length}` } }, 201);
  };
  const files = [new File(['image-1'], 'a.jpg', { type: 'image/jpeg' }), new File(['image-2'], 'b.webp', { type: 'image/webp' })];
  const uploaded = await uploadProjectImages('project-1', files, testToken);
  assert.equal(uploaded.length, 2);
  assert.notEqual(uploaded[0].path, uploaded[1].path);
  const url = projectImageUrl(uploaded[0].path);
  assert.match(url, /^https:\/\/raw\.githubusercontent\.com\/BomXanhGZ\/THIEN-THOI-LAM-DONG\/main\/public\/images\/projects\/project-1\//);
  assert.throws(() => projectImageUrl('public/images/projects/../secret.jpg'), /không hợp lệ/);
});

test('invalid image selection is rejected before uploading; partial success is recoverable', async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return calls === 1 ? json({ content: { sha: 'uploaded-sha' } }, 201) : json({}, 403);
  };
  const image = new File(['image'], 'a.jpg', { type: 'image/jpeg' });
  await assert.rejects(uploadProjectImages('project-1', [image, new File(['svg'], 'b.svg', { type: 'image/svg+xml' })], testToken), /JPEG/);
  assert.equal(calls, 0);
  await assert.rejects(uploadProjectImages('project-1', [image, image], testToken), (error: unknown) => error instanceof ImageUploadError && error.uploaded.length === 1 && error.uploaded[0].sha === 'uploaded-sha');
});

test('image deletion is limited to project images and uses the supplied SHA', async () => {
  let calls = 0;
  globalThis.fetch = async (_input, init) => {
    calls += 1;
    assert.equal(init?.method, 'DELETE');
    assert.equal(JSON.parse(String(init?.body)).sha, 'image-sha');
    return json({});
  };
  await assert.rejects(deleteProjectImage({ path: 'data/posts.json', sha: 'sha' }, testToken), /không hợp lệ/);
  assert.equal(calls, 0);
  await deleteProjectImage({ path: 'public/images/projects/project-1/1.webp', sha: 'image-sha' }, testToken);
  assert.equal(calls, 1);
});
