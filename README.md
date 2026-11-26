# Thiên Thời Lâm Đồng

**Website:** https://bomxanhgz.github.io/THIEN-THOI-LAM-DONG/#/

Đặc tả và tiến độ: [SPEC.md](SPEC.md).

## Chạy local

Dùng Node.js 24.13+ trong nhánh 24.x. Mở PowerShell:

```powershell
cd "E:\BomXanhG-Z_File\THIEN-THOI-LAM-DONG"
npm ci
npm run dev
```

Mở http://localhost:5173/THIEN-THOI-LAM-DONG/#/

Nội dung và ảnh được đọc trực tiếp từ repository trên GitHub. Khi sửa JSON hoặc thêm ảnh bằng source local, cần commit/push để website đọc được dữ liệu mới.

## Chỉnh sửa nội dung

1. Mở `#/admin`, đăng nhập bằng GitHub Fine-grained Token có quyền Contents: Read and write trên repo này.
2. Nhấn **Edit**, sửa thông tin trên các trang; vào Dự án để thêm/sửa/xóa bài và quản lý ảnh.
3. **Save** tải ảnh mới và lưu dữ liệu lên GitHub. Ảnh chọn trước Save chỉ là bản nháp.
4. **Cancel** hoặc **Exit Edit Mode** bỏ các thay đổi chưa lưu sau khi xác nhận.
5. Nếu lưu lỗi, bản nháp được giữ lại để thử lại. Đăng xuất/tải lại trang sẽ kết thúc phiên quản trị.

Cập nhật nội dung qua Save không yêu cầu build lại frontend.

## Kiểm tra và build

```powershell
cd "E:\BomXanhG-Z_File\THIEN-THOI-LAM-DONG"
npm test
npm run build
npm run preview
```

Bản build nằm trong `dist/`. Preview: http://localhost:4173/THIEN-THOI-LAM-DONG/#/

## Deploy frontend

```powershell
cd "E:\BomXanhG-Z_File\THIEN-THOI-LAM-DONG"
git add .
git commit -m "Update website"
git push origin main
```

Theo dõi workflow **Deploy GitHub Pages** trong tab **Actions**. Workflow tự kiểm tra, build, chờ artifact và deploy.
