-- Sửa lệch kiểu cột giữa CSDL và mã nguồn (Hibernate schema validation).
-- V1057/V1061 tạo các cột mã băm bằng char(n) (kiểu độ dài cố định, tự đệm khoảng trắng),
-- trong khi entity khai String + length => Hibernate mong đợi varchar(n) và chặn khởi động.
-- Không sửa V1057/V1061 vì hai bản đó đã chạy trên máy chủ thật (đổi file sẽ lệch checksum Flyway).

alter table chat_visitors
    alter column token_hash type varchar(64);

alter table chat_evaluation_runs
    alter column dataset_checksum type varchar(64);

alter table chat_images
    alter column sha256 type varchar(64);

alter table chat_product_image_fingerprints
    alter column source_version_hash type varchar(64);

alter table chat_product_image_fingerprints
    alter column dhash_hex type varchar(16);
