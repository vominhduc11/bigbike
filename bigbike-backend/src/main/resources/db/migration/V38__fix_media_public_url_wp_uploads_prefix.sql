-- V37 set public_url = '/media/' || file_path, but MinIO stores WP migration files under
-- wp-uploads/{file_path}. The nginx /media/ proxy maps directly to the bucket root, so
-- requests for /media/2026/01/img.jpg resolve to bigbike-media/2026/01/img.jpg (missing).
-- This corrects those records to /media/wp-uploads/{file_path} so the proxy resolves correctly.
UPDATE media
SET    public_url = '/media/wp-uploads/' || file_path,
       updated_at = now()
WHERE  file_path IS NOT NULL
  AND  file_path != ''
  AND  public_url = '/media/' || file_path
  AND  file_path NOT LIKE 'uploads/%'
  AND  file_path NOT LIKE 'wp-uploads/%';
