import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fetchReviewInvitationOptOuts,
  fetchReviewInvitations,
  fetchReviewInvitationSummary,
  skipReviewInvitationAsRefunded,
} from '@/lib/adminApi'
import { showConfirm } from '@/lib/confirm'
import { ReviewInvitationOperations } from './ReviewInvitationOperations'

vi.mock('react-i18next', async (importOriginal) => {
  const translate = (key, values = {}) => {
    const messages = {
      'settings.reviewInvitation.skipRefunded': 'Không gửi — đã hoàn tiền',
      'settings.reviewInvitation.skipConfirm': `Xác nhận ${values.order ?? ''}`,
      'settings.reviewInvitation.skipConfirmTitle': 'Xác nhận không gửi',
      'settings.reviewInvitation.skipSuccess': 'Đã ghi nhận',
      'settings.reviewInvitation.productProgress': `${values.reviewed ?? 0}/${values.total ?? 0} đã đánh giá`,
      'settings.reviewInvitation.completedAt': `Hoàn tất: ${values.date ?? ''}`,
      'settings.reviewInvitation.acceptedAt': `Đã tiếp nhận lúc ${values.date ?? ''}`,
      'settings.reviewInvitation.status.PENDING': 'Đang chờ',
      'settings.reviewInvitation.status.ALL': 'Tất cả',
      'settings.reviewInvitation.status.SENDING': 'Đang gửi',
      'settings.reviewInvitation.status.SENT': 'Đã gửi',
      'settings.reviewInvitation.status.FAILED': 'Gửi lỗi',
      'settings.reviewInvitation.status.UNCERTAIN': 'Chưa rõ kết quả',
      'settings.reviewInvitation.status.SKIPPED': 'Không gửi',
      'settings.reviewInvitation.optOutSourceEmail': 'Đường dẫn trong email',
      'settings.reviewInvitation.dailyUsage': `${values.used ?? 0}/${values.limit ?? 0}`,
      'pagination.items': `${values.count ?? 0} mục`,
      'pagination.page': `Trang ${values.page ?? 1}/${values.total ?? 1}`,
    }
    return messages[key] ?? values.defaultValue ?? key
  }
  return {
    ...(await importOriginal()),
    useTranslation: () => ({ t: translate }),
  }
})

vi.mock('@/lib/adminApi', () => ({
  fetchReviewInvitationSummary: vi.fn(),
  fetchReviewInvitations: vi.fn(),
  fetchReviewInvitationOptOuts: vi.fn(),
  skipReviewInvitationAsRefunded: vi.fn(),
}))

vi.mock('@/lib/confirm', () => ({ showConfirm: vi.fn() }))
vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const pagination = {
  page: 1,
  pageSize: 20,
  totalItems: 1,
  totalPages: 1,
  hasNext: false,
  hasPrevious: false,
}

beforeEach(() => {
  vi.mocked(fetchReviewInvitationSummary).mockResolvedValue({
    pending: 1,
    sent: 0,
    failed: 0,
    uncertain: 0,
    skipped: 0,
    optedOut: 1,
    attemptedToday: 0,
    dailyLimit: 20,
    enabled: true,
    delayDays: 7,
  })
  vi.mocked(fetchReviewInvitations).mockResolvedValue({
    items: [
      {
        id: 'delivery-1',
        orderId: 'order-1',
        orderNumber: 'BB-1001',
        recipientEmail: 'rider@example.com',
        locale: 'vi',
        status: 'PENDING',
        completedAt: '2026-08-31T02:00:00Z',
        dueAt: '2026-09-07T02:00:00Z',
        productCount: 2,
        reviewedProductCount: 1,
        createdAt: '2026-08-31T02:00:00Z',
      },
    ],
    pagination,
  })
  vi.mocked(fetchReviewInvitationOptOuts).mockResolvedValue({
    items: [
      { email: 'stop@example.com', optedOutAt: '2026-09-01T02:00:00Z', source: 'EMAIL_LINK' },
    ],
    pagination,
  })
  vi.mocked(skipReviewInvitationAsRefunded).mockResolvedValue({ skipped: true })
  vi.mocked(showConfirm).mockResolvedValue(true)
})

describe('ReviewInvitationOperations', () => {
  it('shows delivery failures/opt-outs and lets an editor stop a pending refunded order', async () => {
    const user = userEvent.setup()
    render(<ReviewInvitationOperations canUpdate />)

    expect(await screen.findAllByText('BB-1001')).not.toHaveLength(0)
    expect(screen.getAllByText('rider@example.com')).not.toHaveLength(0)
    expect(screen.getAllByText('stop@example.com')).not.toHaveLength(0)
    expect(screen.getByText('0/20')).toBeInTheDocument()

    await user.click(screen.getAllByRole('button', { name: 'Không gửi — đã hoàn tiền' })[0])

    await waitFor(() => expect(showConfirm).toHaveBeenCalled())
    await waitFor(() => expect(skipReviewInvitationAsRefunded).toHaveBeenCalledWith('delivery-1'))
    expect(fetchReviewInvitations).toHaveBeenCalled()
  })
})
