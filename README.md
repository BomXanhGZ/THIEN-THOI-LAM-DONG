# KenlyThoi — Demo

## Mở demo

**Online:** https://bomxanhgz.github.io/kenlythoi-webSite/?demo=1#/

Demo có 4 bài đăng mẫu và 6 ảnh từ thư mục `img-demo`.

1. Nhấn **Edit demo** để sửa nội dung ngay trên trang.
2. Vào **Dự án** để thêm bài; mở bài để sửa, xóa hoặc thêm nhiều ảnh.
3. **Save** lưu bản xem thử trong bộ nhớ tab. **Cancel** bỏ thay đổi chưa lưu.
4. Nút **×** cạnh Save là **Exit Edit Mode**.

Demo không cần token, không ghi lên GitHub. Tải lại trang sẽ khôi phục dữ liệu mẫu.

## Chạy local

Dùng Node.js 24.13+ trong nhánh 24.x:

```sh
npm ci
npm run dev
```

Mở http://localhost:5173/kenlythoi-webSite/?demo=1#/

## Kiểm tra và build

```sh
npm test
npm run build
npm run preview
```

Bản build nằm trong `dist/`. Mở preview tại:
http://localhost:4173/kenlythoi-webSite/?demo=1#/

## Deploy

```sh
git add .
git commit -m "Update website demo"
git push origin main
```

GitHub Actions tự kiểm tra, build và deploy lên Pages. Theo dõi workflow **Deploy GitHub Pages** trong tab **Actions**; có thể chạy lại bằng **Run workflow**.
