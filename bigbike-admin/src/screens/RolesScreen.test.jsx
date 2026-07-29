import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RolesScreen } from './RolesScreen'

const mocks = vi.hoisted(() => ({
  fetchRoles: vi.fn(),
  fetchPermissionCatalog: vi.fn(),
  updateRolePermissions: vi.fn(),
  createRole: vi.fn(),
  deleteRole: vi.fn(),
  showConfirm: vi.fn(),
  t: (key, values = {}) => {
    const text = values.defaultValue ?? key
    return String(text).replace(/\{\{(\w+)\}\}/g, (_, name) => String(values[name] ?? name))
  },
}))

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({
    t: mocks.t,
  }),
}))
vi.mock('../lib/adminApi', () => ({
  fetchRoles: mocks.fetchRoles,
  fetchPermissionCatalog: mocks.fetchPermissionCatalog,
  updateRolePermissions: mocks.updateRolePermissions,
  createRole: mocks.createRole,
  deleteRole: mocks.deleteRole,
}))
vi.mock('../lib/confirm', () => ({ showConfirm: mocks.showConfirm }))

vi.mock('./roles/Toast', () => ({
  Toast: ({ toast }) => toast ? <div role="status">{toast.msg}</div> : null,
}))
vi.mock('./roles/RoleSidebar', () => ({
  RoleSidebar: ({ roles, selectedId, onSelect, canUpdate, onCreateRole }) => (
    <div data-testid="role-sidebar">
      {roles.map((role) => (
        <button
          type="button"
          key={role.id}
          aria-current={role.id === selectedId ? 'true' : undefined}
          onClick={() => onSelect(role.id)}
        >
          role-{role.id}
        </button>
      ))}
      {canUpdate ? <button type="button" onClick={onCreateRole}>create-role</button> : null}
    </div>
  ),
}))
vi.mock('./roles/RoleDetail', () => ({
  RoleDetail: ({
    role, canUpdate, editMode, isDirty, onStartEdit, onToggle, onRequestSave, onDeleteRole,
  }) => (
    <div data-testid="role-detail">
      <span>selected-{role.id}</span>
      {!editMode && canUpdate && role.id !== 'SUPER_ADMIN'
        ? <button type="button" onClick={onStartEdit}>start-edit</button>
        : null}
      {editMode ? (
        <>
          <button type="button" onClick={() => onToggle('roles.write', 'Quản lý vai trò')}>toggle-own-write</button>
          <button type="button" onClick={() => onToggle('admin-users.write', 'Quản lý tài khoản')}>toggle-sensitive</button>
          <button type="button" disabled={!isDirty} onClick={onRequestSave}>request-save</button>
        </>
      ) : null}
      {!role.isSystem ? <button type="button" onClick={onDeleteRole}>request-delete</button> : null}
    </div>
  ),
}))
vi.mock('./roles/ConfirmSensitiveDialog', () => ({
  ConfirmSensitiveDialog: ({ pending, onConfirm }) => pending
    ? <button type="button" onClick={onConfirm}>confirm-sensitive</button>
    : null,
}))
vi.mock('./roles/SaveSummaryDialog', () => ({
  SaveSummaryDialog: ({ pending, onConfirm }) => pending
    ? <button type="button" onClick={onConfirm}>confirm-save</button>
    : null,
}))
vi.mock('./roles/CreateRoleDialog', () => ({
  CreateRoleDialog: ({ onConfirm, sensitiveKeys }) => (
    <div role="dialog" aria-label="create-role">
      <span data-testid="sensitive-count">{sensitiveKeys.size}</span>
      <button type="button" onClick={() => onConfirm({
        id: 'WAREHOUSE',
        name: 'Kho hàng',
        description: '',
        permissions: [],
      })}>
        submit-create
      </button>
    </div>
  ),
}))
vi.mock('./roles/DeleteRoleDialog', () => ({
  DeleteRoleDialog: ({ role, onConfirm }) => role
    ? <button type="button" onClick={onConfirm}>confirm-delete-{role.id}</button>
    : null,
}))

const CATALOG = [
  {
    groupKey: 'roles.groupSystem',
    permissions: [
      { key: 'roles.read', sensitive: false },
      { key: 'roles.write', sensitive: true },
      { key: 'admin-users.write', sensitive: true },
    ],
  },
]

const ROLES = [
  {
    id: 'ADMIN',
    name: 'Admin',
    isSystem: true,
    permissions: ['roles.read', 'roles.write'],
    assignedUserCount: 1,
    updatedAt: '2026-07-29T00:00:00Z',
  },
  {
    id: 'SUPER_ADMIN',
    name: 'Owner',
    isSystem: true,
    permissions: ['*'],
    assignedUserCount: 1,
    updatedAt: '2026-07-29T00:00:00Z',
  },
  {
    id: 'WAREHOUSE',
    name: 'Kho hàng',
    isSystem: false,
    permissions: ['orders.read'],
    assignedUserCount: 2,
    updatedAt: '2026-07-29T00:00:00Z',
  },
  {
    id: 'EMPTY_ROLE',
    name: 'Vai trò trống',
    isSystem: false,
    permissions: [],
    assignedUserCount: 0,
    updatedAt: '2026-07-29T00:00:00Z',
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  mocks.fetchRoles.mockResolvedValue({ items: ROLES })
  mocks.fetchPermissionCatalog.mockResolvedValue(CATALOG)
  mocks.showConfirm.mockResolvedValue(true)
})

describe('RolesScreen', () => {
  it('loads roles and selects the first role with the live permission catalog', async () => {
    render(<RolesScreen canUpdate currentUserRoles={['ADMIN']} />)

    expect(await screen.findByText('selected-ADMIN')).toBeInTheDocument()
    expect(mocks.fetchRoles).toHaveBeenCalledTimes(1)
    expect(mocks.fetchPermissionCatalog).toHaveBeenCalledTimes(1)
  })

  it('shows a retryable full-page error when the role list fails', async () => {
    const user = userEvent.setup()
    mocks.fetchRoles.mockRejectedValueOnce(new Error('Mất kết nối'))
    render(<RolesScreen canUpdate />)

    expect(await screen.findByText('Mất kết nối')).toBeInTheDocument()
    mocks.fetchRoles.mockResolvedValueOnce({ items: ROLES })
    await user.click(screen.getByRole('button', { name: 'common.retry' }))
    expect(await screen.findByText('selected-ADMIN')).toBeInTheDocument()
    expect(mocks.fetchRoles).toHaveBeenCalledTimes(2)
  })

  it('keeps the screen usable with a clear warning when only the catalog fails', async () => {
    mocks.fetchPermissionCatalog.mockRejectedValueOnce(new Error('catalog down'))
    render(<RolesScreen canUpdate />)

    expect(await screen.findByText('selected-ADMIN')).toBeInTheDocument()
    expect(screen.getByText(/Không tải được danh mục quyền mới nhất/)).toBeInTheDocument()
  })

  it('removes every mutation entry point in view-only mode', async () => {
    render(<RolesScreen canUpdate={false} />)
    expect(await screen.findByText('selected-ADMIN')).toBeInTheDocument()

    expect(screen.queryByRole('button', { name: 'create-role' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'start-edit' })).not.toBeInTheDocument()
  })

  it('blocks removing role-management permission from the current user own role', async () => {
    const user = userEvent.setup()
    render(<RolesScreen canUpdate currentUserRoles={['ADMIN']} />)
    await screen.findByText('selected-ADMIN')
    await user.click(screen.getByRole('button', { name: 'start-edit' }))
    await user.click(screen.getByRole('button', { name: 'toggle-own-write' }))

    expect(screen.getByRole('status')).toHaveTextContent('Không thể gỡ quyền quản lý phân quyền')
    expect(screen.getByRole('button', { name: 'request-save' })).toBeDisabled()
  })

  it('requires sensitive confirmation and a final summary before saving', async () => {
    const user = userEvent.setup()
    mocks.updateRolePermissions.mockResolvedValue({
      item: { ...ROLES[0], permissions: ['roles.read', 'roles.write', 'admin-users.write'] },
    })
    render(<RolesScreen canUpdate currentUserRoles={[]} />)
    await screen.findByText('selected-ADMIN')
    await user.click(screen.getByRole('button', { name: 'start-edit' }))
    await user.click(screen.getByRole('button', { name: 'toggle-sensitive' }))
    expect(mocks.updateRolePermissions).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'confirm-sensitive' }))
    await user.click(screen.getByRole('button', { name: 'request-save' }))
    expect(mocks.updateRolePermissions).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'confirm-save' }))

    await waitFor(() => expect(mocks.updateRolePermissions).toHaveBeenCalledWith(
      'ADMIN',
      expect.arrayContaining(['roles.read', 'roles.write', 'admin-users.write']),
    ))
  })

  it('does not open deletion for a custom role that still has assigned staff', async () => {
    const user = userEvent.setup()
    render(<RolesScreen canUpdate />)
    await screen.findByText('selected-ADMIN')
    await user.click(screen.getByRole('button', { name: 'role-WAREHOUSE' }))
    await user.click(screen.getByRole('button', { name: 'request-delete' }))

    expect(screen.queryByRole('button', { name: 'confirm-delete-WAREHOUSE' })).not.toBeInTheDocument()
    expect(mocks.deleteRole).not.toHaveBeenCalled()
  })

  it('deletes an unused custom role and removes it from the list', async () => {
    const user = userEvent.setup()
    mocks.deleteRole.mockResolvedValue(undefined)
    render(<RolesScreen canUpdate />)
    await screen.findByText('selected-ADMIN')
    await user.click(screen.getByRole('button', { name: 'role-EMPTY_ROLE' }))
    await user.click(screen.getByRole('button', { name: 'request-delete' }))
    await user.click(screen.getByRole('button', { name: 'confirm-delete-EMPTY_ROLE' }))

    await waitFor(() => expect(mocks.deleteRole).toHaveBeenCalledWith('EMPTY_ROLE'))
    expect(screen.queryByRole('button', { name: 'role-EMPTY_ROLE' })).not.toBeInTheDocument()
  })

  it('creates a custom role and forwards the live sensitive-permission catalog', async () => {
    const user = userEvent.setup()
    mocks.createRole.mockResolvedValue({
      item: { ...ROLES[3], id: 'WAREHOUSE', name: 'Kho hàng' },
    })
    render(<RolesScreen canUpdate />)
    await screen.findByText('selected-ADMIN')
    await user.click(screen.getByRole('button', { name: 'create-role' }))

    expect(screen.getByTestId('sensitive-count')).toHaveTextContent('2')
    await user.click(screen.getByRole('button', { name: 'submit-create' }))
    await waitFor(() => expect(mocks.createRole).toHaveBeenCalledWith({
      id: 'WAREHOUSE',
      name: 'Kho hàng',
      description: '',
      permissions: [],
    }))
    expect(await screen.findByText('selected-WAREHOUSE')).toBeInTheDocument()
  })
})
