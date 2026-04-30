-- V37: Normalize media table
--   1. storage_provider → uppercase (MINIO / LEGACY_WP)
--   2. public_url       → relative path /media/{file_path}
--      Replaces absolute http://localhost:9000/bigbike-media/... URLs so every
--      client resolves the URL through its own rewrite/proxy layer.
--      Idempotent: rows already starting with /media/ are skipped.

update media
set    storage_provider = upper(storage_provider),
       updated_at       = now()
where  storage_provider != upper(storage_provider);

update media
set    public_url  = '/media/' || file_path,
       updated_at  = now()
where  file_path   is not null
  and  file_path   != ''
  and  public_url  not like '/media/%';
