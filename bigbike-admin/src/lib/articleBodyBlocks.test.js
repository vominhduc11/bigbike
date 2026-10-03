import { describe, expect, it } from 'vitest'
import { articleBodyBlocks } from './articleBodyBlocks'
import { buildFormFromItem, toPayload } from '../screens/content-detail/constants'
import { CONTENT_MENU, PRODUCT_MENU, createBlock } from '../components/block-editor/constants'

describe('editable article recovery', () => {
  const body =
    '<h2>Bảo hộ</h2><p>Nội dung cũ <a href="/product/mu/">mũ</a></p><table><tbody><tr><th>Cỡ</th><td colspan="2">M</td></tr></tbody></table><ul><li><a href="/tin-tuc/">Tin tức</a><ul><li>Chi tiết</li></ul></li></ul>'

  it('keeps text, links, merged table cells and nested lists in editable blocks', () => {
    const blocks = articleBodyBlocks(body)
    expect(blocks.map((block) => block.type)).toEqual([
      'heading',
      'paragraph',
      'table',
      'paragraph',
    ])
    expect(blocks[2].html).toContain('colspan="2"')
    expect(blocks[3].html).toContain('<a href="/tin-tuc/">')
    expect(blocks[3].html).toContain('<ul><li>Chi tiết</li></ul>')
  })

  it('adding one block to a recovered article retains all original content on save', () => {
    const item = { slug: 'bai-viet', title: 'Bài viết', body, bodyBlocks: null }
    const original = structuredClone(item)
    const form = buildFormFromItem('ARTICLE', item)
    form.bodyBlocks.push(createBlock('paragraph', { html: '<p>Phần mới</p>' }))
    const payload = toPayload(form, false)
    expect(payload.bodyBlocks).toHaveLength(5)
    expect(payload.bodyBlocks[1].html).toContain('Nội dung cũ')
    expect(payload.bodyBlocks[2].type).toBe('table')
    expect(item).toEqual(original)
  })

  it('keeps existing blocks and intentional empty articles unchanged', () => {
    const existing = [{ type: 'paragraph', html: '<p>Khối đã sửa</p>' }]
    expect(buildFormFromItem('ARTICLE', { body, bodyBlocks: existing }).bodyBlocks[0].html).toBe(
      existing[0].html,
    )
    expect(buildFormFromItem('ARTICLE', { body: '', bodyBlocks: [] }).bodyBlocks).toEqual([])
  })

  it('offers tables only in the article editor', () => {
    expect(CONTENT_MENU.map((entry) => entry.type)).toContain('table')
    expect(PRODUCT_MENU.map((entry) => entry.type)).not.toContain('table')
  })
})
