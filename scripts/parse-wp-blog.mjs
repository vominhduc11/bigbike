/**
 * Parse WordPress sqldump: extract blog content (posts, categories, tags, thumbnails, SEO).
 *
 * Outputs:
 *   scripts/wp-blog-categories.json
 *   scripts/wp-blog-tags.json
 *   scripts/wp-blog-articles.json     (full payload — body HTML rewritten to MinIO URLs)
 *
 * ID conventions (consistent with existing imports):
 *   - Articles:       wp-art-{postId}
 *   - Blog category:  wp-blog-cat-{termId}   (distinct from product wp-cat-{termId})
 *   - Blog tag:       wp-blog-tag-{termId}
 *
 * Image URL rewrite:
 *   https://bigbike.vn/wp-content/uploads/  → http://localhost:9000/bigbike-media/wp-uploads/
 *
 * Usage: node scripts/parse-wp-blog.mjs
 */

import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DUMP_PATH = join(__dirname, '../bigbike_vn__2026_04_17/sqldump.sql')
const WP_PREFIX = 'https://bigbike.vn/wp-content/uploads/'
const MINIO_PREFIX = 'http://localhost:9000/bigbike-media/wp-uploads/'

// ── helpers ─────────────────────────────────────────────────────────────────
function findInsertBlocks(sql, table) {
  const blocks = []
  const marker = `INSERT INTO \`${table}\` VALUES`
  let i = 0
  while (true) {
    const s = sql.indexOf(marker, i)
    if (s < 0) break
    let j = s + marker.length
    let inStr = false
    while (j < sql.length) {
      const c = sql[j]
      if (inStr) {
        if (c === '\\') { j += 2; continue }
        if (c === "'") inStr = false
        j++
      } else {
        if (c === "'") { inStr = true; j++; continue }
        if (c === ';') break
        j++
      }
    }
    blocks.push([s + marker.length, j])
    i = j + 1
  }
  return blocks
}

function parseRows(text) {
  const rows = []
  let i = 0
  const n = text.length
  while (i < n) {
    if (text[i] !== '(') { i++; continue }
    let depth = 0, inStr = false, j = i
    while (j < n) {
      const c = text[j]
      if (inStr) {
        if (c === '\\') { j += 2; continue }
        if (c === "'") inStr = false
        j++
      } else {
        if (c === "'") { inStr = true; j++; continue }
        if (c === '(') depth++
        else if (c === ')') {
          depth--
          if (depth === 0) { rows.push(text.slice(i, j + 1)); i = j + 1; break }
        }
        j++
      }
    }
    if (j >= n) break
  }
  return rows
}

function splitFields(row) {
  const inner = row.slice(1, -1)
  const out = []
  let i = 0, n = inner.length, buf = '', inStr = false, isStr = false
  while (i < n) {
    const c = inner[i]
    if (inStr) {
      if (c === '\\') { buf += c + (inner[i + 1] ?? ''); i += 2; continue }
      if (c === "'") { inStr = false; i++; continue }
      buf += c; i++
    } else {
      if (c === "'") { inStr = true; isStr = true; i++; continue }
      if (c === ',') { out.push({ value: buf, isString: isStr }); buf = ''; isStr = false; i++; continue }
      buf += c; i++
    }
  }
  out.push({ value: buf, isString: isStr })
  return out
}

function unescapeMysql(s) {
  return s.replace(/\\'/g, "'")
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, '\\')
          .replace(/\\n/g, '\n')
          .replace(/\\r/g, '\r')
          .replace(/\\t/g, '\t')
          .replace(/\\0/g, '\0')
}

function fields(row) {
  return splitFields(row).map(f => f.value === 'NULL' && !f.isString ? null : (f.isString ? unescapeMysql(f.value) : f.value))
}

function rewriteUrl(url) {
  if (typeof url !== 'string') return url
  return url.split(WP_PREFIX).join(MINIO_PREFIX)
}

function rewriteBodyImages(html) {
  if (!html) return html
  return html.split(WP_PREFIX).join(MINIO_PREFIX)
}

// ── load SQL ────────────────────────────────────────────────────────────────
console.log('Reading SQL dump...')
const sql = readFileSync(DUMP_PATH, 'utf-8')
console.log(`  ${(sql.length / 1024 / 1024).toFixed(1)} MB`)

// ── 1. Blog categories (taxonomy = 'category') and tags (taxonomy='post_tag')
console.log('\n1. Extracting blog taxonomies...')
const ttBlocks = findInsertBlocks(sql, 'kd_term_taxonomy')
const blogCatTermIds = new Set()
const blogTagTermIds = new Set()
const ttDescByTermId = {}      // termId → description
const ttCountByTermId = {}     // termId → count
const ttParentByTermId = {}    // termId → parent termId
for (const [s, e] of ttBlocks) {
  const data = sql.slice(s, e)
  for (const row of parseRows(data)) {
    const f = fields(row)
    // (term_taxonomy_id, term_id, taxonomy, description, parent, count)
    if (f.length < 6) continue
    const termId = f[1]
    const tax = f[2]
    if (tax === 'category') blogCatTermIds.add(termId)
    if (tax === 'post_tag') blogTagTermIds.add(termId)
    if (tax === 'category' || tax === 'post_tag') {
      ttDescByTermId[termId] = f[3] ?? ''
      ttParentByTermId[termId] = f[4]
      ttCountByTermId[termId] = parseInt(f[5]) || 0
    }
  }
}
console.log(`  Categories: ${blogCatTermIds.size} | Tags: ${blogTagTermIds.size}`)

// ── 2. Resolve term names/slugs (kd_terms) ─────────────────────────────────
const termsBlocks = findInsertBlocks(sql, 'kd_terms')
const termInfo = {}  // termId → { name, slug }
for (const [s, e] of termsBlocks) {
  const data = sql.slice(s, e)
  for (const row of parseRows(data)) {
    const f = fields(row)
    // (term_id, name, slug, term_group)
    const termId = f[0]
    if (blogCatTermIds.has(termId) || blogTagTermIds.has(termId)) {
      termInfo[termId] = { name: f[1] ?? '', slug: f[2] ?? '' }
    }
  }
}

const blogCategories = [...blogCatTermIds].map(id => ({
  id: `wp-blog-cat-${id}`,
  legacyTermId: id,
  slug: termInfo[id]?.slug ?? `cat-${id}`,
  name: termInfo[id]?.name ?? `Unknown ${id}`,
  parent: ttParentByTermId[id] ?? '0',
  postCount: ttCountByTermId[id] ?? 0,
}))
const blogTags = [...blogTagTermIds].map(id => ({
  id: `wp-blog-tag-${id}`,
  legacyTermId: id,
  slug: termInfo[id]?.slug ?? `tag-${id}`,
  name: termInfo[id]?.name ?? `Unknown ${id}`,
}))
console.log(`  Categories resolved: ${blogCategories.length}, Tags resolved: ${blogTags.length}`)

// ── 3. Posts (post_type='post', status='publish' OR draft) ──────────────────
console.log('\n2. Extracting blog posts...')
const postBlocks = findInsertBlocks(sql, 'kd_posts')
const articles = []
const allAttachmentIds = new Set()      // for thumbnail resolution
const postIdToPost = {}                  // for parent/etc
for (const [s, e] of postBlocks) {
  const data = sql.slice(s, e)
  for (const row of parseRows(data)) {
    const f = fields(row)
    if (f.length < 21) continue
    const postType = f[20]
    if (postType !== 'post') continue
    const status = f[7]
    if (status !== 'publish') continue
    articles.push({
      id: `wp-art-${f[0]}`,
      legacyPostId: f[0],
      authorId: f[1],
      postDate: f[2],
      content: f[4] ?? '',
      title: f[5] ?? '',
      excerpt: f[6] ?? '',
      slug: f[11] ?? '',
      modified: f[14],
      guid: f[18],
      menuOrder: parseInt(f[19]) || 0,
    })
  }
}
console.log(`  ${articles.length} blog posts (publish)`)

// Sanity: ensure unique slugs (URL-decode since some slugs are URL-encoded like nhu%cc%83ng-...)
const slugCount = {}
for (const a of articles) {
  // URL-decode then lowercase for safety
  try { a.slug = decodeURIComponent(a.slug) } catch {}
  slugCount[a.slug] = (slugCount[a.slug] || 0) + 1
}
const dupSlugs = Object.entries(slugCount).filter(([, n]) => n > 1)
if (dupSlugs.length) {
  console.log(`  WARN ${dupSlugs.length} duplicate slug(s):`)
  for (const [s, n] of dupSlugs) console.log(`    "${s}" × ${n}`)
}
// De-dup by appending postId
{
  const seen = new Set()
  for (const a of articles) {
    if (seen.has(a.slug)) {
      const newSlug = `${a.slug}-${a.legacyPostId}`
      console.log(`    fix: "${a.slug}" → "${newSlug}"`)
      a.slug = newSlug
    }
    seen.add(a.slug)
  }
}

// Empty-slug fallback: title-based or postId-based
for (const a of articles) {
  if (!a.slug) {
    a.slug = `article-${a.legacyPostId}`
    console.log(`    empty slug for post ${a.legacyPostId} → "${a.slug}"`)
  }
}

// ── 4. Post → category & tag mappings (kd_term_relationships) ──────────────
console.log('\n3. Extracting post→term relationships...')
const trBlocks = findInsertBlocks(sql, 'kd_term_relationships')
const articlePostIds = new Set(articles.map(a => a.legacyPostId))
const postToCategories = {}  // postId → [termId]
const postToTags = {}        // postId → [termId]
// Need term_taxonomy_id → termId map. term_taxonomy rows: tt_id is f[0], term_id is f[1].
const ttIdToTermId = {}
const ttIdToTax = {}
for (const [s, e] of ttBlocks) {
  const data = sql.slice(s, e)
  for (const row of parseRows(data)) {
    const f = fields(row)
    if (f.length < 3) continue
    ttIdToTermId[f[0]] = f[1]
    ttIdToTax[f[0]] = f[2]
  }
}
for (const [s, e] of trBlocks) {
  const data = sql.slice(s, e)
  for (const row of parseRows(data)) {
    const f = fields(row)
    // (object_id, term_taxonomy_id, term_order)
    const postId = f[0]
    const ttId = f[1]
    if (!articlePostIds.has(postId)) continue
    const termId = ttIdToTermId[ttId]
    const tax = ttIdToTax[ttId]
    if (!termId || !tax) continue
    if (tax === 'category') {
      ;(postToCategories[postId] = postToCategories[postId] || []).push(termId)
    } else if (tax === 'post_tag') {
      ;(postToTags[postId] = postToTags[postId] || []).push(termId)
    }
  }
}
const postsWithCategory = Object.keys(postToCategories).length
const postsWithTag = Object.keys(postToTags).length
console.log(`  ${postsWithCategory}/${articles.length} posts have category`)
console.log(`  ${postsWithTag}/${articles.length} posts have tags`)

// ── 5. Postmeta: thumbnail, SEO (rank_math + yoast) ────────────────────────
console.log('\n4. Extracting postmeta (thumbnail, SEO)...')
const pmBlocks = findInsertBlocks(sql, 'kd_postmeta')
const postMeta = {}  // postId → { metaKey: value }
const KEYS_OF_INTEREST = new Set([
  '_thumbnail_id',
  'rank_math_title',
  'rank_math_description',
  'rank_math_canonical_url',
  'rank_math_robots',
  'rank_math_focus_keyword',
  'rank_math_primary_category',
  'rank_math_og_content_image',
  '_yoast_wpseo_title',
  '_yoast_wpseo_metadesc',
  '_yoast_wpseo_canonical',
  '_yoast_wpseo_focuskw',
  '_yoast_wpseo_primary_category',
  '_yoast_wpseo_meta-robots-noindex',
])
for (const [s, e] of pmBlocks) {
  const data = sql.slice(s, e)
  for (const row of parseRows(data)) {
    const f = fields(row)
    // (meta_id, post_id, meta_key, meta_value)
    if (f.length < 4) continue
    const postId = f[1]
    if (!articlePostIds.has(postId)) continue
    const key = f[2]
    if (!KEYS_OF_INTEREST.has(key)) continue
    if (f[3] === null || f[3] === '') continue
    if (!postMeta[postId]) postMeta[postId] = {}
    postMeta[postId][key] = f[3]
    if (key === '_thumbnail_id') allAttachmentIds.add(f[3])
  }
}
console.log(`  ${Object.keys(postMeta).length} posts have metadata`)
console.log(`  ${allAttachmentIds.size} thumbnail attachments referenced`)

// ── 6. Resolve attachment files (kd_postmeta._wp_attached_file) + alt + dimensions
console.log('\n5. Resolving thumbnail file paths...')
const attachFile = {}  // attachmentPostId → relative path
const attachAlt = {}   // attachmentPostId → alt
const attachMeta = {}  // attachmentPostId → { width, height, mimeType }
for (const [s, e] of pmBlocks) {
  const data = sql.slice(s, e)
  for (const row of parseRows(data)) {
    const f = fields(row)
    if (f.length < 4) continue
    if (!allAttachmentIds.has(f[1])) continue
    if (f[2] === '_wp_attached_file') attachFile[f[1]] = f[3]
    else if (f[2] === '_wp_attachment_image_alt') attachAlt[f[1]] = f[3]
    else if (f[2] === '_wp_attachment_metadata') {
      // Serialized PHP array — extract width, height
      const m = String(f[3])
      const widthM = m.match(/s:5:"width";i:(\d+)/)
      const heightM = m.match(/s:6:"height";i:(\d+)/)
      attachMeta[f[1]] = {
        width: widthM ? parseInt(widthM[1]) : null,
        height: heightM ? parseInt(heightM[1]) : null,
      }
    }
  }
}
// Resolve mime type from attachment post (post_mime_type)
const attachMime = {}
for (const [s, e] of postBlocks) {
  const data = sql.slice(s, e)
  for (const row of parseRows(data)) {
    const f = fields(row)
    if (f.length < 22) continue
    if (!allAttachmentIds.has(f[0])) continue
    if (f[20] === 'attachment') attachMime[f[0]] = f[21]
  }
}
console.log(`  ${Object.keys(attachFile).length} files resolved`)

// ── 7. Build articles JSON ─────────────────────────────────────────────────
console.log('\n6. Building article payloads...')
let withCover = 0, withSeo = 0, bodyImageRewriteCount = 0
for (const a of articles) {
  const pm = postMeta[a.legacyPostId] ?? {}
  const thumbId = pm._thumbnail_id
  if (thumbId && attachFile[thumbId]) {
    const fullUrl = WP_PREFIX + attachFile[thumbId]
    a.coverImageUrl = rewriteUrl(fullUrl)
    a.coverImageAlt = attachAlt[thumbId] ?? a.title
    a.coverImageWidth = attachMeta[thumbId]?.width ?? null
    a.coverImageHeight = attachMeta[thumbId]?.height ?? null
    a.coverImageMime = attachMime[thumbId] ?? null
    a.coverImageLegacyAttachmentId = thumbId
    withCover++
  }
  // SEO
  a.seoTitle = pm.rank_math_title || pm._yoast_wpseo_title || null
  a.seoDescription = pm.rank_math_description || pm._yoast_wpseo_metadesc || null
  a.seoCanonical = pm.rank_math_canonical_url || pm._yoast_wpseo_canonical || null
  a.seoNoIndex = (pm.rank_math_robots && /noindex/i.test(pm.rank_math_robots)) ||
                 pm['_yoast_wpseo_meta-robots-noindex'] === '1' || false
  if (a.seoTitle || a.seoDescription) withSeo++

  // Map primary category (single article.category_id)
  const primaryCatTermId = pm.rank_math_primary_category || pm._yoast_wpseo_primary_category
  const cats = postToCategories[a.legacyPostId] ?? []
  let chosenCat = primaryCatTermId && cats.includes(primaryCatTermId) ? primaryCatTermId : cats[0]
  // If no primary cat & no cats, leave null
  a.primaryCategoryTermId = chosenCat ?? null
  a.allCategoryTermIds = cats
  a.tagTermIds = postToTags[a.legacyPostId] ?? []

  // Rewrite body images
  const beforeBody = a.content
  a.body = rewriteBodyImages(a.content)
  if (beforeBody !== a.body) bodyImageRewriteCount++
}
console.log(`  ${withCover}/${articles.length} have cover image`)
console.log(`  ${withSeo}/${articles.length} have SEO meta`)
console.log(`  ${bodyImageRewriteCount}/${articles.length} have body images rewritten`)

// ── 8. Write outputs ────────────────────────────────────────────────────────
writeFileSync(join(__dirname, 'wp-blog-categories.json'), JSON.stringify(blogCategories, null, 2), 'utf-8')
writeFileSync(join(__dirname, 'wp-blog-tags.json'), JSON.stringify(blogTags, null, 2), 'utf-8')

// Strip giant 'content' field (already in body)
const articlesOut = articles.map(a => ({
  ...a, content: undefined,
}))
writeFileSync(join(__dirname, 'wp-blog-articles.json'), JSON.stringify(articlesOut, null, 2), 'utf-8')

console.log('\n✓ Wrote:')
console.log('  scripts/wp-blog-categories.json')
console.log('  scripts/wp-blog-tags.json')
console.log('  scripts/wp-blog-articles.json')
console.log('\nNext: node scripts/build-v93-migration.mjs')
