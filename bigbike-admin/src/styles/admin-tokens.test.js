import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(resolve('src/styles/admin-tokens.css'), 'utf8')

function declarations(block) {
  return Object.fromEntries(
    [...block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(([, name, value]) => [
      name,
      value.replace(/\/\*[\s\S]*?\*\//g, '').trim(),
    ]),
  )
}

const lightBlock = css.match(/:root\s*\{([\s\S]*?)\n\}/)?.[1] || ''
const darkBlock = css.match(/\[data-theme="dark"\]\s*\{([\s\S]*?)\n\}/)?.[1] || ''
const lightTokens = declarations(lightBlock)
const darkTokens = { ...lightTokens, ...declarations(darkBlock) }

function resolveToken(name, tokens, seen = new Set()) {
  if (seen.has(name)) throw new Error(`Circular token reference: ${name}`)
  seen.add(name)
  const raw = tokens[name]
  if (!raw) throw new Error(`Missing token: ${name}`)
  const variable = raw.match(/^var\((--[\w-]+)\)$/)
  return variable ? resolveToken(variable[1], tokens, seen) : raw
}

function parseColor(raw) {
  if (/^#[\da-f]{6}$/i.test(raw)) {
    return {
      r: Number.parseInt(raw.slice(1, 3), 16),
      g: Number.parseInt(raw.slice(3, 5), 16),
      b: Number.parseInt(raw.slice(5, 7), 16),
      a: 1,
    }
  }
  const rgba = raw.match(
    /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/i,
  )
  if (!rgba) throw new Error(`Unsupported color: ${raw}`)
  return {
    r: Number(rgba[1]),
    g: Number(rgba[2]),
    b: Number(rgba[3]),
    a: rgba[4] == null ? 1 : Number(rgba[4]),
  }
}

function composite(foreground, background) {
  return {
    r: foreground.r * foreground.a + background.r * (1 - foreground.a),
    g: foreground.g * foreground.a + background.g * (1 - foreground.a),
    b: foreground.b * foreground.a + background.b * (1 - foreground.a),
    a: 1,
  }
}

function opaqueColor(token, tokens) {
  const color = parseColor(resolveToken(token, tokens))
  if (color.a === 1) return color
  const base = parseColor(resolveToken('--admin-color-surface-base', tokens))
  return composite(color, base)
}

function luminance(color) {
  const linear = [color.r, color.g, color.b].map((channel) => {
    const value = channel / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]
}

function contrast(foreground, background) {
  const light = Math.max(luminance(foreground), luminance(background))
  const dark = Math.min(luminance(foreground), luminance(background))
  return (light + 0.05) / (dark + 0.05)
}

const semanticPairs = [
  ['body-primary', '--admin-color-text-primary', '--admin-color-surface-base'],
  ['body-secondary', '--admin-color-text-secondary', '--admin-color-surface-base'],
  ['body-muted', '--admin-color-text-muted', '--admin-color-surface-base'],
  ['input-placeholder', '--admin-color-text-placeholder', '--admin-color-surface-base'],
  ['page-primary', '--admin-color-text-primary', '--admin-color-background-page'],
  ['page-secondary', '--admin-color-text-secondary', '--admin-color-background-page'],
  ['page-muted', '--admin-color-text-muted', '--admin-color-background-page'],
  ['page-placeholder', '--admin-color-text-placeholder', '--admin-color-background-page'],
  ['muted-surface-primary', '--admin-color-text-primary', '--admin-color-surface-muted'],
  ['muted-surface-secondary', '--admin-color-text-secondary', '--admin-color-surface-muted'],
  ['muted-surface-muted', '--admin-color-text-muted', '--admin-color-surface-muted'],
  ['raised-surface-primary', '--admin-color-text-primary', '--admin-color-surface-raised'],
  ['primary-button', '--admin-color-on-primary', '--admin-color-primary'],
  ['primary-subtle', '--admin-color-primary-subtle-text', '--admin-color-primary-subtle'],
  ['success-status', '--admin-color-status-success-text', '--admin-color-status-success-bg'],
  ['warning-status', '--admin-color-status-warning-text', '--admin-color-status-warning-bg'],
  [
    'warning-orange-status',
    '--admin-color-status-warning-orange-text',
    '--admin-color-status-warning-orange-bg',
  ],
  ['danger-status', '--admin-color-status-danger-text', '--admin-color-status-danger-bg'],
  ['info-status', '--admin-color-status-info-text', '--admin-color-status-info-bg'],
  ['neutral-status', '--admin-color-status-neutral-text', '--admin-color-status-neutral-bg'],
  ['primary-link', '--admin-color-primary', '--admin-color-surface-base'],
  ['primary-active-link', '--admin-color-primary-active', '--admin-color-background-page'],
]

describe.each([
  ['light', lightTokens],
  ['dark', darkTokens],
])('admin semantic contrast — %s', (_theme, tokens) => {
  it.each(semanticPairs)('%s đạt tối thiểu 4.5:1', (_name, foregroundToken, backgroundToken) => {
    const ratio = contrast(
      opaqueColor(foregroundToken, tokens),
      opaqueColor(backgroundToken, tokens),
    )
    expect(
      ratio,
      `${foregroundToken} / ${backgroundToken}: ${ratio.toFixed(2)}:1`,
    ).toBeGreaterThanOrEqual(4.5)
  })
})
