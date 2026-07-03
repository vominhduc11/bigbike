-- V303: Sửa nội dung 3 dòng "cam kết" mặc định (Bảo hành / Giao hàng / Đổi size) theo mockup
-- Trust Block đã duyệt — value (title) là câu trả lời ngắn gọn, label (subtitle) là TÊN NHÓM
-- chính sách (trước đây ngược lại: title gộp cả câu, subtitle là chi tiết/điều kiện phụ).
-- Cùng dữ liệu này hiển thị ở CẢ khối "Mua tại BigBike.vn" (ProductTrustCard) lẫn khối "Cam
-- kết" dưới nút mua (CommitmentsList) — sửa 1 nơi, khớp cả hai.
--
-- Chỉ update đúng 3 dòng mặc định (1231/1232 sản phẩm dùng chung, seed từ V232), match theo
-- đúng nội dung cũ để KHÔNG đụng dòng đã bị admin tự sửa tay (vd 1 sản phẩm Caberg).

update product_commitments
set title = '2 năm chính hãng',
    subtitle = 'Bảo hành',
    title_en = '2-year official warranty',
    subtitle_en = 'Warranty'
where icon = 'shield-check'
  and title = 'Bảo hành 2 năm chính hãng'
  and subtitle = 'Tại BigBike.vn';

update product_commitments
set title = 'Toàn quốc · COD',
    subtitle = 'Giao hàng 2–3 ngày',
    title_en = 'Nationwide · COD',
    subtitle_en = 'Delivery in 2–3 days'
where icon = 'truck'
  and title = 'Giao toàn quốc 2–3 ngày'
  and subtitle = 'Hà Nội, TP.HCM và các tỉnh · Thanh toán khi nhận (COD)';

update product_commitments
set title = 'Đổi size 30 ngày',
    subtitle = 'Chính sách đổi trả',
    title_en = 'Size exchange in 30 days',
    subtitle_en = 'Exchange policy'
where icon = 'refresh-cw'
  and title = 'Đổi size miễn phí 30 ngày'
  and subtitle = 'Lỗi nhà sản xuất · Không vừa size';
