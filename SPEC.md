# SPEC kỹ thuật

## Kiến trúc

- SPA React + TypeScript, Vite, Tailwind CSS; hosting GitHub Pages. Không có backend/database.
- Hash routing: `#/`, `#/about`, `#/services`, `#/projects`, `#/projects/:slug`, `#/contact`, `#/admin`, `#/trash`.
- `src/github.ts`: đọc/ghi và cache; `src/editor.ts`: lưu bản nháp; `src/useContentEditor.ts`: trạng thái chỉnh sửa; `src/auth.ts`: phiên quản trị; `src/draftStore.ts`: phục hồi; `src/merge.ts`: đối chiếu xung đột.

## Dữ liệu

| Vị trí | Nội dung |
| --- | --- |
| `data/site.json` | `company`, `services`, `media` (logo, hero, about) |
| `data/posts.json` | `posts`: id, slug, title, summary, content, images, featured, category, createdAt, updatedAt |
| `public/images/` | Ảnh gốc; ảnh upload tại `projects/<id>/` |

JSON dùng `schemaVersion: 1`. Ảnh có `path`, `alt`. `posts.json` có `trash` tùy chọn, lưu bài, thời điểm xóa và vị trí khôi phục.

## Đọc và ghi

- Local: mặc định đọc JSON trong `data/`; sửa file rồi reload. `VITE_CONTENT_SOURCE=github` chuyển sang dữ liệu GitHub để kiểm thử.
- Production: đọc JSON và ảnh công khai qua `raw.githubusercontent.com`, không cần token.
- Quản trị: REST API có PAT để lấy snapshot/SHA, ghi JSON và upload/xóa ảnh. **Save vẫn ghi GitHub khi chạy localhost**, không ghi file local.
- Save tạo blob/tree/commit bằng Git Data API, giữ nguyên tree hiện tại; cập nhật nhánh một lần, `force=false`. JSON và ảnh được công bố cùng nhau.
- Kiểm tra SHA snapshot; ghép thay đổi độc lập, yêu cầu admin chọn khi trùng nội dung. Mất phản hồi: xác minh commit trong lịch sử nhánh và thử lại cùng commit.
- IndexedDB giữ nháp/ảnh và commit chờ xác minh; Web Locks bảo vệ từng nháp giữa các tab. Nháp tự lưu sau 500 ms, bắt buộc lưu trước khi công bố; phụ thuộc bộ nhớ trình duyệt.
- Cache bộ nhớ 60 giây, gộp request trùng. Sau Save cập nhật cache ngay, chặn phản hồi cũ; đọc commit vừa lưu tối đa 5 phút trước khi trở lại nhánh.

## Quản trị và giới hạn

- Đăng nhập Fine-grained PAT có quyền Contents: Read and write. Token chỉ ở bộ nhớ tab, mất khi reload/đăng xuất; không đặt trong source, storage hoặc biến `VITE_*`.
- Chỉnh sửa trực tiếp bằng Edit/Save/Cancel. Nút Thêm dự án nằm ở trang Dự án khi bật Edit.
- Trang chủ hiển thị tối đa 3 dự án có `featured=true` theo thứ tự danh sách.
- JSON ghi dưới 1 MB; ảnh JPEG/PNG/WebP/AVIF tối đa 8 MB mỗi file.
- Xóa bài chuyển vào Thùng rác, có khôi phục. Xóa vĩnh viễn/thay ảnh chỉ dọn upload trong `public/images/projects/` khi không còn tham chiếu ở bài hiện hành, Thùng rác hoặc nhận diện; không dọn ảnh gốc. Lịch sử Git và cache CDN vẫn có thể giữ bản cũ.

## Build

- Base path: `/THIEN-THOI-LAM-DONG/`; output: `dist/`.
- GitHub Actions triển khai Pages từ nhánh `main`; thay đổi chỉ trong `data/**` và `public/images/projects/**` không kích hoạt build frontend.
