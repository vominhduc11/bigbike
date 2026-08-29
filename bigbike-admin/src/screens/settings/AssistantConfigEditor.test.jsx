import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AssistantConfigEditor } from './AssistantConfigEditor'
import { validateValue } from './constants'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key }),
}))

function Harness({ initialValue, readOnly = false }) {
  const [value, setValue] = useState(initialValue)
  return <AssistantConfigEditor settingKey="ai_assistant_business_hours" value={value} onChange={setValue} readOnly={readOnly} />
}

const SCHEDULE = JSON.stringify({
  timezone: 'Asia/Ho_Chi_Minh',
  days: Object.fromEntries(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((day) => [day, {
    enabled: day !== 'SUN', open: '09:00', close: '18:00',
  }])),
})

describe('AssistantConfigEditor', () => {
  it('edits the retained staff-handoff schedule as JSON', async () => {
    render(<Harness initialValue={SCHEDULE} />)

    const timeInputs = screen.getAllByDisplayValue('09:00')
    fireEvent.change(timeInputs[0], { target: { value: '08:30' } })

    expect(screen.getByDisplayValue('08:30')).toBeInTheDocument()
  })

  it('keeps the schedule editable only for authorised settings users', () => {
    render(<Harness initialValue={SCHEDULE} readOnly />)

    expect(screen.getAllByRole('switch').every((control) => control.disabled)).toBe(true)
    expect(screen.getAllByDisplayValue('09:00').every((control) => control.disabled)).toBe(true)
  })

  it('validates the retained business-hours setting', () => {
    expect(validateValue('ai_assistant_business_hours', SCHEDULE)).toBeNull()
    expect(validateValue('ai_assistant_business_hours', '{bad json')).toBe('settings.assistantConfig.invalidBusinessHours')
  })
})
