import type { Metadata } from "next";

// Cụm /tai-khoan/* là khu vực cá nhân sau đăng nhập (đơn hàng, sổ địa chỉ,
// sửa thông tin…) — không bao giờ nên xuất hiện trên kết quả tìm kiếm.
// robots.txt đã disallow /tai-khoan ở cấp site; layout này phủ thêm thẻ meta noindex
// cho cả cụm trong MỘT chỗ duy nhất (các page con không tự khai báo metadata). Layout
// chỉ truyền children — không đụng tới cách render/shell hiện có của từng trang.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AccountSegmentLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
