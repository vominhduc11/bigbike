-- Extension có thể tạo trước; số liệu chỉ xuất hiện sau khi PostgreSQL được khởi động lại
-- với shared_preload_libraries=pg_stat_statements.
create extension if not exists pg_stat_statements;
