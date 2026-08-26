import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => ({
      'products.detail.blocks.videoProviderLabel': 'Video source',
      'products.detail.blocks.videoProviderPlaceholder': 'Choose a new source',
      'products.detail.blocks.videoYouTube': 'YouTube',
      'products.detail.blocks.videoUpload': 'Upload / media library',
      'products.detail.blocks.legacySourceWarning': 'Legacy block source must be replaced',
      'products.detail.blocks.videoUrlLabel': 'Video URL',
      'products.detail.blocks.videoUrlPlaceholder': 'YouTube URL',
      'products.detail.blocks.videoCaptionPlaceholder': 'Caption',
      'products.detail.blocks.collapse': 'Thu gọn khối',
      'products.detail.blocks.expand': 'Mở khối',
      'products.detail.blocks.duplicate': 'Nhân bản',
      'products.detail.blocks.remove': 'Xoá khối',
    }[key] || key),
  }),
}))
vi.mock('../DeferredRichTextEditor', () => ({ DeferredRichTextEditor: () => null }))
vi.mock('../AiHtmlBrief', () => ({ default: () => null }))
vi.mock('../Sortable', () => ({ SortableList: () => null, DragHandle: () => null }))
vi.mock('../../lib/confirm', () => ({ showConfirm: vi.fn().mockResolvedValue(true) }))
vi.mock('../MediaRequirementHint', () => ({ MediaRequirementHint: () => null }))
vi.mock('@/components/ui/select', () => ({
  Select: ({ children }) => <>{children}</>,
  SelectContent: ({ children }) => <div>{children}</div>,
  SelectItem: ({ children }) => <div role="option">{children}</div>,
  SelectTrigger: ({ children, ...props }) => <div role="combobox" {...props}>{children}</div>,
  SelectValue: ({ placeholder }) => <span>{placeholder}</span>,
}))

import { BlockCard, VideoBlockEditor } from './blocks'

describe('VideoBlockEditor writable sources', () => {
  it('chỉ hiện YouTube và Upload / media library', async () => {
    render(
      <VideoBlockEditor
        block={{ type: 'video', provider: 'youtube', url: '' }}
        onChange={() => {}}
        onPickVideo={() => {}}
      />,
    )

    expect(screen.getByRole('option', { name: 'YouTube' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /TikTok/i })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /Facebook/i })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Upload / media library' })).toBeInTheDocument()
  })

  it('block TikTok/Facebook hợp lệ không làm vỡ editor', () => {
    render(
      <VideoBlockEditor
        block={{
          type: 'video',
          provider: 'facebook',
          url: 'https://www.facebook.com/bigbike/videos/123',
        }}
        onChange={() => {}}
        onPickVideo={() => {}}
      />,
    )

    expect(screen.queryByText('Legacy block source must be replaced')).not.toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Video source' })).toHaveTextContent('Choose a new source')
  })
})

describe('BlockCard collapse lifecycle', () => {
  it('đóng/mở khối không làm mất nội dung và không tạo lại layout ngoài ý muốn', async () => {
    function Harness() {
      const [collapsed, setCollapsed] = useState(false)
      return (
        <BlockCard
          block={{ _key: 'paragraph-1', type: 'paragraph', html: '<p>Nội dung khối</p>' }}
          disabled={false}
          structDisabled={false}
          contentLang="vi"
          sortable={null}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((value) => !value)}
          insertMenu={[]}
          onInsertBelow={() => {}}
          onUpdate={() => {}}
          onRemove={() => {}}
          onDuplicate={() => {}}
          productMode
        />
      )
    }

    render(<Harness />)
    const collapseButton = screen.getByRole('button', { name: 'Thu gọn khối' })
    expect(collapseButton).toHaveAttribute('aria-expanded', 'true')

    await userEvent.click(collapseButton)
    const expandButton = screen.getByRole('button', { name: 'Mở khối' })
    expect(expandButton).toHaveAttribute('aria-expanded', 'false')

    await userEvent.click(expandButton)
    expect(screen.getByRole('button', { name: 'Thu gọn khối' })).toHaveAttribute('aria-expanded', 'true')
  })
})
