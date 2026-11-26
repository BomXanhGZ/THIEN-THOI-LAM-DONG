import type { Project } from '../content.ts';
import type { ContentEditor } from '../useContentEditor.ts';
import { Field, Icon } from '../components/Website.tsx';

export default function ProjectDetail({ project, editor, onDelete }: { project?: Project; editor: ContentEditor; onDelete: () => void }) {
  const { editing, updateProject, imageSrc } = editor;
  if (!project) return <section className="site-container site-section"><h1>Không tìm thấy công trình</h1><a href="#/projects" className="site-text-link">Về danh sách dự án</a></section>;
  const change = (values: Partial<Project>) => updateProject(project.id, values);
  return <article className="site-container site-project-detail"><a className="site-text-link" href="#/projects">← Tất cả dự án</a>
    <div className="site-detail-heading"><div><p className="site-eyebrow">DỰ ÁN & CÔNG TRÌNH</p><h1><Field value={project.title} onChange={(title) => change({ title })} editing={editing} label="Tên dự án" /></h1></div>{editing && <button className="site-button site-button-danger" onClick={onDelete}>Xóa dự án</button>}</div>
    <div className="site-detail-category"><Field value={project.category || 'Công trình'} onChange={(category) => change({ category })} editing={editing} label="Nhóm dự án" />
      {editing && <label className="site-checkbox"><input type="checkbox" checked={project.featured} onChange={(event) => change({ featured: event.target.checked })} /> Công trình tiêu biểu</label>}
    </div>
    <div className="site-detail-summary"><Field value={project.summary} onChange={(summary) => change({ summary })} editing={editing} label="Mô tả ngắn" multiline /></div>
    {project.images[0] && <img className="site-detail-cover" src={imageSrc(project.images[0].path)} alt={project.images[0].alt || project.title} width="1400" height="900" />}
    <div className="site-detail-content"><h2>Giới thiệu công trình</h2><Field value={project.content} onChange={(content) => change({ content })} editing={editing} label="Nội dung bài viết" multiline /></div>
    <div className="site-section-title"><h2>Hình ảnh công trình</h2>{editing && <label className="site-button site-button-dark site-upload"><Icon name="upload" /> Thêm ảnh<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple onChange={(event) => { editor.addImages(project, event.target.files); event.target.value = ''; }} /></label>}</div>
    <div className="site-gallery">{project.images.map((image, index) => <figure key={image.path}>
      <img src={imageSrc(image.path)} alt={image.alt || project.title} loading="lazy" width="1000" height="700" />
      {editing && <figcaption><span>{index === 0 ? 'Ảnh đại diện' : `Ảnh ${index + 1}`}</span><Field value={image.alt} onChange={(alt) => change({ images: project.images.map((item, i) => i === index ? { ...item, alt } : item) })} editing label={`Mô tả ảnh ${index + 1}`} /><div>
        <label className="site-replace-photo site-upload">Đổi ảnh<input type="file" aria-label={`Chọn ảnh thay thế ${index + 1}`} accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => { const file = event.target.files?.[0]; if (file) editor.replaceProjectImage(project, index, file); event.target.value = ''; }} /></label>
        {index > 0 && <button onClick={() => change({ images: [image, ...project.images.filter((_, i) => i !== index)] })}>Đặt đại diện</button>}
        {index > 0 && <button onClick={() => { const images = [...project.images]; [images[index - 1], images[index]] = [images[index], images[index - 1]]; change({ images }); }}>Lên trước</button>}
        <button onClick={() => change({ images: project.images.filter((_, i) => i !== index) })}>Bỏ khỏi bài viết</button>
      </div></figcaption>}
    </figure>)}</div>
  </article>;
}
