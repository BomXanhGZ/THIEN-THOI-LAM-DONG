export interface DemoProject {
  id: string;
  title: string;
  category: string;
  summary: string;
  content: string;
  images: string[];
}

export interface DemoContent {
  headline: string;
  intro: string;
  about: string;
  services: { id: string; title: string; description: string }[];
  projects: DemoProject[];
}

export const demoAsset = (name: string) => `${import.meta.env.BASE_URL}images/demo/${name}.jpg`;

export function createDemoContent(): DemoContent {
  return {
    headline: 'Điện nước &\nthi công công trình.',
    intro: 'Khám phá các lĩnh vực thi công và không gian trưng bày công trình của THIEN-THOI-LAM-DONG.',
    about: 'THIEN-THOI-LAM-DONG hoạt động trong lĩnh vực điện nước và thi công công trình. Đây là bản thiết kế demo để xem trước cách giới thiệu công ty, dịch vụ và các dự án. Nội dung chi tiết sẽ được cập nhật bằng thông tin thực tế.',
    services: [
      { id: 'electrical', title: 'Thi công hệ thống điện', description: 'Nội dung minh họa về lắp đặt hệ thống điện, tủ điện và chiếu sáng trong công trình.' },
      { id: 'water', title: 'Thi công hệ thống nước', description: 'Nội dung minh họa về hệ thống cấp thoát nước và bố trí đường ống công trình.' },
      { id: 'construction', title: 'Thi công công trình', description: 'Nội dung minh họa về các hạng mục thi công và phối hợp triển khai tại công trường.' },
    ],
    projects: [
      { id: 'he-thong-dien', title: 'Lắp đặt hệ thống điện công trình', category: 'Hệ thống điện', summary: 'Bài mẫu giới thiệu cách bố trí và triển khai hệ thống điện trong công trình.', content: 'Đây là bài đăng demo, không phải hồ sơ một công trình thực tế của THIEN-THOI-LAM-DONG.\n\nPhần nội dung này có thể giới thiệu yêu cầu của công trình, phạm vi thi công, các hạng mục thực hiện và hình ảnh sau khi hoàn thành. Bạn có thể nhấn Edit để thử sửa trực tiếp nội dung trên trang.', images: [demoAsset('electrical'), demoAsset('construction')] },
      { id: 'cap-thoat-nuoc', title: 'Triển khai hệ thống cấp thoát nước', category: 'Hệ thống nước', summary: 'Bài mẫu trình bày hạng mục đường ống và hệ thống cấp thoát nước.', content: 'Bài viết và ảnh chỉ dùng để minh họa giao diện.\n\nĐây là vị trí mô tả hiện trạng, giải pháp bố trí đường ống, quá trình lắp đặt và kiểm tra hệ thống. Hãy thay bằng thông tin cùng hình ảnh công trình thực tế khi hoàn thiện website.', images: [demoAsset('pipes'), demoAsset('electrical')] },
      { id: 'thi-cong-cong-trinh', title: 'Các hạng mục thi công công trình', category: 'Thi công công trình', summary: 'Bài mẫu giới thiệu không gian công trường và các hạng mục triển khai.', content: 'Nội dung minh họa cho trang chi tiết dự án. Thông tin công trình sẽ được cập nhật sau.\n\nBạn có thể sử dụng cấu trúc này để giới thiệu tổng quan, phạm vi công việc và các hình ảnh trong quá trình thi công.', images: [demoAsset('construction'), demoAsset('building'), demoAsset('team')] },
      { id: 'hoan-thien-he-thong', title: 'Hoàn thiện hệ thống kỹ thuật', category: 'Hệ thống điện', summary: 'Bài mẫu về hoàn thiện và kiểm tra các hạng mục kỹ thuật của công trình.', content: 'Bài demo giúp bạn xem cách một dự án xuất hiện trên website.\n\nCó thể thay phần này bằng mô tả các hạng mục hoàn thiện, các bước kiểm tra và kết quả bàn giao thực tế. Không có thông tin khách hàng, địa chỉ hay kết quả thi công thực tế trong dữ liệu mẫu.', images: [demoAsset('building'), demoAsset('pipes')] },
    ],
  };
}
