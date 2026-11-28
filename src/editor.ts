import { parsePosts, parseSite, SITE_IMAGE_KEYS, siteImagePaths, postImagePaths, isProjectImagePath, projectPosition } from './content.ts';
import type { PostsData, SiteData } from './content.ts';
import { gitRequest, branchRef, readSiteForAdmin, readPostsForAdmin, createBlob, imageUploadPath, acceptPublishedContent, GitHubError } from './github.ts';
import type { FileSnapshot } from './github.ts';

export interface ContentSnapshot {
  site: FileSnapshot<SiteData>;
  posts: FileSnapshot<PostsData>;
  head: string;
  tree: string;
}
export interface ContentDraft { site: SiteData; posts: PostsData }
export interface PendingImage { file: File; url: string; target?: string; sha?: string }
export interface SavePlan { base: string; commit: string; snapshot: ContentSnapshot }
export class RejectedSaveError extends GitHubError {}
export class UncertainSaveError extends Error {
  constructor() { super('Chưa xác minh được kết quả lưu. Bản nháp đã được giữ; nhấn Kiểm tra lần lưu khi có mạng.'); }
}
export function contentDraft(snapshot: ContentSnapshot): ContentDraft {
  return structuredClone({ site: snapshot.site.data, posts: snapshot.posts.data });
}
export function sameContent(left: unknown, right: unknown) { return JSON.stringify(left) === JSON.stringify(right); }

export async function readEditorSnapshot(token: string): Promise<ContentSnapshot> {
  const ref = await gitRequest<{ object: { sha: string } }>(`/git/ref/${branchRef()}`, token);
  const head = ref.object.sha;
  const [commit, site, posts] = await Promise.all([
    gitRequest<{ tree: { sha: string } }>(`/git/commits/${head}`, token),
    readSiteForAdmin(token, head), readPostsForAdmin(token, head),
  ]);
  return { head, tree: commit.tree.sha, site, posts };
}
export async function isPlanPublished(plan: SavePlan, token: string) {
  const ref = await gitRequest<{ object: { sha: string } }>(`/git/ref/${branchRef()}`, token);
  if (ref.object.sha === plan.commit) return true;
  if (ref.object.sha === plan.base) return false;
  const comparison = await gitRequest<{ status: string }>(`/compare/${plan.commit}...${ref.object.sha}`, token);
  return comparison.status === 'ahead' || comparison.status === 'identical';
}
export async function publishPlan(plan: SavePlan, token: string): Promise<ContentSnapshot> {
  async function acknowledged() {
    const ref = await gitRequest<{ object: { sha: string } }>(`/git/ref/${branchRef()}`, token);
    // Another admin may have published after this commit. Show the latest state.
    const snapshot = ref.object.sha === plan.commit ? structuredClone(plan.snapshot) : await readEditorSnapshot(token);
    acceptPublishedContent(snapshot.site, snapshot.posts, snapshot.head);
    return snapshot;
  }
  if (!(await isPlanPublished(plan, token))) {
    const current = await gitRequest<{ object: { sha: string } }>(`/git/ref/${branchRef()}`, token);
    if (current.object.sha !== plan.base) throw new RejectedSaveError('Dữ liệu đã thay đổi trên GitHub.', 409);
    try {
      const result = await gitRequest<{ object: { sha: string } }>(`/git/refs/${branchRef()}`, token, 'PATCH', { sha: plan.commit, force: false });
      if (result.object.sha !== plan.commit) throw new UncertainSaveError();
    } catch (failure) {
      try {
        if (await isPlanPublished(plan, token)) {
          return await acknowledged();
        }
      } catch { throw new UncertainSaveError(); }
      if (!(failure instanceof GitHubError) || failure.status === 0 || failure.status >= 500) throw new UncertainSaveError();
      if (failure.status === 409 || failure.status === 422) {
        const latest = await gitRequest<{ object: { sha: string } }>(`/git/ref/${branchRef()}`, token);
        if (latest.object.sha !== plan.base) throw new RejectedSaveError('Dữ liệu đã thay đổi trên GitHub.', 409);
      }
      throw new RejectedSaveError(failure.message, failure.status);
    }
  }
  return acknowledged();
}

export function moveToTrash(data: PostsData, saved: PostsData, id: string): PostsData {
  const visibleIndex = data.posts.findIndex((post) => post.id === id);
  if (visibleIndex < 0) return data;
  const index = projectPosition(data, visibleIndex);
  const project = saved.posts.find((post) => post.id === id);
  const previous = saved.trash?.find((item) => item.project.id === id);
  const archived = project ? { project: structuredClone(project), index, deletedAt: new Date().toISOString() }
    : previous ? { ...previous, index } : undefined;
  return { ...data, posts: data.posts.filter((post) => post.id !== id),
    ...(archived ? { trash: [...(data.trash || []).filter((item) => item.project.id !== id), structuredClone(archived)] }
      : data.trash ? { trash: data.trash.map((item) => item.index > index ? { ...item, index: item.index - 1 } : item) } : {}),
  };
}
export function restoreProject(data: PostsData, id: string): PostsData {
  const item = data.trash?.find((entry) => entry.project.id === id);
  if (!item) return data;
  const index = item.index - data.trash!.filter((entry) => entry.index < item.index).length;
  const posts = [...data.posts]; posts.splice(Math.max(0, Math.min(index, posts.length)), 0, structuredClone(item.project));
  if (data.posts.some((post) => post.id === id || post.slug === item.project.slug)) throw new Error('Bài đang hiển thị đã dùng ID hoặc đường dẫn này. Hãy đổi đường dẫn trước khi khôi phục.');
  return { ...data, posts, trash: data.trash!.filter((entry) => entry !== item) };
}

export function purgeProject(data: PostsData, id: string): PostsData {
  const removed = data.trash?.find((entry) => entry.project.id === id);
  if (!removed) return data;
  return { ...data, trash: data.trash!.filter((entry) => entry !== removed)
    .map((entry) => entry.index > removed.index ? { ...entry, index: entry.index - 1 } : entry) };
}

export async function persistDraft(options: {
  snapshot: ContentSnapshot; draft: ContentDraft; pending: Map<string, PendingImage>; token: string;
  plan?: SavePlan; checkpoint: () => Promise<void>; planned: (plan: SavePlan) => Promise<void>;
}) {
  if (options.plan) {
    const snapshot = await publishPlan(options.plan, options.token);
    return { snapshot, draft: contentDraft(snapshot) };
  }
  if (sameContent(options.draft, contentDraft(options.snapshot))) {
    return { snapshot: structuredClone(options.snapshot), draft: structuredClone(options.draft) };
  }
  const draft = structuredClone(options.draft);
  const uploads: { placeholder: string; pending: PendingImage }[] = [];
  const replace = (path: string, projectId: string) => {
    const image = options.pending.get(path);
    if (!image) return path;
    image.target ||= imageUploadPath(projectId, image.file);
    if (!uploads.some((entry) => entry.placeholder === path)) uploads.push({ placeholder: path, pending: image });
    return image.target;
  };
  if (draft.site.media) for (const key of SITE_IMAGE_KEYS) draft.site.media[key] = replace(draft.site.media[key], 'site-assets');
  for (const post of draft.posts.posts) for (const image of post.images) image.path = replace(image.path, post.id);
  const before = new Map(options.snapshot.posts.data.posts.map((post) => [post.id, post]));
  draft.posts.posts = draft.posts.posts.map((post) => sameContent(post, before.get(post.id))
    ? post : { ...post, updatedAt: new Date().toISOString() });
  parseSite(draft.site); parsePosts(draft.posts);
  const bytes = (value: unknown) => {
    const result = new TextEncoder().encode(`${JSON.stringify(value, null, 2)}\n`);
    if (result.length >= 1024 * 1024) throw new Error('File JSON cần nhỏ hơn 1 MB.');
    return result;
  };
  const siteBytes = bytes(draft.site), postsBytes = bytes(draft.posts);
  await options.checkpoint();
  const latest = await readEditorSnapshot(options.token);
  if (latest.site.sha !== options.snapshot.site.sha || latest.posts.sha !== options.snapshot.posts.sha) {
    throw new GitHubError('Dữ liệu đã thay đổi trên GitHub.', 409);
  }
  const entries: { path: string; mode: '100644'; type: 'blob'; sha: string | null }[] = [];
  const references = new Set([...siteImagePaths(draft.site), ...postImagePaths(draft.posts)]);
  const removed = new Set([...siteImagePaths(latest.site.data), ...postImagePaths(latest.posts.data)]
    .filter((path) => isProjectImagePath(path) && !references.has(path)));
  if (removed.size) {
    const tree = await gitRequest<{ truncated: boolean; tree: { path: string; type: string; mode: string }[] }>(`/git/trees/${latest.tree}?recursive=1`, options.token);
    if (tree.truncated) throw new Error('Không thể kiểm tra đầy đủ ảnh đang lưu; chưa thực hiện xóa.');
    for (const file of tree.tree) if (removed.has(file.path) && file.type === 'blob' && file.mode === '100644') {
      entries.push({ path: file.path, mode: '100644', type: 'blob', sha: null });
    }
  }
  for (const { pending } of uploads) {
    if (!pending.sha) {
      pending.sha = (await createBlob(new Uint8Array(await pending.file.arrayBuffer()), options.token)).sha;
      await options.checkpoint();
    }
    entries.push({ path: pending.target!, mode: '100644', type: 'blob', sha: pending.sha });
  }
  let site = latest.site, posts = latest.posts;
  if (!sameContent(draft.site, latest.site.data)) {
    const blob = await createBlob(siteBytes, options.token);
    site = { data: draft.site, sha: blob.sha };
    entries.push({ path: 'data/site.json', mode: '100644', type: 'blob', sha: blob.sha });
  }
  if (!sameContent(draft.posts, latest.posts.data)) {
    const blob = await createBlob(postsBytes, options.token);
    posts = { data: draft.posts, sha: blob.sha };
    entries.push({ path: 'data/posts.json', mode: '100644', type: 'blob', sha: blob.sha });
  }
  const tree = await gitRequest<{ sha: string }>('/git/trees', options.token, 'POST', { base_tree: latest.tree, tree: entries });
  const commit = await gitRequest<{ sha: string }>('/git/commits', options.token, 'POST', {
    message: 'content: publish website changes', tree: tree.sha, parents: [latest.head],
  });
  const plan: SavePlan = { base: latest.head, commit: commit.sha, snapshot: { head: commit.sha, tree: tree.sha, site, posts } };
  // Persist the exact commit before the only operation which changes the live branch.
  await options.planned(plan);
  const snapshot = await publishPlan(plan, options.token);
  return { snapshot, draft: contentDraft(snapshot) };
}
