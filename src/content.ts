export interface ProjectImage {
  path: string;
  alt: string;
}

export interface Project {
  id: string;
  slug: string;
  title: string;
  summary: string;
  content: string;
  images: ProjectImage[];
  featured: boolean;
  createdAt: string;
  updatedAt: string;
  category?: string;
}

export interface PostsData {
  schemaVersion: 1;
  posts: Project[];
}

export interface SiteData {
  schemaVersion: 1;
  company: {
    name: string;
    description: string;
    about: string;
    experience: string;
    phone: string;
    address: string;
    legalName?: string;
    phoneSecondary?: string;
    fanpage?: string;
    fanpageUrl?: string;
    headline?: string;
    tagline?: string;
  };
  services: { id: string; title: string; description: string }[];
  media?: { logo: string; hero: string; about: string; logoLayout?: 'board' | 'contain' };
}

export const SITE_IMAGE_KEYS = ['logo', 'hero', 'about'] as const;
export type SiteImageKey = typeof SITE_IMAGE_KEYS[number];

export function siteImagePaths(site: SiteData) {
  return SITE_IMAGE_KEYS.map((key) => site.media?.[key]).filter((path): path is string => !!path);
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function strings(value: Record<string, unknown>, keys: string[]) {
  return keys.every((key) => typeof value[key] === 'string');
}

export function isProjectImagePath(path: string) {
  return /^public\/images\/projects\/[a-zA-Z0-9_/-]+\.(jpe?g|png|webp|avif)$/i.test(path)
    && !path.includes('//');
}

export function isPublicImagePath(path: string) {
  return /^public\/images\/[a-zA-Z0-9_/-]+\.(jpe?g|png|webp|avif)$/i.test(path)
    && !path.includes('//');
}

export function parsePosts(value: unknown): PostsData {
  if (!record(value) || value.schemaVersion !== 1 || !Array.isArray(value.posts)) {
    throw new Error('Cấu trúc data/posts.json không hợp lệ.');
  }
  const ids = new Set<string>();
  const slugs = new Set<string>();
  for (const post of value.posts) {
    if (!record(post)
      || !strings(post, ['id', 'slug', 'title', 'summary', 'content', 'createdAt', 'updatedAt'])
      || !/^[a-zA-Z0-9_-]+$/.test(post.id as string)
      || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(post.slug as string)
      || !(post.title as string).trim()
      || !Number.isFinite(Date.parse(post.createdAt as string))
      || !Number.isFinite(Date.parse(post.updatedAt as string))
      || typeof post.featured !== 'boolean'
      || (post.category !== undefined && typeof post.category !== 'string')
      || !Array.isArray(post.images)
      || !post.images.every((image: unknown) => record(image)
        && strings(image, ['path', 'alt']) && isPublicImagePath(image.path as string))) {
      throw new Error('Dữ liệu dự án không hợp lệ. Kiểm tra các trường và đường dẫn ảnh.');
    }
    if (ids.has(post.id as string) || slugs.has(post.slug as string)) {
      throw new Error('ID và slug của mỗi dự án phải duy nhất.');
    }
    ids.add(post.id as string);
    slugs.add(post.slug as string);
  }
  return value as unknown as PostsData;
}

export function parseSite(value: unknown): SiteData {
  if (!record(value) || value.schemaVersion !== 1 || !record(value.company)
    || !strings(value.company, ['name', 'description', 'about', 'experience', 'phone', 'address'])
    || !(value.company.name as string).trim() || !Array.isArray(value.services)) {
    throw new Error('Cấu trúc data/site.json không hợp lệ.');
  }
  for (const key of ['legalName', 'phoneSecondary', 'fanpage', 'fanpageUrl', 'headline', 'tagline']) {
    if (value.company[key] !== undefined && typeof value.company[key] !== 'string') {
      throw new Error('Thông tin công ty không hợp lệ.');
    }
  }
  if (value.company.fanpageUrl && (typeof value.company.fanpageUrl !== 'string'
    || !/^https:\/\/(?:www\.)?facebook\.com\/[a-zA-Z0-9./?=&_%+-]+$/.test(value.company.fanpageUrl))) {
    throw new Error('Link fanpage phải là địa chỉ https://facebook.com hợp lệ.');
  }
  if (typeof value.company.headline === 'string' && !value.company.headline.trim()) {
    throw new Error('Tiêu đề trang chủ không được để trống.');
  }
  if (value.media !== undefined && (!record(value.media)
    || !SITE_IMAGE_KEYS.every((key) => typeof (value.media as Record<string, unknown>)[key] === 'string'
      && ((value.media as Record<string, string>)[key] === '' || isPublicImagePath((value.media as Record<string, string>)[key])))
    || (value.media.logoLayout !== undefined && !['board', 'contain'].includes(value.media.logoLayout as string)))) {
    throw new Error('Đường dẫn ảnh nhận diện không hợp lệ.');
  }
  const ids = new Set<string>();
  for (const service of value.services) {
    if (!record(service) || !strings(service, ['id', 'title', 'description'])
      || !/^[a-zA-Z0-9_-]+$/.test(service.id as string)
      || !(service.title as string).trim() || ids.has(service.id as string)) {
      throw new Error('Dữ liệu dịch vụ không hợp lệ hoặc trùng ID.');
    }
    ids.add(service.id as string);
  }
  return value as unknown as SiteData;
}
