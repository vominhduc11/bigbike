import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AssignmentRolesScreen } from './AssignmentRolesScreen'

const mocks = vi.hoisted(() => ({
  fetchProductAssignment: vi.fn(),
  batchUpdateSettings: vi.fn(),
  showConfirm: vi.fn(),
}))

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({
    t: (key, values = {}) => values.defaultValue ?? key,
  }),
}))
vi.mock('../lib/adminApi', () => ({
  fetchProductAssignment: mocks.fetchProductAssignment,
  batchUpdateSettings: mocks.batchUpdateSettings,
}))
vi.mock('../lib/confirm', () => ({ showConfirm: mocks.showConfirm }))
vi.mock('@/lib/useUnsavedChanges', () => ({ useUnsavedChanges: vi.fn() }))

function renderScreen(props = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <AssignmentRolesScreen canUpdate embedded {...props} />
    </QueryClientProvider>,
  )
  return client
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.fetchProductAssignment.mockResolvedValue({
    title: 'Phân công',
    roles: [{ id: 'content', name: 'Nội dung', items: 'Mô tả sản phẩm' }],
  })
  mocks.batchUpdateSettings.mockResolvedValue({ items: [] })
  mocks.showConfirm.mockResolvedValue(true)
})

describe('AssignmentRolesScreen', () => {
  it('loads the shared assignment title and roles with accessible labels', async () => {
    renderScreen()

    expect(await screen.findByLabelText('Tiêu đề banner')).toHaveValue('Phân công')
    expect(screen.getByLabelText('settings.assign.roleNameLabel')).toHaveValue('Nội dung')
    expect(screen.getByLabelText('settings.assign.itemsLabel')).toHaveValue('Mô tả sản phẩm')
  })

  it('keeps at least one role and disables all editing in view-only mode', async () => {
    renderScreen({ canUpdate: false })

    expect(await screen.findByLabelText('Tiêu đề banner')).toBeDisabled()
    expect(screen.getByLabelText('settings.assign.roleNameLabel')).toBeDisabled()
    expect(screen.queryByRole('button', { name: /Thêm vai trò/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Xóa vai trò' })).toBeDisabled()
  })

  it('requires every role to have a name before saving', async () => {
    const user = userEvent.setup()
    renderScreen()

    await screen.findByLabelText('Tiêu đề banner')
    await user.click(screen.getByRole('button', { name: /Thêm vai trò/ }))
    await user.click(screen.getByRole('button', { name: 'common.save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Nhập tên vai trò')
    expect(mocks.batchUpdateSettings).not.toHaveBeenCalled()
  })

  it('saves the dynamic role list as the shared JSON setting', async () => {
    const user = userEvent.setup()
    renderScreen()

    const roleName = await screen.findByLabelText('settings.assign.roleNameLabel')
    await user.clear(roleName)
    await user.type(roleName, 'Biên tập nội dung')
    await user.click(screen.getByRole('button', { name: 'common.save' }))

    await waitFor(() => expect(mocks.batchUpdateSettings).toHaveBeenCalledWith([
      {
        key: 'product_assign_roles',
        value: JSON.stringify([
          { id: 'content', name: 'Biên tập nội dung', items: 'Mô tả sản phẩm' },
        ]),
      },
    ]))
  })

  it('reports dirty and save states to the embedded settings screen', async () => {
    const user = userEvent.setup()
    const onEditorStateChange = vi.fn()
    renderScreen({ onEditorStateChange })

    const roleName = await screen.findByLabelText('settings.assign.roleNameLabel')
    await waitFor(() => expect(onEditorStateChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ dirtyCount: 0, saving: false }),
    ))

    await user.clear(roleName)
    await user.type(roleName, 'Điều phối nội dung')
    await waitFor(() => expect(onEditorStateChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ dirtyCount: 1, saving: false }),
    ))
  })
})
