import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DeferredRichTextEditor } from './DeferredRichTextEditor'

vi.mock('./RichTextEditor', () => ({
  RichTextEditor: ({ inlineOnly, value }) => (
    <div data-testid="rich-text-editor" data-inline-only={inlineOnly}>{value}</div>
  ),
}))

describe('DeferredRichTextEditor', () => {
  it('giữ khung tải của editor rồi chuyển đủ props sang editor khi chunk sẵn sàng', async () => {
    render(<DeferredRichTextEditor inlineOnly value="Nội dung" />)

    const loading = screen.getByRole('status')
    expect(loading).toHaveAttribute('aria-busy', 'true')
    // Canvas TipTap sau khi tải có chiều cao tối thiểu 200px; giữ placeholder
    // trong cùng thang spacing được duyệt để lúc gắn editor không nhảy layout.
    expect(loading.querySelector('.min-h-52')).not.toBeNull()

    const editor = await screen.findByTestId('rich-text-editor')
    expect(editor).toHaveAttribute('data-inline-only', 'true')
    expect(editor).toHaveTextContent('Nội dung')
  })
})
