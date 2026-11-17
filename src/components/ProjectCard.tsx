import type { Project } from '../content.ts';
import { projectImageUrl } from '../github.ts';

export default function ProjectCard({ project }: { project: Project }) {
  const image = project.images[0];
  return (
    <article className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <a href={`#/projects/${encodeURIComponent(project.slug)}`} className="block h-full">
        {image && <img src={projectImageUrl(image.path)} alt={image.alt} loading="lazy" decoding="async"
          width="800" height="500" className="aspect-[8/5] w-full object-cover" />}
        <div className="p-5">
          <h2 className="text-lg font-semibold text-slate-900">{project.title}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{project.summary}</p>
        </div>
      </a>
    </article>
  );
}
