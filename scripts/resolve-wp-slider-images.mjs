/**
 * Resolve WP slider attachment IDs to real file URLs.
 * Post 12 (homepage) has 7 slides with ACF fields sliders_0..6.
 */
import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DUMP_PATH = join(__dirname, '../bigbike_vn__2026_04_17/sqldump.sql')
const WP_BASE = 'https://bigbike.vn/wp-content/uploads'

console.log('Reading SQL dump...')
const sql = readFileSync(DUMP_PATH, 'utf-8')

// WP slides from post 12 (parsed manually above)
const WP_SLIDES = [
  { idx: 0, imgId: '39386', mobId: '39389', productId: '37433', wpLink: 'mu-bao-hiem-fullface-ilm-racing-helmet-mf509' },
  { idx: 1, imgId: '39425', mobId: '',      productId: '39156', wpLink: 'gang-tay-mo-to-ilm-thoang-khi-cho-nam-va-nu-jc08' },
  { idx: 2, imgId: '39349', mobId: '39348', productId: '38995', wpLink: 'ao-giap-bao-ho-mua-he-ls2-garda-air' },
  { idx: 3, imgId: '36778', mobId: '36779', productId: '36772', wpLink: 'tai-nghe-scs-s9x-bluetooth-cho-mu-bao-hiem' },
  { idx: 4, imgId: '35317', mobId: '35315', productId: '35026', wpLink: 'tai-nghe-scs-s7x-bluetooth-cho-mu-bao-hiem' },
  { idx: 5, imgId: '33940', mobId: '33941', productId: '33022', wpLink: 'ao-quan-bao-ho-adv-spyke-sahara-vented' },
  { idx: 6, imgId: '32385', mobId: '32375', productId: '',      wpLink: 'tai-nghe-bluetooth-gan-mu-bao-hiem' },
]

const allIds = new Set(WP_SLIDES.flatMap(s => [s.imgId, s.mobId].filter(Boolean)))

// Resolve _wp_attached_file
const filePaths = {}
// Simple line-by-line search
const lines = sql.split('\n')
for (const line of lines) {
  if (!line.includes('_wp_attached_file')) continue
  // Match: (meta_id,post_id,'_wp_attached_file','path')
  const matches = line.matchAll(/\((\d+),(\d+),'_wp_attached_file','([^']+)'\)/g)
  for (const m of matches) {
    const postId = m[2]
    if (allIds.has(postId)) {
      filePaths[postId] = `${WP_BASE}/${m[3]}`
    }
  }
}

// Resolve _wp_attachment_image_alt
const alts = {}
for (const line of lines) {
  if (!line.includes('_wp_attachment_image_alt')) continue
  const matches = line.matchAll(/\((\d+),(\d+),'_wp_attachment_image_alt','([^']*)'\)/g)
  for (const m of matches) {
    if (allIds.has(m[2])) {
      alts[m[2]] = m[3]
    }
  }
}

console.log('\nWP Slider Data (7 slides, post 12):')
const result = []
for (const s of WP_SLIDES) {
  const desktopUrl = filePaths[s.imgId] || null
  const mobileUrl  = s.mobId ? (filePaths[s.mobId] || null) : null
  const alt = alts[s.imgId] || ''

  const item = {
    wpIndex: s.idx,
    backendId: `slider_home_${s.idx}`,
    desktopUrl,
    mobileUrl,
    alt,
    productId: s.productId ? `wp-prod-${s.productId}` : null,
    wpProductSlug: s.wpLink || null,
    _imgId: s.imgId,
    _mobId: s.mobId || null,
  }
  result.push(item)

  console.log(`\nSlide ${s.idx} (${item.backendId}):`)
  console.log(`  desktop: ${desktopUrl || '!! NOT FOUND (id=' + s.imgId + ')'}`)
  console.log(`  mobile:  ${mobileUrl || (s.mobId ? '!! NOT FOUND (id=' + s.mobId + ')' : 'null')}`)
  console.log(`  alt:     ${alt || '(no alt)'}`)
  console.log(`  product: ${item.productId || 'null (SCS brand link)'}`)
}

// Check missing
const missing = [...allIds].filter(id => !filePaths[id])
if (missing.length) {
  console.log('\n!! Missing attachment file paths for IDs:', missing.join(', '))
  console.log('   These might be in a different INSERT block — trying broader search...')

  for (const missingId of missing) {
    // Search anywhere in SQL for this attachment
    const idx = sql.indexOf(`,${missingId},'_wp_attached_file','`)
    if (idx > -1) {
      const snippet = sql.slice(idx, idx + 200)
      const m = snippet.match(/'_wp_attached_file','([^']+)'/)
      if (m) {
        filePaths[missingId] = `${WP_BASE}/${m[1]}`
        console.log(`  Found ${missingId} via broader search: ${filePaths[missingId]}`)
      }
    }
  }
}

// Final resolve pass for result
for (const item of result) {
  if (!item.desktopUrl && filePaths[item._imgId]) item.desktopUrl = filePaths[item._imgId]
  if (!item.mobileUrl && item._mobId && filePaths[item._mobId]) item.mobileUrl = filePaths[item._mobId]
}

const outPath = join(__dirname, 'wp-sliders-resolved.json')
writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf-8')
console.log('\nSaved → scripts/wp-sliders-resolved.json')

// Also compare with current backend data
console.log('\n=== COMPARISON WITH CURRENT BACKEND ===')
const CURRENT_BACKEND = [
  { id: 'slider_home_0', desktop: 'tro-chuyen-doi-ket-noi-mai-s9xm-4.jpg', product: 'wp-prod-38469', note: 'SCS S9XM — NOT in WP dump post 12' },
  { id: 'slider_home_1', desktop: 'csbrdve-1.jpg',            product: 'wp-prod-37433', note: 'ILM MF509 = WP slide 0' },
  { id: 'slider_home_2', desktop: 'jlm-jc08.jpg',             product: 'wp-prod-39156', note: 'ILM JC08 = WP slide 1' },
  { id: 'slider_home_3', desktop: 'ls2-como-vs-garda.jpg',    product: 'wp-prod-38995', note: 'LS2 Garda Air = WP slide 2' },
  { id: 'slider_home_4', desktop: 'scs-s9x.jpg',              product: 'wp-prod-36772', note: 'SCS S9X = WP slide 3' },
  { id: 'slider_home_5', desktop: 'scs-s7x-banner-1.jpg',     product: 'wp-prod-35026', note: 'SCS S7X = WP slide 4' },
  { id: 'slider_home_6', desktop: 'spyke.jpg',                product: 'wp-prod-33022', note: 'ADV Spyke = WP slide 5' },
  { id: 'slider_home_7', desktop: 'SCS-NEW-03-03-2.png',      product: null,            note: 'SCS brand = WP slide 6' },
]
console.log('\nBackend has 8 slides vs WP has 7.')
console.log('slider_home_0 (SCS S9XM) is extra — NOT in WP dump (likely newer than April 2026 dump)')
console.log('\nWP slide 0 = ILM MF509 → maps to backend slider_home_1')
console.log('\nImages to verify on bigbike.vn:')
for (const item of result) {
  if (item.desktopUrl) {
    console.log(`  Slide ${item.wpIndex}: ${item.desktopUrl}`)
  } else {
    console.log(`  Slide ${item.wpIndex}: !! desktop URL missing`)
  }
}
