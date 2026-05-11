// Build a Flyway migration that re-seeds the homepage SEO/about settings from
// the actual WP source (post 12 ACF + Yoast meta), rewriting WP slug-style URLs
// to the new Next.js routes.
//
// Output: bigbike-backend/src/main/resources/db/migration/V94__reseed_home_seo_content.sql
//
// V19 already attempted this but used WHERE NOT EXISTS; on the current DB those
// rows are missing (rebuild/restore) so this migration uses ON CONFLICT DO UPDATE.

import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const acf = JSON.parse(readFileSync(join(__dirname, 'wp-post12-acf.json'), 'utf8'))

// WP slug → new system route (per bigbike-web/lib/utils/routes.ts toCategoryPath).
// V19 hardcoded the slug→category mapping; we mirror that.
const URL_REWRITES = [
  ['https://bigbike.vn/mu-bao-hiem.html',     '/danh-muc-san-pham/non-bao-hiem-moto/'],
  ['https://bigbike.vn/ao-quan-bao-ho.html',  '/danh-muc-san-pham/quan-ao-bao-ho-moto/'],
  ['https://bigbike.vn/gang-tay.html',        '/danh-muc-san-pham/gang-tay/'],
  ['https://bigbike.vn/giay-bao-ho.html',     '/danh-muc-san-pham/giay-bao-ho/'],
  ['https://bigbike.vn/phu-kien-khac.html',   '/danh-muc-san-pham/phu-kien-khac/'],
  ['https://bigbike.vn/vi/lien-he.html',      '/lien-he/'],
  ['https://bigbike.vn/lien-he.html',         '/lien-he/'],
  ['https://bigbike.vn/',                     '/'],
]

function rewriteUrls(html) {
  let out = html
  for (const [from, to] of URL_REWRITES) out = out.split(from).join(to)
  return out
}

// Normalize line endings (\r\n → \n) and trim trailing whitespace per line so
// the value is stable across editors/diffs.
function cleanHtml(html) {
  return html
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n')
    .trim()
}

function pgQuote(s) {
  // Use Postgres E'…' string with explicit \n so values stay readable
  // diff-wise even when the body has many lines.
  return "E'" + s
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r/g, '')
    .replace(/\n/g, "\\n") + "'"
}

const seoTitle  = acf['_yoast_wpseo_title']
const seoDesc   = acf['_yoast_wpseo_metadesc']
const aboutTitle    = acf['about_us_0_title']
const aboutSubtitle = acf['about_us_0_sub_title']
const aboutContent  = cleanHtml(rewriteUrls(acf['about_us_0_content']))
const contentBottom = cleanHtml(rewriteUrls(acf['content_bottom']))

if (!contentBottom || !aboutContent) {
  console.error('Missing required ACF values. Aborting.')
  process.exit(1)
}

const upsert = (key, value, group, isPublic, description) => `
insert into site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
values (gen_random_uuid(), '${key}', ${pgQuote(value)}, '${group}', ${isPublic}, '${description.replace(/'/g, "''")}', now(), now())
on conflict (setting_key) do update
set    setting_value = excluded.setting_value,
       setting_group = excluded.setting_group,
       is_public     = excluded.is_public,
       description   = coalesce(site_settings.description, excluded.description),
       updated_at    = now();`.trim()

const sql = `-- V94: Re-seed homepage SEO + about-section settings from the WP source dump
-- (kd_postmeta on wp_posts.ID = 12, the legacy bigbike.vn home page).
--
-- V19 tried to seed these via WHERE NOT EXISTS, but on the current DB those
-- rows are missing (rebuild/restore) and seo_home_title/seo_home_description
-- still hold the V18 ASCII placeholders. This migration uses ON CONFLICT DO
-- UPDATE so it works whether the rows exist with stale/empty values or not.
--
-- Source mapping:
--   _yoast_wpseo_title       → seo_home_title
--   _yoast_wpseo_metadesc    → seo_home_description
--   about_us_0_title         → about_title
--   about_us_0_sub_title     → about_subtitle
--   about_us_0_content       → about_content_html  (URLs rewritten to /danh-muc-san-pham/…)
--   content_bottom           → home_content_bottom_html (URLs rewritten)

${upsert('seo_home_title',           seoTitle,       'seo',         true, 'Homepage SEO title (Yoast).')}

${upsert('seo_home_description',     seoDesc,        'seo',         true, 'Homepage SEO description (Yoast).')}

${upsert('about_title',              aboutTitle,     'public_home', true, 'Homepage about section heading (ACF about_us_0_title).')}

${upsert('about_subtitle',           aboutSubtitle,  'public_home', true, 'Homepage about section sub-heading (ACF about_us_0_sub_title).')}

${upsert('about_content_html',       aboutContent,   'public_home', true, 'Homepage about section body HTML (ACF about_us_0_content).')}

${upsert('home_content_bottom_html', contentBottom,  'seo',         true, 'Homepage bottom SEO content block HTML (ACF content_bottom on WP post 12).')}
`

const out = join(__dirname, '../bigbike-backend/src/main/resources/db/migration/V94__reseed_home_seo_content.sql')
writeFileSync(out, sql, 'utf8')

const sizes = {
  seoTitle: seoTitle.length,
  seoDesc: seoDesc.length,
  aboutTitle: aboutTitle.length,
  aboutSubtitle: aboutSubtitle.length,
  aboutContent: aboutContent.length,
  contentBottom: contentBottom.length,
}
console.log('Migration written:', out)
console.log('Char counts after URL rewrite + cleanup:')
for (const [k, v] of Object.entries(sizes)) console.log(`  ${k.padEnd(16)} ${v}`)
