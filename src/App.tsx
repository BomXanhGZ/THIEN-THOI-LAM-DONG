import { useCallback, useEffect, useState } from 'react';
import type { PostsData, SiteData } from './content.ts';
import { readPosts, readSite } from './github.ts';
import Header from './components/Header.tsx';
import Footer from './components/Footer.tsx';
import Home from './pages/Home.tsx';
import About from './pages/About.tsx';
import Services from './pages/Services.tsx';
import Projects from './pages/Projects.tsx';
import ProjectDetail from './pages/ProjectDetail.tsx';
import Contact from './pages/Contact.tsx';
import AdminLogin from './pages/AdminLogin.tsx';

function currentPath() {
  return window.location.hash.slice(1).replace(/\/$/, '') || '/';
}

export default function App() {
  const [path, setPath] = useState(currentPath);
  const [content, setContent] = useState<{ site: SiteData; posts: PostsData } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const [site, posts] = await Promise.all([readSite(force), readPosts(force)]);
      setContent({ site: site.data, posts: posts.data });
      setError('');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Không thể tải nội dung.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const navigate = () => { setPath(currentPath()); window.scrollTo(0, 0); };
    const focus = () => { void refresh(); };
    window.addEventListener('hashchange', navigate);
    window.addEventListener('focus', focus);
    return () => {
      window.removeEventListener('hashchange', navigate);
      window.removeEventListener('focus', focus);
    };
  }, [refresh]);

  useEffect(() => { void refresh(); }, [refresh, path]);

  const name = content?.site.company.name || 'KenlyThoi';
  let page;
  if (path === '/admin') page = <AdminLogin />;
  else if (!content) page = !error ? <p role="status">Đang tải nội dung…</p> : null;
  else {
    const { site, posts: { posts } } = content;
    switch (path) {
      case '/': page = <Home site={site} posts={posts} />; break;
      case '/about': page = <About site={site} />; break;
      case '/services': page = <Services site={site} />; break;
      case '/projects': page = <Projects posts={posts} />; break;
      case '/contact': page = <Contact site={site} />; break;
      default: {
        const match = /^\/projects\/([a-z0-9-]+)$/.exec(path);
        page = match ? <ProjectDetail project={posts.find((post) => post.slug === match[1])} />
          : <section><h1 className="text-2xl font-semibold">Không tìm thấy trang</h1><a href="#/" className="mt-5 inline-block underline">Về trang chủ</a></section>;
      }
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main-content" onClick={(event) => { event.preventDefault(); document.getElementById('main-content')?.focus(); }} className="sr-only focus:not-sr-only focus:p-3">Đến nội dung chính</a>
      <Header name={name} path={path} />
      <div className="border-b border-orange-100 bg-orange-50 px-5 py-3 text-center text-sm text-slate-700">
        Đang duyệt thiết kế mới cho website. <a className="font-semibold text-orange-800 underline" href={`${window.location.pathname}?demo=1#/`}>Xem bản demo và thử chỉnh sửa →</a>
      </div>
      <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 sm:py-12">
        {error && <div role="alert" className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}{content && ' Đang hiển thị nội dung đã tải trước đó.'}
          <button type="button" disabled={loading} onClick={() => { void refresh(true); }} className="ml-3 font-semibold underline disabled:opacity-50">Thử lại</button>
        </div>}
        {page}
      </main>
      <Footer name={name} />
    </div>
  );
}
