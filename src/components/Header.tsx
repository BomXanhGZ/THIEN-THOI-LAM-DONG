import { useEffect, useState } from 'react';
import type { SiteData } from '../content.ts';
import { Icon, phoneHref } from './Website.tsx';

export const navigation = [['/', 'Trang chủ'], ['/about', 'Giới thiệu'], ['/services', 'Dịch vụ'], ['/projects', 'Dự án'], ['/contact', 'Liên hệ']];

export default function Header({ site, path, imageSrc }: { site: SiteData; path: string; imageSrc: (path: string) => string }) {
  const [menu, setMenu] = useState(false);
  useEffect(() => { setMenu(false); }, [path]);
  return <>
    <div className="site-topbar"><div className="site-container"><span>{site.company.tagline}</span>
      <a href={phoneHref(site.company.phone)}>Hotline: {site.company.phone}</a></div></div>
    <header className="site-header"><div className="site-container">
      <a className="site-brand" href="#/" aria-label={`${site.company.name} — Trang chủ`}>
        {site.media?.logo && <span className={`site-logo-window ${site.media.logoLayout === 'board' ? 'site-logo-board' : ''}`}><img src={imageSrc(site.media.logo)} alt={`Logo ${site.company.name}`} /></span>}
        <span>{site.company.name}<small>ĐIỆN NƯỚC & THI CÔNG</small></span>
      </a>
      <nav className={menu ? 'is-open' : ''} aria-label="Điều hướng chính">
        {navigation.map(([href, label]) => <a key={href} href={`#${href}`} className={path === href || (href === '/projects' && path.startsWith('/projects/')) ? 'is-active' : ''} aria-current={path === href ? 'page' : undefined}>{label}</a>)}
      </nav>
      <a className="site-header-cta" href="#/contact">Trao đổi công trình <Icon name="arrow" size={16} /></a>
      <button className="site-menu-button" onClick={() => setMenu(!menu)} aria-label={menu ? 'Đóng menu' : 'Mở menu'} aria-expanded={menu}><Icon name={menu ? 'close' : 'menu'} /></button>
    </div></header>
  </>;
}
