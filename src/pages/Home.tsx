import type { Project, SiteData } from '../content.ts';
import ProjectCard from '../components/ProjectCard.tsx';

export default function Home({ site, posts }: { site: SiteData; posts: Project[] }) {
  const featured = posts.filter((post) => post.featured).slice(0, 3);
  return (
    <>
      <section className="rounded-xl border border-slate-200 bg-white p-6 sm:p-10">
        <h1 className="text-3xl font-bold text-sky-950 sm:text-4xl">{site.company.name}</h1>
        {site.company.description && <p className="mt-4 max-w-2xl leading-7 text-slate-600">{site.company.description}</p>}
        <a href="#/projects" className="mt-6 inline-block rounded-md bg-sky-800 px-5 py-3 text-sm font-semibold text-white hover:bg-sky-900">
          Xem dự án
        </a>
      </section>
      <section className="mt-10" aria-labelledby="featured-title">
        <h2 id="featured-title" className="mb-5 text-2xl font-semibold">Công trình tiêu biểu</h2>
        {featured.length ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((post) => <ProjectCard key={post.id} project={post} />)}
        </div> : <p className="text-slate-600">Chưa có công trình được đăng.</p>}
      </section>
    </>
  );
}
