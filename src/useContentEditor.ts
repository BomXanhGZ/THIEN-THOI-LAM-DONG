import { useCallback, useEffect, useRef, useState } from 'react';
import type { Project, ProjectImage, SiteData } from './content.ts';
import { getAdminToken, useAdminSession } from './auth.ts';
import { deleteProjectImage, projectImageUrl, readPosts, readSite, validateImageFiles } from './github.ts';
import type { UploadedImage } from './github.ts';
import { contentDraft, persistDraft, sameContent } from './editor.ts';
import type { ContentDraft, ContentSnapshot, PendingImage } from './editor.ts';

export function useContentEditor() {
  const admin = useAdminSession();
  const [snapshot, setSnapshot] = useState<ContentSnapshot | null>(null);
  const [draft, setDraft] = useState<ContentDraft | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [orphanCount, setOrphanCount] = useState(0);
  const writeLock = useRef(false);
  const editingRef = useRef(false);
  const snapshotRef = useRef<ContentSnapshot | null>(null);
  const pending = useRef(new Map<string, PendingImage>());
  const uploaded = useRef(new Map<string, UploadedImage>());
  const previews = useRef(new Map<string, string>());
  const urls = useRef(new Set<string>());
  const dirty = !!snapshot && !!draft && !sameContent(draft, contentDraft(snapshot));

  const refresh = useCallback(async (force = false) => {
    if (editingRef.current || writeLock.current) return;
    setLoading(true);
    try {
      const [site, posts] = await Promise.all([readSite(force), readPosts(force)]);
      const next = { site, posts };
      snapshotRef.current = next;
      setSnapshot(next);
      setDraft(contentDraft(next));
      setError('');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Không thể tải nội dung.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    void refresh();
    const focus = () => { void refresh(); };
    window.addEventListener('focus', focus);
    return () => window.removeEventListener('focus', focus);
  }, [refresh]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (editing && (dirty || busy)) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [editing, dirty, busy]);
  useEffect(() => () => urls.current.forEach((url) => URL.revokeObjectURL(url)), []);
  useEffect(() => {
    if (!admin && editingRef.current) {
      editingRef.current = false;
      setEditing(false);
      if (snapshotRef.current) setDraft(contentDraft(snapshotRef.current));
      setMessage('Phiên quản trị đã kết thúc. Nội dung chưa lưu đã được bỏ.');
    }
  }, [admin]);

  function editDraft(update: (previous: ContentDraft) => ContentDraft) {
    if (!admin || !editing || writeLock.current) return;
    setDraft((previous) => previous ? update(previous) : previous);
  }
  function updateCompany(key: keyof SiteData['company'], value: string) {
    editDraft((previous) => ({ ...previous, site: { ...previous.site, company: { ...previous.site.company, [key]: value } } }));
  }
  function updateServices(services: SiteData['services']) {
    editDraft((previous) => ({ ...previous, site: { ...previous.site, services } }));
  }
  function updateProject(id: string, values: Partial<Project>) {
    editDraft((previous) => ({ ...previous, posts: { ...previous.posts, posts: previous.posts.posts.map((post) => post.id === id ? { ...post, ...values } : post) } }));
  }
  function addProject() {
    const id = `cong-trinh-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const project: Project = { id, slug: id, title: 'Công trình mới', summary: '', content: '', images: [], featured: false, category: '', createdAt: now, updatedAt: now };
    editDraft((previous) => ({ ...previous, posts: { ...previous.posts, posts: [...previous.posts.posts, project] } }));
    window.location.hash = `/projects/${id}`;
  }
  function removeProject(id: string) {
    editDraft((previous) => ({ ...previous, posts: { ...previous.posts, posts: previous.posts.posts.filter((post) => post.id !== id) } }));
    window.location.hash = '/projects';
  }
  function addImages(project: Project, files: FileList | File[] | null) {
    if (!admin || !editing || writeLock.current || !files?.length) return;
    const selected = Array.from(files);
    try { validateImageFiles(selected); } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Ảnh không hợp lệ.'); return;
    }
    const images: ProjectImage[] = selected.map((file) => {
      const path = `pending:${crypto.randomUUID()}`;
      const url = URL.createObjectURL(file);
      urls.current.add(url);
      pending.current.set(path, { file, url });
      return { path, alt: project.title };
    });
    updateProject(project.id, { images: [...project.images, ...images] });
    setError('');
    setMessage('Ảnh đã được thêm vào bản nháp. Nhấn Save để tải lên và lưu.');
  }
  function imageSrc(path: string) {
    return pending.current.get(path)?.url || previews.current.get(path) || projectImageUrl(path);
  }
  async function enterEdit() {
    if (!admin || writeLock.current) return;
    writeLock.current = true;
    setBusy(true);
    try {
      const [site, posts] = await Promise.all([readSite(true), readPosts(true)]);
      const next = { site, posts };
      snapshotRef.current = next;
      setSnapshot(next);
      setDraft(contentDraft(next));
      editingRef.current = true;
      setEditing(true);
      setError(''); setMessage('Chế độ chỉnh sửa đã bật. Thay đổi chỉ được công khai khi bạn nhấn Save.');
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Không thể bật chỉnh sửa.'); }
    finally { writeLock.current = false; setBusy(false); }
  }
  async function cleanupUploads(discarding = false) {
    if (!uploaded.current.size) { setOrphanCount(0); return 0; }
    // Check the current remote references before deleting any session-owned upload.
    let published: Set<string>;
    try {
      const current = await readPosts(true);
      published = new Set(current.data.posts.flatMap((post) => post.images.map((image) => image.path)));
    } catch {
      setOrphanCount(uploaded.current.size);
      return uploaded.current.size;
    }
    const inDraft = new Set(!discarding && editingRef.current
      ? draft?.posts.posts.flatMap((post) => post.images.map((image) => image.path)) : []);
    let failures = 0;
    for (const [path, image] of uploaded.current) {
      if (published.has(path)) { uploaded.current.delete(path); continue; }
      if (inDraft.has(path)) continue;
      try { await deleteProjectImage(image, getAdminToken()); uploaded.current.delete(path); }
      catch { failures += 1; }
    }
    setOrphanCount(failures);
    return failures;
  }
  async function discard() {
    if (writeLock.current || !snapshotRef.current) return;
    writeLock.current = true; setBusy(true);
    try {
      const failures = await cleanupUploads(true);
      setDraft(contentDraft(snapshotRef.current));
      pending.current.clear();
      editingRef.current = false; setEditing(false); setError('');
      setMessage(failures ? `Đã hủy bản nháp. Còn ${failures} ảnh tải lên chưa lưu; bạn có thể thử dọn ảnh lại.` : 'Đã hủy các thay đổi chưa lưu.');
    } finally { writeLock.current = false; setBusy(false); }
  }
  async function save() {
    if (!admin || !snapshot || !draft || writeLock.current) return;
    writeLock.current = true; setBusy(true); setError(''); setMessage('Đang lưu nội dung…');
    let progress = false;
    try {
      const result = await persistDraft({ snapshot, draft, pending: pending.current, token: getAdminToken(),
        acknowledge: (next, nextDraft) => { progress = true; snapshotRef.current = next; setSnapshot(next); setDraft(nextDraft); },
        uploaded: (placeholder, image) => {
          uploaded.current.set(image.path, image);
          const url = pending.current.get(placeholder)?.url;
          if (url) previews.current.set(image.path, url);
          pending.current.delete(placeholder);
        },
      });
      snapshotRef.current = result.snapshot;
      setSnapshot(result.snapshot); setDraft(result.draft);
      const failures = await cleanupUploads();
      setMessage(failures ? `Nội dung đã lưu. Còn ${failures} ảnh tải lên không sử dụng cần dọn lại.` : 'Đã lưu nội dung lên website.');
    } catch (failure) {
      setMessage('');
      setError(`${progress ? 'Một phần thao tác đã hoàn tất. ' : ''}${failure instanceof Error ? failure.message : 'Không thể lưu.'} Bản nháp được giữ lại; bạn có thể kiểm tra và thử Save lại.`);
    } finally { writeLock.current = false; setBusy(false); }
  }
  async function cleanOrphans() {
    if (!admin || writeLock.current) return;
    writeLock.current = true; setBusy(true);
    try { const failures = await cleanupUploads(); setMessage(failures ? `Còn ${failures} ảnh chưa dọn được. Vui lòng thử lại.` : 'Đã dọn ảnh tải lên không được sử dụng.'); }
    finally { writeLock.current = false; setBusy(false); }
  }
  const data = editing ? draft : snapshot ? contentDraft(snapshot) : null;
  return { data, admin, editing, busy, loading, dirty, error, message, orphanCount,
    updateCompany, updateServices, updateProject, addProject, removeProject, addImages, imageSrc,
    refresh, enterEdit, discard, save, cleanOrphans, clearMessage: () => setMessage('') };
}

export type ContentEditor = ReturnType<typeof useContentEditor>;
