# V1095 — prepared operator runbook, not executed on shop data

Basis: `BUSINESS_RULES.md` ARTICLE_RULE_001/007/010/011,
`API_CONTRACT.md` Audit Log Contract and `DEPLOYMENT_GUIDE.md` forward V1095 section.
Historical V1091 remains unchanged. This repair removes only retired property names
from valid JSON of article audit rows. It does not restore already-removed columns.

## Before any approved deployment

1. Run `docker ps` and confirm the intended backend/database and Flyway history.
   Do not change any running service or apply V1095 under the performance task.
2. Reserve a private backup directory outside the checkout and CI artifacts with
   owner-only permissions (`umask 077`). Ensure enough space and test restoration on
   an isolated database. Audit snapshots may contain personal data and must never
   be printed or uploaded as evidence.
3. With PostgreSQL 16 `psql`, record counts only:

```sql
SELECT count(*) AS eligible_rows,
       count(*) FILTER (WHERE before_data IS NOT NULL
           AND NOT pg_input_is_valid(before_data, 'jsonb')) AS invalid_before,
       count(*) FILTER (WHERE after_data IS NOT NULL
           AND NOT pg_input_is_valid(after_data, 'jsonb')) AS invalid_after
FROM audit_logs
WHERE resource_type = 'CONTENT' AND starts_with(action, 'CONTENT_ARTICLE_');
```

Invalid/unrepresentable snapshots require operator review. V1095 preserves malformed
JSON; it does not use a text replacement that could damage retained content.
4. Capture eligible snapshots privately, using the intended connection and a private
   local path in `psql` (the following is a template, not an execution instruction):

```sql
\copy (SELECT id, before_data, after_data FROM audit_logs WHERE resource_type = 'CONTENT' AND starts_with(action, 'CONTENT_ARTICLE_') ORDER BY id) TO '/private-approved-directory/article-audit-before.csv' WITH (FORMAT csv, HEADER true)
```

5. Apply the approved build/migration only in the approved window. Monitor transaction
   locks, duration and failures. The migration is transactional and writes only rows
   whose parsed JSON changes. Test coverage proves transaction rollback and repeat
   invocation safety; it does not measure duration on the shop's audit volume.
6. Capture after-values for the exact backed-up IDs, not newly-created audit events:

```sql
CREATE TEMP TABLE article_audit_before (id uuid PRIMARY KEY, before_data text, after_data text);
\copy article_audit_before FROM '/private-approved-directory/article-audit-before.csv' WITH (FORMAT csv, HEADER true)
\copy (SELECT a.id, a.before_data, a.after_data FROM audit_logs a JOIN article_audit_before b USING (id) ORDER BY a.id) TO '/private-approved-directory/article-audit-after.csv' WITH (FORMAT csv, HEADER true)
```

Keep checksums and row counts for both protected files. Confirm all expected IDs are
present and that unrelated audit modules and article content are unchanged.

## Emergency data rollback, separately approved

An image rollback cannot restore removed JSON properties. Never edit the Flyway
history or V1091/V1095 to pretend the data migration did not run. Use the protected
before and after files on an isolated restoration rehearsal first. The following
transaction is deliberately a dry run ending in `ROLLBACK`; only an operator with
separate approval may commit a verified restoration:

```sql
BEGIN;
CREATE TEMP TABLE article_audit_before (id uuid PRIMARY KEY, before_data text, after_data text);
CREATE TEMP TABLE article_audit_after (id uuid PRIMARY KEY, before_data text, after_data text);
\copy article_audit_before FROM '/private-approved-directory/article-audit-before.csv' WITH (FORMAT csv, HEADER true)
\copy article_audit_after FROM '/private-approved-directory/article-audit-after.csv' WITH (FORMAT csv, HEADER true)

-- Count changed rows in the protected backup pair; stop if IDs differ/missing.
SELECT count(*) AS changed_snapshots
FROM article_audit_before b JOIN article_audit_after p USING (id)
WHERE ROW(b.before_data, b.after_data) IS DISTINCT FROM ROW(p.before_data, p.after_data);

-- Compare-and-swap: never overwrite a snapshot changed after the migration.
UPDATE audit_logs a
SET before_data = b.before_data, after_data = b.after_data
FROM article_audit_before b JOIN article_audit_after p USING (id)
WHERE a.id = b.id
  AND a.resource_type = 'CONTENT' AND starts_with(a.action, 'CONTENT_ARTICLE_')
  AND ROW(a.before_data, a.after_data) IS NOT DISTINCT FROM ROW(p.before_data, p.after_data)
  AND ROW(b.before_data, b.after_data) IS DISTINCT FROM ROW(p.before_data, p.after_data);

-- Updated count must equal changed_snapshots. Any mismatch requires investigation.
ROLLBACK;
```

Record only aggregate counts/status in the public report. Retain or expire protected
backups under existing access and retention procedures; do not silently delete them.
