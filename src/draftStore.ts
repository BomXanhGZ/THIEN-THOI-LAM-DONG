import { githubConfig } from './config.ts';
import type { ContentSnapshot, ContentDraft, PendingImage, SavePlan } from './editor.ts';

interface StoredImage { key: string; target?: string; sha?: string }
export interface DraftBackup {
  id: string; scope: string; login: string; savedAt: string;
  snapshot: ContentSnapshot; draft: ContentDraft; plan?: SavePlan;
  images: StoredImage[];
}
export const draftScope = `${githubConfig.owner}/${githubConfig.repo}/${githubConfig.branch}`;
let connection: Promise<IDBDatabase> | undefined;
const storedFiles = new Set<string>();
function database() {
  return connection ||= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('thien-thoi-drafts', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('drafts', { keyPath: 'id' });
      request.result.createObjectStore('files');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { connection = undefined; reject(new Error('Không mở được nơi lưu bản nháp trên máy.')); };
  });
}
function completed(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = transaction.onerror = () => reject(new Error('Không lưu được bản nháp phục hồi. Kiểm tra dung lượng hoặc quyền lưu trữ của trình duyệt.'));
  });
}
function value<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Không đọc được bản nháp phục hồi.'));
  });
}
export async function saveBackup(input: Omit<DraftBackup, 'scope' | 'savedAt' | 'images'>, pending: Map<string, PendingImage>) {
  const db = await database();
  const transaction = db.transaction(['drafts', 'files'], 'readwrite');
  const done = completed(transaction);
  const record: DraftBackup = {
    id: input.id, login: input.login, scope: draftScope, savedAt: new Date().toISOString(),
    snapshot: structuredClone(input.snapshot), draft: structuredClone(input.draft),
    plan: input.plan ? structuredClone(input.plan) : undefined,
    images: [...pending].map(([key, image]) => ({ key, target: image.target, sha: image.sha })),
  };
  const added: string[] = [];
  for (const [key, image] of pending) {
    const fileKey = `${input.id}:${key}`;
    if (!storedFiles.has(fileKey)) { transaction.objectStore('files').put(image.file, fileKey); added.push(fileKey); }
  }
  transaction.objectStore('drafts').put(record);
  await done;
  added.forEach((key) => storedFiles.add(key));
}
export async function listBackups(login: string) {
  const db = await database();
  const records = await value<DraftBackup[]>(db.transaction('drafts').objectStore('drafts').getAll());
  const locks = navigator.locks ? await navigator.locks.query() : { held: [] };
  const active = new Set((locks.held || []).map((lock) => lock.name));
  return records.filter((record) => record.scope === draftScope && record.login === login && !active.has(`thien-thoi-draft:${record.id}`))
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}
export async function backupImages(record: DraftBackup) {
  const db = await database();
  const pending = new Map<string, PendingImage>();
  try {
    for (const image of record.images) {
      const key = `${record.id}:${image.key}`;
      const file = await value<File | undefined>(db.transaction('files').objectStore('files').get(key));
      if (!file) throw new Error('Bản nháp thiếu ảnh đã chọn. Chưa thực hiện lưu lên GitHub.');
      storedFiles.add(key);
      pending.set(image.key, { file, url: URL.createObjectURL(file), target: image.target, sha: image.sha });
    }
    return pending;
  } catch (failure) { pending.forEach((image) => URL.revokeObjectURL(image.url)); throw failure; }
}
export async function loadBackup(id: string) {
  const db = await database();
  return value<DraftBackup | undefined>(db.transaction('drafts').objectStore('drafts').get(id));
}
export async function removeBackup(id: string) {
  const db = await database();
  const transaction = db.transaction(['drafts', 'files'], 'readwrite');
  const done = completed(transaction);
  transaction.objectStore('drafts').delete(id);
  const cursor = transaction.objectStore('files').openCursor(IDBKeyRange.bound(`${id}:`, `${id}:\uffff`));
  cursor.onsuccess = () => { if (cursor.result) { storedFiles.delete(String(cursor.result.key)); cursor.result.delete(); cursor.result.continue(); } };
  await done;
}
export async function claimBackup(id: string): Promise<(() => void) | null> {
  if (!navigator.locks) throw new Error('Trình duyệt chưa hỗ trợ khóa bản nháp. Hãy dùng Chrome, Edge hoặc Safari mới.');
  return new Promise((resolve, reject) => {
    navigator.locks.request(`thien-thoi-draft:${id}`, { ifAvailable: true }, async (lock) => {
      if (!lock) { resolve(null); return; }
      await new Promise<void>((release) => resolve(release));
    }).catch(reject);
  });
}
