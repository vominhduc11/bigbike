-- V1007: Same normalization as V37 applied to dev seed data.

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
