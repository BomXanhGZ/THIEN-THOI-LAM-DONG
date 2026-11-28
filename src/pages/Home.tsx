import type { ContentEditor } from '../useContentEditor.ts';
import { Field, Icon, SectionTitle } from '../components/Website.tsx';
import ProjectCard from '../components/ProjectCard.tsx';
import { AboutContent } from './About.tsx';
import { ServiceCards } from './Services.tsx';
import SiteImageEditor from '../components/SiteImageEditor.tsx';

export default function Home({ editor }: { editor: ContentEditor }) {
  const { data, editing, updateCompany, imageSrc } = editor;
  if (!data) return null;
  const { site, posts } = data;
  const featured = posts.posts.filter((post) => post.featured).slice(0, 3);
  return <>
    <section className="site-hero">{site.media?.hero && <img className="site-hero-image" src={imageSrc(site.media.hero)} alt="Hình ảnh công trình Thiên Thời Lâm Đồng" fetchPriority="high" width="1536" height="1024" />}<div className="site-hero-shade" />
      <div className="site-container site-hero-content"><SiteImageEditor editor={editor} kind="hero" /><p className="site-eyebrow"><span /> {site.company.name.toUpperCase()}</p>
        <h1><Field value={site.company.headline ?? site.company.description} onChange={(value) => updateCompany('headline', value)} editing={editing} label="Tiêu đề trang chủ" multiline /></h1>
        <div className="site-hero-description"><Field value={site.company.description} onChange={(value) => updateCompany('description', value)} editing={editing} label="Mô tả trang chủ" multiline /></div>
        <div className="site-hero-actions"><a href="#/projects" className="site-button site-button-orange">Khám phá công trình <Icon name="arrow" /></a><a href="#/contact" className="site-hero-secondary">Liên hệ với chúng tôi <span>↗</span></a></div>
      </div>
    </section>
    <div className="site-discipline"><div className="site-container">{['Thi công điện', 'Thi công nước', 'Thi công xây dựng'].map((label, index) => <span key={label}><Icon name={['bolt', 'water', 'building'][index]} />{label}</span>)}</div></div>
    <section className="site-container site-section"><SectionTitle eyebrow="LĨNH VỰC HOẠT ĐỘNG" title="Các hạng mục thi công"><a href="#/services" className="site-text-link">Tất cả dịch vụ <Icon name="arrow" /></a></SectionTitle><ServiceCards editor={editor} /></section>
    <section className="site-about-section"><div className="site-container site-section"><AboutContent editor={editor} /></div></section>
    <section className="site-container site-section"><SectionTitle eyebrow="DỰ ÁN & CÔNG TRÌNH" title="Hình ảnh từ công trình"><a href="#/projects" className="site-text-link">Xem tất cả dự án <Icon name="arrow" /></a></SectionTitle>
      {featured.length ? <div className="site-project-grid">{featured.map((project) => <ProjectCard key={project.id} project={project} imageSrc={imageSrc} />)}</div> : <p className="site-muted">Các công trình tiêu biểu sẽ được cập nhật tại đây.</p>}
    </section>
  </>;
}
