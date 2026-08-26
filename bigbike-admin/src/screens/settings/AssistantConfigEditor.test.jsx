import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AssistantConfigEditor } from './AssistantConfigEditor'
import { validateValue } from './constants'

const api = vi.hoisted(() => ({ previewAssistantTemplate: vi.fn() }))

vi.mock('../../lib/adminApi', () => ({
  previewAssistantTemplate: api.previewAssistantTemplate,
}))

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

  it('previews the exact customer-facing bilingual answer before enablement', async () => {
    api.previewAssistantTemplate.mockResolvedValue({
      matched: true,
      answer: 'Anh/chị lau nhẹ bằng khăn mềm.',
      source: 'TEMPLATE',
      violations: [],
      canEnable: true,
    })
    const user = userEvent.setup()
    render(<Harness
      settingKey="ai_assistant_answer_templates"
      initialValue={JSON.stringify([{
        id: 'care', topic: 'Care', enabled: false,
        triggersVi: ['cách vệ sinh mũ'], triggersEn: ['how to clean helmet'],
        answerVi: 'Anh/chị lau nhẹ bằng khăn mềm.',
        answerEn: 'Please wipe it gently with a soft cloth.',
      }])}
    />)

    await user.click(screen.getByRole('button', { name: /settings\.assistantConfig\.preview$/ }))

    expect(await screen.findAllByText('Anh/chị lau nhẹ bằng khăn mềm.')).toHaveLength(2)
    expect(api.previewAssistantTemplate).toHaveBeenCalledWith(expect.objectContaining({
      locale: 'vi',
      sampleQuestion: 'cách vệ sinh mũ',
      answerVi: 'Anh/chị lau nhẹ bằng khăn mềm.',
    }))
  })

  it('shows the precise policy warning without rewriting an unsafe owner draft', async () => {
    api.previewAssistantTemplate.mockResolvedValue({
      matched: true,
      answer: null,
      source: null,
      violations: ['DISCOUNT_PROMISE'],
      canEnable: false,
    })
    const draft = 'Shop hứa giảm giá 10% cho anh/chị.'
    const user = userEvent.setup()
    render(<Harness
      settingKey="ai_assistant_answer_templates"
      initialValue={JSON.stringify([{
        id: 'sale', topic: 'Promotion', enabled: false,
        triggersVi: ['có giảm giá không'], triggersEn: ['is there a discount'],
        answerVi: draft, answerEn: 'The shop promises a 10% discount.',
      }])}
    />)

    await user.click(screen.getByRole('button', { name: /settings\.assistantConfig\.preview$/ }))

    expect(await screen.findByText('settings.assistantConfig.violations.DISCOUNT_PROMISE')).toBeInTheDocument()
    expect(screen.getByDisplayValue(draft)).toHaveValue(draft)
    expect(screen.getByText('settings.assistantConfig.contentUnchanged')).toBeInTheDocument()
  })
})
