-- V380: automatic review moderation (banned-word list + AI).
-- BUSINESS_RULES.md REVIEW_RULE_012 (lifecycle) and REVIEW_RULE_013 (configuration).
--
-- The five review columns are ANNOTATIONS ONLY. `reviews.status` remains the single
-- source of truth for what is public; these columns just record what the automatic
-- moderator concluded so a human moderator can see why a review moved.
-- Nullable with no backfill: every pre-V380 row keeps NULL, which the admin UI reads
-- as "never checked" — distinct from a row that ran and was skipped.

alter table reviews
    add column moderation_source varchar(16),
    add column moderation_verdict varchar(16),
    add column moderation_categories jsonb,
    add column moderation_reason varchar(500),
    add column moderation_checked_at timestamptz;

alter table reviews
    add constraint ck_reviews_moderation_source
        check (moderation_source is null or moderation_source in ('RULE', 'AI', 'SKIPPED'));

alter table reviews
    add constraint ck_reviews_moderation_verdict
        check (moderation_verdict is null or moderation_verdict in ('CLEAN', 'BLOCKED'));

-- Shop-managed switches. The master switch ships OFF: the moderator stays inert until
-- the deployment also carries GEMINI_API_KEY, so enabling the feature is a two-step
-- decision rather than something a migration turns on behind the owner's back.
-- The AI credential itself is deliberately NOT a row here (REVIEW_RULE_013) — it lives
-- only in the environment and must never reach the database or any admin API.
insert into site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
values
    (gen_random_uuid(), 'review_moderation_enabled', 'false', 'review_moderation', false,
     'Bật kiểm duyệt đánh giá tự động. Cần khai GEMINI_API_KEY ở môi trường trước khi bật.', now(), now()),
    (gen_random_uuid(), 'review_moderation_block_profanity', 'true', 'review_moderation', false,
     'Chặn đánh giá chửi tục, dùng từ thô tục — đưa vào Thùng rác.', now(), now()),
    (gen_random_uuid(), 'review_moderation_block_harassment', 'true', 'review_moderation', false,
     'Chặn đánh giá xúc phạm, công kích cá nhân, kỳ thị — đưa vào Thùng rác.', now(), now()),
    (gen_random_uuid(), 'review_moderation_block_advertising', 'true', 'review_moderation', false,
     'Chặn đánh giá quảng cáo, chèn link, số điện thoại, Zalo, mã giới thiệu — đưa vào Spam.', now(), now()),
    (gen_random_uuid(), 'review_moderation_block_sensitive', 'true', 'review_moderation', false,
     'Chặn nội dung 18+, chính trị, tôn giáo, hoặc rác vô nghĩa không liên quan sản phẩm — đưa vào Thùng rác.', now(), now()),
    (gen_random_uuid(), 'review_moderation_banned_words', '', 'review_moderation', false,
     'Danh sách từ cấm tự quản, ngăn bằng dấu phẩy hoặc xuống dòng. Khớp bỏ dấu, không phân biệt hoa thường, chỉ khớp trọn từ.', now(), now())
on conflict (setting_key) do update
set setting_group = excluded.setting_group,
    is_public = false,
    description = excluded.description,
    updated_at = now();
