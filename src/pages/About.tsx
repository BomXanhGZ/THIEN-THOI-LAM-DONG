import type { SiteData } from '../content.ts';

export default function About({ site }: { site: SiteData }) {
  return (
    <section className="max-w-3xl">
      <h1 className="text-3xl font-bold">Giới thiệu</h1>
      <p className="mt-5 whitespace-pre-wrap leading-8">{site.company.about || 'Thông tin giới thiệu đang được cập nhật.'}</p>
      {site.company.experience && <p className="mt-5 whitespace-pre-wrap leading-8">{site.company.experience}</p>}
    </section>
  );
}
