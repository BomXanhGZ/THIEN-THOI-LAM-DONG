# Kiểm thử thêm, sửa và xóa bài từ UI

Ngày kiểm tra: 26/11/2026. Phạm vi: website Thiên Thời Lâm Đồng, repository `BomXanhGZ/THIEN-THOI-LAM-DONG`.

## Lỗi phát hiện và bản sửa

| Lỗi tái hiện được | Cách xử lý |
| --- | --- |
| Tạo bài mới rồi Cancel làm trang ở lại URL của bài chưa tồn tại | Khi bỏ bản nháp, chuyển về danh sách dự án nếu URL chi tiết không còn trong dữ liệu đã lưu |
| Không thể xóa trắng nhóm dự án tùy chọn | Giữ đúng giá trị rỗng trong ô nhập; chỉ dùng tên mặc định ở chế độ xem |
| Khách mở phiên mới sau Save nhận JSON cũ từ GitHub | Mỗi lần đọc qua mạng dùng URL riêng để tránh phản hồi CDN cũ; vẫn giữ cache trong bộ nhớ và ETag |
| Sau Save thành công, đọc JSON cũ khiến dọn nhầm ảnh vừa công khai | Xác nhận ghi thành công và các tham chiếu trong snapshot đã lưu được ưu tiên bảo vệ ảnh; chỉ dọn upload của phiên hiện tại không còn được dùng |

Bản sửa: commit `2e6b674`. TypeScript và production build đạt. [Lượt triển khai bản sửa](https://github.com/BomXanhGZ/THIEN-THOI-LAM-DONG/actions/runs/45797107256) thành công.

## Kiểm thử UI với API giả lập

Chạy Chromium/Playwright trên ứng dụng thật tại localhost, thay phản hồi GitHub bằng fixture để chủ động tạo lỗi. Các trường hợp này không ghi vào repository thật.

Kết quả: **18/18 đạt**, không có lỗi JavaScript trong trang.

1. Tạo bài rồi Cancel: không ghi dữ liệu, quay về danh sách.
2. Xóa trắng nhóm dự án và Save.
3. Tiêu đề chỉ có khoảng trắng: chặn trước upload; sửa lại rồi Save được.
4. Tạo bài đầu tiên và xóa bài cuối cùng trong danh sách rỗng.
5. Quay lại từ hộp xác nhận xóa, hoặc xóa bản nháp rồi Cancel: giữ nguyên bài đã lưu.
6. Lỗi Save HTTP 401: giữ bản nháp và thử lại được.
7. Lỗi Save HTTP 403: giữ bản nháp và thử lại được.
8. Xung đột HTTP 409: báo lỗi và giữ bản nháp.
9. Lỗi dữ liệu/SHA HTTP 422: báo lỗi và giữ bản nháp.
10. Lỗi máy chủ HTTP 500: giữ bản nháp và thử lại được.
11. Upload thành công một phần: thử lại không tải trùng ảnh đã thành công.
12. Mất mạng khi lưu: giữ bản nháp và thử lại được.
13. Chặn ảnh không hỗ trợ hoặc vượt 8 MB.
14. Giao diện sửa bài ở chiều rộng 375 px không tràn ngang.
15. Chuỗi HTML/script trong tiêu đề được hiển thị như văn bản.
16. Giả lập đọc JSON cũ sau Save: ảnh đã lưu không bị gửi lệnh DELETE.
17. Bấm Save hai lần liên tiếp: chỉ ghi một lần.
18. Token chỉ đọc bị từ chối trước khi vào chế độ sửa.

Các kiểm thử lỗi dùng fixture; việc thử lại không chứng minh token hết hạn hoặc thiếu quyền tự khôi phục. Với lỗi quyền thực tế, cần đăng nhập bằng token hợp lệ theo thông báo của ứng dụng.

## Kiểm thử trực tiếp trên website đã triển khai

Chưa hoàn tất trọn luồng sau bản sửa. Lượt thử tiếp theo bị đóng cửa sổ khi Save đang chạy; upload và ghi JSON có thể hoàn tất sau khi trang đã đóng. Đã đối chiếu lịch sử Git, gỡ đúng bài QA còn sót và xác minh lại các bài gốc cùng toàn bộ blob ảnh gốc. Chưa có kết quả nghiệm thu sửa/xóa trên GitHub thật; không tính lượt bị gián đoạn là đạt.

Kiểm tra chế độ khách sau triển khai: 6 trang (Trang chủ, Giới thiệu, Dịch vụ, Dự án, chi tiết công trình, Liên hệ) ở 320/375/768/1440 px, tổng cộng 24 lượt đạt. Không có lỗi JavaScript, cảnh báo tải nội dung hoặc tràn ngang; hai số điện thoại hiển thị đúng, khách không thấy nút Edit.

## Bảo toàn dữ liệu và dọn dữ liệu thử

Trước khi thử, lưu bản sao hai JSON, mã băm SHA-256 và danh sách blob của toàn bộ `public/images`.

Chỉ tạo bài có mã riêng trong phiên QA. Bộ kiểm thử chặn thay đổi các bài gốc, chặn ghi `site.json` và chặn upload/xóa ảnh ngoài thư mục riêng của bài QA. Token chỉ ở bộ nhớ tiến trình kiểm thử, không ghi vào source, báo cáo hoặc ảnh chụp.

Lượt đầu đã phát hiện lỗi cache/dọn ảnh; bài và ảnh QA của lượt đó đã được gỡ. Hai JSON và cây ảnh sau dọn khớp chính xác bản sao ban đầu. Các commit thử và dọn vẫn được giữ trong lịch sử Git.

Sau lượt thử bị đóng giữa chừng, `data/posts.json` đã được khôi phục đúng byte của bản sao trước kiểm thử, chỉ loại bài thuộc mã QA của phiên; cây `public/images` có cùng danh sách và mã blob với bản sao. `site.json` không bị kiểm thử thay đổi. Cập nhật fanpage và bỏ email sau đó là yêu cầu nội dung riêng của chủ dự án, không phải dữ liệu QA.

## Kiểm tra mã nguồn

- `npm test`: 20/20 đạt, gồm kiểm tra UTF-8, cache/ETag, SHA, quyền token, upload và lưu thành công một phần.
- `npm run build`: TypeScript và production build đạt.
- `git diff --check`: đạt.

## Cách đối chiếu thủ công

1. Đăng nhập tại `#/admin`, bấm Edit và mở Dự án → Thêm dự án.
2. Nhập tiêu đề, mô tả, nội dung tiếng Việt, nhóm và thêm hai ảnh; Save.
3. Mở URL bài trong cửa sổ riêng không đăng nhập, kiểm tra nội dung và ảnh.
4. Sửa nội dung, mô tả ảnh, thứ tự/ảnh đại diện và thay một ảnh; Save rồi kiểm tra lại ở cửa sổ riêng.
5. Sửa thử rồi Cancel; xác nhận nội dung đã lưu được giữ.
6. Thử Quay lại ở hộp xóa; thử xóa khỏi bản nháp rồi Cancel.
7. Xóa bài QA và Save; kiểm tra cửa sổ khách không còn thấy bài.
8. Gỡ mọi file ảnh riêng của bài QA sau khi chắc chắn không còn tham chiếu; đối chiếu dữ liệu và ảnh gốc với bản sao.
