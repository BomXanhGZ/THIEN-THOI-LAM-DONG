import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { ContentSnapshot } from '../src/editor.ts';
import type { SiteData, PostsData } from '../src/content.ts';
export const fixtureSite: SiteData = JSON.parse(readFileSync(new URL('../data/site.json', import.meta.url), 'utf8'));
export const fixturePosts: PostsData = JSON.parse(readFileSync(new URL('../data/posts.json', import.meta.url), 'utf8'));
const hash = (value: string) => createHash('sha1').update(value).digest('hex');
export function json(value: unknown, status = 200) { return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } }); }
/** In-memory Git graph. No requests leave the process. */
export class GitFixture {
  blobs = new Map<string, string>();
  trees = new Map<string, Record<string, string>>();
  commits = new Map<string, { tree: string; parents: string[] }>();
  calls: { path: string; method: string; body: Record<string, unknown> }[] = [];
  head: string;
  failPath = ''; failStatus = 403; losePatch = false; offlineAfterPatch = false; offline = false;
  beforePatch?: () => void;
  constructor(site = fixtureSite, posts = fixturePosts) {
    const files: Record<string, string> = { 'src/unrelated.ts': this.blob('preserve source') };
    files['data/site.json'] = this.blob(JSON.stringify(site)); files['data/posts.json'] = this.blob(JSON.stringify(posts));
    for (const post of [...posts.posts, ...(posts.trash || []).map((item) => item.project)]) {
      for (const image of post.images) files[image.path] = this.blob('original image');
    }
    for (const key of ['logo', 'hero', 'about'] as const) if (site.media?.[key]) files[site.media[key]] = this.blob('site image');
    this.head = this.commit(files, []);
  }
  blob(content: string) { const sha = hash(`blob:${content}`); this.blobs.set(sha, Buffer.from(content).toString('base64')); return sha; }
  commit(files: Record<string, string>, parents = [this.head]) {
    const tree = hash(JSON.stringify(files)); this.trees.set(tree, { ...files });
    const sha = hash(JSON.stringify({ tree, parents })); this.commits.set(sha, { tree, parents }); return sha;
  }
  files(head = this.head) { return this.trees.get(this.commits.get(head)!.tree)!; }
  data<T>(path: string, head = this.head): T { return JSON.parse(Buffer.from(this.blobs.get(this.files(head)[path])!, 'base64').toString()); }
  snapshot(): ContentSnapshot {
    return { head: this.head, tree: this.commits.get(this.head)!.tree,
      site: { data: this.data<SiteData>('data/site.json'), sha: this.files()['data/site.json'] },
      posts: { data: this.data<PostsData>('data/posts.json'), sha: this.files()['data/posts.json'] } };
  }
  external(site?: SiteData, posts?: PostsData) {
    const files = { ...this.files() };
    if (site) files['data/site.json'] = this.blob(JSON.stringify(site));
    if (posts) files['data/posts.json'] = this.blob(JSON.stringify(posts));
    this.head = this.commit(files); return this.snapshot();
  }
  ancestor(base: string, head: string): boolean { return base === head || (this.commits.get(head)?.parents || []).some((parent) => this.ancestor(base, parent)); }
  fetch: typeof fetch = async (input, init) => {
    const url = new URL(String(input)), path = url.pathname.replace(/^\/repos\/[^/]+\/[^/]+/, '');
    const method = init?.method || 'GET', body = init?.body ? JSON.parse(String(init.body)) : {};
    this.calls.push({ path, method, body });
    if (this.offline) throw new TypeError('Simulated offline');
    if (url.hostname === 'raw.githubusercontent.com') return json(this.data(url.pathname.split('/').slice(4).join('/')));
    if (!new Headers(init?.headers).get('Authorization')?.startsWith('Bearer ')) return json({}, 401);
    if (this.failPath && path === this.failPath) return json({}, this.failStatus);
    if (path === '/user') return json({ login: 'fixture-admin' });
    if (path === '') return json({ private: false, permissions: { push: true } });
    if (path === '/branches/main') return json({ name: 'main' });
    if (path === '/git/ref/heads/main') return json({ object: { sha: this.head } });
    if (path.startsWith('/contents/')) {
      const head = url.searchParams.get('ref') === 'main' ? this.head : url.searchParams.get('ref')!;
      const sha = this.files(head)[decodeURIComponent(path.slice('/contents/'.length))];
      return json({ type: 'file', encoding: 'base64', sha, content: this.blobs.get(sha) });
    }
    if (method === 'POST' && path === '/git/blobs') {
      const content = body.encoding === 'base64' ? Buffer.from(body.content, 'base64').toString() : body.content;
      return json({ sha: this.blob(content) }, 201);
    }
    if (method === 'GET' && path.startsWith('/git/commits/')) {
      const commit = this.commits.get(path.split('/').at(-1)!);
      return commit ? json({ tree: { sha: commit.tree }, parents: commit.parents.map((sha) => ({ sha })) }) : json({}, 404);
    }
    if (method === 'GET' && path.startsWith('/git/trees/')) {
      const files = this.trees.get(path.split('/').at(-1)!)!;
      return json({ truncated: false, tree: Object.entries(files).map(([path, sha]) => ({ path, sha, type: 'blob', mode: '100644' })) });
    }
    if (method === 'POST' && path === '/git/trees') {
      if (!body.base_tree || !this.trees.has(body.base_tree)) return json({}, 422);
      const files = { ...this.trees.get(body.base_tree) };
      for (const entry of body.tree) {
        if (entry.sha === null) { if (!files[entry.path]) return json({}, 422); delete files[entry.path]; }
        else files[entry.path] = entry.sha;
      }
      const sha = hash(JSON.stringify(files)); this.trees.set(sha, files); return json({ sha }, 201);
    }
    if (method === 'POST' && path === '/git/commits') {
      const sha = hash(JSON.stringify(body)); this.commits.set(sha, { tree: body.tree, parents: body.parents }); return json({ sha }, 201);
    }
    if (method === 'PATCH' && path === '/git/refs/heads/main') {
      this.beforePatch?.();
      if (body.force !== false || !this.ancestor(this.head, body.sha)) return json({}, 422);
      this.head = body.sha;
      if (this.offlineAfterPatch) this.offline = true;
      if (this.losePatch || this.offlineAfterPatch) throw new TypeError('Published but response lost');
      return json({ object: { sha: this.head } });
    }
    if (path.startsWith('/compare/')) {
      const [base, head] = path.slice('/compare/'.length).split('...');
      return json({ status: base === head ? 'identical' : this.ancestor(base, head) ? 'ahead' : 'diverged' });
    }
    throw new Error(`Unexpected mock request ${method} ${path}`);
  };
}
