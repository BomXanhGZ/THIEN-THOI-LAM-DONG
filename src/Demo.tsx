import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createDemoContent, demoAsset } from './demo-data.ts';
import type { DemoContent, DemoProject } from './demo-data.ts';
import './demo.css';

const navigation = [['/', 'Trang chủ'], ['/about', 'Giới thiệu'], ['/services', 'Dịch vụ'], ['/projects', 'Dự án'], ['/contact', 'Liên hệ']];
const paths: Record<string, string> = {
  arrow: 'M4 12h16m-6-6 6 6-6 6', close: 'm6 6 12 12M6 18 18 6', menu: 'M4 6h16M4 12h16M4 18h16',
  bolt: 'm13 2-9 12h7l-1 8 10-13h-7l1-7Z', water: 'M12 3s-7 8-7 12a7 7 0 0 0 14 0c0-4-7-12-7-12Z',
  building: 'M4 21V4h11v17M15 10h5v11M2 21h20M8 8h3M8 12h3M8 16h3',
  edit: 'm16 3 5 5-12 12-6 1 1-6L16 3Zm-2 2 5 5', plus: 'M12 4v16M4 12h16',
  upload: 'M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5', check: 'm5 12 4 4L19 6',
};

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.arrow} /></svg>;
}

function Field({ value, onChange, editing, label, multiline = false, className = '' }: {
  value: string; onChange: (value: string) => void; editing: boolean; label: string; multiline?: boolean; className?: string;
}) {
  if (!editing) return <span className={className}>{value}</span>;
  return <label className={`demo-field ${className}`}><span className="demo-field-caption">{label}</span>
    {multiline ? <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} />
      : <input value={value} onChange={(e) => onChange(e.target.value)} />}
  </label>;
}

function ProjectCard({ project, index }: { project: DemoProject; index: number }) {
  return <a className="demo-project" href={`#/projects/${project.id}`}>
    <div className="demo-project-image"><img src={project.images[0] || demoAsset('hero')} alt={`${project.title} — ảnh minh họa`} loading="lazy" width="1000" height="700" /><span className="demo-image-label">Ảnh minh họa</span><span className="demo-project-arrow"><Icon name="arrow" /></span></div>
    <div className="demo-project-meta"><span>{project.category}</span><span>{String(index + 1).padStart(2, '0')}</span></div>
    <h3>{project.title}</h3><p>{project.summary}</p>
  </a>;
}

function SectionTitle({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return <div className="demo-section-title"><div><p className="demo-eyebrow">{eyebrow}</p><h2>{title}</h2></div>{children}</div>;
}

export default function Demo() {
  const [saved, setSaved] = useState(createDemoContent);
  const [draft, setDraft] = useState(createDemoContent);
  const [editing, setEditing] = useState(false);
  const [route, setRoute] = useState(() => window.location.hash.slice(1) || '/');
  const [menu, setMenu] = useState(false);
  const [filter, setFilter] = useState('Tất cả');
  const [message, setMessage] = useState('');
  const [dialog, setDialog] = useState<'exit' | 'delete' | null>(null);
  const [contact, setContact] = useState({ phone: '', email: '', address: '' });
  const [savedContact, setSavedContact] = useState(contact);
  const uploadUrls = useRef<string[]>([]);
  const uploadInput = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const data = editing ? draft : saved;
  const activeProject = data.projects.find((p) => route === `/projects/${p.id}`);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved) || JSON.stringify(contact) !== JSON.stringify(savedContact);

  useEffect(() => {
    const navigate = () => { setRoute(window.location.hash.slice(1) || '/'); setMenu(false); setMessage(''); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', navigate);
    return () => window.removeEventListener('hashchange', navigate);
  }, []);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (editing && dirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [editing, dirty]);
  useEffect(() => () => uploadUrls.current.forEach((url) => URL.revokeObjectURL(url)), []);
  useEffect(() => {
    if (dialog) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [dialog]);
  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'THIEN-THOI-LAM-DONG — Bản thiết kế demo';
    return () => { document.title = previousTitle; };
  }, []);

  function change<K extends keyof DemoContent>(key: K, value: DemoContent[K]) {
    setDraft((previous) => ({ ...previous, [key]: value }));
  }
  function updateProject(key: keyof DemoProject, value: string | string[]) {
    if (!activeProject) return;
    setDraft((previous) => ({ ...previous, projects: previous.projects.map((p) => p.id === activeProject.id ? { ...p, [key]: value } : p) }));
  }
  function enterEdit() { setDraft(structuredClone(saved)); setEditing(true); setMessage('Nhấn vào các ô có viền để sửa. Đây là bản xem thử, không ghi lên GitHub.'); }
  function cancelEdit() { setDraft(structuredClone(saved)); setContact(savedContact); setEditing(false); setDialog(null); setMessage('Đã hủy các thay đổi chưa lưu.'); }
  function saveEdit() {
    if (!draft.headline.trim() || draft.projects.some((p) => !p.title.trim()) || draft.services.some((s) => !s.title.trim())) {
      setMessage('Vui lòng điền tiêu đề còn trống trước khi Save.'); return;
    }
    setSaved(structuredClone(draft)); setSavedContact({ ...contact });
    setMessage('Đã lưu bản xem thử trong tab này. Tải lại trang sẽ khôi phục dữ liệu demo ban đầu.');
  }
  function addProject() {
    const id = `bai-mau-${crypto.randomUUID().slice(0, 8)}`;
    setDraft((previous) => ({ ...previous, projects: [...previous.projects, { id, title: 'Dự án mới — bản nháp', category: 'Thi công công trình', summary: 'Nhập mô tả ngắn cho dự án tại đây.', content: 'Nhập nội dung giới thiệu công trình.', images: [] }] }));
    window.location.hash = `/projects/${id}`;
  }
  function upload(files: FileList | null) {
    if (!files?.length || !activeProject) return;
    const selected = Array.from(files);
    if (selected.some((file) => !['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type) || file.size > 8 * 1024 * 1024 || !file.size)) {
      setMessage('Chọn ảnh JPEG, PNG, WebP hoặc AVIF, tối đa 8 MB mỗi ảnh.'); return;
    }
    const urls = selected.map((file) => URL.createObjectURL(file));
    uploadUrls.current.push(...urls);
    updateProject('images', [...activeProject.images, ...urls]);
    setMessage(`Đã thêm ${urls.length} ảnh xem trước. Ảnh demo chỉ nằm trong bộ nhớ tab.`);
    if (uploadInput.current) uploadInput.current.value = '';
  }

  const services = <div className="demo-services-grid">{data.services.map((service, index) => <article className="demo-service" key={service.id}>
    <div className="demo-service-top"><Icon name={['bolt', 'water', 'building'][index % 3]} size={30} /><span>0{index + 1}</span></div>
    <h3><Field value={service.title} onChange={(title) => change('services', draft.services.map((s) => s.id === service.id ? { ...s, title } : s))} editing={editing} label="Tên dịch vụ" /></h3>
    <Field value={service.description} onChange={(description) => change('services', draft.services.map((s) => s.id === service.id ? { ...s, description } : s))} editing={editing} label="Mô tả dịch vụ" multiline />
    <a href="#/contact" className="demo-text-link">Trao đổi về hạng mục <Icon name="arrow" size={17} /></a>
  </article>)}</div>;

  const about = <div className="demo-about-layout"><div className="demo-about-image"><img src={demoAsset('construction')} alt="Công trường xây dựng — ảnh minh họa" loading="lazy" width="1100" height="800" /><span className="demo-image-label">Ảnh minh họa</span><div className="demo-image-stamp"><Icon name="building" size={32} /><span>ĐIỆN NƯỚC<br />& THI CÔNG</span></div></div>
    <div className="demo-about-copy"><p className="demo-eyebrow">VỀ THIEN-THOI-LAM-DONG</p><h2>Nền tảng cho<br />mỗi công trình.</h2><Field value={data.about} onChange={(value) => change('about', value)} editing={editing} label="Giới thiệu công ty" multiline />
      <div className="demo-about-note"><span className="demo-note-line" /><p>Thông tin năng lực, kinh nghiệm và hồ sơ công ty sẽ được bổ sung bằng dữ liệu thực tế.</p></div><a href="#/contact" className="demo-text-link">Kết nối với THIEN-THOI-LAM-DONG <Icon name="arrow" /></a>
    </div></div>;

  let page: ReactNode;
  if (route === '/') page = <>
    <section className="demo-hero"><img className="demo-hero-image" src={demoAsset('hero')} alt="Hệ thống đường ống kỹ thuật — ảnh minh họa" fetchPriority="high" width="1536" height="1024" /><div className="demo-hero-shade" />
      <div className="demo-container demo-hero-content"><p className="demo-eyebrow"><span /> THIEN-THOI-LAM-DONG / ĐIỆN NƯỚC & XÂY DỰNG</p><h1><Field value={data.headline} onChange={(value) => change('headline', value)} editing={editing} label="Tiêu đề trang chủ" multiline /></h1><div className="demo-hero-description"><Field value={data.intro} onChange={(value) => change('intro', value)} editing={editing} label="Mô tả trang chủ" multiline /></div>
        <div className="demo-hero-actions"><a href="#/projects" className="demo-button demo-button-orange">Khám phá công trình <Icon name="arrow" /></a><a href="#/contact" className="demo-hero-secondary">Liên hệ với chúng tôi <span>↗</span></a></div>
      </div><span className="demo-hero-caption">HÌNH ẢNH MINH HỌA / BẢN THIẾT KẾ DEMO</span><div className="demo-hero-index"><span>01</span><i /> <span>THIEN-THOI-LAM-DONG</span></div>
    </section>
    <div className="demo-discipline"><div className="demo-container">{['Điện công trình', 'Cấp thoát nước', 'Thi công công trình'].map((label, i) => <span key={label}><Icon name={['bolt', 'water', 'building'][i]} />{label}<small>0{i + 1}</small></span>)}</div></div>
    <section className="demo-container demo-section"><SectionTitle eyebrow="LĨNH VỰC HOẠT ĐỘNG" title="Các hạng mục thi công"><a href="#/services" className="demo-text-link">Tất cả dịch vụ <Icon name="arrow" /></a></SectionTitle>{services}</section>
    <section className="demo-about-section"><div className="demo-container demo-section">{about}</div></section>
    <section className="demo-container demo-section"><SectionTitle eyebrow="KHÔNG GIAN TRƯNG BÀY DỰ ÁN" title="Dấu ấn công trình"><a href="#/projects" className="demo-text-link">Xem tất cả dự án <Icon name="arrow" /></a></SectionTitle><div className="demo-project-grid">{data.projects.slice(0, 3).map((p, i) => <ProjectCard key={p.id} project={p} index={i} />)}</div></section>
  </>;
  else if (route === '/about') page = <><PageHeading eyebrow="GIỚI THIỆU" title="Cùng tìm hiểu THIEN-THOI-LAM-DONG." description="Thông tin công ty và định hướng trình bày năng lực thi công." /><section className="demo-container demo-section">{about}</section></>;
  else if (route === '/services') page = <><PageHeading eyebrow="LĨNH VỰC HOẠT ĐỘNG" title="Giải pháp cho công trình." description="Các nhóm dịch vụ minh họa, có thể điều chỉnh sau khi chốt phạm vi thực tế." /><section className="demo-container demo-section">{services}</section></>;
  else if (route === '/projects') page = <><PageHeading eyebrow="DỰ ÁN & CÔNG TRÌNH" title="Từ bản vẽ đến công trình." description="Bốn bài đăng mẫu giúp bạn xem trước cách giới thiệu công trình. Tất cả nội dung và hình ảnh đều là minh họa." />
    <section className="demo-container demo-section demo-projects-section"><div className="demo-filter-row"><div className="demo-filters">{['Tất cả', 'Hệ thống điện', 'Hệ thống nước', 'Thi công công trình'].map((item) => <button key={item} className={filter === item ? 'is-active' : ''} onClick={() => setFilter(item)} aria-pressed={filter === item}>{item}</button>)}</div>{editing ? <button className="demo-button demo-button-dark" onClick={addProject}><Icon name="plus" /> Thêm dự án</button> : <span className="demo-result-count">{data.projects.length} bài mẫu</span>}</div>
      <div className="demo-project-grid demo-project-grid-two">{data.projects.filter((p) => filter === 'Tất cả' || p.category === filter).map((p, i) => <ProjectCard key={p.id} project={p} index={i} />)}</div>{!data.projects.filter((p) => filter === 'Tất cả' || p.category === filter).length && <p className="demo-empty">Chưa có dự án trong nhóm này.</p>}
    </section></>;
  else if (activeProject) page = <>
    <section className="demo-container demo-project-detail"><a className="demo-text-link" href="#/projects">← Tất cả dự án</a><div className="demo-detail-heading"><div><p className="demo-eyebrow">BÀI ĐĂNG MINH HỌA</p><h1><Field value={activeProject.title} onChange={(value) => updateProject('title', value)} editing={editing} label="Tên dự án" /></h1></div>{editing && <button className="demo-button demo-button-danger" onClick={() => setDialog('delete')}>Xóa dự án</button>}</div>
      <div className="demo-detail-category">{editing ? <label className="demo-field"><span className="demo-field-caption">Nhóm dự án</span><select value={activeProject.category} onChange={(e) => updateProject('category', e.target.value)}>{['Hệ thống điện', 'Hệ thống nước', 'Thi công công trình'].map((c) => <option key={c}>{c}</option>)}</select></label> : <span>{activeProject.category}</span>}<span>Ảnh và nội dung demo</span></div>
      <div className="demo-detail-summary"><Field value={activeProject.summary} onChange={(value) => updateProject('summary', value)} editing={editing} label="Mô tả ngắn" multiline /></div>
      {activeProject.images[0] && <img className="demo-detail-cover" src={activeProject.images[0]} alt={`${activeProject.title} — ảnh minh họa`} width="1400" height="900" />}
      <div className="demo-detail-content"><h2>Giới thiệu công trình</h2><Field value={activeProject.content} onChange={(value) => updateProject('content', value)} editing={editing} label="Nội dung bài viết" multiline /></div>
      <div className="demo-section-title"><h2>Hình ảnh công trình</h2>{editing && <><input className="sr-only" ref={uploadInput} type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple onChange={(e) => upload(e.target.files)} /><button className="demo-button demo-button-dark" onClick={() => uploadInput.current?.click()}><Icon name="upload" /> Thêm ảnh</button></>}</div>
      <div className="demo-gallery">{activeProject.images.map((image, index) => <figure key={`${image}-${index}`}><img src={image} alt={`Ảnh minh họa ${index + 1}`} loading="lazy" width="1000" height="700" />{editing && <figcaption><span>{index === 0 ? 'Ảnh đại diện' : `Ảnh ${index + 1}`}</span><div>{index > 0 && <button onClick={() => updateProject('images', [image, ...activeProject.images.filter((_, i) => i !== index)])}>Đặt đại diện</button>}<button onClick={() => updateProject('images', activeProject.images.filter((_, i) => i !== index))}>Bỏ ảnh</button></div></figcaption>}</figure>)}</div>
    </section></>;
  else if (route === '/contact') page = <><PageHeading eyebrow="KẾT NỐI VỚI THIEN-THOI-LAM-DONG" title="Bắt đầu từ một cuộc trao đổi." description="Thông tin liên hệ chính thức sẽ được bạn bổ sung. Bản demo không sử dụng số điện thoại hay địa chỉ giả." /><section className="demo-container demo-section"><div className="demo-contact-layout"><div><p className="demo-eyebrow">THÔNG TIN LIÊN HỆ</p><h2>Chúng tôi sẵn sàng<br />lắng nghe.</h2><p className="demo-muted">Bạn có thể thử điền thông tin liên hệ bằng nút Edit. Dữ liệu chỉ được lưu trong bản xem thử của tab hiện tại.</p></div><dl className="demo-contact-details">{[['phone', 'Điện thoại'], ['email', 'Email'], ['address', 'Địa chỉ']].map(([key, label]) => <div key={key}><dt>{label}</dt><dd><Field value={contact[key as keyof typeof contact] || (editing ? '' : 'Chưa bổ sung')} onChange={(value) => setContact((previous) => ({ ...previous, [key]: value }))} editing={editing} label={label} /></dd></div>)}</dl></div></section></>;
  else page = <section className="demo-container demo-section"><h1>Không tìm thấy trang</h1><a href="#/" className="demo-text-link">Về trang chủ <Icon name="arrow" /></a></section>;

  return <div className={`demo ${editing ? 'demo-editing' : ''}`}>
    <a className="demo-skip" href="#demo-main" onClick={(e) => { e.preventDefault(); document.getElementById('demo-main')?.focus(); }}>Đến nội dung chính</a>
    <div className="demo-notice"><div className="demo-container"><span><b>BẢN DEMO</b><span>Nội dung & hình ảnh minh họa, không phải hồ sơ công trình thực tế.</span></span><a href={`${window.location.pathname}#/`}>Về website <Icon name="arrow" size={14} /></a></div></div>
    <header className="demo-header"><div className="demo-container"><a className="demo-brand" href="#/" aria-label="THIEN-THOI-LAM-DONG — Trang chủ"><span className="demo-brand-mark">T<span>.</span></span><span>THIEN-THOI-LAM-DONG<small>ĐIỆN NƯỚC & THI CÔNG</small></span></a>
      <nav className={menu ? 'is-open' : ''} aria-label="Điều hướng chính">{navigation.map(([href, label]) => <a href={`#${href}`} key={href} className={route === href || (href === '/projects' && !!activeProject) ? 'is-active' : ''} aria-current={route === href ? 'page' : undefined}>{label}</a>)}</nav>
      <a className="demo-header-cta" href="#/contact">Trao đổi công trình <Icon name="arrow" size={16} /></a><button className="demo-menu-button" onClick={() => setMenu(!menu)} aria-label={menu ? 'Đóng menu' : 'Mở menu'} aria-expanded={menu}><Icon name={menu ? 'close' : 'menu'} /></button>
    </div></header>
    <main id="demo-main" tabIndex={-1}>{page}</main>
    <section className="demo-cta"><div className="demo-container"><div><p className="demo-eyebrow">KẾT NỐI VÀ TRAO ĐỔI</p><h2>Bạn đang có một công trình?</h2></div><a href="#/contact" className="demo-button demo-button-orange">Liên hệ THIEN-THOI-LAM-DONG <Icon name="arrow" /></a></div></section>
    <footer className="demo-footer"><div className="demo-container"><div className="demo-footer-main"><div><a className="demo-brand" href="#/"><span className="demo-brand-mark">T<span>.</span></span><span>THIEN-THOI-LAM-DONG<small>ĐIỆN NƯỚC & THI CÔNG</small></span></a><p>Điện nước và thi công công trình.<br />Bản thiết kế để cùng bạn hoàn thiện.</p></div><div><h3>Khám phá</h3>{navigation.slice(1, 4).map(([href, label]) => <a href={`#${href}`} key={href}>{label}</a>)}</div><div><h3>Thông tin liên hệ</h3><p>{contact.phone || 'Điện thoại: Chưa bổ sung'}<br />{contact.email || 'Email: Chưa bổ sung'}<br />{contact.address || 'Địa chỉ: Chưa bổ sung'}</p></div></div><div className="demo-footer-bottom"><span>THIEN-THOI-LAM-DONG · Bản thiết kế demo</span><span>Ảnh demo do chủ dự án cung cấp</span></div></div></footer>
    <div className="demo-editor" role="region" aria-label="Công cụ chỉnh sửa demo"><div className="demo-editor-info"><span className="demo-editor-dot" /><div><strong>{editing ? 'Đang chỉnh sửa bản demo' : 'Xem thử cách quản lý nội dung'} <span>{editing && dirty ? '· Chưa lưu' : ''}</span></strong><small>{editing ? 'Lưu trong tab này · Không ghi vào GitHub' : 'Sửa trực tiếp trên trang, không có dashboard riêng'}</small></div></div><div className="demo-editor-actions">{editing ? <><button onClick={cancelEdit} className="demo-editor-cancel">Cancel</button><button onClick={saveEdit} className="demo-button demo-button-orange"><Icon name="check" size={17} /> Save</button><button aria-label="Exit Edit Mode" title="Exit Edit Mode" onClick={() => dirty ? setDialog('exit') : cancelEdit()} className="demo-editor-exit"><Icon name="close" /></button></> : <button onClick={enterEdit} className="demo-button demo-button-dark"><Icon name="edit" size={17} /> Edit demo</button>}</div></div>
    <div className={`demo-toast ${message ? 'is-visible' : ''}`} role="status" aria-live="polite">{message && <><span>{message}</span><button onClick={() => setMessage('')} aria-label="Đóng thông báo"><Icon name="close" size={16} /></button></>}</div>
    <dialog className="demo-dialog" ref={dialogRef} onCancel={() => setDialog(null)}><h2>{dialog === 'delete' ? 'Xóa dự án mẫu này?' : 'Thoát khi chưa lưu?'}</h2><p>{dialog === 'delete' ? 'Dự án sẽ được bỏ khỏi bản nháp. Thao tác không thay đổi dữ liệu trên GitHub.' : 'Những thay đổi chưa Save sẽ bị bỏ. Bạn có thể quay lại để tiếp tục chỉnh sửa.'}</p><div><button className="demo-button demo-button-outline" onClick={() => setDialog(null)}>Quay lại</button><button className="demo-button demo-button-dark" onClick={() => { if (dialog === 'delete' && activeProject) { change('projects', draft.projects.filter((p) => p.id !== activeProject.id)); setDialog(null); window.location.hash = '/projects'; } else cancelEdit(); }}>{dialog === 'delete' ? 'Xóa khỏi bản nháp' : 'Bỏ thay đổi & thoát'}</button></div></dialog>
  </div>;
}

function PageHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <section className="demo-page-heading"><div className="demo-container"><p className="demo-eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div></section>;
}
