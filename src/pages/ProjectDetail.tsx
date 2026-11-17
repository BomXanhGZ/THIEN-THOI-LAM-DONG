import type { Project } from '../content.ts';
import { projectImageUrl } from '../github.ts';

export default function ProjectDetail({ project }: { project: Project | undefined }) {
  if (!project) return <section><h1 className="text-2xl font-semibold">Không tìm thấy dự án</h1><a href="#/projects" className="mt-5 inline-block underline">Về danh sách dự án</a></section>;
  return (
    <article className="mx-auto max-w-4xl">
      <a href="#/projects" className="text-sm text-sky-800 underline">Về danh sách dự án</a>
      <h1 className="mt-5 text-3xl font-bold">{project.title}</h1>
      <p className="mt-4 leading-7 text-slate-600">{project.summary}</p>
      <div className="mt-6 whitespace-pre-wrap leading-8">{project.content}</div>
      <div className="mt-8 grid gap-6">
        {project.images.map((image, index) => <img key={image.path} src={projectImageUrl(image.path)} alt={image.alt}
          loading={index === 0 ? 'eager' : 'lazy'} decoding="async" width="1200" height="800"
          className="h-auto w-full rounded-lg" />)}
      </div>
    </article>
  );
}
