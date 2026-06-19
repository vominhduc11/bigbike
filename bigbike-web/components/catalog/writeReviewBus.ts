// Cầu nối mở modal "Viết đánh giá" từ bất kỳ đâu trong trang chi tiết sản phẩm
// (nút ở khối mua hàng phía trên + nút ở khối đánh giá phía dưới) tới một
// WriteReviewDialog DUY NHẤT mount ở ProductView. Dùng cùng cơ chế custom-event
// như "bb:pdp-activate-tab" để khỏi luồn prop qua nhiều lớp component. Tách ra
// module riêng (không import gì) nên không tạo vòng import giữa dialog ↔ section.
export const WRITE_REVIEW_EVENT = "bb:pdp-write-review";

export function openWriteReviewDialog() {
  window.dispatchEvent(new CustomEvent(WRITE_REVIEW_EVENT));
}
