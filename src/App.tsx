import { useEffect, useRef, useState } from 'react';
import { logoutAdmin } from './auth.ts';
import { useContentEditor } from './useContentEditor.ts';
import Header from './components/Header.tsx';
import Footer from './components/Footer.tsx';
import { Icon } from './components/Website.tsx';
import Home from './pages/Home.tsx';
import About from './pages/About.tsx';
import Services from './pages/Services.tsx';
import Projects from './pages/Projects.tsx';
import ProjectDetail from './pages/ProjectDetail.tsx';
import Contact from './pages/Contact.tsx';
import AdminLogin from './pages/AdminLogin.tsx';
import './site.css';

function currentPath() { return window.location.hash.slice(1).replace(/\/$/, '') || '/'; }
interface Confirmation { title: string; text: string; confirm: string; action: () => void | Promise<void> }

export default function App() {
  const editor = useContentEditor();
  const [path, setPath] = useState(currentPath);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const { data, editing, busy, dirty, admin } = editor;
  useEffect(() => {
    const navigate = () => { setPath(currentPath()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', navigate);
    return () => window.removeEventListener('hashchange', navigate);
  }, []);
  useEffect(() => { if (confirmation) dialog.current?.showModal(); else dialog.current?.close(); }, [confirmation]);
  useEffect(() => {
    if (data) document.title = `${data.site.company.name} — Điện nước & thi công`;
  }, [data?.site.company.name]);

  function discard() {
    if (dirty) setConfirmation({ title: 'Bỏ các thay đổi chưa lưu?', text: 'Bản nháp hiện tại sẽ được bỏ. Các nội dung đã Save vẫn được giữ nguyên.', confirm: 'Bỏ thay đổi', action: editor.discard });
    else void editor.discard();
  }
  async function signOut() { if (editing) await editor.discard(); logoutAdmin(); }
  function requestLogout() {
    if (dirty) setConfirmation({ title: 'Đăng xuất khi chưa lưu?', text: 'Các thay đổi chưa Save sẽ bị bỏ khi bạn đăng xuất.', confirm: 'Bỏ thay đổi và đăng xuất', action: signOut });
    else void signOut();
  }
  const activeProject = data?.posts.posts.find((project) => path === `/projects/${project.slug}`);
  let page;
  if (path === '/admin') page = <div className="site-container site-section"><AdminLogin /></div>;
  else if (!data) page = <section className="site-container site-section"><h1>Thiên Thời Lâm Đồng</h1><p role="status">{editor.loading ? 'Đang tải nội dung…' : 'Chưa tải được nội dung. Vui lòng thử lại.'}</p></section>;
  else switch (path) {
    case '/': page = <Home editor={editor} />; break;
    case '/about': page = <About editor={editor} />; break;
    case '/services': page = <Services editor={editor} />; break;
    case '/projects': page = <Projects editor={editor} />; break;
    case '/contact': page = <Contact editor={editor} />; break;
    default: page = path.startsWith('/projects/') ? <ProjectDetail project={activeProject} editor={editor} onDelete={() => {
      if (activeProject) setConfirmation({ title: 'Xóa dự án này?', text: 'Dự án được bỏ khỏi bản nháp và chỉ xóa khỏi website khi Save. Ảnh gốc không bị xóa.', confirm: 'Xóa khỏi bản nháp', action: () => editor.removeProject(activeProject.id) });
    }} /> : <section className="site-container site-section"><h1>Không tìm thấy trang</h1><a href="#/" className="site-text-link">Về trang chủ</a></section>;
  }
  return <div className={`site ${admin ? 'site-admin' : ''} ${editing ? 'site-editing' : ''}`}>
    <a className="site-skip" href="#main-content" onClick={(event) => { event.preventDefault(); document.getElementById('main-content')?.focus(); }}>Đến nội dung chính</a>
    {data && <Header site={data.site} path={path} />}
    {editor.error && <div className="site-container site-error" role="alert">{editor.error}{!editing && <button disabled={editor.loading} onClick={() => { void editor.refresh(true); }}>Thử tải lại</button>}</div>}
    <main id="main-content" tabIndex={-1}><fieldset className="site-content" disabled={busy} aria-busy={busy}>{page}</fieldset></main>
    {data && <Footer site={data.site} />}
    {admin && <div className="site-editor" role="region" aria-label="Công cụ chỉnh sửa"><div className="site-editor-info"><span className="site-editor-dot" /><div><strong>{busy ? 'Đang xử lý…' : editing ? 'Đang chỉnh sửa' : `Quản trị: ${admin.login}`}<span>{editing && dirty ? ' · Chưa lưu' : ''}</span></strong><small>{editing ? 'Nhấn Save để lưu nội dung lên website' : 'Chỉnh sửa trực tiếp nội dung trên trang'}</small></div></div>
      <div className="site-editor-actions">{editing ? <><button disabled={busy} onClick={discard} className="site-editor-cancel">Cancel</button><button disabled={busy || !dirty} onClick={() => { void editor.save(); }} className="site-button site-button-orange"><Icon name="check" size={17} /> {busy ? 'Đang lưu…' : 'Save'}</button><button disabled={busy} aria-label="Exit Edit Mode" title="Exit Edit Mode" onClick={discard} className="site-editor-exit"><Icon name="close" /></button></>
        : <><button disabled={busy} onClick={() => { void editor.enterEdit(); }} className="site-button site-button-dark"><Icon name="edit" size={17} /> Edit</button><button disabled={busy} onClick={requestLogout} className="site-editor-cancel">Đăng xuất</button></>}
        {editor.orphanCount > 0 && <button disabled={busy} onClick={() => { void editor.cleanOrphans(); }} className="site-editor-cancel">Dọn ảnh chưa dùng ({editor.orphanCount})</button>}
      </div></div>}
    {editor.message && <div className="site-toast is-visible" role="status"><span>{editor.message}</span><button onClick={editor.clearMessage} aria-label="Đóng thông báo"><Icon name="close" size={16} /></button></div>}
    <dialog className="site-dialog" ref={dialog} onCancel={() => setConfirmation(null)}><h2>{confirmation?.title}</h2><p>{confirmation?.text}</p><div><button className="site-button site-button-outline" onClick={() => setConfirmation(null)}>Quay lại</button><button className="site-button site-button-dark" onClick={() => { const action = confirmation?.action; setConfirmation(null); void action?.(); }}>{confirmation?.confirm}</button></div></dialog>
  </div>;
}
