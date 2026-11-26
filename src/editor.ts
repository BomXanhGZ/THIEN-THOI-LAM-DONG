import { parsePosts, parseSite, SITE_IMAGE_KEYS } from './content.ts';
import type { PostsData, SiteData } from './content.ts';
import { savePosts, saveSite, uploadProjectImages } from './github.ts';
import type { FileSnapshot, UploadedImage } from './github.ts';

export interface ContentSnapshot {
  site: FileSnapshot<SiteData>;
  posts: FileSnapshot<PostsData>;
}

export interface ContentDraft { site: SiteData; posts: PostsData }

export interface PendingImage { file: File; url: string }

export function contentDraft(snapshot: ContentSnapshot): ContentDraft {
  return structuredClone({ site: snapshot.site.data, posts: snapshot.posts.data });
}

export function sameContent(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

/** Each completed write is acknowledged immediately so a retry cannot reuse its old SHA. */
export async function persistDraft(options: {
  snapshot: ContentSnapshot;
  draft: ContentDraft;
  pending: Map<string, PendingImage>;
  token: string;
  acknowledge: (snapshot: ContentSnapshot, draft: ContentDraft) => void;
  uploaded: (placeholder: string, image: UploadedImage) => void;
}) {
  let snapshot = structuredClone(options.snapshot);
  const draft = structuredClone(options.draft);
  const siteToValidate = structuredClone(draft.site);
  if (siteToValidate.media) {
    for (const key of SITE_IMAGE_KEYS) {
      if (options.pending.has(siteToValidate.media[key])) {
        siteToValidate.media[key] = `public/images/projects/site-assets/${key}.png`;
      }
    }
  }
  parseSite(siteToValidate);
  // Validate the entire draft before any write, substituting staged paths only for validation.
  parsePosts({ ...draft.posts, posts: draft.posts.posts.map((post) => ({
    ...post, images: post.images.map((image) => ({ ...image, path: options.pending.has(image.path)
      ? `public/images/projects/${post.id}/pending.png` : image.path })),
  })) });
  const acknowledge = () => options.acknowledge(structuredClone(snapshot), structuredClone(draft));
  if (draft.site.media) {
    for (const key of SITE_IMAGE_KEYS) {
      const placeholder = draft.site.media[key];
      const pending = options.pending.get(placeholder);
      if (!pending) continue;
      // Reserve one managed upload folder for site images; originals remain untouched.
      const [uploaded] = await uploadProjectImages('site-assets', [pending.file], options.token);
      draft.site.media[key] = uploaded.path;
      options.uploaded(placeholder, uploaded);
      acknowledge();
    }
  }
  if (!sameContent(draft.site, snapshot.site.data)) {
    snapshot.site = await saveSite(draft.site, snapshot.site.sha, options.token);
    acknowledge();
  }
  for (const post of draft.posts.posts) {
    for (const image of post.images) {
      const pending = options.pending.get(image.path);
      if (!pending) continue;
      const [uploaded] = await uploadProjectImages(post.id, [pending.file], options.token);
      const placeholder = image.path;
      image.path = uploaded.path;
      options.uploaded(placeholder, uploaded);
      acknowledge();
    }
  }
  if (!sameContent(draft.posts, snapshot.posts.data)) {
    const previous = new Map(snapshot.posts.data.posts.map((post) => [post.id, post]));
    draft.posts.posts = draft.posts.posts.map((post) => sameContent(post, previous.get(post.id))
      ? post : { ...post, updatedAt: new Date().toISOString() });
    snapshot.posts = await savePosts(draft.posts, snapshot.posts.sha, options.token);
    acknowledge();
  }
  return { snapshot, draft };
}
