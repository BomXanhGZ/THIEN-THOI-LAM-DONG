import type { Project } from '../content.ts';
import { Icon } from './Website.tsx';

export default function ProjectCard({ project, index, imageSrc }: { project: Project; index: number; imageSrc: (path: string) => string }) {
  return <a className="site-project" href={`#/projects/${project.slug}`}>
    <div className="site-project-image">{project.images[0] ? <img src={imageSrc(project.images[0].path)} alt={project.images[0].alt || project.title} loading="lazy" width="1000" height="700" /> : <div className="site-image-empty">Chưa có hình ảnh</div>}<span className="site-project-arrow"><Icon name="arrow" /></span></div>
    <div className="site-project-meta"><span>{project.category || 'Công trình'}</span><span>{String(index + 1).padStart(2, '0')}</span></div>
    <h3>{project.title}</h3><p>{project.summary}</p>
  </a>;
}
