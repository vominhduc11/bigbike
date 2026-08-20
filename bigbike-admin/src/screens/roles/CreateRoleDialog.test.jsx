import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CreateRoleDialog } from './CreateRoleDialog'

const mocks = vi.hoisted(() => ({ showConfirm: vi.fn() }))

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({
    t: (key, values = {}) => {
      const text = values.defaultValue ?? key
      return String(text).replace(/\{\{(\w+)\}\}/g, (_, name) => String(values[name] ?? name))
    },
  }),
}))
vi.mock('../../lib/confirm', () => ({ showConfirm: mocks.showConfirm }))
vi.mock('@/components/layout/Modal', () => ({
  Modal: ({ title, children, actions }) => (
    <div role="dialog" aria-label="create-role">
      <div>{title}</div>
      {children}
      <div>{actions}</div>
    </div>
  ),
}))
vi.mock('@/components/ui/select', () => ({
  Select: ({ value, onValueChange, children, ...props }) => (
    <select {...props} value={value} onChange={(event) => onValueChange(event.target.value)}>
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }) => <>{children}</>,
  SelectItem: ({ value, children }) => <option value={value}>{children}</option>,
}))

const ROLES = [
  { id: 'SUPER_ADMIN', name: 'Owner', permissions: ['*'] },
  { id: 'ADMIN', name: 'Admin', permissions: ['orders.read', 'roles.write'] },
  { id: 'EDITOR', name: 'Editor', permissions: ['content.read'] },
]

function renderDialog(props = {}) {
  const onConfirm = vi.fn()
  const onCancel = vi.fn()
  render(
    <CreateRoleDialog
      onConfirm={onConfirm}
      onCancel={onCancel}
      saving={false}
      roles={ROLES}
      sensitiveKeys={new Set(['roles.write'])}
      {...props}
    />,
  )
  return { onConfirm, onCancel }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.showConfirm.mockResolvedValue(true)
})

describe('CreateRoleDialog', () => {
  it('generates a valid stable ID from a Vietnamese role name', async () => {
    const user = userEvent.setup()
    const { onConfirm } = renderDialog()
    await user.type(screen.getByLabelText(/^roles\.createRoleNameLabel/), 'Quản lý kho')

    expect(screen.getByText('QUAN_LY_KHO')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'roles.createRoleBtn' }))

    expect(onConfirm).toHaveBeenCalledWith({
      id: 'QUAN_LY_KHO',
      name: 'Quản lý kho',
      description: '',
      permissions: [],
    })
  })

  it('reveals the ID field and blocks a one-character ID before any API call', async () => {
    const user = userEvent.setup()
    const { onConfirm } = renderDialog()
    await user.type(screen.getByLabelText(/^roles\.createRoleNameLabel/), 'A')
    await user.click(screen.getByRole('button', { name: 'roles.createRoleBtn' }))

    expect(await screen.findByLabelText(/^roles\.createRoleIdLabel/)).toHaveValue('A')
    expect(screen.getByRole('alert')).toHaveTextContent('roles.createRoleErrorIdFormat')
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('blocks an empty generated ID when the display name contains only symbols', async () => {
    const user = userEvent.setup()
    const { onConfirm } = renderDialog()
    await user.type(screen.getByLabelText(/^roles\.createRoleNameLabel/), '!!!')
    await user.click(screen.getByRole('button', { name: 'roles.createRoleBtn' }))

    expect(await screen.findByLabelText(/^roles\.createRoleIdLabel/)).toHaveValue('')
    expect(screen.getByRole('alert')).toHaveTextContent('roles.createRoleErrorId')
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('matches the database limits for name, ID and description fields', async () => {
    const user = userEvent.setup()
    renderDialog()
    const name = screen.getByLabelText(/^roles\.createRoleNameLabel/)
    const description = screen.getByLabelText('roles.createRoleDescLabel')

    expect(name).toHaveAttribute('maxlength', '100')
    expect(description).toHaveAttribute('maxlength', '1000')
    await user.type(name, 'Kho')
    await user.click(screen.getByRole('button', { name: 'roles.createRoleIdCustomize' }))
    expect(screen.getByLabelText(/^roles\.createRoleIdLabel/)).toHaveAttribute('maxlength', '50')
  })

  it('never offers SUPER_ADMIN as a clone source', () => {
    renderDialog()

    expect(screen.queryByRole('option', { name: 'Owner' })).not.toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Admin' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Editor' })).toBeInTheDocument()
  })

  it('requires an extra confirmation when cloning sensitive permissions', async () => {
    const user = userEvent.setup()
    const { onConfirm } = renderDialog()
    await user.type(screen.getByLabelText(/^roles\.createRoleNameLabel/), 'Điều phối')
    await user.selectOptions(screen.getByLabelText('roles.createRoleCloneLabel'), 'ADMIN')
    mocks.showConfirm.mockResolvedValueOnce(false)
    await user.click(screen.getByRole('button', { name: 'roles.createRoleBtn' }))

    expect(mocks.showConfirm).toHaveBeenCalledWith(
      expect.stringContaining('1'),
      'Nhân bản quyền nhạy cảm?',
      { variant: 'danger' },
    )
    expect(onConfirm).not.toHaveBeenCalled()

    mocks.showConfirm.mockResolvedValueOnce(true)
    await user.click(screen.getByRole('button', { name: 'roles.createRoleBtn' }))
    await waitFor(() =>
      expect(onConfirm).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'DIEU_PHOI',
          permissions: ['orders.read', 'roles.write'],
        }),
      ),
    )
  })

  it('clones a non-sensitive role without an extra confirmation', async () => {
    const user = userEvent.setup()
    const { onConfirm } = renderDialog()
    await user.type(screen.getByLabelText(/^roles\.createRoleNameLabel/), 'Tin tức')
    await user.selectOptions(screen.getByLabelText('roles.createRoleCloneLabel'), 'EDITOR')
    await user.click(screen.getByRole('button', { name: 'roles.createRoleBtn' }))

    expect(mocks.showConfirm).not.toHaveBeenCalled()
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'TIN_TUC',
        permissions: ['content.read'],
      }),
    )
  })

  it('warns before discarding a partially completed role', async () => {
    const user = userEvent.setup()
    const { onCancel } = renderDialog()
    await user.type(screen.getByLabelText(/^roles\.createRoleNameLabel/), 'Kho')
    mocks.showConfirm.mockResolvedValueOnce(false)
    await user.click(screen.getByRole('button', { name: 'roles.cancelBtn' }))
    expect(onCancel).not.toHaveBeenCalled()

    mocks.showConfirm.mockResolvedValueOnce(true)
    await user.click(screen.getByRole('button', { name: 'roles.cancelBtn' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
