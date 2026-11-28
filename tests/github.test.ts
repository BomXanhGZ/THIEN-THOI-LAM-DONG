import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { parsePosts, parseSite } from '../src/content.ts';
import type { Project } from '../src/content.ts';
import {
  clearContentCache, acceptPublishedContent, GitHubError,
  projectImageUrl, readPosts, readSite, readPostsForAdmin, readSiteForAdmin,
  imageUploadPath, validateImageFiles, gitRequest, validateAdminToken,
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

test('public JSON uses raw without credentials, caches UTF-8 clones and only busts cache on explicit refresh', async () => {
  let calls = 0;
  const urls: string[] = [];
  const value = { ...site, company: { ...site.company, name: 'THIEN-THOI-LAM-DONG — Điện nước 日本語' } };
  globalThis.fetch = async (input, init) => {
    calls += 1;
    const url = new URL(String(input));
    assert.equal(url.origin, 'https://raw.githubusercontent.com');
    assert.match(url.pathname, /\/main\/data\/site.json$/);
    assert.equal(url.search, calls === 1 ? '' : `?refresh=${url.searchParams.get('refresh')}`);
    urls.push(url.href);
    assert.equal(init?.cache, calls === 1 ? 'no-cache' : 'reload');
    assert.equal(init?.credentials, 'omit');
    const headers = new Headers(init?.headers);
    assert.equal(headers.has('Authorization'), false);
    assert.equal(headers.has('If-None-Match'), false);
    return json(value);
  };
  const first = await readSite();
  assert.equal(first.company.name, value.company.name);
  first.company.name = 'mutated draft';
  assert.equal((await readSite()).company.name, value.company.name);
  assert.equal(calls, 1);
  assert.equal((await readSite(true)).company.name, value.company.name);
  assert.equal(calls, 2);
  assert.notEqual(urls[0], urls[1]);
});

test('acknowledged publication populates both public caches without another request', async () => {
  globalThis.fetch = async () => { throw new Error('Cache should satisfy read'); };
  acceptPublishedContent({ data: site, sha: 'site-new' }, { data: posts, sha: 'posts-new' }, 'published-commit');
  assert.deepEqual(await readSite(), site);
  assert.deepEqual(await readPosts(), posts);
});

test('simultaneous public reads share one request and return separate copies', async () => {
  let resolve!: (response: Response) => void;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return new Promise<Response>((done) => { resolve = done; }); };
  const first = readSite();
  const second = readSite();
  assert.equal(calls, 1);
  resolve(json(site));
  const [one, two] = await Promise.all([first, second]);
  one.company.name = 'Changed copy';
  assert.equal(two.company.name, site.company.name);
});

test('a late raw response cannot roll back a completed save or replace its public cache', async () => {
  let resolve!: (response: Response) => void;
  const updated = { ...site, company: { ...site.company, name: 'Saved company' } };
  globalThis.fetch = async () => new Promise<Response>((done) => { resolve = done; });
  const loading = readSite();
  acceptPublishedContent({ data: updated, sha: 'new-sha' }, { data: posts, sha: 'posts-sha' }, 'a'.repeat(40));
  resolve(json(site));
  assert.deepEqual(await loading, updated);
  assert.deepEqual(await readSite(), updated);
});

test('clearing cache prevents an obsolete in-flight request from refilling it', async () => {
  let resolve!: (response: Response) => void;
  const updated = { ...site, company: { ...site.company, name: 'Current company' } };
  globalThis.fetch = async () => new Promise<Response>((done) => { resolve = done; });
  const obsolete = readSite();
  clearContentCache();
  globalThis.fetch = async () => json(updated);
  await readSite();
  resolve(json(site));
  assert.deepEqual(await obsolete, updated);
  assert.deepEqual(await readSite(), updated);
});

test('saved commit protects public refresh during CDN propagation, then returns to branch reads', async () => {
  const originalNow = Date.now;
  let now = originalNow();
  Date.now = () => now;
  const updated = { ...site, company: { ...site.company, name: 'Saved company' } };
  const commit = 'a'.repeat(40);
  const urls: string[] = [];
  try {
    globalThis.fetch = async (input) => {
      urls.push(String(input));
      return json(updated);
    };
    acceptPublishedContent({ data: updated, sha: 'new-sha' }, { data: posts, sha: 'posts-sha' }, 'a'.repeat(40));
    now += 60_001;
    assert.deepEqual(await readSite(), updated);
    assert.match(new URL(urls[0]).pathname, new RegExp(`/${commit}/data/site.json$`));
    assert.equal(new URL(urls[0]).searchParams.get('v'), 'new-sha');
    now += 300_001;
    await readSite();
    assert.match(new URL(urls[1]).pathname, /\/main\/data\/site.json$/);
  } finally { Date.now = originalNow; }
});

test('admin snapshots require a token, deduplicate concurrent reads, and always refresh the SHA', async () => {
  globalThis.fetch = async () => { throw new Error('Must not call GitHub without a token'); };
  await assert.rejects(readSiteForAdmin(''), /đăng nhập/);
  await assert.rejects(readPostsForAdmin(''), /đăng nhập/);
  let calls = 0;
  globalThis.fetch = async (input, init) => {
    calls += 1;
    const url = new URL(String(input));
    assert.equal(url.origin, 'https://api.github.com');
    assert.equal(url.searchParams.get('ref'), 'main');
    assert.equal(new Headers(init?.headers).get('Authorization'), `Bearer ${testToken}`);
    assert.equal(init?.cache, 'no-store');
    return fileResponse(site, `sha-${calls}`);
  };
  const [one, two] = await Promise.all([readSiteForAdmin(testToken), readSiteForAdmin(testToken)]);
  assert.equal(calls, 1);
  assert.equal(one.sha, two.sha);
  one.data.company.name = 'Changed copy';
  assert.equal(two.data.company.name, site.company.name);
  assert.equal((await readSiteForAdmin(testToken)).sha, 'sha-2');
  assert.equal(calls, 2);
});

test('logout preserves acknowledged public content while removing the admin credential', async () => {
  acceptPublishedContent({ data: site, sha: 'new-sha' }, { data: posts, sha: 'posts-sha' }, 'b'.repeat(40));
  logoutAdmin();
  globalThis.fetch = async () => { throw new Error('Published content should already be cached'); };
  assert.deepEqual(await readSite(), site);
  assert.throws(getAdminToken, /đăng nhập/);
});

test('a temporarily unavailable saved raw commit keeps acknowledged data, but does not mask errors forever', async () => {
  const originalNow = Date.now;
  let now = originalNow();
  Date.now = () => now;
  try {
    acceptPublishedContent({ data: site, sha: 'new-sha' }, { data: posts, sha: 'posts-sha' }, 'b'.repeat(40));
    globalThis.fetch = async () => json({}, 404);
    assert.deepEqual(await readSite(true), site);
    now += 300_001;
    await assert.rejects(readSite(true), (error: unknown) => error instanceof GitHubError && error.status === 404);
  } finally { Date.now = originalNow; }
});

test('an admin read completed after logout cannot refill the public cache with an obsolete snapshot', async () => {
  let resolve!: (response: Response) => void;
  globalThis.fetch = async () => new Promise<Response>((done) => { resolve = done; });
  const oldRead = readSiteForAdmin(testToken);
  logoutAdmin();
  resolve(fileResponse(site));
  await oldRead;
  const current = { ...site, company: { ...site.company, name: 'Current public company' } };
  globalThis.fetch = async (input) => {
    assert.equal(new URL(String(input)).origin, 'https://raw.githubusercontent.com');
    return json(current);
  };
  assert.deepEqual(await readSite(), current);
});

test('Git Data requests require token before any network request', async () => {
  globalThis.fetch = async () => { throw new Error('Must not fetch'); };
  await assert.rejects(gitRequest('/git/trees', '', 'POST', {}), /đăng nhập/);
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
  globalThis.fetch = async () => new Response('{broken');
  await assert.rejects(readPosts(true), /JSON UTF-8/);
  globalThis.fetch = async () => json({ schemaVersion: 99, posts: [] });
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

test('image paths are unique, raw and validated before publication', () => {
  const image = new File(['image'], 'a.jpg', { type: 'image/jpeg' });
  const first = imageUploadPath('project-1', image), second = imageUploadPath('project-1', image);
  assert.notEqual(first, second);
  assert.match(projectImageUrl(first), /^https:\/\/raw\.githubusercontent\.com\/BomXanhGZ\/THIEN-THOI-LAM-DONG\/main\/public\/images\/projects\/project-1\//);
  assert.throws(() => projectImageUrl('public/images/projects/../secret.jpg'), /không hợp lệ/);
  assert.throws(() => imageUploadPath('../invalid', image), /không hợp lệ/);
  assert.throws(() => validateImageFiles([image, new File(['svg'], 'b.svg', { type: 'image/svg+xml' })]), /JPEG/);
});
