-- Bỏ dòng "Đơn vị / chú thích" khỏi khối "Ô số liệu nổi bật" (specStats) — owner quyết định
-- 2026-07-06: admin đã gỡ ô nhập unit, lib/specStatsBlock.js chỉ còn sinh 2 span (value + label).
-- Migration này dọn span đơn vị còn sót trong dữ liệu cũ của spec_stats_html / spec_stats_html_en
-- (products) — khớp đúng style cố định mà bộ mã hoá cũ từng sinh ra
-- (font-size:13px;font-weight:500;line-height:1.2;color:var(--color-muted-foreground,#6b7280)).
-- Không đổi schema (unit chưa bao giờ là cột riêng, chỉ là text lồng trong HTML tự do); idempotent
-- (chỉ đụng row match style trên).
update products
set spec_stats_html = regexp_replace(
  spec_stats_html,
  '<span style="font-size:13px;font-weight:500;line-height:1\.2;color:var\(--color-muted-foreground,#6b7280\)">[^<]*</span>',
  '', 'g'
)
where spec_stats_html like '%font-size:13px;font-weight:500;line-height:1.2%';

update products
set spec_stats_html_en = regexp_replace(
  spec_stats_html_en,
  '<span style="font-size:13px;font-weight:500;line-height:1\.2;color:var\(--color-muted-foreground,#6b7280\)">[^<]*</span>',
  '', 'g'
)
where spec_stats_html_en like '%font-size:13px;font-weight:500;line-height:1.2%';
