import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  fetchChatStats: vi.fn(),
  hasPermission: vi.fn(),
}))

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({
    i18n: { resolvedLanguage: 'vi' },
    t: (key, values = {}) => ({
      'settings.assistantOperationalStats.title': 'Số liệu vận hành Trợ lý BigBike',
      'settings.assistantOperationalStats.description': 'Số liệu kỹ thuật dùng để so sánh bản AI.',
      'settings.assistantOperationalStats.tokensToday': 'Token hôm nay',
      'settings.assistantOperationalStats.providerRequestsToday': 'Yêu cầu nhà cung cấp hôm nay',
      'settings.assistantOperationalStats.averageLatencyToday': 'Thời gian trả lời trung bình hôm nay',
      'settings.assistantOperationalStats.latency14Days': 'Tốc độ p95 trong 14 ngày',
      'settings.assistantOperationalStats.p50': `p50: ${values.value || '—'}`,
      'settings.assistantOperationalStats.fallbacksThisMonth': 'Số lần lùi bản tháng này',
      'settings.assistantOperationalStats.indexCostThisMonth': 'Chi phí lập chỉ mục tháng này',
      'settings.assistantOperationalStats.evaluationCostThisMonth': 'Chi phí chấm điểm tháng này',
      'settings.assistantOperationalStats.modelUsage': 'Bản AI thực tế đã dùng trong tháng',
      'settings.assistantOperationalStats.modelUsageLine': `${values.count} lượt · ${values.cost}`,
    }[key] || values.defaultValue || key),
  }),
}))

vi.mock('../../lib/adminApi', () => ({ fetchChatStats: mocks.fetchChatStats }))
vi.mock('../../lib/auth', () => ({ useHasPermission: () => mocks.hasPermission }))

const { AssistantOperationalStats } = await import('./AssistantOperationalStats')

function renderStats() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <AssistantOperationalStats />
    </QueryClientProvider>,
  )
}

describe('AssistantOperationalStats', () => {
  beforeEach(() => vi.clearAllMocks())

  it('reuses chat stats and shows technical metrics in Settings', async () => {
    mocks.hasPermission.mockReturnValue(true)
    mocks.fetchChatStats.mockResolvedValue({
      hasTelemetry: true,
      inputTokens: 100,
      outputTokens: 40,
      thinkingTokens: 10,
      providerRequests: 3,
      averageLatencyMs: 1500,
      fallbacks: { p50LatencyMs14Days: 700, p95LatencyMs14Days: 1800, month: 4, lastReason: 'TIMEOUT' },
      costs: { indexMonthUsd: 1.2, evaluationMonthUsd: 0.8 },
      modelUsage: [{ modelId: 'gemini-2.5-flash', uses: 12, costUsd: 2 }],
    })

    renderStats()

    expect(await screen.findByText('Số liệu vận hành Trợ lý BigBike')).toBeInTheDocument()
    expect(await screen.findByText('gemini-2.5-flash')).toBeInTheDocument()
    expect(screen.getByText('150')).toBeInTheDocument()
    expect(mocks.fetchChatStats).toHaveBeenCalledWith(expect.objectContaining({ date: expect.any(String) }))
  })

  it('keeps technical metrics permission-scoped', () => {
    mocks.hasPermission.mockReturnValue(false)
    renderStats()

    expect(screen.getByText('settings.assistantOperationalStats.permissionDenied')).toBeInTheDocument()
    expect(mocks.fetchChatStats).not.toHaveBeenCalled()
  })
})
