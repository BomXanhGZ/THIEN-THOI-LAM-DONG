import type { SiteImageKey } from '../content.ts';
import type { ContentEditor } from '../useContentEditor.ts';
import { Icon } from './Website.tsx';

const labels: Record<SiteImageKey, string> = { logo: 'Logo công ty', hero: 'Ảnh đầu trang', about: 'Ảnh giới thiệu' };

export default function SiteImageEditor({ editor, kind, floating = false }: { editor: ContentEditor; kind: SiteImageKey; floating?: boolean }) {
  if (!editor.editing) return null;
  const value = editor.data?.site.media?.[kind];
  const label = labels[kind];
  return <div className={`site-image-controls ${floating ? 'site-image-controls-floating' : ''}`} role="group" aria-label={`Chỉnh sửa ${label.toLowerCase()}`}>
    <strong>{label}</strong>
    <div className="site-image-actions"><label className="site-button site-button-dark site-upload"><Icon name="upload" size={16} />{value ? 'Đổi ảnh' : 'Thêm ảnh'}
      <input type="file" aria-label={`Chọn ${label.toLowerCase()}`} accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => {
        const file = event.target.files?.[0];
        if (file) editor.updateSiteImage(kind, file);
        event.target.value = '';
      }} />
    </label>{value && <button className="site-button site-button-outline" onClick={() => editor.updateSiteImage(kind, null)}>Bỏ ảnh</button>}</div>
    {kind === 'logo' && value && <label className="site-checkbox"><input type="checkbox" checked={editor.data?.site.media?.logoLayout === 'board'} onChange={(event) => editor.updateLogoLayout(event.target.checked ? 'board' : 'contain')} />Ảnh là bảng hiệu: lấy biểu tượng ở đầu trang</label>}
  </div>;
}
