import type { SiteData } from '../content.ts';
import { Icon, phoneHref } from './Website.tsx';

export default function Footer({ site }: { site: SiteData }) {
  const { company } = site;
  return <>
    <section className="site-cta"><div className="site-container"><div><p className="site-eyebrow">KẾT NỐI VÀ TRAO ĐỔI</p><h2>Bạn đang có một công trình?</h2></div><a href="#/contact" className="site-button site-button-orange">Liên hệ với chúng tôi <Icon name="arrow" /></a></div></section>
    <footer className="site-footer"><div className="site-container"><div className="site-footer-main">
      <div><a href="#/" className="site-brand">{company.name}</a><p>{company.legalName}<br />{company.description}</p></div>
      <div><h3>Thông tin liên hệ</h3><a href={phoneHref(company.phone)}>{company.phone}</a>
        {company.phoneSecondary && <a href={phoneHref(company.phoneSecondary)}>{company.phoneSecondary}</a>}
        <p>{company.address}</p>
        {company.fanpage && (company.fanpageUrl ? <a href={company.fanpageUrl} target="_blank" rel="noreferrer">Fanpage: {company.fanpage}</a> : <p>Fanpage: {company.fanpage}</p>)}
      </div>
    </div><div className="site-footer-bottom"><span>© {new Date().getFullYear()} {company.name}</span><a href="#/admin">Đăng nhập quản trị</a></div></div></footer>
  </>;
}
