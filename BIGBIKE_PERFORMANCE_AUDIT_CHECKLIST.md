# BigBike Performance Audit Checklist

## Bối cảnh
Audit performance toàn diện cho hệ thống BigBike (monorepo 3 package). Đây là audit prompt — chỉ kiểm tra và báo cáo vấn đề, KHÔNG tự sửa code. Sau khi audit xong, tổng hợp kết quả và chờ xác nhận trước khi thực hiện fix.

## Phạm vi
- `bigbike-web` — Next.js 15, App Router, Tailwind v4
- `bigbike-admin` — Vite + React
- `bigbike-backend` — Spring Boot
- Database/Infra liên quan

---

## 1. Baseline Measurement
- [ ] Lighthouse/PageSpeed Insights cho 3 loại route: SSG (trang tĩnh), ISR (product/category), CSR (sau đăng nhập)
- [ ] Ghi nhận Core Web Vitals (LCP, INP, CLS) cho từng loại route
- [ ] Kiểm tra Spring Boot Actuator/Micrometer metrics (nếu đã enable)
- [ ] Bật log slow query >200ms (Hibernate `show_sql` + `format_sql`, hoặc DB slow query log)
- [ ] Chụp request waterfall (DevTools Network) cho 2-3 trang tiêu biểu (trang chủ, danh sách sản phẩm, chi tiết sản phẩm)

## 2. bigbike-web (Next.js)

**Rendering & Data Fetching**
- [ ] Xác nhận rendering strategy đúng theo route (SSG/ISR/CSR không lẫn lộn)
- [ ] ISR revalidate interval hợp lý (không quá ngắn gây tốn resource, không quá dài gây data cũ)
- [ ] SWR: `revalidateOnFocus`, dedupe interval, cache key có bị duplicate fetch không

**Bundle & Assets**
- [ ] Chạy `@next/bundle-analyzer`, tìm dependency nặng không cần thiết
- [ ] Dynamic import cho component nặng (modal, chart, rich editor...)
- [ ] `next/image`: format AVIF/WebP, đúng `sizes` attribute, priority cho ảnh above-the-fold
- [ ] Font loading: `next/font`, preload, `font-display` — kiểm tra lại do trước đó có vấn đề fallback system font (Barlow không load đúng)

**Hydration**
- [ ] Đo hydration cost các trang CSR sau đăng nhập
- [ ] Client Component nào có thể chuyển về Server Component

## 3. bigbike-admin (Vite + React)
- [ ] Bundle size tổng, breakdown theo 21 module
- [ ] Code splitting theo route — module không dùng ngay không nên load sẵn
- [ ] React DevTools Profiler: tìm re-render thừa ở component chính (bảng dữ liệu, dashboard)
- [ ] Table/list lớn đã có virtualization chưa
- [ ] Lazy load module ít dùng

## 4. bigbike-backend (Spring Boot)

**Query & Data Access**
- [ ] Bật `hibernate.generate_statistics`, tìm N+1 query
- [ ] Index cho cột filter/sort thường dùng (sản phẩm, đơn hàng, tồn kho)
- [ ] DTO projection thay vì trả full entity ở API list
- [ ] Pagination áp dụng đúng cho API trả list lớn

**Connection & Caching**
- [ ] HikariCP pool size phù hợp tải thực tế
- [ ] Đánh giá thêm cache Redis cho data ít đổi (category, config, danh mục)
- [ ] Response payload — có trả dư field không cần thiết không

**API Design**
- [ ] Endpoint bị FE gọi trùng lặp nhiều lần (waterfall N+1 ở tầng network)
- [ ] Response time theo endpoint, liệt kê top 5 chậm nhất

## 5. Database/Infra
- [ ] Slow query log — liệt kê top query chậm
- [ ] Missing index trên bảng chính
- [ ] CDN cho ảnh/static asset
- [ ] Nén gzip/brotli ở reverse proxy/server
- [ ] Latency kết nối DB-BE (cùng region?)

---

## Output mong muốn
Tổng hợp kết quả audit thành bảng:

| Vấn đề | Vị trí (file/module) | Mức độ ảnh hưởng | Đề xuất fix |
|---|---|---|---|
| | | Cao / Trung bình / Thấp | |

**Lưu ý:** Chỉ audit và báo cáo. Không tự sửa code. Chờ xác nhận trước khi fix hàng loạt.
