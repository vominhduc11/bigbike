-- MEDIA_RULE_014: nested admin media folders and reviewable organization plans.
-- No media row or object is deleted by this migration. Existing legacy folders are reused.

ALTER TABLE media_folders
    ADD COLUMN IF NOT EXISTS parent_id uuid,
    ADD COLUMN IF NOT EXISTS system_key varchar(120),
    ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'uq_media_folders_system_key'
          AND conrelid = 'media_folders'::regclass
    ) THEN
        ALTER TABLE media_folders
            ADD CONSTRAINT uq_media_folders_system_key UNIQUE (system_key);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_media_folders_parent_id'
          AND conrelid = 'media_folders'::regclass
    ) THEN
        ALTER TABLE media_folders
            ADD CONSTRAINT fk_media_folders_parent_id
            FOREIGN KEY (parent_id) REFERENCES media_folders(id) ON DELETE RESTRICT;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_media_folders_parent_sort
    ON media_folders (parent_id, sort_order, lower(name));

-- Stable root folders. system_key is the identity used by the planner and the admin UI.
INSERT INTO media_folders (name, slug, system_key, sort_order)
VALUES
    ('Sản phẩm', 'san-pham', 'root:products', 10),
    ('Bài viết', 'bai-viet', 'root:articles', 20),
    ('Thương hiệu', 'thuong-hieu', 'root:brands', 30),
    ('Danh mục', 'danh-muc', 'root:categories', 40),
    ('Banner', 'banner', 'root:banners', 50),
    ('Video gốc', 'video-goc', 'root:videos', 60)
ON CONFLICT (system_key) DO UPDATE
SET name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    sort_order = EXCLUDED.sort_order,
    updated_at = now();

-- Reuse the two folders that already contain shop media instead of creating exceptions.
UPDATE media_folders
SET name = 'KEWIG', slug = 'kewig', system_key = 'products:kewig', sort_order = 107,
    parent_id = (SELECT id FROM media_folders WHERE system_key = 'root:products')
WHERE system_key = 'products:kewig'
   OR slug = 'm36-c1s'
   OR name = 'Giá đỡ điện thoại';

UPDATE media_folders
SET name = 'SCS', slug = 'scs', system_key = 'products:scs', sort_order = 106,
    parent_id = (SELECT id FROM media_folders WHERE system_key = 'root:products')
WHERE system_key = 'products:scs'
   OR slug = 's10x'
   OR name = 'SCS';

-- Product brand children. The planner never creates a new brand folder at runtime.
INSERT INTO media_folders (name, slug, system_key, parent_id, sort_order)
SELECT v.name, v.slug, v.system_key,
       (SELECT id FROM media_folders WHERE system_key = 'root:products'), v.sort_order
FROM (VALUES
    ('ILM', 'ilm', 'products:ilm', 101),
    ('TAICHI', 'taichi', 'products:taichi', 102),
    ('LS2', 'ls2', 'products:ls2', 103),
    ('KOMINE', 'komine', 'products:komine', 104),
    ('GIVI', 'givi', 'products:givi', 105),
    ('SCS', 'scs', 'products:scs', 106),
    ('KEWIG', 'kewig', 'products:kewig', 107),
    ('Caberg', 'caberg', 'products:caberg', 108),
    ('NIC', 'nic', 'products:nic', 109),
    ('HEVIK', 'hevik', 'products:hevik', 110),
    ('SPYKE', 'spyke', 'products:spyke', 111),
    ('XPEED', 'xpeed', 'products:xpeed', 112),
    ('ROK Straps', 'rok-straps', 'products:rok-straps', 113),
    ('BIGBIKE', 'bigbike', 'products:bigbike', 114),
    ('AGV', 'agv', 'products:agv', 115),
    ('SPIRIT MOTO', 'spirit-moto', 'products:spirit-moto', 116),
    ('SIXS', 'sixs', 'products:sixs', 117),
    ('QUADLOCK', 'quadlock', 'products:quadlock', 118),
    ('DAINESE', 'dainese', 'products:dainese', 119),
    ('Chưa rõ hãng', 'chua-ro-hang', 'products:unknown', 120)
) AS v(name, slug, system_key, sort_order)
ON CONFLICT (system_key) DO UPDATE
SET name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    parent_id = EXCLUDED.parent_id,
    sort_order = EXCLUDED.sort_order,
    updated_at = now();

-- Article year children.
INSERT INTO media_folders (name, slug, system_key, parent_id, sort_order)
SELECT v.name, v.slug, v.system_key,
       (SELECT id FROM media_folders WHERE system_key = 'root:articles'), v.sort_order
FROM (VALUES
    ('2020', '2020', 'articles:2020', 201),
    ('2021', '2021', 'articles:2021', 202),
    ('2022', '2022', 'articles:2022', 203),
    ('2023', '2023', 'articles:2023', 204),
    ('2024', '2024', 'articles:2024', 205),
    ('2025', '2025', 'articles:2025', 206),
    ('2026', '2026', 'articles:2026', 207)
) AS v(name, slug, system_key, sort_order)
ON CONFLICT (system_key) DO UPDATE
SET name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    parent_id = EXCLUDED.parent_id,
    sort_order = EXCLUDED.sort_order,
    updated_at = now();

CREATE TABLE media_organization_runs (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    state               varchar(20) NOT NULL,
    plan_hash           varchar(128) NOT NULL,
    source_snapshot     text NOT NULL,
    actor_id            uuid,
    previewed_at        timestamptz NOT NULL DEFAULT now(),
    applied_at          timestamptz,
    undone_at           timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ck_media_organization_run_state
        CHECK (state IN ('PREVIEWED', 'APPLIED', 'UNDONE'))
);

CREATE INDEX idx_media_organization_runs_created_at
    ON media_organization_runs (created_at DESC, id DESC);

CREATE TABLE media_organization_items (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id                uuid NOT NULL,
    media_id              uuid NOT NULL,
    original_filename     text,
    mime_type             varchar(127),
    old_folder_id         uuid,
    new_folder_id         uuid,
    old_title             text,
    new_title             text,
    old_alt_text          text,
    new_alt_text          text,
    action                varchar(40) NOT NULL,
    reason                text NOT NULL,
    expected_updated_at   timestamptz NOT NULL,
    created_at            timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_media_organization_items_run
        FOREIGN KEY (run_id) REFERENCES media_organization_runs(id) ON DELETE CASCADE,
    CONSTRAINT fk_media_organization_items_old_folder
        FOREIGN KEY (old_folder_id) REFERENCES media_folders(id) ON DELETE SET NULL,
    CONSTRAINT fk_media_organization_items_new_folder
        FOREIGN KEY (new_folder_id) REFERENCES media_folders(id) ON DELETE SET NULL,
    CONSTRAINT uq_media_organization_items_run_media UNIQUE (run_id, media_id)
);

CREATE INDEX idx_media_organization_items_run_action
    ON media_organization_items (run_id, action, new_folder_id);

CREATE INDEX idx_media_organization_items_media
    ON media_organization_items (media_id);
