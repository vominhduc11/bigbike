-- REVIEW_RULE_008 (owner decision 2026-07-22): cho phép khách chọn nửa sao khi đánh giá.
-- reviews.rating chuyển từ smallint (nguyên 1..5, V14) sang numeric(2,1) bước 0,5
-- (10 mức: 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5). Dữ liệu cũ (luôn nguyên) tự nới scale, không cần backfill.

alter table reviews
    alter column rating type numeric(2, 1) using rating::numeric(2, 1);

alter table reviews
    drop constraint ck_reviews_rating;

alter table reviews
    add constraint ck_reviews_rating check (
        rating in (1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5)
    );
