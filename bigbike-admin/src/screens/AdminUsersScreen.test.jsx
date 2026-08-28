import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AdminUsersScreen } from './AdminUsersScreen'

const mocks = vi.hoisted(() => ({
  fetchAdminUsers: vi.fn(),
  fetchRoles: vi.fn(),
  createAdminUser: vi.fn(),
  updateAdminUser: vi.fn(),
  resendAdminInvite: vi.fn(),
  showConfirm: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({
    t: (key, values = {}) => {
      const roleLabels = {
        'roles.roleLabel_SUPER_ADMIN': 'Chủ hệ thống',
        'roles.roleLabel_ADMIN': 'Quản trị viên',
        'roles.roleLabel_EDITOR': 'Biên tập viên',
      }
      const text = roleLabels[key] ?? values.defaultValue ?? key
      return String(text).replace(/\{\{(\w+)\}\}/g, (_, name) => String(values[name] ?? name))
    },
  }),
}))

vi.mock('../lib/adminApi', () => ({
  fetchAdminUsers: mocks.fetchAdminUsers,
  fetchRoles: mocks.fetchRoles,
  createAdminUser: mocks.createAdminUser,
  updateAdminUser: mocks.updateAdminUser,
  resendAdminInvite: mocks.resendAdminInvite,
  mapValidationErrors: (error) => error?.fieldErrors || {},
}))
vi.mock('../lib/confirm', () => ({ showConfirm: mocks.showConfirm }))
vi.mock('@/lib/toast', () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}))
vi.mock('../lib/useDebounce', () => ({ useDebounce: (value) => value }))
vi.mock('../lib/useColumnVisibility', () => ({
  useColumnVisibility: (columns) => ({
    visibleColumns: columns,
    hiddenKeys: [],
    toggle: vi.fn(),
    allColumns: columns,
  }),
}))

vi.mock('../components/AdminTable', () => ({
  AdminTable: ({ rows, columns, loading }) => (
    <div data-testid="admin-users-table" data-loading={String(Boolean(loading))}>
      {rows.map((row) => (
        <div key={row.id} data-testid={`admin-row-${row.id}`}>
          {columns.map((column) => (
            <div key={column.key} data-column={column.key}>
              {column.render ? column.render(row) : row[column.key]}
            </div>
          ))}
        </div>
      ))}
    </div>
  ),
}))
vi.mock('../components/FilterSearchInput', () => ({
  FilterSearchInput: ({ value, onChange, placeholder }) => (
    <input aria-label={placeholder} value={value} onChange={(event) => onChange(event.target.value)} />
  ),
}))
vi.mock('../components/FilterSelect', () => ({
  FilterSelect: ({ value, onValueChange, ariaLabel, options }) => (
    <select aria-label={ariaLabel} value={value} onChange={(event) => onValueChange(event.target.value)}>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  ),
}))
vi.mock('../components/PageSizeSelect', () => ({
  PageSizeSelect: () => <div data-testid="page-size" />,
}))
vi.mock('../components/ColumnVisibilityToggle', () => ({
  ColumnVisibilityToggle: () => <div data-testid="column-visibility" />,
}))
vi.mock('../components/FilterChips', () => ({ FilterChips: () => null }))
vi.mock('../components/PaginationControls', () => ({
  PaginationControls: () => <div data-testid="pagination-controls" />,
}))
vi.mock('../components/ReadOnlyBanner', () => ({
  ReadOnlyBanner: ({ warning }) => <div role="status">{warning}</div>,
}))
vi.mock('../components/StatePanel', () => ({
  StatePanel: ({ title, description, actionLabel, onAction }) => (
    <div>
      <span>{title}</span>
      <span>{description}</span>
      {actionLabel ? <button type="button" onClick={onAction}>{actionLabel}</button> : null}
    </div>
  ),
}))
vi.mock('../components/layout', () => ({
  Screen: ({ children, ...props }) => <main {...props}>{children}</main>,
  ScreenHeader: ({ eyebrow, title, description, actions }) => (
    <header><span>{eyebrow}</span><h1>{title}</h1><p>{description}</p>{actions}</header>
  ),
  Modal: ({ open, title, children, actions }) => open ? (
    <div role="dialog" aria-label={title}>
      {children}
      <div>{actions}</div>
    </div>
  ) : null,
  ResponsiveFilterBar: ({ children, ariaLabel }) => <section aria-label={ariaLabel}>{children}</section>,
}))
vi.mock('@/components/ui/select', () => ({
  Select: ({ value, onValueChange, disabled, children, ...props }) => (
    <select
      {...props}
      value={value}
      disabled={disabled}
      onChange={(event) => onValueChange?.(event.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }) => <>{children}</>,
  SelectItem: ({ value, disabled, children }) => <option value={value} disabled={disabled}>{children}</option>,
}))

const USERS = [
  {
    id: 'self',
    email: 'self@bigbike.vn',
    displayName: 'Tài khoản của tôi',
    role: 'ADMIN',
    status: 'ACTIVE',
    lastLoginAt: null,
  },
  {
    id: 'editor',
    email: 'editor@bigbike.vn',
    displayName: 'Biên tập viên',
    role: 'EDITOR',
    status: 'ACTIVE',
    lastLoginAt: null,
  },
  {
    id: 'invited',
    email: 'invited@bigbike.vn',
    displayName: 'Người được mời',
    role: 'EDITOR',
    status: 'INVITED',
    lastLoginAt: null,
  },
  {
    id: 'owner',
    email: 'owner@bigbike.vn',
    displayName: 'Chủ hệ thống',
    role: 'SUPER_ADMIN',
    status: 'ACTIVE',
    lastLoginAt: null,
  },
]

function renderScreen(props = {}) {
  return render(
    <AdminUsersScreen
      canUpdate
      currentUserId="self"
      isSuperAdmin={false}
      {...props}
    />,
  )
}

function row(id) {
  return screen.getByTestId(`admin-row-${id}`)
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.fetchAdminUsers.mockResolvedValue({
    items: USERS,
    pagination: { page: 1, pageSize: 20, totalItems: USERS.length, totalPages: 1 },
  })
  mocks.fetchRoles.mockResolvedValue({ items: [
    { id: 'SUPER_ADMIN', name: 'Super Admin' },
    { id: 'ADMIN', name: 'Admin' },
    { id: 'EDITOR', name: 'Editor' },
    { id: 'WAREHOUSE', name: 'Kho hàng' },
  ] })
  mocks.showConfirm.mockResolvedValue(true)
})

describe('AdminUsersScreen', () => {
  it('does not call Roles API when roles.read is missing', async () => {
    renderScreen({ canReadRoles: false, canAssignRoles: false })

    await screen.findByText('adminUsers.title')
    expect(mocks.fetchRoles).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'adminUsers.createBtn' })).toBeDisabled()
  })

  it('loads the accounts and fully locks mutations in view-only mode', async () => {
    renderScreen({ canUpdate: false })

    expect(await screen.findByTestId('admin-row-editor')).toBeInTheDocument()
    expect(screen.getByText('adminUsers.readOnlyHint')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'adminUsers.createBtn' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'common.edit' })).not.toBeInTheDocument()
  })

  it('uses the API role catalog for both filtering and account assignment', async () => {
    const user = userEvent.setup()
    renderScreen()
    await screen.findByTestId('admin-row-editor')

    const roleFilter = screen.getByLabelText('adminUsers.filterRole')
    expect(within(roleFilter).getByRole('option', { name: 'Biên tập viên' })).toBeInTheDocument()
    expect(within(roleFilter).queryByRole('option', { name: 'Quản lý shop' })).not.toBeInTheDocument()

    await user.click(within(row('editor')).getByRole('button', { name: 'common.edit' }))
    const dialog = screen.getByRole('dialog', { name: 'adminUsers.editTitle' })
    expect(within(dialog).getByRole('option', { name: 'Biên tập viên' })).toBeInTheDocument()
    expect(within(dialog).queryByRole('option', { name: 'Quản lý shop' })).not.toBeInTheDocument()
  })

  it('does not offer a manual activation action for an invited account', async () => {
    renderScreen()
    await screen.findByText('Người được mời')

    expect(within(row('invited')).queryByRole('button', { name: 'adminUsers.actionActivate' })).not.toBeInTheDocument()
    expect(within(row('invited')).getByRole('button', { name: 'adminUsers.resendInvite' })).toBeEnabled()
  })

  it('prevents duplicate invite resends while the first request is pending', async () => {
    const user = userEvent.setup()
    let finish
    mocks.resendAdminInvite.mockReturnValue(new Promise((resolve) => { finish = resolve }))
    renderScreen()
    await screen.findByText('Người được mời')

    const resend = within(row('invited')).getByRole('button', { name: 'adminUsers.resendInvite' })
    await user.click(resend)
    expect(resend).toBeDisabled()
    await user.click(resend)
    expect(mocks.resendAdminInvite).toHaveBeenCalledTimes(1)

    finish({ inviteEmailSent: true })
    await waitFor(() => expect(resend).toBeEnabled())
  })

  it('locks every field when a lower-tier admin opens a SUPER_ADMIN account', async () => {
    const user = userEvent.setup()
    renderScreen()
    await screen.findByTestId('admin-row-owner')
    await user.click(within(row('owner')).getByRole('button', { name: 'common.edit' }))

    const dialog = screen.getByRole('dialog', { name: 'adminUsers.editTitle' })
    expect(within(dialog).getByLabelText('adminUsers.formDisplayName')).toBeDisabled()
    expect(within(dialog).getByLabelText('adminUsers.formRole')).toBeDisabled()
    expect(within(dialog).getByLabelText('adminUsers.formStatus')).toBeDisabled()
    expect(within(dialog).getByLabelText(/^adminUsers\.formPasswordNew/)).toBeDisabled()
    expect(within(dialog).getByRole('button', { name: 'adminUsers.saveBtn' })).toBeDisabled()
  })

  it('lets an admin change their own password but never sends self role/status changes', async () => {
    const user = userEvent.setup()
    mocks.updateAdminUser.mockResolvedValue({ item: USERS[0] })
    renderScreen()
    await screen.findByText('Tài khoản của tôi')
    await user.click(within(row('self')).getByRole('button', { name: 'common.edit' }))

    const dialog = screen.getByRole('dialog', { name: 'adminUsers.editTitle' })
    expect(within(dialog).getByLabelText('adminUsers.formRole')).toBeDisabled()
    expect(within(dialog).getByLabelText('adminUsers.formStatus')).toBeDisabled()
    const password = within(dialog).getByLabelText(/^adminUsers\.formPasswordNew/)
    expect(password).toBeEnabled()
    await user.type(password, 'Secure@123')
    await user.click(within(dialog).getByRole('button', { name: 'adminUsers.saveBtn' }))

    await waitFor(() => expect(mocks.updateAdminUser).toHaveBeenCalledWith('self', {
      displayName: 'Tài khoản của tôi',
      status: undefined,
      role: undefined,
      newPassword: 'Secure@123',
    }))
  })

  it('keeps invited status read-only and explains the invite acceptance flow', async () => {
    const user = userEvent.setup()
    renderScreen()
    await screen.findByText('Người được mời')
    await user.click(within(row('invited')).getByRole('button', { name: 'common.edit' }))

    const dialog = screen.getByRole('dialog', { name: 'adminUsers.editTitle' })
    expect(within(dialog).getByLabelText('adminUsers.formStatus')).toBeDisabled()
    expect(within(dialog).getByText('adminUsers.inviteStatusLocked')).toBeInTheDocument()
  })

  it('blocks a short password before calling the server', async () => {
    const user = userEvent.setup()
    renderScreen()
    await screen.findByTestId('admin-row-editor')
    await user.click(within(row('editor')).getByRole('button', { name: 'common.edit' }))

    const dialog = screen.getByRole('dialog', { name: 'adminUsers.editTitle' })
    await user.type(within(dialog).getByLabelText(/^adminUsers\.formPasswordNew/), 'short')
    await user.click(within(dialog).getByRole('button', { name: 'adminUsers.saveBtn' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Mật khẩu phải có ít nhất 8 ký tự.')
    expect(mocks.updateAdminUser).not.toHaveBeenCalled()
  })

  it('creates an invite without a password and hides SUPER_ADMIN from lower-tier admins', async () => {
    const user = userEvent.setup()
    const invited = { ...USERS[2], id: 'new-invite', email: 'new@bigbike.vn' }
    mocks.createAdminUser.mockResolvedValue({
      item: invited,
      inviteEmailSent: false,
      inviteUrl: 'https://admin.bigbike.vn/accept-invite/token',
    })
    renderScreen()
    await screen.findByTestId('admin-row-editor')
    await user.click(screen.getByRole('button', { name: 'adminUsers.createBtn' }))

    const dialog = screen.getByRole('dialog', { name: 'adminUsers.createTitle' })
    expect(within(dialog).queryByRole('option', { name: 'Chủ hệ thống' })).not.toBeInTheDocument()
    await user.type(within(dialog).getByLabelText(/^adminUsers\.formEmail/), 'new@bigbike.vn')
    await user.type(within(dialog).getByLabelText(/^adminUsers\.formDisplayName/), 'Quản trị viên mới')
    await user.click(within(dialog).getByRole('button', { name: 'adminUsers.createBtn' }))

    await waitFor(() => expect(mocks.createAdminUser).toHaveBeenCalledWith({
      email: 'new@bigbike.vn',
      displayName: 'Quản trị viên mới',
      role: 'ADMIN',
    }))
    expect(await screen.findByText('https://admin.bigbike.vn/accept-invite/token')).toBeInTheDocument()
  })

  it('shows SUPER_ADMIN as an assignable role only to a system owner', async () => {
    const user = userEvent.setup()
    renderScreen({ isSuperAdmin: true })
    await screen.findByTestId('admin-row-editor')
    await user.click(screen.getByRole('button', { name: 'adminUsers.createBtn' }))

    const dialog = screen.getByRole('dialog', { name: 'adminUsers.createTitle' })
    expect(within(dialog).getByRole('option', { name: 'Chủ hệ thống' })).toBeInTheDocument()
  })

  it('requires confirmation before locking an active account', async () => {
    const user = userEvent.setup()
    mocks.updateAdminUser.mockResolvedValue({
      item: { ...USERS[1], status: 'DISABLED' },
    })
    renderScreen()
    await screen.findByTestId('admin-row-editor')
    await user.click(within(row('editor')).getByRole('button', { name: 'adminUsers.actionLock' }))

    expect(mocks.showConfirm).toHaveBeenCalled()
    await waitFor(() => expect(mocks.updateAdminUser).toHaveBeenCalledWith('editor', { status: 'DISABLED' }))
  })

  it('keeps pagination text aligned with card padding', async () => {
    renderScreen()

    await screen.findByTestId('pagination-controls')
    expect(screen.getByTestId('pagination-controls').parentElement).toHaveClass('px-4')
  })
})
