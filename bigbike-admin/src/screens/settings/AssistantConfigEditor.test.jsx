import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AssistantConfigEditor } from './AssistantConfigEditor'
import { validateValue } from './constants'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, values = {}) => key === 'settings.assistantConfig.itemCount'
      ? `${values.count}/${values.max} items`
      : key,
  }),
}))

function Harness({ settingKey, initialValue = '[]', readOnly = false }) {
  const [value, setValue] = useState(initialValue)
  return <AssistantConfigEditor settingKey={settingKey} value={value} onChange={setValue} readOnly={readOnly} />
}

describe('AssistantConfigEditor', () => {
  it('adds and edits an abbreviation as structured JSON', async () => {
    const user = userEvent.setup()
    render(<Harness settingKey="ai_assistant_abbreviations" />)

    await user.click(screen.getByRole('button', { name: 'settings.assistantConfig.addAbbreviation' }))
    const inputs = screen.getAllByRole('textbox')
    await user.type(inputs[0], 'mbh')
    await user.type(inputs[1], 'mu bao hiem')

    expect(screen.getByDisplayValue('mbh')).toBeInTheDocument()
    expect(screen.getByDisplayValue('mu bao hiem')).toBeInTheDocument()
    expect(screen.getByText('1/100 items')).toBeInTheDocument()
  })

  it('shows saved answers in read-only mode without mutation controls', () => {
    render(<Harness
      settingKey="ai_assistant_answer_templates"
      readOnly
      initialValue={JSON.stringify([{
        id: 'warranty', topic: 'Warranty', enabled: true,
        triggersVi: ['bảo hành'], triggersEn: ['warranty'],
        answerVi: 'BigBike hỗ trợ theo chính sách hiện hành.',
        answerEn: 'BigBike follows its current policy.',
      }])}
    />)

    expect(screen.getAllByDisplayValue('warranty').every((control) => control.disabled)).toBe(true)
    expect(screen.queryByRole('button', { name: 'settings.assistantConfig.addTemplate' })).not.toBeInTheDocument()
  })

  it('validates duplicate abbreviations and incomplete bilingual templates before saving', () => {
    const duplicateAliases = JSON.stringify([
      { locale: 'vi', phrase: 'mbh', expansion: 'mũ bảo hiểm', enabled: true },
      { locale: 'vi', phrase: 'MBH', expansion: 'mũ bảo hiểm', enabled: true },
    ])
    const incompleteTemplate = JSON.stringify([{
      id: 'shipping', topic: 'Shipping', enabled: true,
      triggersVi: ['giao hàng'], triggersEn: [], answerVi: 'Có hỗ trợ.', answerEn: '',
    }])

    expect(validateValue('ai_assistant_abbreviations', duplicateAliases)).toBe('settings.assistantConfig.duplicate')
    expect(validateValue('ai_assistant_answer_templates', incompleteTemplate)).toBe('settings.assistantConfig.invalid')
  })
})
