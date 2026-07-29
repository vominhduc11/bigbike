-- CATEGORY_RULE_003: canonical VI category URLs use /danh-muc/{slug}/ and the
-- canonical VI product archive uses /sp/. Historical redirect sources and
-- immutable migration data are intentionally not rewritten wholesale.

CREATE OR REPLACE FUNCTION bigbike_normalize_storefront_catalog_urls(input_text text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    normalized text;
BEGIN
    IF input_text IS NULL OR input_text = '' THEN
        RETURN input_text;
    END IF;

    normalized := input_text;

    -- Known WordPress category aliases whose legacy slug differs from the current category slug.
    normalized := replace(normalized,
        '/vi/danh-muc-san-pham/ao-quan-bao-ho/ao-bao-ho-vai-textile-jackets.html',
        '/danh-muc/ao-bao-ho-vai-textile-jackets-vi/');
    normalized := replace(normalized,
        '/vi/danh-muc-san-pham/mu-bao-hiem/mu-bao-hiem-fullface.html',
        '/danh-muc/mu-bao-hiem-fullface/');
    normalized := replace(normalized,
        '/vi/danh-muc-san-pham/mu-bao-hiem/mu-bao-hiem-3-4.html',
        '/danh-muc/mu-bao-hiem-3-4/');
    normalized := replace(normalized,
        '/vi/danh-muc-san-pham/ao-quan-bao-ho.html',
        '/danh-muc/quan-ao-bao-ho-moto/');
    normalized := replace(normalized,
        '/vi/danh-muc-san-pham/mu-bao-hiem.html',
        '/danh-muc/non-bao-hiem-moto/');
    normalized := replace(normalized,
        '/vi/danh-muc-san-pham/gang-tay.html',
        '/danh-muc/gang-tay/');
    normalized := replace(normalized,
        '/vi/danh-muc-san-pham/giay-bao-ho.html',
        '/danh-muc/giay-bao-ho/');
    normalized := replace(normalized,
        '/vi/danh-muc-san-pham/giap-bao-ho-tay-chan-dai-lung-phu-kien-giap.html',
        '/danh-muc/giap-bao-ho-tay-chan-dai-lung-phu-kien-giap/');

    -- Archive aliases must be handled before the generic category-prefix replacement.
    normalized := replace(normalized, '/danh-muc-san-pham.html', '/sp/');
    normalized := replace(normalized, '/danh-muc-san-pham/', '/danh-muc/');

    RETURN normalized;
END;
$$;

-- Category fields that can be rendered directly on the storefront.
UPDATE categories
SET description = bigbike_normalize_storefront_catalog_urls(description),
    description_en = bigbike_normalize_storefront_catalog_urls(description_en),
    intro_content = bigbike_normalize_storefront_catalog_urls(intro_content),
    intro_content_en = bigbike_normalize_storefront_catalog_urls(intro_content_en),
    seo_canonical_url = bigbike_normalize_storefront_catalog_urls(seo_canonical_url)
WHERE concat_ws(' ', description, description_en, intro_content, intro_content_en, seo_canonical_url)
      LIKE '%danh-muc-san-pham%';

-- Article HTML and its editor representation must stay aligned.
UPDATE articles
SET body = bigbike_normalize_storefront_catalog_urls(body),
    body_en = bigbike_normalize_storefront_catalog_urls(body_en),
    body_blocks = bigbike_normalize_storefront_catalog_urls(body_blocks::text)::jsonb,
    seo_canonical_url = bigbike_normalize_storefront_catalog_urls(seo_canonical_url)
WHERE concat_ws(' ', body, body_en, body_blocks::text, seo_canonical_url)
      LIKE '%danh-muc-san-pham%';

-- Product rich content can contain category links in several independently editable sections.
UPDATE products
SET description = bigbike_normalize_storefront_catalog_urls(description),
    description_en = bigbike_normalize_storefront_catalog_urls(description_en),
    description_blocks = bigbike_normalize_storefront_catalog_urls(description_blocks::text)::jsonb,
    suitability_advisory = bigbike_normalize_storefront_catalog_urls(suitability_advisory),
    suitability_advisory_en = bigbike_normalize_storefront_catalog_urls(suitability_advisory_en),
    suitability_section = bigbike_normalize_storefront_catalog_urls(suitability_section::text)::jsonb,
    size_guide = bigbike_normalize_storefront_catalog_urls(size_guide),
    size_guide_en = bigbike_normalize_storefront_catalog_urls(size_guide_en),
    size_guide_section = bigbike_normalize_storefront_catalog_urls(size_guide_section::text)::jsonb,
    faqs = bigbike_normalize_storefront_catalog_urls(faqs::text)::jsonb,
    commitments = bigbike_normalize_storefront_catalog_urls(commitments::text)::jsonb,
    highlights = bigbike_normalize_storefront_catalog_urls(highlights::text)::jsonb,
    specifications_html = bigbike_normalize_storefront_catalog_urls(specifications_html),
    specifications_html_en = bigbike_normalize_storefront_catalog_urls(specifications_html_en),
    spec_stats_html = bigbike_normalize_storefront_catalog_urls(spec_stats_html),
    spec_stats_html_en = bigbike_normalize_storefront_catalog_urls(spec_stats_html_en),
    trust_badges_html = bigbike_normalize_storefront_catalog_urls(trust_badges_html),
    trust_badges_html_en = bigbike_normalize_storefront_catalog_urls(trust_badges_html_en),
    seo_canonical_url = bigbike_normalize_storefront_catalog_urls(seo_canonical_url)
WHERE concat_ws(
          ' ', description, description_en, description_blocks::text,
          suitability_advisory, suitability_advisory_en, suitability_section::text,
          size_guide, size_guide_en, size_guide_section::text,
          faqs::text, commitments::text, highlights::text,
          specifications_html, specifications_html_en,
          spec_stats_html, spec_stats_html_en,
          trust_badges_html, trust_badges_html_en, seo_canonical_url
      ) LIKE '%danh-muc-san-pham%';

-- One imported product canonical used the removed /san-pham/{slug} detail shape.
UPDATE products
SET seo_canonical_url = regexp_replace(
        seo_canonical_url,
        '^https?://[^/]+/san-pham/([^/?#]+)/?$',
        '/product/\1/'
    )
WHERE seo_canonical_url ~ '^https?://[^/]+/san-pham/[^/?#]+/?$';

UPDATE site_settings
SET setting_value = bigbike_normalize_storefront_catalog_urls(setting_value),
    setting_value_en = bigbike_normalize_storefront_catalog_urls(setting_value_en)
WHERE concat_ws(' ', setting_value, setting_value_en) LIKE '%danh-muc-san-pham%';

UPDATE menu_items
SET url = CASE
        WHEN regexp_replace(url, '/+$', '') IN ('/san-pham', '/danh-muc', '/danh-muc-san-pham')
            OR url = '/danh-muc-san-pham.html'
            THEN '/sp/'
        ELSE bigbike_normalize_storefront_catalog_urls(url)
    END
WHERE url LIKE '%danh-muc-san-pham%' OR regexp_replace(url, '/+$', '') = '/san-pham';

-- Only migrate extensionless, single-segment category slug redirects. Thousands of
-- WordPress product sources under /danh-muc-san-pham/*.html remain immutable inputs.
UPDATE redirects
SET source_pattern = regexp_replace(
        source_pattern,
        '^/danh-muc-san-pham/',
        '/danh-muc/'
    ),
    updated_at = now()
WHERE source_pattern ~ '^/danh-muc-san-pham/[^/.]+/?$'
  AND target_url LIKE '/danh-muc-san-pham/%';

UPDATE redirects
SET target_url = bigbike_normalize_storefront_catalog_urls(target_url),
    updated_at = now()
WHERE target_url LIKE '%danh-muc-san-pham%';

DROP FUNCTION bigbike_normalize_storefront_catalog_urls(text);
