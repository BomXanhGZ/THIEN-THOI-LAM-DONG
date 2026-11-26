# Đặc tả hệ thống THIEN-THOI-LAM-DONG

Ngày cập nhật: **26/11/2026**.

Tài liệu tổng hợp yêu cầu đã chốt trong các trao đổi, cập nhật sau khi chủ dự án xác nhận kết thúc giai đoạn demo và chuyển sang website chính. Các mục yêu cầu mô tả hệ thống cần hoàn thành; bảng tiến độ ghi nhận những gì thực sự đã triển khai tại thời điểm kiểm tra.

## 1. Mục tiêu và phạm vi

Xây dựng website giới thiệu công ty trong lĩnh vực **điện nước và thi công công trình**, quảng bá năng lực thông qua thông tin công ty, dịch vụ, hồ sơ dự án và hình ảnh thực tế.

Ưu tiên giao diện chuyên nghiệp, đơn giản, dễ sử dụng và dễ bảo trì. Người quản trị sửa nội dung trực tiếp trên website, phù hợp với người không biết lập trình.

Các quyết định đã chốt:

- Tên thương hiệu và repository: `THIEN-THOI-LAM-DONG`.
- Dùng một repository cho mã nguồn, JSON và ảnh.
- Dùng GitHub API để đọc và cập nhật nội dung trực tiếp.
- Không xây dựng backend, database server hoặc Python server.
- Không xây dựng dashboard, sidebar hay một hệ thống giao diện quản trị riêng ngoài trang đăng nhập.
- Không tự thêm công nghệ hoặc chức năng ngoài yêu cầu; chỉ thêm file, thư mục khi thực sự cần.
- Không tự tạo thông tin doanh nghiệp, khách hàng hoặc công trình thực tế chưa được cung cấp.

Phương án IndexedDB, xuất/nhập ZIP và Python hỗ trợ xuất bản xuất hiện trong yêu cầu cũ hơn. **Yêu cầu sau cùng đã chuyển sang GitHub API trực tiếp**; phương án cũ không phải phạm vi triển khai hiện tại.

## 2. Thông tin dự án

| Mục | Giá trị |
| --- | --- |
| Thư mục local | `E:\BomXanhG-Z_File\THIEN-THOI-LAM-DONG` |
| Repository | https://github.com/BomXanhGZ/THIEN-THOI-LAM-DONG |
| Nhánh triển khai | `main` |
| Website chính | https://bomxanhgz.github.io/THIEN-THOI-LAM-DONG/#/ |
| Giai đoạn hiện tại | Website chính, dùng ảnh và thông tin công ty thực tế |
| Hướng dẫn chạy và build | [README.md](README.md) |

## 3. Kiến trúc và công nghệ

| Thành phần | Lựa chọn đã chốt |
| --- | --- |
| Frontend | React + Vite + TypeScript |
| Giao diện | Tailwind CSS; CSS bổ sung khi cần |
| Hosting | GitHub Pages |
| Build và deploy frontend | GitHub Actions |
| Đọc/ghi nội dung | GitHub REST API |
| Dữ liệu | JSON trong repository |
| Hình ảnh | File ảnh trong repository; ảnh dự án dùng URL trực tiếp từ GitHub |
| Đăng nhập quản trị | GitHub Fine-grained Personal Access Token |
| Điều hướng hiện tại | Hash routing để tương thích GitHub Pages |

Luồng xem: người truy cập mở website → frontend tải JSON qua GitHub API → hiển thị nội dung và ảnh.

Luồng cập nhật: admin đăng nhập → bật Edit → sửa bản nháp → Save → cập nhật JSON/ảnh qua GitHub API → khách xem nhận nội dung mới sau khi cache được làm mới.

Thay đổi nội dung dự án không yêu cầu build hoặc deploy lại frontend. Thay đổi mã nguồn frontend vẫn cần build và deploy.

## 4. Các trang công khai

| ID | Trang | Yêu cầu |
| --- | --- | --- |
| PAGE-01 | Trang chủ | Giới thiệu công ty, lĩnh vực hoạt động và công trình tiêu biểu |
| PAGE-02 | Giới thiệu | Thông tin, kinh nghiệm và năng lực công ty |
| PAGE-03 | Dịch vụ | Các lĩnh vực thi công điện nước và mô tả dịch vụ |
| PAGE-04 | Dự án | Danh sách công trình, ảnh đại diện, tên và mô tả ngắn |
| PAGE-05 | Chi tiết dự án | Nội dung giới thiệu công trình kèm nhiều hình ảnh |
| PAGE-06 | Liên hệ | Thông tin liên hệ chính thức do chủ dự án cung cấp |

Yêu cầu chung:

- Responsive trên mobile, tablet và desktop.
- Hỗ trợ tối thiểu 30 bài viết dự án, mỗi dự án có nhiều ảnh.
- Ưu tiên tốc độ tải trang và trải nghiệm xem ảnh, đọc hồ sơ công trình.
- Bố cục và nội dung tập trung vào ngành điện nước, thi công công trình.

## 5. Quản trị và chỉnh sửa trực tiếp

| ID | Yêu cầu |
| --- | --- |
| AUTH-01 | Trang đăng nhập quản trị có route logic `/admin`; với hash routing, URL dùng `#/admin` |
| AUTH-02 | Kiểm tra token hợp lệ và có quyền ghi repository trước khi xác lập phiên quản trị |
| AUTH-03 | Không hardcode token trong source hoặc đưa token vào build output |
| AUTH-04 | Token chỉ giữ trong bộ nhớ tab; đăng xuất hoặc tải lại trang làm mất phiên |
| EDIT-01 | Sau đăng nhập, admin dùng cùng giao diện với khách xem và có thêm nút Edit |
| EDIT-02 | Chỉnh sửa trực tiếp thông tin công ty, dịch vụ và nội dung dự án |
| EDIT-03 | Thêm, sửa, xóa dự án tại các trang tương ứng |
| EDIT-04 | Upload nhiều ảnh và quản lý ảnh của dự án |
| EDIT-05 | Có Save, Cancel và Exit Edit Mode; phân biệt rõ bản nháp với nội dung đã lưu |
| EDIT-06 | Save cập nhật dữ liệu thật trên GitHub; không chỉ giữ thay đổi trong trình duyệt |
| EDIT-07 | Cancel bỏ thay đổi nội dung chưa lưu; xử lý rõ việc thoát khi còn thay đổi |
| EDIT-08 | Khi lưu lỗi hoặc xung đột, giữ bản nháp để người dùng có thể xử lý và thử lại |

Không xây dựng Redux, CMS hay framework bổ sung nếu không có nhu cầu thực tế và yêu cầu mới.

## 6. Dữ liệu và ảnh

### 6.1. Vị trí lưu trữ

| Dữ liệu | Vị trí |
| --- | --- |
| Thông tin công ty, dịch vụ | `data/site.json` |
| Danh sách dự án | `data/posts.json` |
| Ảnh công trình | `public/images/projects/` |
| Ảnh gốc và bảng logo do chủ dự án cung cấp | `public/images/`; logo tại `public/images/logo.png` |

Website chính phải đọc dữ liệu động từ GitHub, không phụ thuộc bản JSON đã đóng gói trong `dist/`. Ảnh dự án mới dùng URL trực tiếp từ GitHub để hiển thị mà không cần chờ Pages deploy.

### 6.2. Cấu trúc hiện có trong source

`data/site.json` có `schemaVersion: 1`, đối tượng `company` và mảng `services`.

- `company`: `name`, `legalName`, `headline`, `description`, `about`, `experience`, `tagline`, `phone`, `phoneSecondary`, `email`, `address`, `fanpage`, `fanpageUrl`. Các trường bổ sung là tùy chọn để dữ liệu cũ vẫn đọc được.
- `media`: các đường dẫn `logo`, `hero`, `about`. Ảnh được kiểm tra chỉ nằm trong `public/images/`.
- Mỗi dịch vụ: `id`, `title`, `description`.

`data/posts.json` có `schemaVersion: 1` và mảng `posts`. Mỗi dự án gồm:

| Trường | Ý nghĩa |
| --- | --- |
| `id` | Định danh dự án, duy nhất |
| `slug` | Đường dẫn dự án, duy nhất |
| `title` | Tên công trình |
| `summary` | Mô tả ngắn |
| `content` | Nội dung chi tiết dạng văn bản |
| `images` | Mảng ảnh, mỗi ảnh có `path` và `alt` |
| `featured` | Đánh dấu công trình tiêu biểu |
| `category` | Nhóm công trình, tùy chọn |
| `createdAt`, `updatedAt` | Thời điểm tạo và cập nhật |

Đây là cấu trúc đang triển khai, dùng làm căn cứ khi nối giao diện với API. Các thay đổi schema về sau cần được đánh giá và cập nhật tài liệu.

### 6.3. Quy tắc cập nhật

- Dùng SHA của phiên bản đã đọc khi cập nhật file; không tự ghi đè nếu có xung đột.
- Xử lý lỗi mạng, token không hợp lệ/hết hạn, thiếu quyền, giới hạn API và dữ liệu không hợp lệ.
- Làm mới cache sau khi lưu thành công; không cam kết mọi khách xem cập nhật tức thì.
- Upload ảnh và lưu JSON hiện là các thao tác riêng. Giao diện cần xử lý upload thành công một phần, thử lại và ảnh không còn được sử dụng.
- Xóa dự án khỏi JSON không mặc nhiên đồng nghĩa xóa mọi file ảnh của dự án.

Giới hạn triển khai hiện tại: JSON dưới 1 MB; ảnh upload hỗ trợ JPEG, PNG, WebP, AVIF, tối đa 8 MB mỗi ảnh. Đây là giới hạn trong code hiện tại, không phải chỉ tiêu do khách hàng mới bổ sung.

## 7. Chuyển sang website chính

Chủ dự án đã xác nhận giai đoạn demo hoàn tất ngày 26/11/2026.

- Đã bỏ entry, component, dữ liệu và stylesheet riêng của demo; chỉ còn một website chính.
- Giữ bố cục đã duyệt, chuyển sang dữ liệu đọc từ GitHub và cơ chế lưu thật.
- Dùng toàn bộ 17 ảnh do chủ dự án cung cấp, gồm bảng logo và 16 ảnh công trình/thi công.
- Chia ảnh thành ba hồ sơ theo nội dung nhìn thấy: thi công tại công trình, chiếu sáng công trình/cảnh quan, không gian trang trí/chiếu sáng. Tiêu đề mô tả không thay thế tên công trình chính thức.
- Không tự thêm khách hàng, địa chỉ công trình, năm hoàn thành hoặc số năm kinh nghiệm.

Thông tin trích trực tiếp từ ảnh `logo.png`:

| Thông tin | Nội dung |
| --- | --- |
| Tên công ty | Công ty TNHH Thiên Thời Lâm Đồng |
| Điện thoại | 0388 600 880; 0337 200 880 |
| Địa chỉ | Xóm 3, thôn 9, Lộc Ngãi, Bảo Lâm 1, Lâm Đồng |
| Fanpage | Thiên Thời Lâm Đồng; chưa có URL chính thức |
| Dịch vụ | Thi công điện, thi công nước, thi công xây dựng; cung cấp vật tư điện nước |

Email, URL fanpage và số năm kinh nghiệm không có trong ảnh; để trống và không hiển thị thông tin giả.

## 8. Build và deployment

- GitHub Actions kiểm tra, build và deploy frontend lên GitHub Pages.
- Cấu hình đường dẫn gốc và routing phải khớp repository `THIEN-THOI-LAM-DONG`.
- Commit chỉ thay đổi `data/**` và/hoặc `public/images/projects/**` không kích hoạt build frontend theo workflow hiện tại.
- Token quản trị không được đưa vào cấu hình build.
- Hướng dẫn thao tác giữ ngắn gọn trong [README.md](README.md), có lệnh chuyển vào thư mục dự án trước khi chạy.

## 9. Tiến độ đối chiếu ngày 26/11/2026

| Hạng mục | Trạng thái | Bằng chứng hoặc phần còn thiếu |
| --- | --- | --- |
| Đổi tên thương hiệu, repo và folder | Hoàn tất | Source và Git remote dùng tên mới; folder local đã đổi |
| Website chính | Đã triển khai | Một entry `src/main.tsx`; giao diện tại `src/pages/`, `src/components/`, `src/site.css` |
| Giai đoạn demo | Đã kết thúc và gỡ mã riêng | Không còn chế độ lưu thử trong tab |
| Thông tin công ty | Đã bổ sung từ logo | Hai số điện thoại, địa chỉ, tên pháp lý, tên fanpage, bốn nhóm dịch vụ |
| Ảnh thực tế và logo | Đã tích hợp | Logo ở đầu trang và bảng đầy đủ ở Liên hệ; toàn bộ 17 ảnh có tham chiếu |
| Chỉnh sửa và lưu thật | Đã nối với API | `src/useContentEditor.ts`, `src/editor.ts`; Edit/Save/Cancel/Exit, CRUD, thêm/sắp xếp/bỏ ảnh |
| An toàn khi lưu lỗi | Đã kiểm thử giả lập | Giữ bản nháp, giữ SHA sau thành công một phần, không upload lại ảnh đã thành công |
| Hủy ảnh tải lên chưa công khai | Đã triển khai | Chỉ dọn ảnh mới thuộc phiên hiện tại, đọc lại tham chiếu trên GitHub trước khi xóa; giữ nguyên ảnh gốc và ảnh đã công khai |
| Kiểm tra tự động | 18/18 test đạt | Schema, API, phiên đăng nhập, lưu thành công một phần, upload và ảnh gốc |
| Build và TypeScript | Đạt | `npm run build` |
| Kiểm thử trình duyệt | Đã kiểm tra với GitHub giả lập | Các trang tại 320/375/768/1440 px; đăng nhập, sửa, lưu, hủy, xóa, xung đột và 30 dự án × 10 ảnh |
| Nội dung cần bổ sung | Còn thiếu dữ kiện | Email, URL fanpage, năng lực/kinh nghiệm cụ thể và tên chính thức của từng công trình |
| GitHub Pages | Deploy thành công | Commit `8f9c5c1`, [Actions run 45783910936](https://github.com/BomXanhGZ/THIEN-THOI-LAM-DONG/actions/runs/45783910936); bước chờ artifact và Deploy đều đạt |
| Website online | Đã kiểm tra trên trình duyệt thật | Trang chủ, logo, ba nhóm ảnh và thông tin liên hệ đọc đúng từ GitHub; 20 file phát hành được đối chiếu với build local |
| Nghiệm thu ghi dữ liệu thật từ trình duyệt | Còn cần | Kiểm tra bằng token quản trị thực tế sau deploy; test giả lập không thay thế nghiệm thu này |

Lỗi deploy trước: [Actions run 45779102492](https://github.com/BomXanhGZ/THIEN-THOI-LAM-DONG/actions/runs/45779102492). Log ghi nhận upload `github-pages` thành công nhưng truy vấn metadata ngay sau đó trả 0 artifact; API sau đó có đúng artifact và chưa hết hạn. Workflow bổ sung quyền đọc Actions và chờ metadata tối đa 12 lượt trước khi deploy.

## 10. Tiêu chí nghiệm thu cuối cùng

- [ ] Đủ các trang PAGE-01 đến PAGE-06 với nội dung đã được xác nhận.
- [ ] Giao diện được duyệt, hoạt động phù hợp trên mobile, tablet và desktop.
- [ ] Khách xem không cần token để tải thông tin và ảnh công khai.
- [ ] Đăng nhập đúng quyền; token không xuất hiện trong source/build và bị xóa khi kết thúc phiên theo AUTH-04.
- [ ] Admin chỉnh sửa ngay trên giao diện website theo EDIT-01 đến EDIT-08.
- [ ] Thêm/sửa/xóa dự án, upload nhiều ảnh và Save được dữ liệu thật.
- [ ] Sau Save, khách xem hoặc phiên trình duyệt khác nhận nội dung mới sau khi làm mới cache, không cần deploy frontend.
- [ ] Cancel/Exit xử lý đúng bản nháp; lỗi lưu không làm mất bản nháp hoặc tự ghi đè dữ liệu mới hơn.
- [x] Kiểm tra sức chứa 30 dự án, mỗi dự án 10 ảnh, bằng dữ liệu kiểm thử trong trình duyệt.
- [ ] Kiểm tra lỗi quyền, mạng, giới hạn API, xung đột SHA và upload thành công một phần.
- [x] Pipeline deploy frontend thành công và các URL, ảnh hoạt động đúng dưới đường dẫn mới.

## 11. Các bước tiếp theo

1. Nghiệm thu Edit/Save/Cancel và upload bằng token quản trị thực tế.
2. Bổ sung email, URL fanpage, thông tin năng lực và tên/mô tả chính thức của công trình khi được cung cấp.
3. Duyệt lại nội dung và các thiết bị thực tế trước khi bàn giao.

## 12. Thông tin cần chủ dự án cung cấp hoặc xác nhận

- Email công khai và URL fanpage chính thức, nếu có.
- Thông tin kinh nghiệm, năng lực đã xác nhận.
- Tên chính thức và mô tả chi tiết tương ứng với các nhóm ảnh công trình.
- Kết quả nghiệm thu thao tác lưu thật bằng tài khoản quản trị của chủ dự án.

Khi yêu cầu hoặc tiến độ thay đổi, cập nhật phần tương ứng, ngày đối chiếu và bằng chứng kiểm tra. Chỉ đánh dấu hoàn tất khi đã có kết quả xác minh phù hợp.
