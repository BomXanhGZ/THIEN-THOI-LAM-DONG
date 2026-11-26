import { useState } from 'react';
import type { ContentEditor } from '../useContentEditor.ts';
import ProjectCard from '../components/ProjectCard.tsx';
import { Icon, PageHeading } from '../components/Website.tsx';

export default function Projects({ editor }: { editor: ContentEditor }) {
  const [filter, setFilter] = useState('Tất cả');
  const projects = editor.data?.posts.posts || [];
  const categories = ['Tất cả', ...new Set(projects.map((project) => project.category || 'Công trình'))];
  const selectedFilter = categories.includes(filter) ? filter : 'Tất cả';
  const visible = projects.filter((project) => selectedFilter === 'Tất cả' || (project.category || 'Công trình') === selectedFilter);
  return <><PageHeading eyebrow="DỰ ÁN & CÔNG TRÌNH" title="Từ công trường đến không gian hoàn thiện." description="Hình ảnh công trình và quá trình thi công của Thiên Thời Lâm Đồng." />
    <section className="site-container site-section site-projects-section"><div className="site-filter-row"><div className="site-filters">{categories.map((category) => <button key={category} className={selectedFilter === category ? 'is-active' : ''} onClick={() => setFilter(category)} aria-pressed={selectedFilter === category}>{category}</button>)}</div>
      {editor.editing ? <button className="site-button site-button-dark" onClick={editor.addProject}><Icon name="plus" /> Thêm dự án</button> : <span className="site-result-count">{visible.length} công trình</span>}</div>
      <div className="site-project-grid site-project-grid-two">{visible.map((project, index) => <ProjectCard key={project.id} project={project} index={index} imageSrc={editor.imageSrc} />)}</div>
      {!visible.length && <p className="site-empty">Chưa có công trình trong nhóm này.</p>}
    </section></>;
}
