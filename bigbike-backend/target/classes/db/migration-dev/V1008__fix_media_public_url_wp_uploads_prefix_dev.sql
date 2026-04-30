-- Same fix as V38 applied to dev seed data.
UPDATE media
SET    public_url = '/media/wp-uploads/' || file_path,
       updated_at = now()
WHERE  file_path IS NOT NULL
  AND  file_path != ''
  AND  public_url = '/media/' || file_path
  AND  file_path NOT LIKE 'uploads/%'
  AND  file_path NOT LIKE 'wp-uploads/%';
