-- V285: Update Privacy Policy slug from 'chinh-sach-bao-ve-thong-tin-ca-nhan' to 'chinh-sach-bao-mat-thong-tin'
-- To keep only a single short, clean URL as requested by the owner.
-- NOTE: bảng `pages` đã bị DROP ở V271 — chỉ update menu_items.

UPDATE menu_items
SET url = '/chinh-sach/chinh-sach-bao-mat-thong-tin'
WHERE url = '/chinh-sach/chinh-sach-bao-ve-thong-tin-ca-nhan';
