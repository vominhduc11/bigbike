/**
 * Generate Flyway migration V93__import_wp_blog.sql from parsed JSON.
 *
 * Inserts:
 *   - 5 content_categories (blog) with stable id wp-blog-cat-{termId}
 *   - 18 blog_tags with stable id wp-blog-tag-{termId}
 *   - 167 articles with stable id wp-art-{postId}
 *   - article_category_map (multi-cat per article)
 *   - article_tag_map
 *
 * All inserts use ON CONFLICT DO NOTHING (idempotent re-run).
 *
 * PostgreSQL dollar-quoted strings ($body$...$body$) used for body HTML to
 * avoid quote-escaping pain. We pick a tag that does not occur in the content.
 *
 * Usage: node scripts/build-v93-migration.mjs
 */

import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const cats = JSON.parse(readFileSync(join(__dirname, 'wp-blog-categories.json'), 'utf-8'))
const tags = JSON.parse(readFileSync(join(__dirname, 'wp-blog-tags.json'), 'utf-8'))
const articles = JSON.parse(readFileSync(join(__dirname, 'wp-blog-articles.json'), 'utf-8'))

console.log(`Loaded: ${cats.length} cats, ${tags.length} tags, ${articles.length} articles`)

// Helpers: SQL escape (Postgres E'' syntax).
// Use single-quote-doubled style which is the SQL standard.
function sqlStr(s) {
  if (s === null || s === undefined) return 'NULL'
  return "'" + String(s).replace(/'/g, "''") + "'"
}
function sqlInt(n) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return 'NULL'
  return String(parseInt(n))
}
function sqlBool(b) {
  if (b === null || b === undefined) return 'NULL'
  return b ? 'TRUE' : 'FALSE'
}
function sqlTimestamp(s) {
  if (!s || s === '0000-00-00 00:00:00') return 'NULL'
  // Convert "YYYY-MM-DD HH:MM:SS" → ISO with timezone (assume UTC; WP stores local but we don't have offset; use as-is + Z)
  return `'${s.replace(' ', 'T')}Z'::timestamptz`
}

// Pick safe dollar-quote tag for a given body.
function pickDollarTag(body) {
  const candidates = ['body', 'b', 'blog', 'article', 'post', 'content', 'data', 'q', 'qq']
  for (const t of candidates) {
    const tag = `$${t}$`
    if (!body.includes(tag)) return t
  }
  // Fall back to a unique tag based on hash
  for (let i = 0; i < 100; i++) {
    const tag = `$tag${i}$`
    if (!body.includes(tag)) return `tag${i}`
  }
  throw new Error('Cannot find safe dollar tag')
}
function dollarStr(s) {
  if (s === null || s === undefined) return 'NULL'
  const tag = pickDollarTag(String(s))
  return `$${tag}$${s}$${tag}$`
}

// ── Build SQL ───────────────────────────────────────────────────────────────
const lines = []
lines.push(`-- V93: Import WordPress blog content (167 articles + 5 categories + 18 tags).`)
lines.push(`-- Source: bigbike_vn__2026_04_17/sqldump.sql.`)
lines.push(`-- Generator: scripts/parse-wp-blog.mjs + scripts/build-v93-migration.mjs.`)
lines.push(`--`)
lines.push(`-- Stable ID conventions:`)
lines.push(`--   articles:           wp-art-{wp_post_id}`)
lines.push(`--   content_categories: wp-blog-cat-{wp_term_id}    (distinct from product wp-cat-{N})`)
lines.push(`--   blog_tags:          wp-blog-tag-{wp_term_id}`)
lines.push(`--`)
lines.push(`-- Idempotent: ON CONFLICT (id) DO NOTHING. Re-running this migration after`)
lines.push(`-- partial failure is safe.`)
lines.push(`--`)
lines.push(`-- Body HTML image URLs rewritten from`)
lines.push(`--   https://bigbike.vn/wp-content/uploads/  →  http://localhost:9000/bigbike-media/wp-uploads/`)
lines.push(`-- so dev/local stack serves images from MinIO instead of production WP.`)
lines.push('')

// Categories
lines.push(`-- ── 1. Content categories (blog) ──────────────────────────────────────────`)
lines.push(`insert into content_categories (id, slug, name) values`)
const catRows = cats.map(c => `  (${sqlStr(c.id)}, ${sqlStr(c.slug)}, ${sqlStr(c.name)})`)
lines.push(catRows.join(',\n') + `\non conflict (id) do nothing;`)
lines.push('')

// Tags
lines.push(`-- ── 2. Blog tags ──────────────────────────────────────────────────────────`)
if (tags.length > 0) {
  lines.push(`insert into blog_tags (id, slug, name) values`)
  const tagRows = tags.map(t => `  (${sqlStr(t.id)}, ${sqlStr(t.slug)}, ${sqlStr(t.name)})`)
  lines.push(tagRows.join(',\n') + `\non conflict (id) do nothing;`)
  lines.push('')
}

// Articles — one INSERT per article (body HTML can be large; keep readability)
lines.push(`-- ── 3. Articles ───────────────────────────────────────────────────────────`)
lines.push(`-- ${articles.length} blog posts. Body HTML is dollar-quoted to avoid escaping.`)
lines.push('')

for (const a of articles) {
  const primaryCatId = a.primaryCategoryTermId ? `wp-blog-cat-${a.primaryCategoryTermId}` : null
  const cols = [
    'id', 'slug', 'title', 'excerpt', 'body',
    'cover_image_url', 'cover_image_alt', 'cover_image_width', 'cover_image_height', 'cover_image_mime_type',
    'category_id', 'publish_status', 'seo_title', 'seo_description', 'seo_canonical_url', 'seo_no_index',
    'published_at', 'created_at', 'updated_at',
  ]
  const vals = [
    sqlStr(a.id),
    sqlStr(a.slug),
    sqlStr(a.title),
    a.excerpt ? sqlStr(a.excerpt) : 'NULL',
    dollarStr(a.body || ''),
    a.coverImageUrl ? sqlStr(a.coverImageUrl) : 'NULL',
    a.coverImageAlt ? sqlStr(a.coverImageAlt) : 'NULL',
    sqlInt(a.coverImageWidth),
    sqlInt(a.coverImageHeight),
    a.coverImageMime ? sqlStr(a.coverImageMime) : 'NULL',
    primaryCatId ? sqlStr(primaryCatId) : 'NULL',
    `'PUBLISHED'`,
    a.seoTitle ? sqlStr(a.seoTitle) : 'NULL',
    a.seoDescription ? sqlStr(a.seoDescription) : 'NULL',
    a.seoCanonical ? sqlStr(a.seoCanonical) : 'NULL',
    sqlBool(a.seoNoIndex),
    sqlTimestamp(a.postDate),
    sqlTimestamp(a.postDate),
    sqlTimestamp(a.modified || a.postDate),
  ]
  lines.push(`insert into articles (${cols.join(', ')}) values`)
  lines.push(`  (${vals.join(', ')})`)
  lines.push(`on conflict (id) do nothing;`)
  lines.push('')
}

// Article → category map (multi-category)
lines.push(`-- ── 4. Article → Category map (many-to-many) ──────────────────────────────`)
const catMapRows = []
for (const a of articles) {
  let order = 0
  for (const termId of a.allCategoryTermIds || []) {
    catMapRows.push(`  (${sqlStr(a.id)}, ${sqlStr(`wp-blog-cat-${termId}`)}, ${order++})`)
  }
}
if (catMapRows.length) {
  lines.push(`insert into article_category_map (article_id, category_id, sort_order) values`)
  lines.push(catMapRows.join(',\n') + `\non conflict (article_id, category_id) do nothing;`)
  lines.push('')
}

// Article → tag map
lines.push(`-- ── 5. Article → Tag map ──────────────────────────────────────────────────`)
const tagMapRows = []
for (const a of articles) {
  let order = 0
  for (const termId of a.tagTermIds || []) {
    tagMapRows.push(`  (${sqlStr(a.id)}, ${sqlStr(`wp-blog-tag-${termId}`)}, ${order++})`)
  }
}
if (tagMapRows.length) {
  lines.push(`insert into article_tag_map (article_id, tag_id, sort_order) values`)
  lines.push(tagMapRows.join(',\n') + `\non conflict (article_id, tag_id) do nothing;`)
  lines.push('')
} else {
  lines.push(`-- (no article→tag relationships in WP dump)`)
  lines.push('')
}

const outPath = join(__dirname, '../bigbike-backend/src/main/resources/db/migration/V93__import_wp_blog.sql')
const sql = lines.join('\n')
writeFileSync(outPath, sql, 'utf-8')

console.log(`\n✓ Wrote ${outPath}`)
console.log(`  Total: ${(sql.length / 1024).toFixed(1)} KB`)
console.log(`  Categories: ${cats.length}`)
console.log(`  Tags: ${tags.length}`)
console.log(`  Articles: ${articles.length}`)
console.log(`  cat-map rows: ${catMapRows.length}`)
console.log(`  tag-map rows: ${tagMapRows.length}`)
