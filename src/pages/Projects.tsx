import type { Project } from '../content.ts';
import ProjectCard from '../components/ProjectCard.tsx';

export default function Projects({ posts }: { posts: Project[] }) {
  return (
    <section>
      <h1 className="text-3xl font-bold">Dự án</h1>
      {posts.length ? <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => <ProjectCard key={post.id} project={post} />)}
      </div> : <p className="mt-5 text-slate-600">Chưa có dự án được đăng.</p>}
    </section>
  );
}
