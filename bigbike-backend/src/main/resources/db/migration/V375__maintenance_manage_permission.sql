-- V375 — Quyền "bật/tắt bảo trì" hiện rõ trong màn Vai trò (owner chốt 2026-08-06).
--
-- Vấn đề của V374: cổng khoá bảo trì so khớp TÊN VAI TRÒ (`DEVELOPER`) — bắt buộc phải vậy,
-- vì quyền '*' của SUPER_ADMIN thoả mãn mọi permission check nên không permission nào loại
-- trừ được họ. Hệ quả phụ: khả năng này KHÔNG hiện ở đâu trong màn "Vai trò và quyền truy
-- cập", và endpoint phải mượn tạm `settings.write` để xác thực — một quyền không liên quan,
-- lại sửa được ngay trong màn đó. Ai bỏ tick `settings.write` của DEVELOPER là công tắc bảo
-- trì im lặng ngừng hoạt động, không có dấu hiệu gì.
--
-- Cách xử lý: thêm permission riêng `maintenance.manage` để khả năng này NHÌN THẤY ĐƯỢC ở
-- đúng nơi owner mong đợi, và endpoint yêu cầu CẢ permission này LẪN tên vai trò DEVELOPER.
-- SUPER_ADMIN vẫn bị chặn vì cổng tên vai trò còn nguyên.
--
-- Lưu ý: cấp `maintenance.manage` cho vai trò khác sẽ KHÔNG có tác dụng — cổng tên vai trò
-- vẫn chặn. Điều này được ghi rõ trong nhãn/mô tả quyền ở admin để không gây hiểu nhầm.
--
-- V375 tách riêng khỏi V374 vì V374 đã chạy trên production (2026-08-06 15:11 UTC);
-- sửa file cũ sẽ làm Flyway báo lệch checksum khi khởi động.

INSERT INTO role_permissions (role_id, permission)
VALUES ('DEVELOPER', 'maintenance.manage')
ON CONFLICT (role_id, permission) DO NOTHING;
