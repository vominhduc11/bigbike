-- Home video bilingual title (V161). Vietnamese `title` stays canonical; the
-- optional English title is stored in a nullable `title_en` column on the same
-- row. Public reads resolve via COALESCE(title_en, title) — falls back to
-- Vietnamese when blank. Mirrors V160 (menu label) / V136 (product bilingual).
alter table home_videos
    add column title_en varchar(255);
