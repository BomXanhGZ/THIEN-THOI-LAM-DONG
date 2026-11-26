import type { ContentEditor } from '../useContentEditor.ts';
import { Field, Icon, PageHeading } from '../components/Website.tsx';
import SiteImageEditor from '../components/SiteImageEditor.tsx';

export function AboutContent({ editor }: { editor: ContentEditor }) {
  const { data, editing, updateCompany, imageSrc } = editor;
  if (!data) return null;
  const { company, media } = data.site;
  return <div className="site-about-layout"><div className="site-about-image">{media?.about && <img src={imageSrc(media.about)} alt="Thi công tại công trình" loading="lazy" width="1100" height="800" />}<SiteImageEditor editor={editor} kind="about" floating /><div className="site-image-stamp"><Icon name="building" size={32} /><span>ĐIỆN NƯỚC<br />& THI CÔNG</span></div></div>
    <div className="site-about-copy"><p className="site-eyebrow">VỀ {company.name.toUpperCase()}</p><h2>Chuyên nghiệp.<br />An toàn. Hiệu quả.</h2>
      <Field value={company.about} onChange={(value) => updateCompany('about', value)} editing={editing} label="Giới thiệu công ty" multiline />
      {(company.experience || editing) && <div className="site-experience"><Field value={company.experience} onChange={(value) => updateCompany('experience', value)} editing={editing} label="Kinh nghiệm và năng lực" multiline /></div>}
      <div className="site-about-note"><span className="site-note-line" /><Field value={company.tagline || ''} onChange={(value) => updateCompany('tagline', value)} editing={editing} label="Phương châm hoạt động" /></div>
      <a href="#/contact" className="site-text-link">Kết nối với chúng tôi <Icon name="arrow" /></a>
    </div></div>;
}

export default function About({ editor }: { editor: ContentEditor }) {
  return <><PageHeading eyebrow="GIỚI THIỆU" title={editor.data?.site.company.name || 'Giới thiệu'} description={editor.data?.site.company.legalName} /><section className="site-container site-section"><AboutContent editor={editor} /></section></>;
}
