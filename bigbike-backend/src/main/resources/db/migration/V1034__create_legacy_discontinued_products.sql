-- Owner decision 2026-08-15: historical product URLs are operated in Admin,
-- never by a hard-coded storefront registry. They intentionally have no price,
-- stock, SKU, publish status or checkout data.
CREATE TABLE legacy_discontinued_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    name_en VARCHAR(255),
    brand_name VARCHAR(255),
    category_slug VARCHAR(255) NOT NULL,
    image_url VARCHAR(2048),
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_legacy_discontinued_products_slug UNIQUE (slug),
    CONSTRAINT ck_legacy_discontinued_products_slug
        CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

CREATE INDEX ix_legacy_discontinued_products_enabled_updated
    ON legacy_discontinued_products (enabled, updated_at DESC);

-- Carry every reviewed static history page forward without overwriting a later
-- administrator edit on a database where this data was backfilled manually.
INSERT INTO legacy_discontinued_products
    (slug, name, name_en, brand_name, category_slug, image_url, enabled)
VALUES
    ('balo-moto-phuot-kriega-r15', 'Ba lô moto phượt Kriega R15', 'Ba lô moto phượt Kriega R15', 'Kriega', 'balo-phuot-balo-moto', '/media/wp-uploads/2026/01/balo-moto-phuot-Kriega-R20.jpg', true),
    ('balo-moto-phuot-kriega-r20', 'Ba lô moto phượt Kriega R20', 'Ba lô moto phượt Kriega R20', 'Kriega', 'balo-phuot-balo-moto', '/media/wp-uploads/2026/01/balo-moto-phuot-Kriega-R20.jpg', true),
    ('balo-moto-phuot-kriega-r25', 'Ba lô moto phượt Kriega R25', 'Ba lô moto phượt Kriega R25', 'Kriega', 'balo-phuot-balo-moto', '/media/wp-uploads/2026/01/balo-moto-phuot-Kriega-R20.jpg', true),
    ('balo-moto-phuot-kriega-r30', 'Ba lô moto phượt Kriega R30', 'Ba lô moto phượt Kriega R30', 'Kriega', 'balo-phuot-balo-moto', '/media/wp-uploads/2026/01/balo-moto-phuot-Kriega-R20.jpg', true),
    ('balo-moto-phuot-kriega-trail-18-adventure', 'Ba lô moto phượt Kriega Trail 18 Adventure', 'Ba lô moto phượt Kriega Trail 18 Adventure', 'Kriega', 'balo-phuot-balo-moto', '/media/wp-uploads/2026/01/balo-moto-phuot-Kriega-R20.jpg', true),
    ('balo-moto-phuot-kriega-trail-9-adventure', 'Ba lô moto phượt Kriega Trail 9 Adventure', 'Ba lô moto phượt Kriega Trail 9 Adventure', 'Kriega', 'balo-phuot-balo-moto', '/media/wp-uploads/2026/01/balo-moto-phuot-Kriega-R20.jpg', true),
    ('tui-chong-nuoc-kriega-us-10-drypack', 'Túi chống nước Kriega US-10 Drypack', 'Túi chống nước Kriega US-10 Drypack', 'Kriega', 'balo-tui-deo-tui-treo-xe', '/media/wp-uploads/2026/01/balo-moto-phuot-Kriega-R20.jpg', true),
    ('tui-chong-nuoc-kriega-us-15-drypack', 'Túi chống nước Kriega US-15 Drypack', 'Túi chống nước Kriega US-15 Drypack', 'Kriega', 'balo-tui-deo-tui-treo-xe', '/media/wp-uploads/2026/01/balo-moto-phuot-Kriega-R20.jpg', true),
    ('tui-chong-nuoc-kriega-us-20-drypack', 'Túi chống nước Kriega US-20 Drypack', 'Kriega US-20 Drypack', 'Kriega', 'balo-tui-deo-tui-treo-xe', '/media/wp-uploads/2026/01/balo-moto-phuot-Kriega-R20.jpg', true),
    ('tui-chong-nuoc-kriega-us-30-drypack', 'Túi chống nước Kriega US-30 Drypack', 'Kriega US-30 Drypack', 'Kriega', 'balo-tui-deo-tui-treo-xe', '/media/wp-uploads/2026/01/balo-moto-phuot-Kriega-R20.jpg', true),
    ('mu-bao-hiem-3-4-smk-retro-jet-rebel', 'Mũ bảo hiểm 3/4 SMK Retro Jet Rebel', 'SMK Retro Jet Rebel open-face helmet', 'SMK', 'mu-bao-hiem-fullface', NULL, true),
    ('mu-bao-hiem-fullface-smk-retro-ranko-ma626-ece-22-05-06-dot', 'Mũ bảo hiểm fullface SMK Retro Ranko', 'SMK Retro Ranko full-face helmet', 'SMK', 'mu-bao-hiem-fullface', NULL, true),
    ('boi-tron-bao-duong-sen-chain-lube-special-will-f1', 'Dung dịch bôi trơn sên Chain Lube Special Will F1', 'Chain Lube Special Will F1', 'Special Will', 'phu-kien-moto-khac', NULL, true),
    ('chai-xit-sen-arrow-chain-lube', 'Chai xịt sên Arrow Chain Lube', 'Arrow Chain Lube spray', 'Arrow', 'phu-kien-moto-khac', NULL, true),
    ('duong-sen-cao-cap-liqui-moly', 'Dưỡng sên cao cấp Liqui Moly', 'Liqui Moly premium chain care', 'Liqui Moly', 'phu-kien-moto-khac', NULL, true),
    ('giay-forma-adventure-low-dry', 'Giày Forma Adventure Low Dry', 'Forma Adventure Low Dry boots', 'Forma', 'giay-bao-ho-moto-phuot', '/media/wp-uploads/2022/11/giay-bao-ho-moto-xe-may-phuot-tuoring-adv-forma-adventure-low-dry-01.jpg', true),
    ('giay-forma-adventure-dry', 'Giày Forma Adventure Dry', 'Forma Adventure Dry boots', 'Forma', 'giay-bao-ho-moto-phuot', '/media/wp-uploads/2022/11/giay-bao-ho-mo-to-forma-adventure-dry-boots.jpg', true),
    ('giay-forma-elite-dry', 'Giày Forma Elite Dry', 'Forma Elite Dry boots', 'Forma', 'giay-bao-ho-moto-phuot', '/media/wp-uploads/2022/11/giay-bao-ho-mo-to-forma-adventure-dry-boots.jpg', true),
    ('giay-bao-ho-moto-xe-may-phuot-forma-ground-dry-chong-tham-nuoc', 'Giày bảo hộ moto Forma Ground Dry chống thấm nước', 'Forma Ground Dry waterproof riding boots', 'Forma', 'giay-bao-ho-moto-phuot', '/media/wp-uploads/2022/11/giay-bao-ho-mo-to-forma-adventure-dry-boots.jpg', true),
    ('giay-da-moto-xe-may-phuot-urban-city-forma-ground-flow-chong-tham-nuoc', 'Giày da moto Forma Ground Flow', 'Forma Ground Flow riding boots', 'Forma', 'giay-bao-ho-moto-phuot', '/media/wp-uploads/2022/11/giay-bao-ho-mo-to-forma-adventure-dry-boots.jpg', true),
    ('phu-kien-kinh-thay-hang-ls2', 'Phụ kiện kính thay hãng LS2', 'LS2 replacement visor accessory', 'LS2', 'phu-kien-moto-khac', '/media/wp-uploads/2023/12/pinlock-la-gi.jpg', true),
    ('gang-tay-moto-phuot-alpinestars-smx1-air-v2', 'Găng tay moto Alpinestars SMX-1 Air V2', 'Alpinestars SMX-1 Air V2 riding gloves', 'Alpinestars', 'gang-tay-xe-may-moto', '/media/wp-uploads/2020/06/alpinestars_glove_smx1_air_black_yellow_zoom.jpg', true),
    ('ao-bao-ho-scoyco-jk152', 'Áo bảo hộ Scoyco JK152', 'Scoyco JK152 riding jacket', 'Scoyco', 'ao-quan-bao-ho', '/media/wp-uploads/2026/05/ao-giap-nu-scoyco-jk152w.jpg', true),
    ('ao-furygan-leo', 'Áo bảo hộ Furygan Leo', 'Furygan Leo riding jacket', 'Furygan', 'ao-quan-bao-ho', NULL, true),
    ('gang-tay-bao-ho-xe-may-ls2-vega-man', 'Găng tay bảo hộ xe máy LS2 Vega Man', 'LS2 Vega Man motorcycle gloves', 'LS2', 'gang-tay-xe-may-moto', NULL, true),
    ('gang-tay-moto-phuot-ls2-spark-man', 'Găng tay moto phượt LS2 Spark Man', 'LS2 Spark Man motorcycle riding gloves', 'LS2', 'gang-tay-xe-may-moto', NULL, true),
    ('mu-bao-hiem-3-4-cacbon-nic-n03', 'Mũ bảo hiểm 3/4 carbon NIC N03', 'NIC N03 carbon open-face helmet', 'NIC', 'mu-bao-hiem-3-4', NULL, true),
    ('quan-giap-bao-ho-moto-dririder-nordic-2', 'Quần giáp bảo hộ moto Dririder Nordic 2', 'Dririder Nordic 2 motorcycle riding pants', 'Dririder', 'ao-quan-moto-adventure', NULL, true),
    ('vi-kriega-stash-wallet', 'Ví Kriega Stash Wallet', 'Kriega Stash Wallet', 'Kriega', 'tui-deo-hong-tui-deo-dui', NULL, true),
    ('mu-fullface-ls2-ff807-dragon-carbon-6k-2-kinh', 'Mũ fullface LS2 FF807 Dragon Carbon 6K 2 kính', 'LS2 FF807 Dragon Carbon 6K dual-visor full-face helmet', 'LS2', 'mu-bao-hiem-fullface', NULL, true),
    ('mu-bao-hiem-ls2-ff327-challenger-carbon-fold', 'Mũ bảo hiểm LS2 FF327 Challenger Carbon Fold', 'LS2 FF327 Challenger Carbon Fold helmet', 'LS2', 'mu-bao-hiem-fullface', NULL, true),
    ('giap-nguc-roi-rs-taichi-trv079', 'Giáp ngực rời RS Taichi TRV079', 'RS Taichi TRV079 detachable chest protector', 'RS Taichi', 'giap-bao-ho-tay-chan', NULL, true),
    ('tui-duoi-xe-chong-nuoc-tornado-2-pack-sack', 'Túi đuôi xe chống nước Tornado 2 Pack Sack', 'Tornado 2 Pack Sack waterproof tail bag', 'Tornado', 'balo-tui-deo-tui-treo-xe', NULL, true),
    ('ao-giap-scoyco-jk53-jean', 'Áo giáp Scoyco JK53 Jean', 'Scoyco JK53 Jean riding jacket', 'Scoyco', 'ao-quan-bao-ho', NULL, true),
    ('ao-thun-moto-thoi-trang', 'Áo thun moto thời trang', 'Motorcycle fashion T-shirt', NULL, 'ao-quan-bao-ho', NULL, true),
    ('pat-chan-guong-osopro', 'Pát chân gương Osopro', 'Osopro mirror bracket', 'Osopro', 'gia-do-dien-thoai-xe-may', NULL, true),
    -- The 22 high-impression URLs reviewed on 2026-08-15. A NULL image is
    -- intentional when no exact source image was verified; Admin can add one later.
    ('giay-bao-ho-forma-legacy-dry', 'Giày bảo hộ Forma Legacy Dry', 'Forma Legacy Dry riding boots', 'Forma', 'giay-bao-ho-moto-phuot', NULL, true),
    ('quan-giap-bao-ho-furygan-duke-bukser', 'Quần giáp bảo hộ Furygan Duke Bukser', 'Furygan Duke riding pants', 'Furygan', 'ao-quan-bao-ho', NULL, true),
    ('ao-bao-ho-moto-oneal-underdog-protector-jacket-v-24-black', 'Áo bảo hộ moto O''Neal Underdog Protector Jacket V.24', 'O''Neal Underdog Protector Jacket V.24', 'O''Neal', 'ao-quan-bao-ho', NULL, true),
    ('giap-chan-komine-sk690', 'Giáp chân Komine SK690', 'Komine SK690 leg protectors', 'Komine', 'giap-bao-ho-tay-chan', '/media/migration/wordpress/1a/1aa5d72f0c3a28831f6b6bb02d37e445bbec902184669db5ea0967eb2f12bc8b/61S-lfIiEBS._AC_SX679_.jpg', true),
    ('quan-bao-ho-ls2-norway', 'Quần bảo hộ LS2 Norway', 'LS2 Norway riding pants', 'LS2', 'ao-quan-bao-ho', NULL, true),
    ('ao-bao-ho-skype-paris', 'Áo bảo hộ Skype Paris', 'Skype Paris riding jacket', 'Skype', 'ao-quan-bao-ho', NULL, true),
    ('quan-giap-jean-scoyco-p066', 'Quần giáp jean Scoyco P066', 'Scoyco P066 riding jeans', 'Scoyco', 'ao-quan-bao-ho', NULL, true),
    ('giay-bao-ho-chong-nuoc-komine-bk-067', 'Giày bảo hộ chống nước Komine BK-067', 'Komine BK-067 waterproof riding boots', 'Komine', 'giay-bao-ho-moto-phuot', NULL, true),
    ('giap-goi-ls2-rookie', 'Giáp gối LS2 Rookie', 'LS2 Rookie knee protectors', 'LS2', 'giap-bao-ho-tay-chan', NULL, true),
    ('ong-tay-chong-nang-ls2', 'Ống tay chống nắng LS2', 'LS2 sun sleeves', 'LS2', 'phu-kien-do-lot-do-mua-moto', NULL, true),
    ('ao-bao-ho-nu-scoyco-jk158w', 'Áo bảo hộ nữ Scoyco JK158W', 'Scoyco JK158W women''s riding jacket', 'Scoyco', 'ao-quan-bao-ho', NULL, true),
    ('ao-bao-ho-touring-rjays', 'Áo bảo hộ touring Rjays', 'Rjays touring jacket', 'Rjays', 'ao-quan-bao-ho', NULL, true),
    ('gang-tay-mo-to-ilm-thoang-khi-cho-nam-va-nu-jc36', 'Găng tay mô tô ILM thoáng khí JC36', 'ILM JC36 ventilated motorcycle gloves', 'ILM', 'gang-tay-xe-may-moto', NULL, true),
    ('ao-mua-bo-danh-cho-suit-da-1-2-manh-furygan', 'Áo mưa bộ dành cho suit da Furygan', 'Furygan rain suit for leather gear', 'Furygan', 'phu-kien-do-lot-do-mua-moto', NULL, true),
    ('quan-lot-mac-trong-giap-sixs-super-light-italy', 'Quần lót mặc trong giáp Sixs Super Light Italy', 'Sixs Super Light base-layer pants', 'Sixs', 'phu-kien-do-lot-do-mua-moto', NULL, true),
    ('gang-tay-ls2-swift-racing', 'Găng tay LS2 Swift Racing', 'LS2 Swift Racing gloves', 'LS2', 'gang-tay-xe-may-moto', NULL, true),
    ('ba-lo-xo-taichi-rsb290-wp-bucket-backpack-chong-nuoc', 'Ba lô xe Taichi RSB290 WP Bucket Backpack chống nước', 'Taichi RSB290 WP Bucket Backpack', 'RS Taichi', 'balo-tui-deo-tui-treo-xe', NULL, true),
    ('mu-bao-hiem-3-4-hjc-i40n-chuan-ece-06-2', 'Mũ bảo hiểm 3/4 HJC I40N chuẩn ECE 06', 'HJC I40N open-face helmet', 'HJC', 'mu-bao-hiem-3-4', NULL, true),
    ('ao-quan-giap-bao-ho-ls2-apollo-man', 'Áo quần giáp bảo hộ LS2 Apollo Man', 'LS2 Apollo Man protective apparel', 'LS2', 'ao-quan-bao-ho', NULL, true),
    ('gang-tay-bao-ho-komine-gk-1683', 'Găng tay bảo hộ Komine GK-1683', 'Komine GK-1683 protective gloves', 'Komine', 'gang-tay-xe-may-moto', NULL, true),
    ('quan-bao-ho-cho-nu-ls2-router', 'Quần bảo hộ cho nữ LS2 Router', 'LS2 Router women''s riding pants', 'LS2', 'ao-quan-bao-ho', NULL, true),
    ('quan-bao-ho-ls2-commo-air-cho-nam-va-nu', 'Quần bảo hộ LS2 Commo Air cho nam và nữ', 'LS2 Commo Air riding pants', 'LS2', 'ao-quan-bao-ho', NULL, true)
ON CONFLICT (slug) DO NOTHING;
