import { render, screen } from '@testing-library/react'
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
    }[key] || key),
  }),
}))
vi.mock('../RichTextEditor', () => ({ RichTextEditor: () => null }))
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

import { VideoBlockEditor } from './blocks'

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
    expect(screen.getByRole('option', { name: 'Upload / media library' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /TikTok/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /Facebook/i })).not.toBeInTheDocument()
  })

  it('legacy block không làm vỡ editor và yêu cầu chọn nguồn mới', () => {
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

    expect(screen.getByText('Legacy block source must be replaced')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Video source' })).toHaveTextContent('Choose a new source')
  })
})
