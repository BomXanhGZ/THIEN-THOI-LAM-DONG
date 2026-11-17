import type { SiteData } from '../content.ts';

export default function Contact({ site }: { site: SiteData }) {
  const { phone, email, address } = site.company;
  const details = [['Điện thoại', phone], ['Email', email], ['Địa chỉ', address]].filter(([, value]) => value);
  return (
    <section>
      <h1 className="text-3xl font-bold">Liên hệ</h1>
      {details.length ? <dl className="mt-6 grid max-w-3xl gap-5">
        {details.map(([label, value]) => <div key={label}><dt className="font-semibold">{label}</dt><dd className="mt-1 whitespace-pre-wrap text-slate-600">{value}</dd></div>)}
      </dl> : <p className="mt-5 text-slate-600">Thông tin liên hệ đang được cập nhật.</p>}
    </section>
  );
}
