import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MoneyInput } from './MoneyInput'

function Harness({ initial = '', zeroAsEmpty = false, onCommit }) {
  const [value, setValue] = useState(initial)
  return (
    <MoneyInput
      aria-label="Giá"
      value={value}
      zeroAsEmpty={zeroAsEmpty}
      onValueChange={(next) => {
        setValue(next)
        onCommit?.(next)
      }}
    />
  )
}

describe('MoneyInput', () => {
  it('replaces an existing formatted price without formatting between keystrokes', async () => {
    const user = userEvent.setup()
    render(<Harness initial="220000" />)
    const input = screen.getByRole('textbox', { name: 'Giá' })

    expect(input.value).toBe('220.000')
    await user.click(input)
    await user.keyboard('2000000')
    expect(input.value).toBe('2000000')
    await user.tab()
    expect(input.value).toBe('2.000.000')
  })

  it('accepts slow/continuous typing and insertion in the middle without caret jumps', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const input = screen.getByRole('textbox', { name: 'Giá' })

    await user.click(input)
    await user.keyboard('220')
    await new Promise((resolve) => setTimeout(resolve, 5))
    await user.keyboard('000')
    expect(input.value).toBe('220000')

    input.setSelectionRange(3, 3)
    await user.keyboard('5')
    expect(input.value).toBe('2205000')
    expect(input.selectionStart).toBe(4)
  })

  it('handles backspace/delete and paste with either grouping convention', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const input = screen.getByRole('textbox', { name: 'Giá' })
    await user.click(input)

    for (const pasted of ['2000000', '2.000.000', '2,000,000']) {
      fireEvent.change(input, { target: { value: pasted, selectionStart: pasted.length } })
      expect(input.value).toBe('2000000')
    }

    input.setSelectionRange(4, 4)
    await user.keyboard('{Backspace}')
    expect(input.value).toBe('200000')
    input.setSelectionRange(3, 3)
    await user.keyboard('{Delete}')
    expect(input.value).toBe('20000')
  })

  it('commits empty and sale zero as empty while leaving final payload numeric', async () => {
    const user = userEvent.setup()
    const commits = []
    render(<Harness initial="0" zeroAsEmpty onCommit={(next) => commits.push(next)} />)
    const input = screen.getByRole('textbox', { name: 'Giá' })

    expect(input.value).toBe('')
    await user.click(input)
    await user.keyboard('1600000')
    await user.tab()
    expect(input.value).toBe('1.600.000')
    expect(commits.at(-1)).toBe('1600000')

    await user.click(input)
    await user.clear(input)
    await user.keyboard('0')
    await user.tab()
    expect(input.value).toBe('')
    expect(commits.at(-1)).toBe('')
  })
})

