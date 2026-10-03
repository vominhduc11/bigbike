#!/usr/bin/env node
// One-off, guarded article-block compaction. The public HTML is never updated.
// Usage: node scripts/ops/consolidate-article-blocks.mjs prepare|pilot|verify|all|rollback <plan-dir>
// The full batch additionally requires --confirmed-after-pilot.
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const require = createRequire(new URL('../../bigbike-admin/package.json', import.meta.url))
const { JSDOM } = require('jsdom')
const document = new JSDOM('').window.document
const PILOT_IDS = new Set(['wp-art-31801', 'wp-art-30400', 'wp-art-37910', 'wp-art-35526', 'wp-art-30416'])
const KNOWN_STALE_IDS = new Set([
  'wp-art-17468', 'wp-art-17619', 'wp-art-26075', 'wp-art-35526',
  'wp-art-37867', 'wp-art-40806', 'wp-art-41091', 'wp-art-8091',
])
const BOUNDARY_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'table', 'figure', 'img', 'video', 'iframe', 'hr', 'blockquote'])
const VISIBLE_RE = /\s|\u200b|\ufeff/gu

function sql(query) {
  const result = spawnSync('docker', [
    'exec', '-i', 'bigbike-postgres', 'sh', '-c',
    'exec psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -X -q -t -A -v ON_ERROR_STOP=1',
  ], { input: query + '\n', encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
  if (result.error || result.status !== 0) throw new Error(`PostgreSQL failed: ${result.error?.message || result.stderr?.slice(0, 1000)}`)
  return result.stdout.trim()
}

function readRows() {
  return JSON.parse(sql("SELECT COALESCE(json_agg(row_to_json(a) ORDER BY a.id), '[]'::json) FROM articles a;"))
}

function fragment(html) {
  const template = document.createElement('template')
  template.innerHTML = html || ''
  return template.content
}

function textOf(html) { return fragment(html).textContent || '' }
function compactText(text) { return (text || '').replace(VISIBLE_RE, '') }
function escaped(text) {
  const span = document.createElement('span')
  span.textContent = text || ''
  return span.innerHTML
}

function blockText(block) {
  if (!block) return ''
  if (block.type === 'paragraph' || block.type === 'table' || block.type === 'callout') return textOf(block.html)
  if (block.type === 'heading') return block.text || ''
  if (block.type === 'list') return (block.items || []).join('')
  if (block.type === 'image' || block.type === 'video') return block.caption || ''
  if (block.type === 'feature') return [block.caption, block.subheading, block.heading, textOf(block.html)].join('')
  return ''
}

function blocksText(blocks) { return compactText((blocks || []).map(blockText).join('')) }
function htmlText(html) { return compactText(textOf(html || '')) }

function isBoldSubheading(p) {
  if (p.tagName?.toLowerCase() !== 'p') return false
  const content = p.textContent?.trim() || ''
  if (!content || content.length > 120 || /[.!…]$/.test(content)
      || p.closest('table, figure, ul, ol, li, blockquote')
      || p.querySelector('img, video, iframe, table, a')) return false
  if (/^(bold|[6-9]00)$/i.test(p.style.fontWeight || '')) return true
  const elements = [...p.children]
  if (elements.length !== 1) return false
  const tag = elements[0].tagName.toLowerCase()
  if (tag !== 'strong' && tag !== 'b'
      && !(tag === 'span' && /^(bold|[6-9]00)$/i.test(elements[0].style.fontWeight || ''))) return false
  return ![...p.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())
}

function hasBoundaryInside(node) {
  if (node.nodeType !== 1) return false
  const tag = node.tagName.toLowerCase()
  if (BOUNDARY_TAGS.has(tag) || isBoldSubheading(node)) return true
  return [...node.children].some(hasBoundaryInside)
}

function classify(node) {
  if (node.nodeType !== 1) return 'prose'
  const tag = node.tagName.toLowerCase()
  if (BOUNDARY_TAGS.has(tag) || isBoldSubheading(node)) return 'boundary'
  if (tag !== 'p' && tag !== 'span' && tag !== 'em' && tag !== 'i' && tag !== 'strong' && tag !== 'b') return 'boundary'
  return hasBoundaryInside(node) ? 'boundary' : 'prose'
}

function paragraphParts(block) {
  const root = fragment(block.html)
  const nodes = [...root.childNodes].filter(n => n.nodeType !== 3 || n.textContent.trim())
  // Split nested wrappers at headings/lists/images too. Each fragment keeps the
  // ancestor wrapper attributes so its editor HTML still carries the old styling.
  const explode = node => {
    if (node.nodeType === 1 && ['div', 'section'].includes(node.tagName.toLowerCase())
        && [...node.children].some(hasBoundaryInside)) {
      const children = [...node.childNodes].filter(n => n.nodeType !== 3 || n.textContent.trim())
      if (children.length) return children.flatMap(child => explode(child).map(part => {
        const shell = node.cloneNode(false)
        shell.appendChild(part.node.cloneNode(true))
        return { node: shell, kind: part.kind }
      }))
    }
    return [{ node, kind: classify(node) }]
  }
  const expanded = nodes.flatMap(explode).map(part => ({
    html: part.node.outerHTML || escaped(part.node.textContent), kind: part.kind,
  }))
  if (!expanded.length) return [{ block, kind: 'boundary' }]
  if (expanded.length === 1) return [{ block, kind: expanded[0].kind }]
  // Splitting is necessary only where the original block crosses a boundary.
  if (expanded.every(part => part.kind === 'prose')) return [{ block, kind: 'prose' }]
  return expanded.map(part => ({ block: { ...block, html: part.html }, kind: part.kind }))
}

function simpleWebImage(node) {
  const tag = node.tagName?.toLowerCase()
  if (tag === 'img' && node.getAttribute('src')) {
    return { type: 'image', url: node.getAttribute('src'), alt: node.getAttribute('alt') || '', caption: '' }
  }
  if (tag !== 'figure') return null
  const imgs = node.querySelectorAll('img[src]')
  if (imgs.length !== 1 || node.querySelector('a, video, iframe, table') || [...node.children].some(c => !['IMG', 'FIGCAPTION'].includes(c.tagName))) return null
  const caption = node.querySelector('figcaption')
  if (caption?.children.length || node.getAttributeNames().length || imgs[0].getAttributeNames().some(a => !['src', 'alt'].includes(a))) return null
  return { type: 'image', url: imgs[0].getAttribute('src'), alt: imgs[0].getAttribute('alt') || '', caption: caption?.textContent || '' }
}

function reconstructFromWeb(body) {
  const output = []
  for (const node of [...fragment(body).childNodes]) {
    if (node.nodeType === 3 && !node.textContent.trim()) continue
    if (node.nodeType !== 1) {
      if (node.nodeType === 3) output.push({ type: 'paragraph', html: `<p>${escaped(node.textContent)}</p>` })
      continue
    }
    const tag = node.tagName.toLowerCase()
    const image = simpleWebImage(node)
    if (image) output.push(image)
    else if (tag === 'table') output.push({ type: 'table', html: node.outerHTML })
    else if (tag === 'h2' || tag === 'h3') {
      if (!node.children.length && !node.getAttributeNames().length && node.textContent.length <= 500)
        output.push({ type: 'heading', level: Number(tag[1]), text: node.textContent })
      else output.push({ type: 'paragraph', html: node.outerHTML })
    } else if (tag === 'ul' || tag === 'ol') {
      if (![...node.children].some(c => c.tagName !== 'LI' || c.children.length) && !node.getAttributeNames().length)
        output.push({ type: 'list', style: tag === 'ol' ? 'numbered' : 'bulleted', items: [...node.children].map(c => c.textContent) })
      else output.push({ type: 'paragraph', html: node.outerHTML })
    } else output.push({ type: 'paragraph', html: node.outerHTML })
  }
  return output
}

function captionCandidate(image, next) {
  if (image.type !== 'image' || image.caption?.trim() || next?.type !== 'paragraph') return null
  const children = [...fragment(next.html).childNodes].filter(n => n.nodeType !== 3 || n.textContent.trim())
  if (children.length !== 1 || children[0].tagName?.toLowerCase() !== 'p')
    return { uncertain: 'text_after_image_has_complex_markup', caption: textOf(next.html).trim() }
  const p = children[0]
  const caption = p.textContent || ''
  if (!caption.trim()) return { uncertain: 'empty_spacing_after_image', caption: '' }
  if (caption.length > 160 || p.querySelector('a, img, table, video, iframe, h1, h2, h3, h4, h5, h6'))
    return { uncertain: 'text_after_image_not_a_certain_caption', caption: caption.trim() }
  const markup = p.outerHTML
  const styled = /text-align\s*:\s*center|font-style\s*:\s*italic/i.test(markup)
    || p.querySelector('em, i') || /caption|wp-caption-text/i.test(p.className)
  if (!styled) return { uncertain: 'short_text_after_image', caption: caption.trim() }
  const textNodes = []
  const visit = node => {
    if (node.nodeType === 3 && node.textContent.trim()) textNodes.push(node)
    for (const child of node.childNodes || []) visit(child)
  }
  visit(p)
  if (textNodes.length !== 1 || caption.length > 500) return { uncertain: 'styled_caption_has_multiple_text_parts', caption: caption.trim() }
  const clone = p.cloneNode(true)
  const cloneTexts = []
  visitClone(clone, cloneTexts)
  cloneTexts[0].textContent = '{{caption}}'
  const template = clone.outerHTML
  if (template.length > 5000) return { uncertain: 'caption_markup_too_long', caption: caption.trim() }
  return { caption: textNodes[0].textContent, template }
}

function visitClone(node, list) {
  if (node.nodeType === 3 && node.textContent.trim()) list.push(node)
  for (const child of node.childNodes || []) visitClone(child, list)
}

function sourceImages(blocks) {
  const result = []
  for (const b of blocks || []) {
    if (b.type === 'image') result.push(b.url)
    for (const field of ['html']) {
      if (!b[field]) continue
      for (const image of fragment(b[field]).querySelectorAll('img')) result.push(image.getAttribute('src'))
    }
  }
  return result
}

function compact(row) {
  const before = row.body_blocks || []
  const stale = KNOWN_STALE_IDS.has(row.id)
  if (!stale && blocksText(before) !== htmlText(row.body))
    throw new Error(`${row.id}: unlisted pre-existing web/editor text mismatch`)
  const input = stale ? reconstructFromWeb(row.body) : before
  const pieces = input.flatMap(block => block.type === 'paragraph'
    ? paragraphParts(block) : [{ block, kind: 'boundary' }])
  const result = []
  const skipped = []
  let captions = 0
  for (let i = 0; i < pieces.length; i++) {
    const { block, kind } = pieces[i]
    if (block.type === 'image' && i + 1 < pieces.length) {
      const candidate = captionCandidate(block, pieces[i + 1].block)
      if (candidate?.uncertain) skipped.push({ afterBlock: i + 1, reason: candidate.uncertain, text: candidate.caption.slice(0, 160) })
      if (candidate?.template) {
        result.push({ ...block, caption: candidate.caption, captionHtmlTemplate: candidate.template })
        captions++
        i++
        continue
      }
    }
    const previous = result.at(-1)
    const previousIsProse = previous?.type === 'paragraph' && previous.__prose === true
    const mergeHtml = block.type === 'paragraph' ? block.html || '' : ''
    if (kind === 'prose' && previousIsProse && previous.html.length + mergeHtml.length <= 50000) {
      previous.html += mergeHtml
    } else if (kind === 'prose' && block.type === 'paragraph') {
      result.push({ ...block, __prose: true })
    } else result.push({ ...block })
  }
  const output = result.map(({ __prose: _, ...block }) => block)
  if (output.length > 400) throw new Error(`${row.id}: exceeds 400 blocks`)
  for (const block of output) if (block.type === 'paragraph' && (block.html || '').length > 50000) throw new Error(`${row.id}: paragraph exceeds 50000 chars`)
  if (stale ? blocksText(output) !== htmlText(row.body) : blocksText(output) !== blocksText(before)) {
    throw new Error(`${row.id}: text changed during compaction`)
  }
  if (JSON.stringify(sourceImages(output)) !== JSON.stringify(sourceImages(input))) throw new Error(`${row.id}: image URL/order changed`)
  for (const block of output) {
    if (block.type !== 'paragraph') continue
    const root = fragment(block.html)
    if (!root.querySelector('h1,h2,h3,h4,h5,h6')) continue
    const withoutHeadings = root.cloneNode(true)
    for (const heading of withoutHeadings.querySelectorAll('h1,h2,h3,h4,h5,h6')) heading.remove()
    if (withoutHeadings.textContent.trim()) throw new Error(`${row.id}: heading shares a block with prose`)
  }
  for (const block of output) {
    if (block.type !== 'paragraph') continue
    const root = fragment(block.html)
    const subheadings = [...root.querySelectorAll('p')].filter(isBoldSubheading)
    if (!subheadings.length) continue
    const withoutSubheadings = root.cloneNode(true)
    for (const p of [...withoutSubheadings.querySelectorAll('p')].filter(isBoldSubheading)) p.remove()
    if (withoutSubheadings.textContent.trim()) throw new Error(`${row.id}: bold subheading shares a block with prose`)
  }
  return { output, stale, captions, skipped }
}

function hash(text) { return crypto.createHash('sha256').update(text || '', 'utf8').digest('hex') }
function saveJson(file, object) { fs.writeFileSync(file, JSON.stringify(object), { mode: 0o600, flag: 'wx' }) }
function loadPlan(dir) {
  const baseline = JSON.parse(fs.readFileSync(path.join(dir, 'baseline.json'), 'utf8'))
  const plan = JSON.parse(fs.readFileSync(path.join(dir, 'plan.json'), 'utf8'))
  if (hash(JSON.stringify(baseline)) !== plan.baselineSha256) throw new Error('Baseline checksum mismatch')
  return { baseline, plan }
}
function q(value) { return `'${String(value).replaceAll("'", "''")}'` }
function jsonSql(value) {
  if (value === null || value === undefined) return 'NULL::jsonb'
  return `convert_from(decode('${Buffer.from(JSON.stringify(value)).toString('base64')}','base64'),'UTF8')::jsonb`
}
function nullableHashPredicate(column, value) {
  return value === null ? `${column} IS NULL` : `${column} IS NOT NULL AND md5(${column})=${q(crypto.createHash('md5').update(value).digest('hex'))}`
}
function updateStatement(original, proposed, rollback) {
  const expected = rollback ? proposed : original.body_blocks
  const replacement = rollback ? original.body_blocks : proposed
  const version = rollback ? original.version + 1 : original.version
  const nextVersion = rollback ? original.version : original.version + 1
  return `UPDATE articles SET body_blocks=${jsonSql(replacement)}, version=${nextVersion}
    WHERE id=${q(original.id)} AND version=${version}
      AND body_blocks IS NOT DISTINCT FROM ${jsonSql(expected)}
      AND ${nullableHashPredicate('body', original.body)}
      AND ${nullableHashPredicate('body_en', original.body_en)};
    IF NOT FOUND THEN RAISE EXCEPTION 'Concurrent change or missing article: %', ${q(original.id)}; END IF;`
}
function applyRows(rows, entries, rollback = false, probe = false) {
  const statements = entries.map(entry => updateStatement(rows.get(entry.id), entry.blocks, rollback))
  if (!statements.length) return
  sql(`BEGIN; DO $article_compaction$ BEGIN\n${statements.join('\n')}\nEND $article_compaction$; ${probe ? 'ROLLBACK' : 'COMMIT'};`)
}

function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson)
  if (value && typeof value === 'object') return Object.fromEntries(
    Object.keys(value).sort().map(key => [key, canonicalJson(value[key])]))
  return value
}
function sameJson(a, b) { return JSON.stringify(canonicalJson(a)) === JSON.stringify(canonicalJson(b)) }

const [command, dirArg, ...flags] = process.argv.slice(2)
if (!['prepare', 'probe', 'probe-rollback', 'pilot', 'verify', 'all', 'rollback'].includes(command))
  throw new Error('Expected prepare|probe|probe-rollback|pilot|verify|all|rollback')
if (command === 'prepare') {
  const dir = dirArg || path.join('/root/exports', `article-block-compact-${new Date().toISOString().replace(/[:.]/g, '-')}`)
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
  fs.chmodSync(dir, 0o700)
  const baseline = readRows()
  const entries = []
  const report = []
  for (const row of baseline) {
    const { output, stale, captions, skipped } = compact(row)
    const before = row.body_blocks || []
    if (!sameJson(output, before)) entries.push({ id: row.id, blocks: output })
    report.push({ id: row.id, slug: row.slug, status: row.publish_status, before: before.length,
      after: output.length, staleRepair: stale, captionsMoved: captions, skipped,
      bodySha256: hash(row.body), bodyEnSha256: hash(row.body_en) })
  }
  if (baseline.length !== 185) throw new Error(`Expected 185 articles, found ${baseline.length}; review scope before continuing`)
  if (PILOT_IDS.size !== 5 || [...PILOT_IDS].some(id => !baseline.some(row => row.id === id))) throw new Error('Pilot article missing')
  saveJson(path.join(dir, 'baseline.json'), baseline)
  saveJson(path.join(dir, 'plan.json'), { baselineSha256: hash(JSON.stringify(baseline)), entries, report })
  const totalBefore = report.reduce((sum, item) => sum + item.before, 0)
  const totalAfter = report.reduce((sum, item) => sum + item.after, 0)
  const lines = [
    '# Gộp khối bài viết tin tức', '',
    `Tổng: ${baseline.length} bài; ${totalBefore} → ${totalAfter} khối.`,
    `Chú thích đã chuyển: ${report.reduce((n, item) => n + item.captionsMoved, 0)}.`,
    `Dòng dưới ảnh để nguyên: ${report.reduce((n, item) => n + item.skipped.length, 0)}.`, '',
    '| ID | Đường dẫn | Trước | Sau | Sửa lệch cũ |', '|---|---|---:|---:|---|',
    ...report.map(item => `| ${item.id} | ${item.slug} | ${item.before} | ${item.after} | ${item.staleRepair ? 'có' : ''} |`),
    '', '## Dòng dưới ảnh chưa chắc là chú thích', '',
    ...report.flatMap(item => item.skipped.map(skip => `- ${item.id} / ${item.slug}, sau khối ${skip.afterBlock}: ${skip.reason} — ${skip.text.replaceAll('\n', ' ')}`)),
  ]
  fs.writeFileSync(path.join(dir, 'report.md'), lines.join('\n') + '\n', { mode: 0o600, flag: 'wx' })
  console.log(JSON.stringify({ dir, articles: baseline.length, before: totalBefore, after: totalAfter,
    changed: entries.length, captionsMoved: report.reduce((n, item) => n + item.captionsMoved, 0),
    skipped: report.reduce((n, item) => n + item.skipped.length, 0) }))
} else {
  if (!dirArg) throw new Error('Plan directory required')
  const { baseline, plan } = loadPlan(dirArg)
  const byId = new Map(baseline.map(row => [row.id, row]))
  const current = new Map(readRows().map(row => [row.id, row]))
  if (command === 'verify') {
    const deviations = []
    const proposed = new Map(plan.entries.map(entry => [entry.id, entry.blocks]))
    for (const original of baseline) {
      const actual = current.get(original.id)
      if (!actual) {
        deviations.push({ id: original.id, reason: 'article missing' })
        continue
      }
      for (const key of Object.keys(original)) {
        if (key === 'body_blocks' || key === 'version') continue
        if (!sameJson(actual[key], original[key]))
          deviations.push({ id: original.id, reason: `${key} changed` })
      }
      if (!sameJson(actual.body_blocks, original.body_blocks)
          && !sameJson(actual.body_blocks, proposed.get(original.id)))
        deviations.push({ id: original.id, reason: 'blocks differ from baseline and plan' })
    }
    console.log(JSON.stringify({ articles: baseline.length, deviations, applied: plan.entries.filter(entry =>
      sameJson(current.get(entry.id)?.body_blocks, entry.blocks)).length }))
    if (deviations.length) process.exitCode = 1
  } else {
    if (command === 'all' && !flags.includes('--confirmed-after-pilot')) throw new Error('Full run requires explicit --confirmed-after-pilot')
    const entries = plan.entries.filter(entry => ['pilot', 'probe', 'probe-rollback'].includes(command) ? PILOT_IDS.has(entry.id)
      : command === 'all' ? !PILOT_IDS.has(entry.id) : flags.includes('--all') || PILOT_IDS.has(entry.id))
    const pending = entries.filter(entry => {
      const original = byId.get(entry.id)
      const actual = current.get(entry.id)
      const expected = command === 'rollback' || command === 'probe-rollback' ? entry.blocks : original.body_blocks
      return sameJson(actual?.body_blocks, expected)
    })
    if (pending.length !== entries.length) throw new Error(`Some selected articles are not at expected state (${pending.length}/${entries.length}); run verify and review`)
    applyRows(byId, pending, command === 'rollback' || command === 'probe-rollback',
      command === 'probe' || command === 'probe-rollback')
    console.log(JSON.stringify({ command, updated: pending.length, ids: pending.map(entry => entry.id) }))
  }
}
