import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  fetchHomeVideos: vi.fn(),
  fetchSettings: vi.fn(),
  batchUpdateSettings: vi.fn(),
  hasPermission: vi.fn(() => true),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) =>
      ({
        'homeVideos.title': 'Home videos',
        'homeVideos.addButton': 'Add video',
        'homeVideos.formSource': 'Video source',
        'homeVideos.sourceYoutube': 'YouTube',
        'homeVideos.sourceTikTok': 'TikTok',
        'homeVideos.sourceFacebook': 'Facebook',
        'homeVideos.sourceUpload': 'Upload / media library',
        'homeVideos.legacySourceWarning': 'Legacy source must be replaced',
        'homeVideos.statusVisible': 'Visible',
        'homeVideos.statusHomepage': 'On homepage',
        'homeVideos.statusEnabledOutside': 'Enabled, outside the first 10',
        'homeVideos.hideAction': 'Hide',
        'homeVideos.channelTitle': 'Automatic YouTube source',
        'homeVideos.channelDescription': 'Checked nightly',
        'homeVideos.channelLabel': 'Official YouTube channel',
        'homeVideos.channelHint': 'Use a channel page',
        'homeVideos.channelSave': 'Save YouTube channel',
        'homeVideos.channelValidation': 'Invalid channel address',
        'homeVideos.channelSaveSuccess': 'Channel saved',
        'homeVideos.homepageRuleHint': 'The first ten enabled videos appear',
        'homeVideos.filterHomepage': 'On homepage',
        'homeVideos.filterEnabledOutside': 'Enabled, outside the first 10',
        'homeVideos.selectVideo': 'Select video',
        'homeVideos.previewVideo': 'Preview video',
        'homeVideos.preview': 'Preview',
        'common.edit': 'Edit',
        'common.delete': 'Delete',
      })[key] || key,
  }),
}))

vi.mock('../lib/adminApi', () => ({
  fetchHomeVideos: mocks.fetchHomeVideos,
  createHomeVideo: vi.fn(),
  updateHomeVideo: vi.fn(),
  deleteHomeVideo: vi.fn(),
  reorderHomeVideos: vi.fn(),
  fetchSettings: mocks.fetchSettings,
  batchUpdateSettings: mocks.batchUpdateSettings,
}))

vi.mock('@/lib/auth', () => ({
  useHasPermission: () => mocks.hasPermission,
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
import { buildHomeVideoThumbnail, isValidYouTubeChannelUrl } from './homeVideoPayload'

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

function video(overrides = {}) {
  return {
    id: 'legacy-home-video',
    title: 'Legacy home video',
    titleEn: '',
    videoUrl: 'https://www.tiktok.com/@bigbike/video/7412345678901234567',
    youtubeId: null,
    thumbnail: null,
    isActive: true,
    sortOrder: 0,
    ...overrides,
  }
}

describe('HomeVideoListScreen video sources', () => {
  beforeEach(() => {
    mocks.hasPermission.mockReturnValue(true)
    mocks.fetchHomeVideos.mockResolvedValue({ items: [video()] })
    mocks.fetchSettings.mockResolvedValue({
      items: [{ key: 'youtube_url', value: 'https://www.youtube.com/@bigbike-shop' }],
    })
    mocks.batchUpdateSettings.mockResolvedValue({
      items: [{ key: 'youtube_url', value: 'https://www.youtube.com/@new-channel' }],
    })
  })

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

  it('bản ghi TikTok đầy đủ mở được với đủ bốn nguồn hợp lệ', async () => {
    const user = userEvent.setup()
    renderScreen()

    await user.click(await screen.findByRole('button', { name: 'Edit' }))

    expect(screen.queryByText('Legacy source must be replaced')).not.toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'YouTube' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Upload / media library' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /TikTok/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Facebook/i })).toBeInTheDocument()
  })

  it('phân biệt 10 video trên trang chủ với video đang bật nhưng nằm ngoài', async () => {
    mocks.fetchHomeVideos.mockResolvedValue({
      items: Array.from({ length: 11 }, (_, index) =>
        video({
          id: `video-${index}`,
          title: `Video ${index}`,
          sortOrder: index,
        }),
      ),
    })

    renderScreen()

    expect((await screen.findAllByText('On homepage')).length).toBeGreaterThanOrEqual(10)
    expect(screen.getAllByText('Enabled, outside the first 10').length).toBeGreaterThanOrEqual(1)
  })

  it('kiểm tra và lưu kênh YouTube chính thức ngay trên màn video', async () => {
    const user = userEvent.setup()
    renderScreen()

    const input = await screen.findByRole('textbox', { name: 'Official YouTube channel' })
    fireEvent.change(input, { target: { value: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' } })
    fireEvent.blur(input)
    expect(screen.getByText('Invalid channel address')).toBeInTheDocument()
    expect(mocks.batchUpdateSettings).not.toHaveBeenCalled()

    fireEvent.change(input, { target: { value: 'https://www.youtube.com/@new-channel' } })
    await user.click(screen.getByRole('button', { name: 'Save YouTube channel' }))

    await waitFor(() =>
      expect(mocks.batchUpdateSettings).toHaveBeenCalledWith([
        { key: 'youtube_url', value: 'https://www.youtube.com/@new-channel' },
      ]),
    )
  })

  it('chỉ chấp nhận trang kênh, không chấp nhận video hoặc playlist', () => {
    expect(isValidYouTubeChannelUrl('https://youtube.com/@bigbike-shop')).toBe(true)
    expect(
      isValidYouTubeChannelUrl('https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv'),
    ).toBe(true)
    expect(isValidYouTubeChannelUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(false)
    expect(isValidYouTubeChannelUrl('https://www.youtube.com/playlist?list=PL123')).toBe(false)
    expect(isValidYouTubeChannelUrl('https://www.youtube.com/@bigbike%2Fshop')).toBe(false)
  })
})
