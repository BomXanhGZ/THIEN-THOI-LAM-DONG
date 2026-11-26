import { githubConfig } from './config.ts';
import { isProjectImagePath, isPublicImagePath, parsePosts, parseSite } from './content.ts';
import type { PostsData, SiteData } from './content.ts';

const repository = `/repos/${encodeURIComponent(githubConfig.owner)}/${encodeURIComponent(githubConfig.repo)}`;
const CACHE_TTL = 60_000;
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

interface CacheEntry extends FileSnapshot<unknown> {
  etag: string | null;
  expiresAt: number;
}

interface ContentFile {
  type: string;
  encoding: string;
  content: string;
  sha: string;
}

const cache = new Map<string, CacheEntry>();

export function clearContentCache() {
  cache.clear();
}

function contentEndpoint(path: string) {
  return `${repository}/contents/${path.split('/').map(encodeURIComponent).join('/')}`;
}

async function request(endpoint: string, options: {
  token?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  etag?: string | null;
} = {}): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2026-03-10',
  };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.etag) headers['If-None-Match'] = options.etag;

  let response: Response;
  try {
    response = await fetch(`https://api.github.com${endpoint}`, {
      method: options.method || 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: 'no-store',
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new GitHubError('Không thể kết nối GitHub. Kiểm tra mạng rồi thử lại.', 0);
  }
  if (response.ok || response.status === 304) return response;

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

async function readJson<T>(path: string, parse: (value: unknown) => T, force = false): Promise<FileSnapshot<T>> {
  const previous = cache.get(path);
  if (!force && previous && previous.expiresAt > Date.now()) {
    return { data: parse(structuredClone(previous.data)), sha: previous.sha };
  }
  // A unique URL avoids serving a stale anonymous GitHub/CDN response after a write.
  // The in-memory TTL and ETag still prevent unnecessary content transfers.
  const response = await request(`${contentEndpoint(path)}?ref=${encodeURIComponent(githubConfig.branch)}&cache_bust=${crypto.randomUUID()}`, {
    etag: previous?.etag,
  });
  if (response.status === 304 && previous) {
    previous.expiresAt = Date.now() + CACHE_TTL;
    return { data: parse(structuredClone(previous.data)), sha: previous.sha };
  }
  const file = await response.json() as ContentFile;
  if (file.type !== 'file' || file.encoding !== 'base64' || typeof file.content !== 'string' || !file.sha) {
    throw new Error(`Không đọc được ${path}. JSON phải là file UTF-8 dưới 1 MB.`);
  }
  let value: unknown;
  try {
    value = JSON.parse(decodeText(file.content));
  } catch {
    throw new Error(`${path} không phải JSON UTF-8 hợp lệ.`);
  }
  const data = parse(value);
  cache.set(path, { data: structuredClone(data), sha: file.sha, etag: response.headers.get('etag'), expiresAt: Date.now() + CACHE_TTL });
  return { data, sha: file.sha };
}

export function readPosts(force = false) {
  return readJson('data/posts.json', parsePosts, force);
}

export function readSite(force = false) {
  return readJson('data/site.json', parseSite, force);
}

function requireToken(token: string) {
  if (!token.trim()) throw new GitHubError('Cần đăng nhập trước khi ghi dữ liệu.', 401);
}

async function writeFile(path: string, content: string, token: string, message: string, sha?: string) {
  requireToken(token);
  const response = await request(contentEndpoint(path), {
    method: 'PUT', token,
    body: { message, content, branch: githubConfig.branch, ...(sha ? { sha } : {}) },
  });
  cache.delete(path);
  const result = await response.json() as { content: { sha: string } };
  return result.content.sha;
}

async function saveJson<T>(path: string, data: T, sha: string, token: string): Promise<FileSnapshot<T>> {
  if (!sha.trim()) throw new Error('Thiếu SHA của phiên bản đã đọc. Tải lại trước khi lưu.');
  const bytes = new TextEncoder().encode(`${JSON.stringify(data, null, 2)}\n`);
  if (bytes.length >= 1024 * 1024) throw new Error('File JSON cần nhỏ hơn 1 MB.');
  const nextSha = await writeFile(path, encodeBytes(bytes), token, `content: update ${path}`, sha);
  return { data, sha: nextSha };
}

// CRUD uses a copy of the posts array, then saves the complete document with its original SHA.
export function savePosts(data: PostsData, sha: string, token: string) {
  return saveJson('data/posts.json', parsePosts(data), sha, token);
}

export function saveSite(data: SiteData, sha: string, token: string) {
  return saveJson('data/site.json', parseSite(data), sha, token);
}

export interface UploadedImage {
  path: string;
  sha: string;
}

export class ImageUploadError extends Error {
  readonly uploaded: UploadedImage[];

  constructor(uploaded: UploadedImage[]) {
    super('Upload ảnh chưa hoàn tất. Các ảnh đã tải lên được giữ trong thuộc tính uploaded để thử lại hoặc dọn dẹp.');
    this.name = 'ImageUploadError';
    this.uploaded = uploaded;
  }
}

export function validateImageFiles(files: File[]) {
  for (const file of files) {
    if (!imageExtensions[file.type] || file.size === 0 || file.size > MAX_IMAGE_SIZE) {
      throw new Error('Chỉ chấp nhận JPEG, PNG, WebP, AVIF có dung lượng tối đa 8 MB mỗi ảnh.');
    }
  }
}

export async function uploadProjectImages(projectId: string, files: File[], token: string): Promise<UploadedImage[]> {
  requireToken(token);
  if (!/^[a-zA-Z0-9_-]+$/.test(projectId)) throw new Error('ID dự án không hợp lệ.');
  validateImageFiles(files);
  const uploaded: UploadedImage[] = [];
  try {
    // Contents API writes are intentionally sequential to avoid branch conflicts.
    for (const file of files) {
      const path = `public/images/projects/${projectId}/${crypto.randomUUID()}.${imageExtensions[file.type]}`;
      const content = encodeBytes(new Uint8Array(await file.arrayBuffer()));
      const sha = await writeFile(path, content, token, `content: upload image for ${projectId}`);
      uploaded.push({ path, sha });
    }
  } catch (error) {
    if (uploaded.length) throw new ImageUploadError(uploaded);
    throw error;
  }
  return uploaded;
}

export async function deleteProjectImage(image: UploadedImage, token: string) {
  requireToken(token);
  if (!isProjectImagePath(image.path) || !image.sha.trim()) throw new Error('Đường dẫn ảnh hoặc SHA không hợp lệ.');
  await request(contentEndpoint(image.path), {
    method: 'DELETE', token,
    body: { message: 'content: delete project image', sha: image.sha, branch: githubConfig.branch },
  });
}

export function projectImageUrl(path: string) {
  if (!isPublicImagePath(path)) throw new Error('Đường dẫn ảnh không hợp lệ.');
  // UUID filenames are immutable: new images get a new URL and never need a Pages deploy.
  const parts = [githubConfig.owner, githubConfig.repo, githubConfig.branch, ...path.split('/')];
  return `https://raw.githubusercontent.com/${parts.map(encodeURIComponent).join('/')}`;
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
