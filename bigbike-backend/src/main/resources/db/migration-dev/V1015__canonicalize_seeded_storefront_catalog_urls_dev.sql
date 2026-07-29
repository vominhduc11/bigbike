-- V1004/V1005 are historical dev seeds that run after production V359.
-- Normalize only the URLs they can reintroduce; do not edit their checksummed SQL.
UPDATE menu_items
SET url = CASE
        WHEN regexp_replace(url, '/+$', '') IN ('/san-pham', '/danh-muc', '/danh-muc-san-pham')
            OR url = '/danh-muc-san-pham.html'
            THEN '/sp/'
        ELSE regexp_replace(url, '^/danh-muc-san-pham/', '/danh-muc/')
    END
WHERE url LIKE '/danh-muc-san-pham%' OR regexp_replace(url, '/+$', '') = '/san-pham';
