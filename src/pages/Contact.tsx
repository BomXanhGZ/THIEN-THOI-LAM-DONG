import type { ContentEditor } from '../useContentEditor.ts';
import type { SiteData } from '../content.ts';
import { Field, PageHeading, phoneHref } from '../components/Website.tsx';

export default function Contact({ editor }: { editor: ContentEditor }) {
  const { data, editing, updateCompany, imageSrc } = editor;
  if (!data) return null;
  const { company, media } = data.site;
  const fields: { key: keyof SiteData['company']; label: string; kind?: 'phone' | 'email' }[] = [
    { key: 'legalName', label: 'Tên công ty' }, { key: 'name', label: 'Tên hiển thị' },
    { key: 'phone', label: 'Điện thoại', kind: 'phone' }, { key: 'phoneSecondary', label: 'Điện thoại bổ sung', kind: 'phone' },
    { key: 'email', label: 'Email', kind: 'email' }, { key: 'address', label: 'Địa chỉ' },
    { key: 'fanpage', label: 'Fanpage' }, { key: 'fanpageUrl', label: 'Link fanpage' },
  ];
  return <><PageHeading eyebrow="KẾT NỐI VỚI CHÚNG TÔI" title="Bắt đầu từ một cuộc trao đổi." description={company.legalName} />
    <section className="site-container site-section"><div className="site-contact-layout"><div><p className="site-eyebrow">THÔNG TIN LIÊN HỆ</p><h2>Chúng tôi sẵn sàng<br />lắng nghe.</h2><p className="site-muted">Liên hệ để trao đổi về hạng mục thi công điện, nước, xây dựng và vật tư cho công trình.</p></div>
      <dl className="site-contact-details">{fields.filter(({ key }) => editing || (key !== 'name' && key !== 'fanpageUrl' && company[key])).map(({ key, label, kind }) => {
        const value = company[key] || '';
        return <div key={key}><dt>{label}</dt><dd>{editing ? <Field value={value} onChange={(next) => updateCompany(key, next)} editing label={label} multiline={key === 'address'} />
          : kind === 'phone' ? <a href={phoneHref(value)}>{value}</a> : kind === 'email' ? <a href={`mailto:${value}`}>{value}</a>
            : key === 'fanpage' && company.fanpageUrl ? <a href={company.fanpageUrl} target="_blank" rel="noreferrer">{value}</a> : value}</dd></div>;
      })}</dl>
    </div>{media?.logo && <figure className="site-company-board"><img src={imageSrc(media.logo)} alt={`Bảng thông tin ${company.legalName || company.name}`} loading="lazy" width="1440" height="729" /></figure>}</section>
  </>;
}
