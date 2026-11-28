import type { ContentEditor } from '../useContentEditor.ts';
import type { DraftBackup } from '../draftStore.ts';

const labels: Record<string, string> = {
  title: 'Tiêu đề', summary: 'Mô tả ngắn', content: 'Nội dung', images: 'Hình ảnh', featured: 'Công trình tiêu biểu',
  category: 'Nhóm dự án', phone: 'Điện thoại', phoneSecondary: 'Điện thoại bổ sung', address: 'Địa chỉ',
  name: 'Tên công ty', legalName: 'Tên pháp lý', headline: 'Tiêu đề trang chủ', description: 'Mô tả',
  about: 'Giới thiệu', experience: 'Kinh nghiệm', tagline: 'Khẩu hiệu', fanpage: 'Fanpage', fanpageUrl: 'Link fanpage',
  logo: 'Logo', hero: 'Ảnh đầu trang', logoLayout: 'Cách hiển thị logo', state: 'Trạng thái bài viết',
};
function Version({ value, editor }: { value: unknown; editor: ContentEditor }) {
  if (value === undefined) return <p>Đã xóa</p>;
  if (typeof value === 'boolean') return <p>{value ? 'Có' : 'Không'}</p>;
  if (typeof value === 'string') {
    if (/^(public\/images\/|pending:)/.test(value)) return <img src={editor.imageSrc(value)} alt="Ảnh của phương án" />;
    return <p>{value || '(Để trống)'}</p>;
  }
  if (Array.isArray(value)) return <div className="site-conflict-images">{value.map((item, index) => item && typeof item.path === 'string'
    ? <img key={index} src={editor.imageSrc(item.path)} alt={item.alt || `Ảnh ${index + 1}`} /> : null)}</div>;
  if (value && typeof value === 'object' && 'project' in value) {
    const item = value as { state: string; project: { title: string; summary: string; content: string } };
    return <><strong>{item.state === 'trash' ? 'Trong Thùng rác' : 'Đang hiển thị'}: {item.project.title}</strong><p>{item.project.summary}</p><p>{item.project.content}</p></>;
  }
  return <p>Nội dung của hạng mục đã thay đổi.</p>;
}

export default function EditorRecovery({ editor, onDiscard }: { editor: ContentEditor; onDiscard: (record: DraftBackup) => void }) {
  const projects = [...(editor.data?.posts.posts || []), ...(editor.data?.posts.trash || []).map((item) => item.project)];
  return <>
    {editor.storageError && <div className="site-container site-error" role="alert">{editor.storageError}</div>}
    {!!editor.recovery.length && !editor.editing && <section className="site-container site-recovery" aria-label="Khôi phục bản nháp">
      <h2>Bạn có bản nháp chưa hoàn tất</h2>
      {editor.recovery.map((record) => <div className="site-recovery-item" key={record.id}>
        <p>{record.plan ? 'Lần lưu cần xác minh' : 'Bản nháp'} — {new Date(record.savedAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</p>
        <div><button disabled={editor.busy} className="site-button site-button-dark" onClick={() => { void editor.recover(record); }}>Khôi phục bản nháp</button>
          <button disabled={editor.busy} className="site-button" onClick={() => onDiscard(record)}>Bỏ bản nháp</button></div>
      </div>)}
    </section>}
    {!!editor.conflicts.length && <section className="site-container site-recovery" aria-label="Đối chiếu xung đột">
      <h2>Chọn nội dung muốn giữ</h2>
      <p>Các thay đổi không trùng nhau đã được giữ. Chọn phương án cho từng phần dưới đây, sau đó kiểm tra và Save.</p>
      {editor.conflicts.map((conflict) => {
        const parts = conflict.path.split('/'), post = projects.find((item) => item.id === parts[2]);
        const label = labels[parts.at(-1)!] || 'Trạng thái hoặc nội dung bài viết';
        return <article className="site-conflict" key={conflict.path}>
          <h3>{post ? `${post.title} — ` : ''}{label}</h3>
          <div className="site-conflict-columns">{(['local', 'remote'] as const).map((choice) => <div key={choice}>
            <h4>{choice === 'local' ? 'Bản của bạn' : 'Bản trên GitHub'}</h4>
            <div className="site-conflict-value"><Version value={conflict[choice]} editor={editor} /></div>
            <button className="site-button site-button-dark" onClick={() => editor.resolveConflict(conflict.path, choice)}>{choice === 'local' ? 'Giữ phần của tôi' : 'Dùng phần GitHub'}</button>
          </div>)}</div>
        </article>;
      })}
    </section>}
  </>;
}
