export default function Footer({ name }: { name: string }) {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-4 px-5 py-6 text-sm text-slate-600">
        <span>{name}</span>
        <a href="#/admin" className="hover:text-sky-800">Đăng nhập quản trị</a>
      </div>
    </footer>
  );
}
