-- Admin-managed layout for the public contact page (/lien-he).
-- Single-row table; the builder replaces the whole `blocks` array on save.
-- Channel/address/map/hours blocks bind to existing site_settings keys (single source of truth
-- shared with header/footer); custom channels and rich-text carry their own value in the JSON.
-- The seed reproduces the current hand-coded layout so the page is unchanged until an admin edits it.

CREATE TABLE IF NOT EXISTS contact_page_layout (
    id         uuid PRIMARY KEY,
    blocks     jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO contact_page_layout (id, blocks, updated_at)
VALUES (
    '00000000-0000-0000-0000-0000000000c0',
    '[
      {"id":"map","type":"map","enabled":true,"sortOrder":0,"column":"main","icon":"","labelVi":"","labelEn":"","bindKey":"contact_address","value":null,"href":null,"htmlVi":null,"htmlEn":null},
      {"id":"hotline","type":"channel","enabled":true,"sortOrder":1,"column":"main","icon":"/wp-content/themes/bigbike/images/contact-call-icon.png","labelVi":"Liên hệ với chúng tôi","labelEn":"Contact us","bindKey":"hotline","value":null,"href":null,"htmlVi":null,"htmlEn":null},
      {"id":"hotline2","type":"channel","enabled":true,"sortOrder":2,"column":"main","icon":"/wp-content/themes/bigbike/images/contact-call-icon.png","labelVi":"Hotline","labelEn":"Hotline","bindKey":"hotline_2","value":null,"href":null,"htmlVi":null,"htmlEn":null},
      {"id":"address","type":"address","enabled":true,"sortOrder":3,"column":"main","icon":"/wp-content/themes/bigbike/images/contact-marker-icon.png","labelVi":"Cửa hàng","labelEn":"Store","bindKey":"contact_address","value":null,"href":null,"htmlVi":null,"htmlEn":null},
      {"id":"hours","type":"hours","enabled":true,"sortOrder":4,"column":"main","icon":"/wp-content/themes/bigbike/images/contact-calendar-icon.png","labelVi":"Giờ làm việc","labelEn":"Opening hours","bindKey":null,"value":null,"href":null,"htmlVi":null,"htmlEn":null},
      {"id":"zalo","type":"channel","enabled":true,"sortOrder":5,"column":"online","icon":"","labelVi":"Zalo","labelEn":"Zalo","bindKey":"zalo_url","value":null,"href":null,"htmlVi":null,"htmlEn":null},
      {"id":"facebook","type":"channel","enabled":true,"sortOrder":6,"column":"online","icon":"","labelVi":"Facebook","labelEn":"Facebook","bindKey":"facebook_url","value":null,"href":null,"htmlVi":null,"htmlEn":null},
      {"id":"online_hotline","type":"channel","enabled":true,"sortOrder":7,"column":"online","icon":"","labelVi":"Hotline","labelEn":"Hotline","bindKey":"hotline","value":null,"href":null,"htmlVi":null,"htmlEn":null}
    ]'::jsonb,
    now()
)
ON CONFLICT (id) DO NOTHING;
