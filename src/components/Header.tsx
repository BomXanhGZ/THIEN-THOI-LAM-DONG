import { logoutAdmin, useAdminSession } from '../auth.ts';

const links = [
  ['/', 'Trang chủ'], ['/about', 'Giới thiệu'], ['/services', 'Dịch vụ'],
  ['/projects', 'Dự án'], ['/contact', 'Liên hệ'],
];

export default function Header({ name, path }: { name: string; path: string }) {
  const admin = useAdminSession();
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-5">
        <a href="#/" className="text-xl font-bold text-sky-900">{name}</a>
        <nav aria-label="Điều hướng chính" className="flex flex-wrap gap-x-5 gap-y-3 text-sm">
          {links.map(([href, label]) => (
            <a key={href} href={`#${href}`} aria-current={path === href ? 'page' : undefined}
              className={path === href ? 'font-semibold text-sky-800' : 'text-slate-600 hover:text-sky-800'}>
              {label}
            </a>
          ))}
        </nav>
      </div>
      {admin && (
        <div className="flex flex-wrap items-center justify-center gap-4 bg-sky-50 px-5 py-2 text-sm">
          <span>Đã đăng nhập: {admin.login}</span>
          <button type="button" onClick={logoutAdmin} className="underline">Đăng xuất</button>
        </div>
      )}
    </header>
  );
}
