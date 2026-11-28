import type { ReactNode } from 'react';

const paths: Record<string, string> = {
  arrow: 'M4 12h16m-6-6 6 6-6 6', close: 'm6 6 12 12M6 18 18 6', menu: 'M4 6h16M4 12h16M4 18h16',
  bolt: 'm13 2-9 12h7l-1 8 10-13h-7l1-7Z', water: 'M12 3s-7 8-7 12a7 7 0 0 0 14 0c0-4-7-12-7-12Z',
  building: 'M4 21V4h11v17M15 10h5v11M2 21h20M8 8h3M8 12h3M8 16h3',
  edit: 'm16 3 5 5-12 12-6 1 1-6L16 3Zm-2 2 5 5', plus: 'M12 4v16M4 12h16',
  upload: 'M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5', check: 'm5 12 4 4L19 6',
  message: 'M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-1 2v-6.5A8.5 8.5 0 1 1 21 11.5ZM7 14l4-4 3 3 3-4',
};

export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.arrow} /></svg>;
}

export function Field({ value, onChange, editing, label, multiline = false, className = '' }: {
  value: string; onChange: (value: string) => void; editing: boolean; label: string; multiline?: boolean; className?: string;
}) {
  if (!editing) return <span className={className}>{value}</span>;
  return <label className={`site-field ${className}`}><span className="site-field-caption">{label}</span>
    {multiline ? <textarea aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} rows={3} />
      : <input aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} />}
  </label>;
}

export function SectionTitle({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return <div className="site-section-title"><div><p className="site-eyebrow">{eyebrow}</p><h2>{title}</h2></div>{children}</div>;
}

export function PageHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return <section className="site-page-heading"><div className="site-container"><p className="site-eyebrow">{eyebrow}</p><h1>{title}</h1>{description && <p>{description}</p>}</div></section>;
}

export function phoneHref(phone: string) { return `tel:${phone.replace(/[^+\d]/g, '')}`; }
