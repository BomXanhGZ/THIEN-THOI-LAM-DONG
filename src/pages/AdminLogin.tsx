import { useState } from 'react';
import type { FormEvent } from 'react';
import { loginAdmin, useAdminSession } from '../auth.ts';

export default function AdminLogin() {
  const admin = useAdminSession();
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const candidate = input;
    setInput('');
    setBusy(true);
    setError('');
    try {
      await loginAdmin(candidate);
      window.location.hash = '/';
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Không thể đăng nhập.');
    } finally {
      setBusy(false);
    }
  }

  if (admin) return <section><h1 className="text-2xl font-semibold">Đã đăng nhập: {admin.login}</h1><a href="#/" className="mt-5 inline-block underline">Về trang chủ</a></section>;
  return (
    <section className="mx-auto max-w-lg rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
      <h1 className="text-2xl font-bold">Đăng nhập quản trị</h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">Sử dụng GitHub Fine-grained Personal Access Token có quyền Contents: Read and write trên repository của website.</p>
      <form onSubmit={submit} className="mt-6">
        <label htmlFor="github-token" className="block text-sm font-semibold">GitHub Token</label>
        <input id="github-token" type="password" value={input} onChange={(event) => setInput(event.target.value)} required
          autoComplete="off" autoCapitalize="none" spellCheck={false} disabled={busy}
          className="mt-2 w-full rounded-md border border-slate-300 px-3 py-3" />
        <p className="mt-2 text-xs leading-5 text-slate-500">Token chỉ được giữ trong bộ nhớ của tab. Tải lại trang hoặc đăng xuất sẽ xóa phiên.</p>
        {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={busy} className="mt-5 rounded-md bg-sky-800 px-5 py-3 text-sm font-semibold text-white hover:bg-sky-900 disabled:opacity-50">
          {busy ? 'Đang kiểm tra…' : 'Đăng nhập'}
        </button>
      </form>
    </section>
  );
}
