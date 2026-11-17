# KenlyThoi Website

Nền tảng website giới thiệu công ty KenlyThoi trong lĩnh vực điện nước và thi công công trình. React + Vite + TypeScript + Tailwind CSS, lưu nội dung và ảnh trong **một repository**, frontend trên GitHub Pages. Không có backend, database hoặc Python server.

## Phạm vi phiên bản này

Đã chuẩn bị:

- Các trang cơ bản: Trang chủ, Giới thiệu, Dịch vụ, Dự án, Chi tiết dự án, Liên hệ và Đăng nhập quản trị; bố cục responsive tối giản.
- Kiểu dữ liệu và kiểm tra cấu trúc JSON; không giới hạn số dự án ở mức 30. Bộ kiểm tra có trường hợp 30 dự án, mỗi dự án 10 ảnh.
- Đọc nội dung trực tiếp qua GitHub REST API; URL ảnh trực tiếp từ GitHub.
- Các hàm lưu JSON, upload nhiều ảnh, xóa ảnh, xử lý SHA, cache và lỗi API.
- Đăng nhập bằng Fine-grained PAT; phiên chỉ nằm trong bộ nhớ tab.
- Workflow build và deploy GitHub Pages.

**Chưa triển khai:** giao diện hoàn chỉnh, nút Edit và các thao tác inline editing (thêm/sửa/xóa dự án, Save, Cancel, Exit Edit Mode). Các hàm API bên dưới là nền tảng cho giai đoạn đó, chưa có biểu mẫu chỉnh sửa/upload trên website. Không có Admin Dashboard hoặc sidebar quản trị.

Chỉ tên công ty và lĩnh vực do chủ dự án cung cấp được điền sẵn. Dự án, dịch vụ, kinh nghiệm, địa chỉ và thông tin liên hệ còn trống; không có công trình hoặc thông tin doanh nghiệp giả.

## Cài đặt và chạy

Yêu cầu Node.js **24.13 trở lên trong nhánh 24.x**, npm và repository public trên GitHub.

```sh
npm ci
npm run dev
```

Mặc định truy cập `http://localhost:5173/kenlythoi-webSite/`. Dùng URL Vite in ra nếu cổng đã được sử dụng.

```sh
npm test          # Kiểm tra dữ liệu/API bằng fetch giả lập, không ghi vào GitHub
npm run typecheck
npm run build    # Kiểm tra TypeScript và tạo dist/
npm run preview  # Xem bản đã build
```

`node_modules/`, `dist/` và cấu hình cá nhân không được đưa vào Git.

## Cấu hình repository

Cấu hình mặc định khớp remote hiện tại:

| Biến công khai | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `VITE_GITHUB_OWNER` | `BomXanhGZ` | Chủ repository |
| `VITE_GITHUB_REPO` | `kenlythoi-webSite` | Tên repository |
| `VITE_GITHUB_BRANCH` | `main` | Nhánh chứa JSON và ảnh |
| `VITE_BASE_PATH` | `/kenlythoi-webSite/` | Đường dẫn gốc của GitHub Pages |

Nếu cần thay đổi khi chạy local, sao chép `.env.example` thành `.env.local`, sửa các giá trị công khai rồi khởi động lại Vite. Khi deploy, workflow tự lấy owner/repo từ repository đang chạy và dùng nhánh `main`. Nếu đổi nhánh hoặc dùng tên miền riêng, sửa phần `env` và bộ lọc nhánh trong workflow tương ứng; tên miền riêng dùng `VITE_BASE_PATH=/`.

**Không đặt token trong `.env`, biến `VITE_*`, GitHub Actions variables, source code, URL hoặc file JSON.** Biến `VITE_*` được nhúng vào frontend công khai.

Repository và nhánh phải đã có `data/site.json`, `data/posts.json`. Website local cũng đọc GitHub, không đọc JSON cục bộ và không có fallback dữ liệu trong `dist/`. Vì checkout ban đầu chưa có commit, cần commit/push nền tảng lần đầu trước khi kiểm thử tải nội dung thật. Trước bước đó, giao diện sẽ báo không tìm thấy dữ liệu; đây không phải lỗi build.

## Routing trên GitHub Pages

Dùng hash routing để không cần máy chủ xử lý route hoặc file chuyển hướng 404:

| Trang | URL tương đối từ gốc website |
| --- | --- |
| Trang chủ | `#/` |
| Giới thiệu | `#/about` |
| Dịch vụ | `#/services` |
| Dự án | `#/projects` |
| Chi tiết | `#/projects/<slug>` |
| Liên hệ | `#/contact` |
| Đăng nhập | `#/admin` |

Route logic `/admin` có URL đầy đủ sau khi deploy là `https://BomXanhGZ.github.io/kenlythoi-webSite/#/admin`. Truy cập trực tiếp `/kenlythoi-webSite/admin` không được GitHub Pages phục vụ; dùng đường dẫn có `#` kể cả khi lưu bookmark hoặc tải lại trang.

## Dữ liệu

### `data/site.json`

- `schemaVersion`: `1`.
- `company`: `name`, `description`, `about`, `experience`, `phone`, `email`, `address`, đều là chuỗi. Thông tin chưa có để `""`.
- `services`: mảng `{ id, title, description }`; `id` duy nhất, chỉ gồm chữ, số, `_`, `-`; `title` không được trống.

### `data/posts.json`

```json
{
  "schemaVersion": 1,
  "posts": []
}
```

Mỗi phần tử trong `posts` có các trường sau. Đây là mô tả cấu trúc, không phải dữ liệu công trình thực tế:

| Trường | Kiểu / quy tắc |
| --- | --- |
| `id` | Chuỗi duy nhất, ổn định; chữ, số, `_`, `-` |
| `slug` | Chuỗi duy nhất cho URL; chữ thường không dấu, số và dấu `-` giữa các từ |
| `title` | Tên công trình, không trống |
| `summary` | Mô tả ngắn dạng văn bản |
| `content` | Nội dung dạng văn bản, xuống dòng bằng `\n`; không render HTML |
| `images` | Mảng `{ "path": "public/images/projects/<id>/<filename>.webp", "alt": "Mô tả ảnh" }` |
| `featured` | `true` để xuất hiện trong nhóm công trình tiêu biểu |
| `createdAt` | Thời gian ISO 8601, ví dụ `new Date().toISOString()` |
| `updatedAt` | Thời gian ISO 8601 cập nhật gần nhất |

Không lưu ảnh Base64 trong JSON. Giữ mỗi file JSON dưới 1 MB để dùng Contents API dạng Base64. Với 30+ dự án, ảnh được tải riêng và dùng lazy loading ở danh sách; trang chủ hiển thị tối đa ba dự án tiêu biểu. Nội dung dài và nhiều ảnh không bị gộp vào JavaScript bundle.

## GitHub API và phiên quản trị

Các file chính:

- `src/config.ts`: cấu hình repository công khai.
- `src/content.ts`: kiểu dữ liệu và kiểm tra JSON.
- `src/github.ts`: API, SHA, ảnh và cache.
- `src/auth.ts`: phiên quản trị trong bộ nhớ, hook dùng chung trên giao diện.
- `src/App.tsx`: tải dữ liệu và điều hướng; các trang dùng chung component trong `src/components/`.

### Tạo và sử dụng token

1. Trong GitHub, mở **Settings → Developer settings → Personal access tokens → Fine-grained tokens**.
2. Chọn resource owner của repository và **Only select repositories**, chỉ chọn repository này.
3. Cấp **Repository permissions → Contents: Read and write**. Metadata được GitHub cấp kèm. Không cần quyền Workflows hoặc Administration.
4. Chọn thời hạn phù hợp, tạo token và nhập tại `#/admin`. Tài khoản tạo token cũng phải có quyền ghi repository. Nếu tổ chức yêu cầu phê duyệt token, hoàn thành bước đó trước.

Đăng nhập kiểm tra `/user`, quyền repository, nhánh dữ liệu và tạo **Git blob rỗng không được tham chiếu** để xác minh token thực sự có quyền Contents: write. Chỉ xem `permissions.push` không đủ để xác minh quyền của Fine-grained PAT. Bước kiểm tra blob không tạo file, không tạo commit, không thay đổi nhánh và không chạy workflow. Quy tắc bảo vệ nhánh vẫn có thể từ chối thao tác Save sau này; blob probe không bảo đảm vượt qua các quy tắc đó.

Sau khi đăng nhập, admin trở về giao diện website thông thường, có trạng thái phiên và nút Đăng xuất. Token không lưu trong `localStorage`, `sessionStorage` hoặc cookie; tải lại/đóng tab hoặc đăng xuất sẽ làm mất phiên. Mỗi tab cần đăng nhập riêng. Không ghi token ra log.

### Hợp đồng dùng cho inline editing ở giai đoạn sau

```ts
import { getAdminToken } from './auth.ts';
import { readPosts, savePosts } from './github.ts';

const snapshot = await readPosts(true);
const draft = structuredClone(snapshot.data);
// Thêm/sửa/xóa phần tử draft.posts, cập nhật updatedAt theo thao tác.
const saved = await savePosts(draft, snapshot.sha, getAdminToken());
// Giữ saved.sha cho lần lưu tiếp theo hoặc đọc lại dữ liệu.
```

- `readPosts(force?)`, `readSite(force?)` trả `{ data, sha }`. Đọc công khai không gửi token.
- `savePosts(data, sha, token)`, `saveSite(data, sha, token)` kiểm tra dữ liệu, mã hóa UTF-8/Base64 và cập nhật file đúng nhánh bằng SHA đã đọc.
- `uploadProjectImages(projectId, files, token)` trả `[{ path, sha }]`. Kiểm tra toàn bộ lựa chọn trước khi upload, hỗ trợ JPEG/PNG/WebP/AVIF tối đa 8 MB/ảnh, tên file UUID, ghi tuần tự. Nên tối ưu ảnh trước khi upload.
- `projectImageUrl(path)` tạo URL `raw.githubusercontent.com/<owner>/<repo>/<branch>/public/images/projects/...`, không dùng URL GitHub Pages cho ảnh mới. Tên file upload mới luôn khác để tránh cache ảnh cũ; không ghi đè ảnh cũ tại cùng URL.
- `deleteProjectImage({ path, sha }, token)` chỉ cho phép xóa trong thư mục ảnh dự án.
- `clearContentCache()` xóa cache JSON trong bộ nhớ.

CRUD dự án là thay đổi mảng `draft.posts` rồi lưu cả tài liệu; không có endpoint/backend riêng. Cancel bỏ bản nháp; chỉ Save gọi hàm ghi. Không tự động thử ghi đè nếu GitHub trả lỗi SHA `409/422`: giữ bản nháp, đọc phiên bản mới và cho người dùng xử lý xung đột.

Upload ảnh và lưu JSON là các commit riêng, **không phải một giao dịch nguyên tử**. Upload xong mới thêm đường dẫn vào bản nháp và Save JSON. Nếu upload dở dang, `ImageUploadError.uploaded` giữ danh sách đã thành công. Nếu hủy hoặc Save JSON thất bại, giao diện sau này cần giữ danh sách để thử lại hoặc dọn bằng `deleteProjectImage`; không xóa ảnh vẫn được dự án khác tham chiếu. Xóa một bài viết khỏi JSON không tự động xóa các file ảnh.

Không gọi đồng thời các thao tác ghi Contents API trên cùng nhánh. Các thao tác trong một lượt upload đã được tuần tự hóa; giao diện chỉnh sửa sau này cần khóa Save/upload trong lúc đang ghi.

### Cache và giới hạn

JSON có cache trong bộ nhớ **60 giây**, dùng ETag để kiểm tra lại. Sau ghi thành công cache file tương ứng bị xóa. Website kiểm tra dữ liệu khi mở trang, chuyển trang hoặc quay lại tab; `force=true` bỏ thời gian chờ cache trong bộ nhớ và vẫn xác thực ETag với GitHub. Không polling liên tục và không có service worker.

Khách có thể tải lại trang để đọc nội dung mới mà không chờ frontend deploy. Một tab đang để nguyên sẽ cập nhật khi chuyển trang/quay lại tab sau thời gian cache. Cache phía GitHub/CDN vẫn có thể có độ trễ ngắn; không cam kết cập nhật đồng thời tức thì cho mọi khách.

GitHub API có giới hạn tần suất cho truy cập không đăng nhập, thường dùng chung theo IP. Lỗi mạng, token hết hạn, thiếu quyền, giới hạn tần suất và xung đột được trả thành thông báo; không tự lặp yêu cầu vô hạn. Nếu tải lại thất bại khi đã có dữ liệu trên trang, website giữ nội dung cũ và báo lỗi.

## Deploy GitHub Pages

1. Commit và push source, lockfile, `data/` cùng workflow lên nhánh `main` của repository public.
2. Trong repository, chọn **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Push thay đổi frontend hoặc chạy thủ công workflow **Deploy GitHub Pages** từ tab Actions. Workflow chạy `npm ci`, `npm test`, `npm run build`, sau đó upload `dist/` và deploy Pages.
4. Sau khi workflow thành công, mở URL trong deployment `github-pages`. URL dự kiến của repository hiện tại là `https://BomXanhGZ.github.io/kenlythoi-webSite/`.

Workflow dùng `GITHUB_TOKEN` do Actions tự cấp với quyền `contents: read`, `pages: write`, `id-token: write`; không yêu cầu tạo secret PAT cho build/deploy. Token admin chỉ nhập lúc sử dụng website.

`paths-ignore` bỏ qua push chỉ thay đổi `data/**` và/hoặc `public/images/projects/**`. Vì vậy Save nội dung hoặc upload ảnh không kích hoạt build. Một commit đồng thời thay đổi source/config vẫn kích hoạt build bình thường. Không thêm workflow khác chạy build cho mọi commit nội dung. Nếu đổi nhánh dữ liệu khác `main`, bảo đảm cấu hình đọc và ghi trỏ cùng nhánh đó.

## Kiểm chứng và giới hạn hiện tại

`npm test` kiểm tra schema 30 dự án, UTF-8, ETag, SHA, vô hiệu hóa cache sau ghi, lỗi API, token read-only, đăng xuất và lỗi upload một phần. Toàn bộ request trong test là giả lập; không có dữ liệu nào được ghi lên GitHub.

Build thành công không thay thế kiểm thử tích hợp với repository và token thật. Sau lần push/deploy đầu tiên, cần kiểm tra tải JSON public, đăng nhập bằng token read-only/read-write, quy tắc nhánh và ảnh raw GitHub. Phiên bản này chưa được publish tự động từ môi trường phát triển.

Tài liệu tham chiếu chính thức: [Vite — GitHub Pages](https://vite.dev/guide/static-deploy#github-pages), [Tailwind — Vite plugin](https://tailwindcss.com/docs/installation/using-vite), [GitHub Contents API](https://docs.github.com/en/rest/repos/contents), [GitHub Git blobs API](https://docs.github.com/en/rest/git/blobs).
