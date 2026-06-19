-- V245 — "Hiển thị trên web": admin bật/tắt từng phần (section) của trang chi tiết sản phẩm.
-- Lưu opaque JSON string (như size_guide / suitability_advisory): backend chỉ truyền qua;
-- admin serialize, web parse. Map {sectionKey: boolean}.
--
-- Mặc định NULL = "chưa quyết" → web giữ hành vi cũ (hiện khi có dữ liệu) cho mọi sản phẩm
-- đang bán. Không cần backfill: lần đầu admin lưu lại sản phẩm, form seed map theo nội dung
-- hiện có rồi ghi explicit, nên web không đổi. Sản phẩm tạo MỚI gửi map mặc định tắt (opt-in).

alter table products
    add column if not exists section_visibility text;
