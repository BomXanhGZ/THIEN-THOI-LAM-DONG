import { useSyncExternalStore } from 'react';
import { clearContentCache, validateAdminToken } from './github.ts';

interface AdminSession {
  login: string;
}

// Never persist credentials in browser storage, cookies, URLs, or build variables.
let token: string | null = null;
let session: AdminSession | null = null;
let revision = 0;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

export async function loginAdmin(input: string) {
  const currentRevision = ++revision;
  const candidate = input.trim();
  const verified = await validateAdminToken(candidate);
  if (revision !== currentRevision) throw new Error('Phiên đăng nhập đã bị hủy.');
  token = candidate;
  session = verified;
  clearContentCache();
  notify();
}

export function logoutAdmin() {
  revision += 1;
  token = null;
  session = null;
  clearContentCache();
  notify();
}

export function getAdminToken(): string {
  if (!token) throw new Error('Cần đăng nhập trước khi chỉnh sửa.');
  return token;
}

export function useAdminSession() {
  return useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    () => session,
  );
}
