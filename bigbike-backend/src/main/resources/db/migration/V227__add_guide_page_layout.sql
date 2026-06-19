-- Admin-managed layout for the public guide landing page (/huong-dan).
-- Single-row table; the builder replaces the whole `entries` array on save.
-- Each entry is a card on the landing grid pointing (via page_slug) at a CMS page that holds the
-- detail body (managed in Content -> Pages). The seed reproduces the current hard-coded grid so the
-- page is unchanged until an admin edits it. Hero image is null -> web falls back to its theme asset.

CREATE TABLE IF NOT EXISTS guide_page_layout (
    id             uuid PRIMARY KEY,
    hero_title_vi  text,
    hero_title_en  text,
    hero_image_url text,
    entries        jsonb NOT NULL,
    updated_at     timestamptz NOT NULL DEFAULT now()
);

INSERT INTO guide_page_layout (id, hero_title_vi, hero_title_en, hero_image_url, entries, updated_at)
VALUES (
    '00000000-0000-0000-0000-0000000000d0',
    'Hướng dẫn mua hàng & sản phẩm',
    'Buying and product guides',
    NULL,
    '[
      {"id":"mua-hang","enabled":true,"sortOrder":0,"pathSegment":"mua-hang","pageSlug":"huong-dan-mua-hang","icon":"ShoppingCart","titleVi":"Hướng dẫn mua hàng","titleEn":"How to buy","descriptionVi":"Hướng dẫn đặt hàng, thanh toán và nhận hàng tại BigBike.","descriptionEn":"Guide to ordering, payment and delivery at BigBike."},
      {"id":"size-mu","enabled":true,"sortOrder":1,"pathSegment":"size-mu","pageSlug":"cach-do-size-dau","icon":"HardHat","titleVi":"Cách xác định size mũ bảo hiểm","titleEn":"How to choose helmet size","descriptionVi":"Hướng dẫn đo chu vi đầu và chọn size mũ bảo hiểm phù hợp.","descriptionEn":"How to measure head circumference and choose the right helmet size."},
      {"id":"size-gang-tay","enabled":true,"sortOrder":2,"pathSegment":"size-gang-tay","pageSlug":"cach-do-size-gang-tay","icon":"Hand","titleVi":"Cách đo size găng tay bảo hộ","titleEn":"How to choose glove size","descriptionVi":"Hướng dẫn đo bàn tay và chọn size găng tay bảo hộ moto.","descriptionEn":"How to measure your hand and choose motorcycle protective glove size."}
    ]'::jsonb,
    now()
)
ON CONFLICT (id) DO NOTHING;
