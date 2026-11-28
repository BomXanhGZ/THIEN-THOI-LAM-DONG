import type { ContentEditor } from '../useContentEditor.ts';
import { PageHeading } from '../components/Website.tsx';

export default function Trash({ editor, onPurge }: { editor: ContentEditor; onPurge: (id: string) => void }) {
  return <><PageHeading eyebrow="QUẢN LÝ DỰ ÁN" title="Thùng rác" description="Khôi phục hoặc xóa vĩnh viễn bài đã bỏ. Thay đổi chỉ có hiệu lực khi nhấn Save." />
    <section className="site-container site-section">
      <a className="site-text-link" href="#/projects">Tất cả dự án</a>
      {!editor.admin || !editor.editing ? <p className="site-empty">Đăng nhập và bật Edit để quản lý Thùng rác.</p>
        : (editor.data?.posts.trash || []).length ? <div className="site-trash-list">{editor.data!.posts.trash!.map((item) => <article key={item.project.id}>
          <div><h2>{item.project.title}</h2><p>{item.project.summary}</p><small>Đã xóa: {new Date(item.deletedAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</small></div>
          <div><button className="site-button site-button-dark" onClick={() => editor.restorePost(item.project.id)}>Khôi phục bài</button>
            <button className="site-button site-button-danger" onClick={() => onPurge(item.project.id)}>Xóa vĩnh viễn</button></div>
        </article>)}</div> : <p className="site-empty">Thùng rác đang trống.</p>}
    </section>
  </>;
}
