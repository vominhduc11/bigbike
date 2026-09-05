# Sơ đồ ERD dạng Mermaid

Mỗi file chứa **một** sơ đồ, kéo thả thẳng vào https://mermaid-viewer.com (hoặc mở trên GitHub / VS Code) là ra hình.

| File | Nội dung |
|---|---|
| `00-tong-quan.md` | Bản đồ 8 nhóm nghiệp vụ - xem cái này trước |
| `01-san-pham-danh-muc.md` | Sản phẩm & danh mục (19 bảng) |
| `02-khach-hang.md` | Khách hàng & tài khoản (7 bảng) |
| `03-don-hang-thanh-toan.md` | Giỏ hàng, đơn hàng & thanh toán (15 bảng) |
| `04-danh-gia.md` | Đánh giá sản phẩm (7 bảng) |
| `05-noi-dung-web.md` | Nội dung & giao diện website (13 bảng) |
| `06-quan-tri-phan-quyen.md` | Quản trị & phân quyền (10 bảng) |
| `07-tro-ly-chat.md` | Trợ lý chat (7 bảng) |
| `08-ky-thuat-van-hanh.md` | Kỹ thuật & vận hành (11 bảng) |
| `99-toan-he-thong.md` | Tất cả bảng trong một sơ đồ (nặng) |

Sinh lại bằng `bash scripts/ops/export-erd.sh`. Không sửa tay.
