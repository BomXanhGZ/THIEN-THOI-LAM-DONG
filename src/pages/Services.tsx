import type { ContentEditor } from '../useContentEditor.ts';
import { Field, Icon, PageHeading } from '../components/Website.tsx';

export function ServiceCards({ editor }: { editor: ContentEditor }) {
  const { data, editing, updateServices } = editor;
  if (!data) return null;
  return <div className="site-services-grid">{data.site.services.map((service, index) => <article className="site-service" key={service.id}>
    <div className="site-service-top"><Icon name={['bolt', 'water', 'building', 'plus'][index % 4]} size={30} /></div>
    <h3><Field value={service.title} onChange={(title) => updateServices(data.site.services.map((item) => item.id === service.id ? { ...item, title } : item))} editing={editing} label="Tên dịch vụ" /></h3>
    <Field value={service.description} onChange={(description) => updateServices(data.site.services.map((item) => item.id === service.id ? { ...item, description } : item))} editing={editing} label="Mô tả dịch vụ" multiline />
    <a href="#/contact" className="site-text-link">Trao đổi về hạng mục <Icon name="arrow" size={17} /></a>
    {editing && <button className="site-remove-service" onClick={() => updateServices(data.site.services.filter((item) => item.id !== service.id))}>Bỏ dịch vụ</button>}
  </article>)}</div>;
}

export default function Services({ editor }: { editor: ContentEditor }) {
  return <><PageHeading eyebrow="LĨNH VỰC HOẠT ĐỘNG" title="Giải pháp cho công trình." description="Thi công điện, nước, xây dựng và cung cấp vật tư điện nước." />
    <section className="site-container site-section"><ServiceCards editor={editor} />
      {editor.editing && <button className="site-button site-button-dark site-add-service" onClick={() => editor.updateServices([...(editor.data?.site.services || []), { id: `dich-vu-${crypto.randomUUID()}`, title: 'Dịch vụ mới', description: '' }])}><Icon name="plus" /> Thêm dịch vụ</button>}
    </section></>;
}
