import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) =>
      ({
        'homeVideos.title': 'Home videos',
        'homeVideos.addButton': 'Add video',
        'homeVideos.formSource': 'Video source',
        'homeVideos.sourceYoutube': 'YouTube',
        'homeVideos.sourceUpload': 'Upload / media library',
        'homeVideos.legacySourceWarning': 'Legacy source must be replaced',
        'homeVideos.statusVisible': 'Visible',
        'homeVideos.hideAction': 'Hide',
        'homeVideos.preview': 'Preview',
        'common.edit': 'Edit',
        'common.delete': 'Delete',
      })[key] || key,
  }),
}))

vi.mock('../lib/adminApi', () => ({
  fetchHomeVideos: vi.fn().mockResolvedValue({
    items: [
      {
        id: 'legacy-home-video',
        title: 'Legacy home video',
        titleEn: '',
        videoUrl: 'https://www.tiktok.com/@bigbike/video/7412345678901234567',
        youtubeId: null,
        thumbnail: null,
        isActive: true,
        sortOrder: 0,
      },
    ],
  }),
  createHomeVideo: vi.fn(),
  updateHomeVideo: vi.fn(),
  deleteHomeVideo: vi.fn(),
  reorderHomeVideos: vi.fn(),
}))

vi.mock('../components/Sortable', () => ({
  useDragSensors: () => [],
  SortableRow: ({ children }) =>
    children({
      setNodeRef: () => {},
      style: {},
      isDragging: false,
      attributes: {},
      listeners: {},
    }),
}))
vi.mock('../lib/contentLang', () => ({ useContentLang: () => 'vi' }))
vi.mock('@/lib/useUnsavedChanges', () => ({ useUnsavedChanges: () => {} }))
vi.mock('@/lib/useSaveShortcut', () => ({ useSaveShortcut: () => {} }))
vi.mock('../components/VideoPickerModal', () => ({ VideoPickerModal: () => null }))
vi.mock('../components/ImageUrlInput', () => ({ ImageUrlInput: () => null }))
vi.mock('../components/MediaRequirementHint', () => ({ MediaRequirementHint: () => null }))

import { HomeVideoListScreen } from './HomeVideoListScreen'
import { buildHomeVideoThumbnail } from './homeVideoPayload'

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = ResizeObserverMock

function renderScreen() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <HomeVideoListScreen canUpdate />
    </QueryClientProvider>,
  )
}

describe('HomeVideoListScreen video sources', () => {
  it('giữ đầy đủ metadata thumbnail do picker trả về', () => {
    expect(
      buildHomeVideoThumbnail({
        thumbnailUrl: '  /media/home/video-thumb.webp  ',
        thumbnailAlt: '  Ảnh video  ',
        thumbnailWidth: 500,
        thumbnailHeight: 900,
        thumbnailMimeType: 'image/webp',
      }),
    ).toEqual({
      url: '/media/home/video-thumb.webp',
      alt: 'Ảnh video',
      width: 500,
      height: 900,
      mimeType: 'image/webp',
    })
  })

  it('legacy record vẫn mở được nhưng form chỉ có YouTube và Upload / media library', async () => {
    const user = userEvent.setup()
    renderScreen()

    await user.click(await screen.findByRole('button', { name: 'Edit' }))

    expect(screen.getByText('Legacy source must be replaced')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'YouTube' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Upload / media library' })).toBeInTheDocument()
    expect(screen.queryByRole('radio', { name: /TikTok/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('radio', { name: /Facebook/i })).not.toBeInTheDocument()
  })
})
