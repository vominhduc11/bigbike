import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Eye, Trash2 } from 'lucide-react'
import { TableRowActions } from './TableRowActions'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key }),
}))

describe('TableRowActions', () => {
  it('keeps the primary action visible and moves secondary actions into the shared menu', async () => {
    const user = userEvent.setup()
    const onView = vi.fn()
    const onDelete = vi.fn()

    render(
      <TableRowActions
        primaryActions={[{ key: 'view', label: 'View', icon: Eye, onSelect: onView }]}
        menuActions={[
          { key: 'delete', label: 'Delete', icon: Trash2, tone: 'danger', onSelect: onDelete },
        ]}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'View' }))
    expect(onView).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Delete')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'common.actions' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    expect(onDelete).toHaveBeenCalledTimes(1)
  })
})
