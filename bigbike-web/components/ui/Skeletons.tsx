/**
 * Layout-matched skeleton components — barrel.
 *
 * Mỗi khung chờ sao lại đúng cấu trúc của trang nó thay thế, để cái khách thấy lúc
 * chờ khớp với cái hiện ra sau đó (cùng băng-rôn, cùng số cột, cùng chiều cao).
 * Chia theo khu vực trong ./skeleton/:
 *   - primitives.tsx  — atom (SkelText/…), SkeletonRoot, khung trang & thẻ dùng chung
 *   - storefront.tsx  — trang chủ, chi tiết SP, danh sách SP/danh mục/thương hiệu,
 *                       tìm kiếm, danh sách & chi tiết bài viết
 *   - account.tsx     — đặt hàng, tài khoản, đơn hàng, xác nhận đơn
 *   - content.tsx     — đăng nhập/đăng ký, trang tĩnh, liên hệ, hướng dẫn
 *
 * Re-export ở đây để call site giữ nguyên "@/components/ui/Skeletons".
 */

export * from "./skeleton/primitives";
export * from "./skeleton/storefront";
export * from "./skeleton/account";
export * from "./skeleton/content";
