# Phase 2B — Catalog / Content / Media / Redirect Dry-Run Importer

**Status:** COMPLETE — all 353 tests pass, no DB writes, migration disabled by default.

---

## A. Summary

Phase 2B implements a streaming dry-run importer that reads the BigBike WordPress SQL dump
(~128 MB, ISO-8859-1 mixed encoding) and maps 10 content domains — products, variations,
categories, brands, tags, media, pages, articles, menus, and redirects — to Spring Boot
domain objects without touching the application database.

Key deliverables:
- `PhpSerializeParser` — full parser for PHP `serialize()` format (s/i/b/d/N/a/O types)
- `WordPressSqlDumpRowReader` — line-streaming SQL reader supporting both mysqldump INSERT formats
- `WordPressInsertParser` — single-line and multi-row INSERT VALUE parser with MySQL escape handling
- 6 new domain mappers (category, brand, page, article, variation, permalink-manager)
- Updated `WordPressMediaMapper` — now extracts `width`, `height`, `sizesJson` via PHP deserialization
- `CatalogContentDryRunResult` — immutable result record with Builder
- `WordPressCatalogContentDryRunService` — single-pass streaming orchestrator
- 31 new unit/integration tests (Phase2BWordPressCatalogDryRunImporterTest)
- Fixture: `wp_fixture_multi_insert.sql`

---

## B. Files Changed

### New — parsers
| File | Purpose |
|------|---------|
| `migration/wordpress/parser/PhpSerializeParser.java` | PHP serialize() parser (@Component) |
| `migration/wordpress/parser/WordPressTableRow.java` | Row record with typed accessors |
| `migration/wordpress/parser/WordPressInsertParser.java` | INSERT line → List<WordPressTableRow> |
| `migration/wordpress/parser/WordPressSqlDumpRowReader.java` | Streaming SQL dump reader |

### New — models
| File | Purpose |
|------|---------|
| `migration/wordpress/model/WpTermRelationship.java` | post ↔ term_taxonomy link |
| `migration/wordpress/model/WpFgRedirect.java` | FG Redirect plugin row |
| `migration/wordpress/model/WpOption.java` | wp_options row |

### New — mappers
| File | Domain |
|------|--------|
| `migration/wordpress/mapper/WordPressCategoryMapper.java` | product_cat taxonomy |
| `migration/wordpress/mapper/WordPressBrandMapper.java` | pwb-brand taxonomy |
| `migration/wordpress/mapper/WordPressPageMapper.java` | page post_type |
| `migration/wordpress/mapper/WordPressArticleMapper.java` | post post_type |
| `migration/wordpress/mapper/WordPressVariationMapper.java` | product_variation post_type |
| `migration/wordpress/mapper/WordPressPermalinkManagerMapper.java` | permalink-manager_uris option |

### Updated — mappers
| File | Change |
|------|--------|
| `migration/wordpress/mapper/WordPressMediaMapper.java` | Added PHP deserialization, width/height/sizesJson extraction |
| All 8 mappers | Fixed `Collectors.toMap()` NPE on null `meta_value` |

### New — report/service
| File | Purpose |
|------|---------|
| `migration/wordpress/report/CatalogContentDryRunResult.java` | Immutable result + Builder |
| `migration/wordpress/service/WordPressCatalogContentDryRunService.java` | Single-pass orchestrator |

### New — tests and fixtures
| File | Purpose |
|------|---------|
| `test/.../Phase2BWordPressCatalogDryRunImporterTest.java` | 31 test cases |
| `test/resources/fixtures/wordpress/wp_fixture_multi_insert.sql` | Multi-table SQL fixture |

### Updated — tests
| File | Change |
|------|--------|
| `test/.../Phase2AWordPressMigrationFoundationTest.java` | Fixed PHP array declaration `a:5:` → `a:1:` |

---

## C. Real Dump Findings

Dump file: configured via `bigbike.migration.wordpress.dump-path` (not committed).
Streaming mode: ISO-8859-1, line-by-line, never loads full dump into memory.

Counts from dry-run over the bounded fixture set (full dump counts require production run):

| Domain | Source | Mapped | Skipped/Deferred | Key Warnings |
|--------|--------|--------|------------------|--------------|
| Products | 2 | 2 | 0 | — |
| Variations | 4 | 4 | 0 | — |
| Categories | 0 | 0 | 0 | — (none in fixture) |
| Brands | 0 | 0 | 0 | — (none in fixture) |
| Media | 1 | 0 | 1 | Missing `_wp_attached_file` |
| Pages | 1 | 1 | 0 | — |
| Articles | 4 | 4 | 0 | — |
| Menus | 0 | 0 | 0 | — (none in fixture) |
| RankMath redirects | 1 | 1 | 0 | Self-loop row detected and skipped |
| FG redirects | 3 | 0 | 3 | All rows missing old_url/new_url columns |
| Permalink entries | 0 | 0 | 0 | — (no kd_options fixture row) |

Note: the real production dump contains 1,227+ products. Full dry-run counts require
running `WordPressCatalogContentDryRunService.run()` against the actual dump path.

---

## D. Parser / Importer Architecture

### PHP Serialize Parser

Handles the MySQL-serialized PHP values stored in `kd_postmeta.meta_value`:

```
s:5:"width" → String "width"   (byte-length declared; ASCII fast path)
i:800       → Long 800
b:1         → Boolean true
d:1.5       → Double 1.5
N;          → null
a:2:{k;v;k;v;} → Map<Object,Object>
O:…         → warn + skip (not needed for migration)
```

Critical edge case: truncated arrays (e.g. `a:5:{s:5:"width";i:800;}` declares 5 elements
but closes after 1). The parser checks for `}` before each array element and stops early,
accumulating a warning. This is expected for WooCommerce's `_wp_attachment_metadata`.

For multibyte UTF-8 strings (Vietnamese titles in serialized data), the parser falls back
to scanning for the closing `"` rather than using the declared byte length.

### SQL Dump Row Reader

Reads the dump line-by-line using `StandardCharsets.ISO_8859_1` (accepts any byte sequence;
no `MalformedInputException`). Never loads the full file into memory.

**Phase 1 — CREATE TABLE parsing:**
Extracts column names from `CREATE TABLE` statements using regex
`^\s+[`'"]([^`'"]+)[`'"]\s+\w`, skipping KEY/INDEX/CONSTRAINT lines.

**Phase 2 — INSERT parsing:**
Supports both mysqldump output formats:

```
# Extended-insert (default mysqldump):
INSERT INTO `kd_posts` VALUES (1,'product',...),(2,'page',...);

# Skip-extended-insert (--skip-extended-insert):
INSERT INTO `kd_posts` VALUES
(1,'product',...);
```

The multi-line format is handled by `isIncompleteInsert()`: if an INSERT line ends with just
`VALUES` (no row data), it is buffered as `pendingInsert` and combined with the next `(...)` line.

### INSERT Value Parser

Handles:
- Single-line multi-row: `VALUES (r1),(r2),(r3);`
- Explicit column list: `INSERT INTO t (col1,col2) VALUES (...)`
- NULL values → Java `null`
- MySQL escape sequences: `\'`, `\\`, `\n`, `\r`, `\t`, `\0`
- Quoted strings with embedded commas and parentheses

Critical fix: a `valuesConsumed` flag prevents double-matching `VALUES` when the explicit
column list parser already consumed it.

### Orchestrator (Single-Pass Streaming)

`WordPressCatalogContentDryRunService` streams the dump once, dispatching rows from 8 tables:

```
kd_posts, kd_postmeta,
kd_terms, kd_term_taxonomy, kd_term_relationships,
kd_rank_math_redirections, kd_fg_redirect, kd_options
```

After streaming completes, all in-memory maps are partitioned by post_type, taxonomy,
and option name. No second file pass is needed.

---

## E. Mapping Decisions

### URL Patterns
| Domain | Pattern | Example |
|--------|---------|---------|
| Product | `/{slug}.html` | `/honda-sh350.html` |
| Category | `/{slug}.html` | `/xe-may.html` |
| Brand | `/thuong-hieu/{slug}.html` | `/thuong-hieu/honda.html` |
| Article | `/tin-tuc/{slug}.html` | `/tin-tuc/bao-duong-xe.html` |
| Page | `/{slug}.html` | `/chinh-sach-bao-hanh.html` |

### SEO Priority
All content mappers apply: RankMath (`rank_math_title`, `rank_math_description`) first,
Yoast (`_yoast_wpseo_title`, `_yoast_wpseo_metadesc`) as fallback.

### Status Mapping
| WordPress `post_status` | Mapped status |
|------------------------|---------------|
| publish | PUBLISHED / ACTIVE |
| draft | DRAFT |
| trash | ARCHIVED |
| private | DRAFT / ACTIVE (variation) |
| (any other) | DRAFT |

### Variation Attributes
Extracted from postmeta keys prefixed `attribute_` or `attribute_pa_` (WooCommerce
product attribute taxonomy). The `pa_` prefix is stripped to get the attribute name.

### Permalink Manager
The `permalink-manager_uris` option stores a PHP-serialized map of:
- Integer key → POST permalink override (`/custom-slug.html`)
- `tax-NNN` string key → TERM permalink override

Conflicts (two keys mapping to the same URI) are reported as warnings, not errors.

### FG Redirect Plugin
The column names for `kd_fg_redirect` vary by plugin version. The importer tries multiple
aliases: `old_url`/`redirect_url`/`source`/`from_url` and `new_url`/`redirect_to`/`target`/
`to_url`/`url`. Rows where neither resolves are counted as skipped with a warning.

---

## F. Warnings / Blockers

### Resolved during Phase 2B

| Issue | Root Cause | Fix |
|-------|-----------|-----|
| `MalformedInputException` reading dump | MySQL dump has non-UTF-8 byte sequences | Changed to `ISO_8859_1` charset |
| `productsSource=0` in dry-run | Real dump uses multi-line INSERT format | Added `pendingInsert` buffering in `WordPressSqlDumpRowReader` |
| `NullPointerException` in `Collectors.toMap()` | NULL `meta_value` rows in postmeta | Added null filter + `metaValue() != null ? metaValue() : ""` lambda |
| PHP parse error: `Unknown type '}'` | Truncated arrays (declared N, actual < N) | Added early-exit `}` check in `parseArray()` |
| `Double-VALUES` parse bug | `tryParseColumnList()` consumed VALUES; main loop matched again | Added `valuesConsumed` flag |
| `StandardCharsets` unused import | Inline fully-qualified reference instead of import | Added import, used `StandardCharsets.ISO_8859_1` |

### Open / Deferred

| Item | Notes |
|------|-------|
| FG Redirect column names | Column aliases guessed; real schema needs verification against actual dump CREATE TABLE |
| Product tags (`product_tag`) | Counted but fully deferred — no target schema table yet |
| Menu items without a menu term relationship | Items unlinked from any `nav_menu` term are silently dropped |
| Vietnamese multibyte in PHP serialized strings | Length mismatch triggers fallback scan; data is captured but with warning |
| Full production dry-run counts | Only fixture counts verified; full 1,227+ product run pending |

---

## G. Tests Added / Updated

### Phase2BWordPressCatalogDryRunImporterTest — 31 tests

**PHP Serialize (4 tests)**
- `phpParser_parsesString`
- `phpParser_parsesInteger`
- `phpParser_parsesArray`
- `phpParser_handlesTruncatedArray`

**SQL Dump Row Reader (3 tests)**
- `sqlDumpRowReader_parsesMultiRowInsert`
- `sqlDumpRowReader_handlesEscapedQuotes`
- `sqlDumpRowReader_handlesNullValues`

**Products / Categories / Brands (5 tests)**
- `dryRun_countsProductsFromFixture`
- `dryRun_countsVariationsFromFixture`
- `dryRun_countsCategories`
- `dryRun_countsBrands`
- `dryRun_detectsDuplicateSku`

**Media (2 tests)**
- `mediaMapper_extractsWidthHeight`
- `mediaMapper_warnsOnMissingAttachedFile`

**Pages / Articles (2 tests)**
- `pageMapper_mapsSlugTitleContent`
- `articleMapper_mapsSlugTitlePublishedAt`

**Menus (2 tests)**
- `menuMapper_mapsNavMenuItems`
- `menuMapper_detectsMenuCycle`

**Redirects (3 tests)**
- `redirectMapper_mapsRankMathRedirect`
- `redirectMapper_detectsSelfLoop`
- `redirectMapper_detectsDuplicateSource`

**Permalink Manager (2 tests)**
- `permalinkMapper_parsesPhpSerializedUriMap`
- `permalinkMapper_detectsConflictingUris`

**Safety / Regression (8 tests)**
- `dryRun_producesNoDbWrites`
- `dryRun_isDisabledByDefault`
- `dryRun_handlesEmptyDump`
- `dryRun_handlesUnknownPostTypes`
- `dryRun_totalWarningsIsNonNegative`
- `sqlParser_parsesExplicitColumnList`
- `sqlParser_parsesMultiLineInsertFormat`
- `phpParser_parsesNestedArray`

### Phase2AWordPressMigrationFoundationTest — 20 tests (unchanged, 1 fixture fix)
Fixed `a:5:{...}` → `a:1:{...}` in media mapper fixture to match actual element count.

**Total: 353 tests, 0 failures, 0 errors.**

---

## H. Commands Executed

```bash
# Verify Docker Compose configuration is valid
docker compose config --quiet
# exit: 0

# Full test suite
mvn test
# Tests run: 353, Failures: 0, Errors: 0, Skipped: 0
# BUILD SUCCESS
```

Test breakdown by class:
| Test Class | Tests |
|-----------|-------|
| Phase2BWordPressCatalogDryRunImporterTest | 31 |
| Phase2AWordPressMigrationFoundationTest | 20 |
| Phase1KOpenApiContractTest | 12 |
| Phase1BSchemaTest | 12 |
| Phase1CCommerceSchemaTest | 17 |
| PublicReadApiTest | 5 |
| PasswordServiceTest | 4 |
| BigbikeBackendApplicationTests | 1 |
| (remaining Phase 1 tests) | 251 |
| **Total** | **353** |

---

## I. Recommended Next Phase

**Phase 2C — Dry-Run Write Plan (no actual DB writes)**

Generate a write plan from the dry-run result:
1. For each mapped domain, emit a `WriteOperation` (INSERT/UPSERT/SKIP) with the target
   table, conflict strategy, and estimated row count.
2. Validate foreign key ordering: categories → products → variations, terms → posts.
3. Produce a human-readable plan report (HTML or Markdown) that the team can review before
   any DB mutation is authorized.
4. Add a `--plan-only` CLI flag to `WordPressMigrationCli` that runs 2B then 2C without
   writing.

This keeps the "never write without explicit sign-off" guarantee while giving full
visibility into exactly what would change before Phase 2D (actual import).

---

## J. Safety Check

| Guarantee | Verified |
|-----------|---------|
| No writes to application DB | Yes — `WordPressCatalogContentDryRunService` is read-only; no `@Transactional`, no repository saves |
| Migration disabled by default | Yes — `bigbike.migration.wordpress.enabled=false` in `application.properties`; service is a passive `@Service` not wired to startup |
| No WordPress source modification | Yes — dump file is opened read-only via `Files.newBufferedReader` |
| No frontend changes | Yes — zero frontend files modified |
| Existing tests still pass | Yes — 322 prior tests + 31 new = 353 total, all green |
| No secrets in test fixtures | Yes — fixture uses synthetic data only, no real credentials or PII |
| Streaming, not full-load | Yes — `WordPressSqlDumpRowReader` reads line-by-line; only target-table rows are accumulated in memory |
