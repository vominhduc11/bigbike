-- V381: daily ceiling on paid AI moderation calls (REVIEW_RULE_013).
--
-- Why a separate migration rather than editing V380: V380 has already been applied to
-- production. Editing an applied migration changes its checksum and takes the whole stack
-- down on the next deploy — that exact failure happened on 2026-08-07. Applied migrations
-- are append-only.
--
-- The public review endpoint is rate limited at 5 submissions/minute PER IP, which bounds
-- one attacker to ~7,200 submissions a day and bounds a distributed one not at all. That
-- is a spend risk on a prepaid credit balance, so the moderator gets its own hard ceiling:
-- past the limit it stops calling out and reviews simply stay in Pending for a human,
-- the same fail-safe every other error path uses. The banned-word layer keeps running
-- because it costs nothing.

insert into site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
values
    (gen_random_uuid(), 'review_moderation_daily_limit', '200', 'review_moderation', false,
     'Số lượt gọi AI tối đa mỗi ngày (giờ Việt Nam). Vượt ngưỡng thì ngừng gọi AI, đánh giá nằm ở Chờ duyệt; danh sách từ cấm vẫn chạy vì không tốn phí. Đặt 0 để tắt hẳn phần gọi AI.', now(), now())
on conflict (setting_key) do update
set setting_group = excluded.setting_group,
    is_public = false,
    description = excluded.description,
    updated_at = now();
