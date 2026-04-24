UPDATE writing_changes
SET operation = 'update'
WHERE operation = 'create'
  AND base_blob_id IS NOT NULL;

UPDATE writing_changes
SET operation = 'create'
WHERE operation = 'update'
  AND base_blob_id IS NULL
  AND proposed_blob_id IS NOT NULL;
