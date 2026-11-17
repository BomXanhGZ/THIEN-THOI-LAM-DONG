import type { SiteData } from '../content.ts';

export default function Services({ site }: { site: SiteData }) {
  return (
    <section>
      <h1 className="text-3xl font-bold">Dịch vụ</h1>
      {site.services.length ? <div className="mt-6 grid gap-5 sm:grid-cols-2">
        {site.services.map((service) => (
          <article key={service.id} className="rounded-lg border border-slate-200 bg-white p-6">
            <h2 className="text-xl font-semibold">{service.title}</h2>
            <p className="mt-3 whitespace-pre-wrap leading-7 text-slate-600">{service.description}</p>
          </article>
        ))}
      </div> : <p className="mt-5 text-slate-600">Thông tin dịch vụ đang được cập nhật.</p>}
    </section>
  );
}
