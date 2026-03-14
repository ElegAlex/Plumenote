UPDATE documents d
SET folder_id = (
  SELECT f.id FROM folders f
  WHERE f.domain_id = d.domain_id AND f.parent_id IS NULL
  ORDER BY f.position LIMIT 1
)
WHERE d.folder_id IS NULL;

ALTER TABLE documents ALTER COLUMN folder_id SET NOT NULL;
