# BigBike WordPress live migration runbook

> **HISTORICAL RECORD — the tooling described here no longer exists (removed 2026-08-18).**
> The WordPress → BigBike cutover completed in 2026-06. The whole `migration/wordpress/**` package —
> `LiveMigrationPreflightCli`, `LiveMigrationExecutionCli`, every `Live*` planner, the Spring import/dry-run
> runners, `MediaCopyRunner`, and the `bigbike.migration.wordpress.*` configuration — was deleted from the
> repository during a codebase cleanup. This document is retained only to record what the one-time migration
> was authorized to do. Do not treat any command or class name below as runnable. Recover from git history
> (before 2026-08-18) if the migration ever needs to be re-run.

This is the production contract for the one-time WordPress → BigBike migration. It implements the owner-approved safety rules in `bigbike-live-migration-prompt.md`; it does not authorize a cutover by itself.

## Allowed data and precedence

- Write only products, variants/options, directly referenced media, articles/tags, product-category links to categories that already exist, and reviewed redirects.
- Never write customers, orders, admin users, sessions, OAuth identities, SMTP settings, tracking IDs, or unrelated WordPress data.
- Existing target data wins. A matched target row may receive only a directly mapped field that is currently null/blank; nonblank content, prices, media, taxonomy and admin-authored data are never overwritten. The normal status exception is a target product whose `legacy_id` and deterministic `wp-prod-{sourceId}` ID both match the source and which has no attributable admin audit: if it is `PUBLISHED`, the reviewed plan explicitly downgrades it to `DRAFT` with optimistic timestamp predicates and a system audit entry. The additional exact owner override for SKU `SCS-S10X` may force only the final-snapshot winner from source IDs `41038`/`41181` to `DRAFT`; it cannot apply to another source ID/SKU and is separately audited.
- Redirects have one narrowly scoped repair action because a broken redirect cannot be preserved as valid SEO state. An existing rule may be changed only when it has no admin audit, its complete current row is captured in the reviewed JSON, its current target is a legacy chain or a missing/non-public detail route, and the replacement is a known-live canonical route. The executor matches the reviewed id/source/target/type/status/enabled values optimistically, normalizes the rule to a permanent 301, and writes a `SYSTEM` audit row. A rule pointing to a different live target, carrying a fixed query/fragment, or touched by an admin remains a conflict.
- New migrated products are always `DRAFT`. New articles retain the selected source status. A missing required product field is never silently skipped: the planner uses only the controlled inference rules in the exact reviewed versioned override (currently `deploy/migration/live-migration-owner-overrides-v2.json`), emits one audit row per inferred field, and otherwise returns `MANUAL_REVIEW`, which blocks execution. No placeholder SKU/title/price/canonical/category/brand is invented. `uncategorized` is the sole category fallback; `uncategorized-brand` is the explicit brand fallback and always carries a follow-up warning. Override v2 sets only source IDs `35222`, `38995`, and `39004` to owner-confirmed `Unisex`; the remaining manual rows stay blocked.
- Structured SKU/brand/gender remains first priority. When it is absent, brand may match only one exact normalized target token or reviewed alias; gender may use exact `nữ`/`lady`/`women`/`female`, `nam`/`man`/`men`/`male`, or `unisex` title tokens, or an explicitly listed neutral accessory category. Apparel, pants, shoes and gloves without such evidence remain manual. SKU may come only from one clear title model code that is unique across normalized source products/variants and target products/variants; slug/source ID/`WP-*` generation and fuzzy matching are forbidden.
- Source products `41038` and `41181` share `SCS-S10X` and are never merged. The planner requires both exact source rows and distinct parseable `post_modified_gmt` values and computes the newer row. The versioned override records `41181` only as the owner's expected winner; a different winner, tie, missing timestamp, or ambiguity blocks both records and reports the exact timestamps instead of silently selecting either. The owner reaffirmed `41181` for override v2, but the current pre-freeze dump still shows `41038` newer, so both remain blocked. Recheck final evidence and obtain a new explicit confirmation before changing the expected ID. If final evidence matches, the winner alone is imported as `DRAFT`; the loser contributes no content/SEO/translation/media data, and its aliases use one exact related category or `ACKNOWLEDGED_NO_SAFE_TARGET`.
- WooCommerce `_regular_price` maps to target `retail_price`; a positive `_sale_price` maps to `sale_price` only when it is lower. Because target `products.retail_price` is `NOT NULL`, a new source parent without a positive directly mapped shared price is skipped and reported even when its children have prices; the migration never writes a synthetic `0` sentinel.

## Only authorized tools

1. `LiveMigrationPreflightCli` is a standalone, read-only planner. Its JDBC transaction is `REPEATABLE READ, READ ONLY`; it cannot start Spring/Flyway/Hibernate or expose a write path.
2. `LiveMigrationExecutionCli` is the only production writer. It accepts the reviewed JSON plan, re-runs preflight against the same dump and current target, compares an immutable plan digest, acquires a PostgreSQL advisory lock, checks protected-domain counts, and writes idempotently in one PostgreSQL transaction.
3. The older Spring `bigbike.migration.wordpress.mode=import` path is rehearsal-only and must refuse real writes. It creates placeholders/overwrites fields and is not compatible with this contract.

Do not run the execution CLI while any preflight blocker remains. A successful preflight still does not authorize DNS, Nginx, service restart, schema application, deletion, or cutover.

Every planner/executor invocation must set both `BIGBIKE_LIVE_MIGRATION_OWNER_OVERRIDES` to the reviewed versioned JSON and `BIGBIKE_LIVE_MIGRATION_RECOVERY_STAGING` to the exact recovery staging directory. The override path, version and SHA-256, duplicate timestamps/selection, inference rows, exact variant-attachment decisions, recovery plan, unavailable-media fallback, exact target-field mutation plans, and target cleanup evidence are serialized into the JSON and immutable plan digest.

## Required final-snapshot gates

All gates are mandatory and fail closed:

- Source content writes and target product/article writes are frozen, with recorded start time.
- The selected dump was created after freeze from the confirmed live database/table prefix; the selected uploads directory is the live one. On the current VPS the discovered WordPress table prefix is `kd_`; rediscover it from the final dump and fail closed on drift rather than defaulting to `wp_`.
- `BIGBIKE_LIVE_MIGRATION_FINAL_SNAPSHOT=true` and `BIGBIKE_LIVE_MIGRATION_FREEZE_CONFIRMED=true`.
- Target schema contains V368 (content categories removed), V369 (media SHA-256), and V370 (run/checkpoint audit).
- The reviewed JSON plan has zero blockers and its SHA-256 equals the operator-supplied expected value.
- Every legacy content URL still embedded in target product/article/brand content must either have an executable redirect/media mapping or an exact reviewed field action. A redirect with no safe target is `ACKNOWLEDGED_NO_SAFE_TARGET`: it writes no redirect, stays in the manual report and remains a 404 without blocking solely on that redirect. In HTML only, an `<a href>` to such a path may be unwrapped while preserving its complete anchor content. Plain-text, canonical and structured/JSON URLs are never deleted by this policy and remain reported/blocking if unresolved. Homepage and generic product-listing fallbacks remain forbidden.
- The 35 structured/JSON URL rows without exact destinations remain blockers by owner decision. Do not weaken this gate or treat an absent redirect target as permission to delete JSON/plain-text/canonical data.
- Owner override v2 contains two planning-only exact mutations for `wp-art-41091`: remove three exact top-level image nodes from `body_blocks` only when the complete before hash matches and the derived after hash is exact, and set only the exact `cover_image_url` value to null. The general migration executor must reject v2 until a separate confirmed mutation and fresh preflight report both rows as `ALREADY_APPLIED`; this policy does not authorize media-row deletion.
- A fresh preflight with the same snapshot, manifest, rules and target state produces the same immutable plan digest and the same protected customer/order/admin counts. The generated report file SHA-256 may change because `generatedAt` and filesystem headroom are evidence fields outside the digest, but the plan digest must not. Source post iteration and ambiguous inference candidates must be explicitly sorted; never accept a digest mismatch as harmless collection ordering.
- The exact execution confirmation phrase includes snapshot id plus dump/plan hash prefixes. It is not a generic boolean.
- The off-VPS backup manifest below is valid. A local file, an unverified upload, or an expiring/short-retention backup does not pass.

## Off-VPS backup manifest v1

The manifest contains metadata only—never credentials or signed URLs with secrets. It must be verified in the previous 24 hours, retained for at least 30 more days, and list exactly one copy of every required kind:

- `SOURCE_DATABASE`
- `SOURCE_UPLOADS`
- `TARGET_DATABASE`
- `TARGET_MEDIA_METADATA`
- `NGINX_CONFIG`
- `DEPLOYMENT_CONFIG`

Each artifact requires an external URI (not `file:`, localhost or the VPS filesystem), lowercase SHA-256, byte size greater than zero, and `verifiedReadable=true`. `SOURCE_DATABASE.sha256` and top-level `sourceDumpSha256` must equal the selected final dump hash. See `deploy/migration/offsite-backup-manifest.example.json` for shape.

The owner-side implementation is `deploy/migration/pull-live-migration-backups.ps1` and requires PowerShell 7, OpenSSH and `tar` on Windows. It writes under `C:\Users\vomin\OneDrive\Documents\BigBike-Migration\<snapshot-id>\`, uses `scp` only for the already-created exact final source dump, and streams uploads, target `pg_dump`, target media DB/MinIO inventory, Nginx and deployment config over SSH via `System.Diagnostics.Process.StandardOutput.BaseStream`. It never creates a full archive on the VPS and contains no credential values. First run without `-ConfirmOneDriveSynced`; after OneDrive finishes and the files can be read back, rerun with `-VerifyOnly -ConfirmOneDriveSynced`. Each verification output uses the validator field `verifiedReadableAt` and sets `retentionUntil` 31 days later, leaving the required 30-day retention margin throughout the permitted 24-hour verification window. Do not promote `offsite-backup-verification.json` into the VPS manifest until all six artifacts have nonzero bytes, lowercase SHA-256, a successful gzip/tar/JSONL read test, sync/read-back confirmation and at least 30 days retention at validation time. The PowerShell `SnapshotId`, manifest `snapshotId`, and `BIGBIKE_LIVE_MIGRATION_SNAPSHOT_ID` must be identical; put a rules/review revision in the report directory or handoff name, never by appending it to only one of those three snapshot identifiers.

Run this only from PowerShell 7 on the owner's Windows machine after the final post-freeze dump exists. Replace every placeholder with the final snapshot evidence; never use a pre-freeze v18/v24 hash:

```powershell
Set-Location 'C:\path\to\bigbike-web-new'
$backupArgs = @{
    SnapshotId = '<final-snapshot-id>'
    VpsHost = '<VPS-host-or-IP>'
    VpsUser = 'root'
    SourceDumpRemotePath = '/root/myproject/bigbike-migration/<final-source-dump>.sql.gz'
    ExpectedSourceDumpSha256 = '<64-character-lowercase-final-dump-sha256>'
    # IdentityFile = 'C:\Users\vomin\.ssh\<private-key>'
}
./deploy/migration/pull-live-migration-backups.ps1 @backupArgs
```

The first run must finish all six local hash/readability checks. Wait for OneDrive to report fully synced, open/read the files again from the synced location, then attest and regenerate verification metadata without re-pulling or overwriting artifacts:

```powershell
./deploy/migration/pull-live-migration-backups.ps1 @backupArgs -VerifyOnly -ConfirmOneDriveSynced
```

Return only `offsite-backup-verification.json` and the non-secret sync/readability confirmation to the VPS operator. Do not paste SSH keys, database passwords, MinIO credentials, Cloudflare tokens, or signed OneDrive URLs into chat or manifests.

## Execution and recovery

- Domain order is target-media checksum fills → referenced media → products/category links → variants/options/gallery → articles/tags → existing target URL-only rewrites → redirect inserts/guarded updates → validation.
- MinIO keys and media UUIDs are content-derived. A retry reuses the same verified object; an object copied before a failed DB transaction is a safe reusable orphan, not an overwritten target object.
- PostgreSQL writes are processed in bounded batches with savepoints, but the data, run record, and audit checkpoints commit together only after all post-write validation passes. Any database failure rolls the entire migration back, so a retry starts from an unchanged target and can reproduce the reviewed digest.
- Every ordinary update uses a field whitelist plus null/blank predicate. The narrowly scoped legacy-status exception uses exact ID, `legacy_id`, status, reviewed `created_at`/`updated_at`, and absence-of-audit predicates; the SCS override additionally requires exact source ID/SKU and reviewed target timestamps/status. Existing-content rewrites change reviewed URL/tag fragments only, record operations, and are guarded by exact before/after whole-field SHA-256 values. Redirect repairs use the exact reviewed redirect row and add a system audit. Every insert uses deterministic identity or a unique natural key. A target drift/constraint mismatch fails the batch; it is never converted into a broader overwrite/delete.
- At completion, customer/order/admin counts must equal the preflight baseline. Imported products must be `DRAFT`; no duplicate variant SKU or content slug may have been introduced; all referenced media objects and redirects must validate.
- On failure, keep the old site and freeze in place. Do not restore over the target blindly. PostgreSQL changes roll back atomically; copied content-addressed objects may remain as safe reusable orphans. Diagnose the failure record, rerun preflight after correction, and retry only with a newly verified exact plan, or use the verified target backup with an explicitly scoped rollback plan.

## Missing-media recovery

- Recover a missing referenced file only from its exact source URL/object or another byte-identical verified copy. Similar filenames, resized variants, and visually similar images are not substitutes.
- Downloaded recovery candidates stay outside the live WordPress uploads tree until their URL, MIME type, byte length, and SHA-256 have been recorded in a recovery manifest and reviewed.
- Exactly four files in `bigbike-migration/recovered-media` are approved by relative path, byte size, MIME signature and SHA-256. The read-only planner reports `PENDING_EXPLICIT_COPY_BEFORE_FINAL_SNAPSHOT`; copying still requires its separate gate, must refuse a different existing destination, and the final `SOURCE_UPLOADS` backup must contain the restored bytes. Never make the execution CLI depend on a live third-party HTTP download.
- Source attachment `30184` has no recoverable row/path/bytes. The owner-approved v2 exception removes only gallery reference `30184` from variants `30187` and `30188`, and only while parent `30183`, thumbnail `30186`, and raw gallery `[30184,30185]` all match. The reviewed result must retain thumbnail `30186` and gallery `30185`. Any evidence drift is a conflict, and executor gallery selection is filtered through the immutable reviewed attachment list so raw source metadata cannot reintroduce `30184`.
- The unresolved exact file `2021/05/mua-giay-scoyco-alpinestar-1024x772.png` may only be restored when an exact original is proven and hash-bound in a revised owner override. While absent, only its exact `<img>` and wrapping dead-media anchor in `wp-art-26064.body`/`body_en` may be removed. The planner records before/after whole-field SHA-256 and operations; all other prose remains byte-for-byte unchanged apart from those exact fragments.
- Missing target MinIO objects and duplicate target hashes have a read-only exact cleanup plan. Missing rows are deletion candidates only after zero UUID/public-URL/object-key references. Duplicate canonical priority is verified existing object/hash, highest reference count, admin/audit provenance, oldest `created_at`, then lexicographic ID; filename is never a signal. Every rebind is whole-field hash-bound and must validate before exact DB-row deletion. Protected customer/order/admin/session/auth tables are excluded from writes and content scanning. Cleanup requires verified target backup, a final rescan, printing the exact rows/keys/references, and a separate destructive confirmation. Duplicate MinIO objects are retained through cutover and for at least 24 stable hours, then require another confirmation before object deletion.

## Operations outside the writer

Applying Flyway migrations, restarting/building services, changing Nginx, changing Cloudflare/DNS, purging caches, OAuth/email/tracking tests, unfreezing writes, 24-hour monitoring, and deletion/rename of the old project remain separate operator steps. They require their own validation and, where destructive, the explicit final owner confirmation required by the master migration prompt.
