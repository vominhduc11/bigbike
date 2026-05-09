-- V85: Media folders (flat) + media tags (many-to-many)
--
-- Folders are flat (single level) — each media optionally belongs to one folder.
-- Tags are free-form labels; a media can have many, and the same label can apply
-- to many media. We keep tags lowercased and trimmed at the application layer.

-- Folders ────────────────────────────────────────────────────────────────────
create table media_folders (
    id          uuid primary key default gen_random_uuid(),
    name        varchar(120) not null,
    slug        varchar(160) not null,
    description text,
    created_at  timestamp with time zone not null default now(),
    updated_at  timestamp with time zone not null default now(),
    constraint uq_media_folders_slug unique (slug)
);

create index idx_media_folders_name on media_folders (lower(name));

-- Add folder_id to media (nullable — a media without folder is "uncategorized")
alter table media add column folder_id uuid;
alter table media add constraint fk_media_folder_id
    foreign key (folder_id) references media_folders (id) on delete set null;
create index idx_media_folder_id on media (folder_id);

-- Tags ────────────────────────────────────────────────────────────────────────
-- Stored as a join table so we can filter and aggregate efficiently.
create table media_tags (
    media_id   uuid not null,
    tag        varchar(80) not null,
    created_at timestamp with time zone not null default now(),
    primary key (media_id, tag),
    constraint fk_media_tags_media_id
        foreign key (media_id) references media (id) on delete cascade
);

create index idx_media_tags_tag on media_tags (tag);
