import { HomeSkeleton } from "@/components/ui/Skeletons";

// Nằm trong route group `(home)` — KHÔNG được đưa trở lại `app/[locale]/loading.tsx`.
//
// `loading.tsx` tạo một Suspense boundary bọc toàn bộ segment con của nó. Đặt ở
// `app/[locale]/` nghĩa là bọc CẢ APP: response bắt đầu stream ngay khi trang await
// dữ liệu, header bay đi kèm mã 200, và mọi `notFound()` / `permanentRedirect()` sau
// đó không đổi được mã trạng thái nữa (Next 16:
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/loading.md
// mục "Status Codes"). Hậu quả đo được ngày 2026-08-06: mọi URL không tồn tại trả 200
// và trả về HTML của chính khung chờ này thay vì giao diện 404; redirect chuẩn hoá
// slug EN (PRODUCT_RULE_003) im lặng không chạy.
//
// Route group `(home)` không xuất hiện trong URL, nên `/` và `/en/` giữ nguyên đường
// dẫn mà khung chờ chỉ còn áp cho riêng trang chủ.
// Bất biến này được khoá bằng __tests__/seo/render-boundaries.test.ts.
export default function Loading() {
  return <HomeSkeleton />;
}
