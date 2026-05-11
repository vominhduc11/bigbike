/**
 * Import WordPress video CPT posts into BigBike home_videos table.
 *
 * WP stores videos as custom post type 'video' with ACF field 'youtube_url'.
 * The homepage template (page-home.php) queries latest 5 video posts from this CPT.
 *
 * Usage: node scripts/import-wp-videos.mjs
 */

import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createHash } from 'crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DUMP_PATH = join(__dirname, '../bigbike_vn__2026_04_17/sqldump.sql')

console.log('Reading SQL dump...')
const sql = readFileSync(DUMP_PATH, 'utf-8')
console.log(`  File size: ${(sql.length / 1024 / 1024).toFixed(1)} MB`)

// ── Step 1: Find all posts with youtube_url postmeta ─────────────────────────
// Format: (meta_id, post_id, 'youtube_url', 'URL')
console.log('\n1. Extracting youtube_url postmeta...')
const youtubeUrlByPost = new Map() // postId -> youtubeUrl

const NEEDLE = ",'youtube_url','"
let searchIdx = 0
while ((searchIdx = sql.indexOf(NEEDLE, searchIdx)) !== -1) {
  const before = sql.slice(Math.max(0, searchIdx - 40), searchIdx)
  const postIdMatch = before.match(/,(\d+)$/)
  const postId = postIdMatch ? postIdMatch[1] : null

  const valStart = searchIdx + NEEDLE.length
  const valEnd = sql.indexOf("'", valStart)
  const ytUrl = valEnd > valStart ? sql.slice(valStart, valEnd) : null

  if (postId && ytUrl && ytUrl.startsWith('http')) {
    youtubeUrlByPost.set(postId, ytUrl)
  }
  searchIdx += NEEDLE.length
}
console.log(`  Found ${youtubeUrlByPost.size} posts with youtube_url`)

// ── Step 2: Filter to only video CPT posts ────────────────────────────────────
// Video CPT posts have GUID pattern: ?post_type=video&#038;p=ID
// Products have GUID like: ?p=ID (without post_type)
// Use the GUID to confirm post_type=video
console.log('\n2. Filtering to video CPT posts...')

function extractVideoPostTitle(postId) {
  const guidPattern = '?post_type=video&#038;p=' + postId + "'"
  const guidIdx = sql.indexOf(guidPattern)
  if (guidIdx < 0) return null

  // Look backward from GUID for 'publish' status field
  const searchWindow = sql.slice(Math.max(0, guidIdx - 1000), guidIdx)
  const publishIdx = searchWindow.lastIndexOf(",'publish',")
  if (publishIdx < 0) return null

  // Format before 'publish': ...,'TITLE','EXCERPT','publish'
  const beforePublish = searchWindow.slice(0, publishIdx).slice(-200)
  const m = beforePublish.match(/,'([^']*)','([^']*)'$/)
  if (m) return m[1].replace(/\\'/g, "'").replace(/\\\\/g, '\\').trim()
  return null
}

const videoCptPosts = new Map() // postId -> { youtubeUrl, title }

for (const [postId, youtubeUrl] of youtubeUrlByPost) {
  const title = extractVideoPostTitle(postId)
  if (title !== null) {
    // title === null means no GUID with post_type=video → skip (it's a product)
    videoCptPosts.set(postId, { youtubeUrl, title })
  }
}

console.log(`  ${videoCptPosts.size} video CPT posts (out of ${youtubeUrlByPost.size} total with youtube_url)`)

// ── Step 3: Parse YouTube ID ─────────────────────────────────────────────────
function extractYouTubeId(url) {
  if (!url) return null
  const short = url.match(/youtu\.be\/([A-Za-z0-9_-]{11})/)
  if (short) return short[1]
  const watch = url.match(/[?&]v=([A-Za-z0-9_-]{11})/)
  if (watch) return watch[1]
  const shorts = url.match(/\/shorts\/([A-Za-z0-9_-]{11})/)
  if (shorts) return shorts[1]
  const embed = url.match(/\/embed\/([A-Za-z0-9_-]{11})/)
  if (embed) return embed[1]
  return null
}

function stableId(postId) {
  const hash = createHash('md5').update(`wp-video-${postId}`).digest('hex')
  return `hv-wp-${hash.slice(0, 8)}`
}

// ── Step 4: Build sorted video list ─────────────────────────────────────────
console.log('\n3. Building final video list...')
const videos = []
let sortOrder = 1

// Sort by postId descending (most recent first = smallest sort_order)
const sortedPostIds = [...videoCptPosts.keys()].sort((a, b) => Number(b) - Number(a))

for (const postId of sortedPostIds) {
  const { youtubeUrl, title } = videoCptPosts.get(postId)
  const ytId = extractYouTubeId(youtubeUrl)
  if (!ytId) {
    console.log(`  SKIP post ${postId}: cannot extract YouTube ID from ${youtubeUrl}`)
    continue
  }

  const embedUrl = `https://www.youtube.com/embed/${ytId}?rel=0`
  const autoThumbnailUrl = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`
  const id = stableId(postId)
  const displayTitle = title || `Video BigBike #${postId}`

  videos.push({ id, wpPostId: postId, sortOrder: sortOrder++, title: displayTitle, videoUrl: youtubeUrl, youtubeId: ytId, embedUrl, autoThumbnailUrl })
}

console.log(`  Total: ${videos.length} videos`)
console.log('\n  All videos:')
for (const v of videos) {
  console.log(`    [${v.sortOrder}] wp#${v.wpPostId} | ${v.youtubeId} | ${v.title}`)
}

// ── Step 5: Generate SQL migration ───────────────────────────────────────────
console.log('\n4. Generating SQL migration...')

const escapeSql = (str) => {
  if (str === null || str === undefined) return 'NULL'
  return "'" + String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"
}

const sqlRows = videos.map((v) =>
  `  (${escapeSql(v.id)}, ${v.sortOrder}, ${escapeSql(v.title)}, ${escapeSql(v.videoUrl)}, ` +
  `${escapeSql(v.youtubeId)}, NULL, TRUE, NOW(), NOW())`
)

const migrationSql = `-- Migration: Import WordPress video CPT posts into home_videos
-- Source: WP SQL dump bigbike_vn__2026_04_17/sqldump.sql
-- WP post_type: video | ACF field: youtube_url
-- WP homepage (page-home.php) shows latest 5 video posts; we import all for admin management.
-- embed_url and auto_thumbnail_url are computed at runtime in Java (PublicHomeVideoResponse.from).
-- Sorted by WP post ID desc (most recent first = lowest sort_order).
-- Generated: ${new Date().toISOString()}
-- Total: ${videos.length} videos
--
-- To apply: run against BigBike PostgreSQL database.
-- Note: sort_order has UNIQUE constraint (V72 migration). Run DELETE first to clear old data.

-- Clear existing WP-imported videos (identified by hv-wp- prefix)
DELETE FROM home_videos WHERE id LIKE 'hv-wp-%';

INSERT INTO home_videos
  (id, sort_order, title, video_url, youtube_id, thumbnail, is_active, created_at, updated_at)
VALUES
${sqlRows.join(',\n')};

-- Verify
SELECT id, sort_order, youtube_id, LEFT(title, 60) AS title FROM home_videos ORDER BY sort_order LIMIT 20;
`

const sqlOutPath = join(__dirname, 'import-wp-videos.sql')
writeFileSync(sqlOutPath, migrationSql, 'utf-8')
console.log(`  SQL → scripts/import-wp-videos.sql`)

const jsonOutPath = join(__dirname, 'wp-videos-extracted.json')
writeFileSync(jsonOutPath, JSON.stringify(videos, null, 2), 'utf-8')
console.log(`  JSON → scripts/wp-videos-extracted.json`)

console.log(`\n✓ Done. ${videos.length} videos ready to import.`)
console.log('  Review scripts/import-wp-videos.sql then run against BigBike DB.')
