import { useCallback, useEffect, useRef, useState } from 'react';
import type { Project, ProjectImage, SiteData, SiteImageKey } from './content.ts';
import { getAdminToken, useAdminSession } from './auth.ts';
import { projectImageUrl, readPosts, readSite, validateImageFiles, GitHubError } from './github.ts';
import { contentDraft, persistDraft, sameContent, readEditorSnapshot, isPlanPublished, publishPlan, UncertainSaveError, RejectedSaveError, moveToTrash, restoreProject, purgeProject } from './editor.ts';
import type { ContentDraft, ContentSnapshot, PendingImage, SavePlan } from './editor.ts';
import { saveBackup, listBackups, backupImages, removeBackup, claimBackup, loadBackup, draftScope } from './draftStore.ts';
import type { DraftBackup } from './draftStore.ts';
import { mergeContent } from './merge.ts';
import type { ContentConflict, ConflictChoices } from './merge.ts';

export function useContentEditor() {
  const admin = useAdminSession();
  const [published, setPublished] = useState<ContentDraft | null>(null);
  const [snapshot, setSnapshot] = useState<ContentSnapshot | null>(null);
  const [draft, setDraft] = useState<ContentDraft | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [storageError, setStorageError] = useState('');
  const [recovery, setRecovery] = useState<DraftBackup[]>([]);
  const [conflicts, setConflicts] = useState<ContentConflict[]>([]);
  const [uncertain, setUncertain] = useState(false);
  const writeLock = useRef(false), editingRef = useRef(false);
  const snapshotRef = useRef<ContentSnapshot | null>(null), draftRef = useRef<ContentDraft | null>(null);
  const plan = useRef<SavePlan | undefined>(undefined);
  const backupId = useRef(''), release = useRef<(() => void) | undefined>(undefined);
  const backupQueue = useRef(Promise.resolve());
  const refreshRevision = useRef(0);
  const pending = useRef(new Map<string, PendingImage>());
  const previews = useRef(new Map<string, string>()), urls = useRef(new Set<string>());
  const conflictState = useRef<{ base: ContentSnapshot; local: ContentDraft; remote: ContentSnapshot; choices: ConflictChoices } | null>(null);
  const dirty = !!snapshot && !!draft && !sameContent(draft, contentDraft(snapshot));
  draftRef.current = draft;

  function apply(next: ContentSnapshot, nextDraft = contentDraft(next)) {
    snapshotRef.current = next; draftRef.current = nextDraft;
    setSnapshot(next); setDraft(nextDraft); setPublished(contentDraft(next));
  }
  async function checkpoint() {
    if (!admin || !snapshotRef.current || !draftRef.current || !backupId.current) throw new Error('Chưa có phiên bản nháp để phục hồi.');
    const record = { id: backupId.current, login: admin.login, snapshot: structuredClone(snapshotRef.current), draft: structuredClone(draftRef.current), plan: plan.current ? structuredClone(plan.current) : undefined };
    const images = new Map([...pending.current].map(([key, value]) => [key, { ...value }]));
    const saving = backupQueue.current.catch(() => {}).then(() => saveBackup(record, images));
    backupQueue.current = saving;
    await saving;
    setStorageError('');
  }
  async function clearStored() {
    const id = backupId.current;
    const removing = backupQueue.current.catch(() => {}).then(async () => { if (id) await removeBackup(id); });
    backupQueue.current = removing;
    await removing;
  }
  function finishLease() { release.current?.(); release.current = undefined; backupId.current = ''; }
  function clearPending() {
    for (const image of pending.current.values()) { URL.revokeObjectURL(image.url); urls.current.delete(image.url); }
    pending.current.clear();
  }
  const refresh = useCallback(async (force = false) => {
    if (editingRef.current || writeLock.current) return;
    const currentRevision = ++refreshRevision.current;
    setLoading(true);
    try {
      const [site, posts] = await Promise.all([readSite(force), readPosts(force)]);
      if (currentRevision !== refreshRevision.current || editingRef.current || writeLock.current) return;
      setPublished({ site, posts }); setError('');
    } catch (failure) {
      if (currentRevision === refreshRevision.current) setError(failure instanceof Error ? failure.message : 'Không thể tải nội dung.');
    } finally { if (currentRevision === refreshRevision.current) setLoading(false); }
  }, []);
  useEffect(() => {
    void refresh();
    const focus = () => { void refresh(); };
    window.addEventListener('focus', focus);
    return () => window.removeEventListener('focus', focus);
  }, [refresh]);
  useEffect(() => {
    let active = true;
    if (admin) void listBackups(admin.login).then((records) => { if (active) setRecovery(records); }).catch((failure) => { if (active) setStorageError(String(failure.message)); });
    else setRecovery([]);
    return () => { active = false; };
  }, [admin]);
  useEffect(() => {
    if (!admin || !editing || busy || writeLock.current) return;
    const timer = window.setTimeout(() => { void (dirty || plan.current ? checkpoint() : clearStored()).catch((failure) => setStorageError(failure.message)); }, 500);
    return () => window.clearTimeout(timer);
  }, [admin, editing, dirty, busy, draft]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (editing && (dirty || busy || uncertain)) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [editing, dirty, busy, uncertain]);
  useEffect(() => () => { release.current?.(); urls.current.forEach((url) => URL.revokeObjectURL(url)); }, []);
  useEffect(() => {
    if (!admin && editingRef.current) {
      editingRef.current = false; setEditing(false); finishLease();
      clearPending(); plan.current = undefined; setUncertain(false); setConflicts([]); conflictState.current = null;
      if (snapshotRef.current) apply(snapshotRef.current);
      setMessage('Phiên quản trị đã kết thúc. Bản nháp chưa lưu được giữ trên máy để khôi phục sau khi đăng nhập.');
    }
  }, [admin]);
  function editDraft(update: (previous: ContentDraft) => ContentDraft) {
    if (!admin || !editing || writeLock.current || plan.current || conflictState.current) return;
    setDraft((previous) => previous ? update(previous) : previous);
  }
  function updateCompany(key: keyof SiteData['company'], value: string) {
    editDraft((previous) => ({ ...previous, site: { ...previous.site, company: { ...previous.site.company, [key]: value } } }));
  }
  function updateServices(services: SiteData['services']) {
    editDraft((previous) => ({ ...previous, site: { ...previous.site, services } }));
  }
  function stageImage(file: File) {
    const path = `pending:${crypto.randomUUID()}`;
    const url = URL.createObjectURL(file);
    urls.current.add(url);
    pending.current.set(path, { file, url });
    return path;
  }
  function updateSiteImage(key: SiteImageKey, file: File | null) {
    if (!admin || !editing || writeLock.current || plan.current) return;
    let path = '';
    if (file) {
      try { validateImageFiles([file]); } catch (failure) {
        setError(failure instanceof Error ? failure.message : 'Ảnh không hợp lệ.'); return;
      }
      path = stageImage(file);
    }
    editDraft((previous) => ({ ...previous, site: { ...previous.site, media: {
      logo: '', hero: '', about: '', ...previous.site.media, [key]: path,
      ...(key === 'logo' && file ? { logoLayout: 'contain' as const } : {}),
    } } }));
    setError('');
    setMessage(file ? 'Ảnh đã được đổi trong bản nháp. Nhấn Save để lưu lên website.' : 'Ảnh được bỏ khỏi bản nháp. Nhấn Save để xác nhận.');
  }
  function updateLogoLayout(layout: 'board' | 'contain') {
    editDraft((previous) => previous.site.media ? { ...previous, site: { ...previous.site,
      media: { ...previous.site.media, logoLayout: layout },
    } } : previous);
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
    editDraft((previous) => ({ ...previous, posts: moveToTrash(previous.posts, snapshotRef.current!.posts.data, id) }));
    window.location.hash = '/projects';
  }
  function restorePost(id: string) {
    if (!draftRef.current) return;
    try {
      const posts = restoreProject(draftRef.current.posts, id);
      editDraft((previous) => ({ ...previous, posts }));
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Không khôi phục được bài.'); }
  }
  function purgePost(id: string) {
    editDraft((previous) => ({ ...previous, posts: purgeProject(previous.posts, id) }));
  }
  function addImages(project: Project, files: FileList | File[] | null) {
    if (!admin || !editing || writeLock.current || plan.current || !files?.length) return;
    const selected = Array.from(files);
    try { validateImageFiles(selected); } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Ảnh không hợp lệ.'); return;
    }
    const images: ProjectImage[] = selected.map((file) => ({ path: stageImage(file), alt: project.title }));
    updateProject(project.id, { images: [...project.images, ...images] });
    setError('');
    setMessage('Ảnh đã được thêm vào bản nháp. Nhấn Save để tải lên và lưu.');
  }
  function replaceProjectImage(project: Project, index: number, file: File) {
    if (!admin || !editing || writeLock.current || plan.current || !project.images[index]) return;
    try { validateImageFiles([file]); } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Ảnh không hợp lệ.'); return;
    }
    const path = stageImage(file);
    updateProject(project.id, { images: project.images.map((image, i) => i === index ? { ...image, path } : image) });
    setError(''); setMessage('Ảnh đã được thay trong bản nháp. Nhấn Save để lưu.');
  }
  function imageSrc(path: string) {
    return pending.current.get(path)?.url || previews.current.get(path) || projectImageUrl(path);
  }

  async function enterEdit() {
    if (!admin || writeLock.current) return;
    refreshRevision.current += 1; writeLock.current = true; setBusy(true);
    try {
      const records = await listBackups(admin.login);
      if (records.length) { setRecovery(records); return; }
      const id = crypto.randomUUID(), unlock = await claimBackup(id);
      if (!unlock) throw new Error('Không khóa được bản nháp. Hãy thử lại.');
      backupId.current = id; release.current = unlock;
      const token = getAdminToken(), next = await readEditorSnapshot(token);
      if (getAdminToken() !== token) throw new Error('Phiên quản trị đã thay đổi.');
      plan.current = undefined; setUncertain(false); apply(next);
      editingRef.current = true; setEditing(true); setError(''); setMessage('Chế độ chỉnh sửa đã bật. Nhấn Save để công bố thay đổi.');
    } catch (failure) { finishLease(); setError(failure instanceof Error ? failure.message : 'Không thể bật chỉnh sửa.'); }
    finally { writeLock.current = false; setBusy(false); setLoading(false); }
  }
  async function recover(record: DraftBackup) {
    if (!admin || writeLock.current || editing) return;
    writeLock.current = true; refreshRevision.current += 1; setBusy(true);
    try {
      const unlock = await claimBackup(record.id);
      if (!unlock) throw new Error('Bản nháp đang mở ở tab khác.');
      release.current = unlock; backupId.current = record.id;
      const saved = await loadBackup(record.id);
      if (!saved || saved.scope !== draftScope || saved.login !== admin.login) throw new Error('Không còn bản nháp này.');
      const token = getAdminToken();
      if (saved.plan && await isPlanPublished(saved.plan, token)) {
        apply(await publishPlan(saved.plan, token)); await clearStored(); finishLease();
        setRecovery((items) => items.filter((item) => item.id !== record.id));
        setMessage('Lần lưu trước đã thành công trên GitHub. Nội dung đã được xác minh.'); return;
      }
      clearPending();
      pending.current = await backupImages(saved);
      pending.current.forEach((image) => urls.current.add(image.url));
      plan.current = saved.plan; setUncertain(!!saved.plan);
      apply(saved.snapshot, saved.draft);
      editingRef.current = true; setEditing(true);
      setRecovery((items) => items.filter((item) => item.id !== record.id));
      setError(''); setMessage(saved.plan ? 'Đã khôi phục lần lưu cần xác minh. Nhấn Kiểm tra lần lưu.' : 'Đã khôi phục bản nháp và ảnh đã chọn.');
      window.location.hash = '/projects';
    } catch (failure) { finishLease(); setError(failure instanceof Error ? failure.message : 'Không thể khôi phục.'); }
    finally { writeLock.current = false; setBusy(false); }
  }
  async function dismissRecovery(record: DraftBackup) {
    if (!admin || writeLock.current) return;
    writeLock.current = true; setBusy(true);
    let unlock: (() => void) | null = null;
    try {
      unlock = await claimBackup(record.id);
      if (!unlock) throw new Error('Bản nháp đang mở ở tab khác.');
      const current = await loadBackup(record.id);
      if (current?.plan) {
        if (!(await isPlanPublished(current.plan, getAdminToken()))) throw new UncertainSaveError();
        apply(await publishPlan(current.plan, getAdminToken()));
      }
      await removeBackup(record.id);
      setRecovery((items) => items.filter((item) => item.id !== record.id));
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Không bỏ được bản nháp.'); }
    finally { unlock?.(); writeLock.current = false; setBusy(false); }
  }
  async function discard(): Promise<boolean> {
    if (writeLock.current || !snapshotRef.current) return false;
    writeLock.current = true; setBusy(true);
    try {
      let confirmed = conflictState.current?.remote || snapshotRef.current;
      if (plan.current) {
        if (!(await isPlanPublished(plan.current, getAdminToken()))) throw new UncertainSaveError();
        confirmed = await publishPlan(plan.current, getAdminToken());
      }
      await clearStored(); apply(confirmed); clearPending();
      plan.current = undefined; setUncertain(false); setConflicts([]); conflictState.current = null;
      editingRef.current = false; setEditing(false); finishLease(); setError(''); setStorageError('');
      const path = window.location.hash.slice(1).replace(/\/$/, '');
      if (path.startsWith('/projects/') && !confirmed.posts.data.posts.some((post) => path === `/projects/${post.slug}`)) window.location.hash = '/projects';
      setMessage('Đã bỏ phần chưa lưu. Nội dung đã công bố trên GitHub được giữ nguyên.');
      return true;
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Chưa bỏ được bản nháp.'); return false; }
    finally { writeLock.current = false; setBusy(false); }
  }
  async function rebase(remote: ContentSnapshot) {
    const base = snapshotRef.current!, local = draftRef.current!;
    const result = mergeContent(base, local, remote);
    if (result.conflicts.length) {
      conflictState.current = { base, local, remote, choices: {} };
      setConflicts(result.conflicts); setError('Có nội dung được sửa ở phiên khác. Chọn phần muốn giữ trước khi Save.');
    } else {
      apply(remote, result.draft); setError(''); setMessage('Đã ghép các thay đổi không trùng nhau. Kiểm tra bản nháp rồi nhấn Save.');
    }
    await checkpoint();
  }
  function resolveConflict(path: string, choice: 'local' | 'remote') {
    const current = conflictState.current;
    if (!current || writeLock.current) return;
    current.choices[path] = choice;
    const result = mergeContent(current.base, current.local, current.remote, current.choices);
    setConflicts(result.conflicts);
    if (!result.conflicts.length) {
      apply(current.remote, result.draft); conflictState.current = null;
      setError(''); setMessage('Đã đối chiếu xung đột. Kiểm tra lại rồi nhấn Save.');
    }
  }
  async function save() {
    if (!admin || !snapshotRef.current || !draftRef.current || writeLock.current || conflicts.length) return;
    writeLock.current = true; setBusy(true); setError(''); setMessage('Đang lưu nội dung…');
    try {
      await checkpoint();
      const result = await persistDraft({ snapshot: snapshotRef.current, draft: draftRef.current, pending: pending.current,
        token: getAdminToken(), plan: plan.current, checkpoint,
        planned: async (next) => { plan.current = next; await checkpoint(); },
      });
      for (const image of pending.current.values()) if (image.target) previews.current.set(image.target, image.url);
      pending.current.clear(); apply(result.snapshot, result.draft);
      plan.current = undefined; setUncertain(false); setConflicts([]); conflictState.current = null;
      try { await clearStored(); setMessage('Đã lưu toàn bộ thay đổi lên website.'); }
      catch { setMessage('Đã lưu lên GitHub. Bản phục hồi trên máy sẽ được kiểm tra lại ở lần đăng nhập sau.'); }
    } catch (failure) {
      setMessage('');
      if (failure instanceof RejectedSaveError) { plan.current = undefined; setUncertain(false); }
      try {
        if (failure instanceof GitHubError && failure.status === 409 && !plan.current) {
          await rebase(await readEditorSnapshot(getAdminToken()));
        } else {
          setUncertain(!!plan.current);
          setError(`${failure instanceof Error ? failure.message : 'Không thể lưu.'} Bản nháp và ảnh được giữ trên máy.`);
          await checkpoint();
        }
      } catch (nextFailure) { setError(nextFailure instanceof Error ? nextFailure.message : 'Chưa đối chiếu được dữ liệu.'); }
    } finally { writeLock.current = false; setBusy(false); }
  }
  async function stash() {
    try { await checkpoint(); return true; }
    catch (failure) { setStorageError(failure instanceof Error ? failure.message : 'Chưa giữ được bản nháp.'); return false; }
  }
  const data = editing ? draft : published;
  return { data, admin, editing, busy, loading, dirty, error, message, storageError, recovery, conflicts, uncertain,
    updateCompany, updateServices, updateSiteImage, updateLogoLayout, updateProject, addProject, removeProject, restorePost, purgePost,
    addImages, replaceProjectImage, imageSrc, refresh, enterEdit, recover, dismissRecovery, resolveConflict,
    discard, save, stash, clearMessage: () => setMessage('') };
}
export type ContentEditor = ReturnType<typeof useContentEditor>;
