import { githubConfig } from './config.ts';
import { isPublicImagePath, parsePosts, parseSite } from './content.ts';
import type { PostsData, SiteData } from './content.ts';

const repository = `/repos/${encodeURIComponent(githubConfig.owner)}/${encodeURIComponent(githubConfig.repo)}`;
const localContent = import.meta.env?.DEV && import.meta.env.VITE_CONTENT_SOURCE !== 'github';
const CACHE_TTL = 60_000;
const WRITE_PROPAGATION_TTL = 5 * 60_000;
const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
const imageExtensions: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif',
};

export class GitHubError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'GitHubError';
    this.status = status;
  }
}

export interface FileSnapshot<T> {
  data: T;
  sha: string;
}

interface CacheEntry {
  data: unknown;
  version?: string;
  commit?: string;
  commitExpiresAt?: number;
  expiresAt: number;
}

interface ContentFile {
  type: string;
  encoding: string;
  content: string;
  sha: string;
}

const cache = new Map<string, CacheEntry>();
const publicReads = new Map<string, Promise<unknown>>();
const adminReads = new Map<string, { token: string; promise: Promise<FileSnapshot<unknown>> }>();
const revisions = new Map<string, number>();
let cacheRevision = 0;
let adminRevision = 0;

export function clearAdminCache() {
  adminRevision += 1;
  adminReads.clear();
}

export function clearContentCache() {
  cacheRevision += 1;
  cache.clear();
  publicReads.clear();
  revisions.clear();
  clearAdminCache();
}

function revision(path: string) {
  return `${cacheRevision}:${revisions.get(path) || 0}`;
}

function publishContent(path: string, data: unknown, version: string, commit?: string) {
  const previous = cache.get(path);
  const pinned = commit ? { commit, commitExpiresAt: Date.now() + WRITE_PROPAGATION_TTL }
    : previous?.version === version ? { commit: previous.commit, commitExpiresAt: previous.commitExpiresAt } : {};
  revisions.set(path, (revisions.get(path) || 0) + 1);
  publicReads.delete(path);
  cache.set(path, { data: structuredClone(data), version, ...pinned, expiresAt: Date.now() + CACHE_TTL });
}

function contentEndpoint(path: string) {
  return `${repository}/contents/${path.split('/').map(encodeURIComponent).join('/')}`;
}

async function fetchResponse(url: string, options: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new GitHubError('Không thể kết nối GitHub. Kiểm tra mạng rồi thử lại.', 0);
  }
  if (response.ok) return response;

  if (response.status === 429 || response.headers.get('x-ratelimit-remaining') === '0'
    || (response.status === 403 && response.headers.has('retry-after'))) {
    throw new GitHubError('Đã chạm giới hạn GitHub API. Vui lòng chờ rồi thử lại.', response.status);
  }
  const messages: Record<number, string> = {
    401: 'Token không hợp lệ hoặc đã hết hạn. Hãy đăng nhập lại.',
    403: 'GitHub từ chối thao tác. Kiểm tra quyền Contents: Read and write và quy tắc nhánh.',
    404: 'Không tìm thấy repository, nhánh hoặc file. Kiểm tra cấu hình và quyền truy cập.',
    409: 'Dữ liệu đã thay đổi hoặc nhánh đang xung đột. Tải lại trước khi lưu.',
    422: 'GitHub từ chối dữ liệu hoặc SHA. Tải lại và kiểm tra nội dung trước khi lưu.',
  };
  throw new GitHubError(messages[response.status] || `GitHub API gặp lỗi (${response.status}).`, response.status);
}

async function request(endpoint: string, options: {
  token: string;
  method?: 'GET' | 'POST' | 'PATCH';
  body?: unknown;
}): Promise<Response> {
  requireToken(options.token);
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2026-03-10',
    Authorization: `Bearer ${options.token}`,
  };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  return fetchResponse(`https://api.github.com${endpoint}`, {
    method: options.method || 'GET', headers, cache: 'no-store',
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

function rawUrl(path: string, ref = githubConfig.branch) {
  const parts = [githubConfig.owner, githubConfig.repo, ref, ...path.split('/')];
  return `https://raw.githubusercontent.com/${parts.map(encodeURIComponent).join('/')}`;
}

function encodeBytes(bytes: Uint8Array): string {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 8192) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 8192));
  }
  return btoa(binary);
}

function decodeText(base64: string): string {
  const binary = atob(base64.replace(/\s/g, ''));
  return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}

async function readPublicJson<T>(path: string, parse: (value: unknown) => T, force: boolean): Promise<T> {
  const previous = cache.get(path);
  if (!force && previous && previous.expiresAt > Date.now()) {
    return parse(structuredClone(previous.data));
  }
  let pending = publicReads.get(path);
  if (!pending) {
    const startedAt = revision(path);
    const task = (async () => {
      try {
        // Briefly read the exact saved commit while branch/CDN caches propagate.
        // The pin expires so this tab can discover later edits from other sessions.
        const ref = previous?.commit && (previous.commitExpiresAt || 0) > Date.now() ? previous.commit : githubConfig.branch;
        const url = localContent
          ? new URL(`${import.meta.env.BASE_URL}${path}`, window.location.origin)
          : new URL(rawUrl(path, ref));
        // A known saved SHA changes the CDN cache key without making every URL unique.
        if (previous?.version) url.searchParams.set('v', previous.version);
        if (force) url.searchParams.set('refresh', crypto.randomUUID());
        // The browser handles HTTP validators; raw does not expose ETag through CORS.
        const response = await fetchResponse(url.href, { cache: localContent ? 'no-store' : force ? 'reload' : 'no-cache', credentials: 'omit' });
        let value: unknown;
        try { value = await response.json(); }
        catch { throw new Error(`${path} không phải JSON UTF-8 hợp lệ.`); }
        const data = parse(value);
        if (startedAt !== revision(path)) return cache.get(path)?.data ?? data;
        cache.set(path, { ...previous, data: structuredClone(data), expiresAt: Date.now() + CACHE_TTL });
        return data;
      } catch (failure) {
        const current = cache.get(path);
        if (startedAt !== revision(path) && current) return current.data;
        // A new raw commit can briefly be unavailable. Its successful REST write
        // remains authoritative; keep that content until the bounded pin expires.
        if (current?.commit && (current.commitExpiresAt || 0) > Date.now()) {
          current.expiresAt = Math.min(Date.now() + CACHE_TTL, current.commitExpiresAt!);
          return current.data;
        }
        throw failure;
      }
    })();
    publicReads.set(path, task);
    pending = task;
  }
  try { return parse(structuredClone(await pending)); }
  finally { if (publicReads.get(path) === pending) publicReads.delete(path); }
}

async function readAdminJson<T>(path: string, parse: (value: unknown) => T, token: string, ref?: string): Promise<FileSnapshot<T>> {
  requireToken(token);
  const key = `${ref || githubConfig.branch}:${path}`;
  let pending = adminReads.get(key);
  if (!pending || pending.token !== token) {
    const session = adminRevision;
    const startedAt = revision(path);
    const promise = (async () => {
      const response = await request(`${contentEndpoint(path)}?ref=${encodeURIComponent(ref || githubConfig.branch)}&cache_bust=${crypto.randomUUID()}`, { token });
      const file = await response.json() as ContentFile;
      if (file.type !== 'file' || file.encoding !== 'base64' || typeof file.content !== 'string'
        || typeof file.sha !== 'string' || !file.sha.trim()) {
        throw new Error(`Không đọc được ${path}. JSON phải là file UTF-8 dưới 1 MB.`);
      }
      let value: unknown;
      try { value = JSON.parse(decodeText(file.content)); }
      catch { throw new Error(`${path} không phải JSON UTF-8 hợp lệ.`); }
      const data = parse(value);
      if (!ref && session === adminRevision && startedAt === revision(path)) publishContent(path, data, file.sha);
      return { data, sha: file.sha };
    })();
    pending = { token, promise };
    adminReads.set(key, pending);
  }
  try {
    const value = await pending.promise;
    return { data: parse(structuredClone(value.data)), sha: value.sha };
  } finally { if (adminReads.get(key) === pending) adminReads.delete(key); }
}

export function readPosts(force = false) {
  return readPublicJson('data/posts.json', parsePosts, force);
}

export function readSite(force = false) {
  return readPublicJson('data/site.json', parseSite, force);
}

export function readPostsForAdmin(token: string, ref?: string) {
  return readAdminJson('data/posts.json', parsePosts, token, ref);
}

export function readSiteForAdmin(token: string, ref?: string) {
  return readAdminJson('data/site.json', parseSite, token, ref);
}

export async function gitRequest<T>(path: string, token: string, method: 'GET' | 'POST' | 'PATCH' = 'GET', body?: unknown): Promise<T> {
  const response = await request(`${repository}${path}`, { token, method, body });
  return response.json() as Promise<T>;
}

export function acceptPublishedContent(site: FileSnapshot<SiteData>, posts: FileSnapshot<PostsData>, commit: string) {
  clearAdminCache();
  publishContent('data/site.json', site.data, site.sha, commit);
  publishContent('data/posts.json', posts.data, posts.sha, commit);
}

export function branchRef() { return `heads/${githubConfig.branch.split('/').map(encodeURIComponent).join('/')}`; }

export function imageUploadPath(projectId: string, file: File) {
  if (!/^[a-zA-Z0-9_-]+$/.test(projectId)) throw new Error('ID dự án không hợp lệ.');
  validateImageFiles([file]);
  return `public/images/projects/${projectId}/${crypto.randomUUID()}.${imageExtensions[file.type]}`;
}

export async function createBlob(bytes: Uint8Array, token: string) {
  const content = encodeBytes(bytes);
  // Blob creation is content-addressed. Repeating it cannot publish duplicate files.
  for (let attempt = 0; ; attempt += 1) {
    try { return await gitRequest<{ sha: string }>('/git/blobs', token, 'POST', { content, encoding: 'base64' }); }
    catch (failure) {
      if (attempt || !(failure instanceof GitHubError) || (failure.status !== 0 && failure.status < 500)) throw failure;
    }
  }
}

function requireToken(token: string) {
  if (!token.trim()) throw new GitHubError('Cần đăng nhập quản trị để truy cập GitHub API.', 401);
}

export function validateImageFiles(files: File[]) {
  for (const file of files) {
    if (!imageExtensions[file.type] || file.size === 0 || file.size > MAX_IMAGE_SIZE) {
      throw new Error('Chỉ chấp nhận JPEG, PNG, WebP, AVIF có dung lượng tối đa 8 MB mỗi ảnh.');
    }
  }
}

export function projectImageUrl(path: string) {
  if (!isPublicImagePath(path)) throw new Error('Đường dẫn ảnh không hợp lệ.');
  // UUID filenames are immutable: new images get a new URL and never need a Pages deploy.
  return rawUrl(path);
}

export async function validateAdminToken(token: string): Promise<{ login: string }> {
  if (!token.startsWith('github_pat_')) throw new Error('Vui lòng sử dụng GitHub Fine-grained Personal Access Token.');
  const userResponse = await request('/user', { token });
  const user = await userResponse.json() as { login: string };
  const repoResponse = await request(repository, { token });
  const repo = await repoResponse.json() as { private: boolean; permissions?: { push?: boolean } };
  if (repo.private) throw new Error('Website cần repository public để khách đọc JSON và ảnh mà không có token.');
  if (!repo.permissions?.push) throw new GitHubError('Tài khoản không có quyền ghi vào repository này.', 403);
  await request(`${repository}/branches/${encodeURIComponent(githubConfig.branch)}`, { token });
  // A successful GET/permissions.push alone does not prove the token has Contents: write.
  // This probe requires that permission but creates no commit, file, or workflow run.
  await request(`${repository}/git/blobs`, {
    method: 'POST', token, body: { content: '', encoding: 'utf-8' },
  });
  return { login: user.login };
}
