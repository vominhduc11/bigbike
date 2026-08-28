import { describe, expect, it } from 'vitest'
import {
  KEY_GUIDE,
  TAB_META,
  TAB_ORDER,
  groupBySection,
  isTranslatableSetting,
  settingWhere,
} from './constants'

describe('shared store policy settings', () => {
  it('exposes warranty and returns as one bilingual admin group', () => {
    expect(TAB_ORDER).toContain('STORE_POLICY')
    expect(TAB_META.STORE_POLICY).toBeDefined()
    expect(isTranslatableSetting({
      key: 'policy_warranty_body_html',
      settingGroup: 'STORE_POLICY',
      valueType: 'HTML',
    })).toBe(true)
    expect(isTranslatableSetting({
      key: 'policy_return_exchange_title',
      settingGroup: 'STORE_POLICY',
      valueType: 'STRING',
    })).toBe(true)
  })

  it('keeps all four policy fields in the same guided section', () => {
    const keys = [
      'policy_warranty_title',
      'policy_warranty_body_html',
      'policy_return_exchange_title',
      'policy_return_exchange_body_html',
    ]
    const sections = groupBySection(keys.map((key) => ({ key })))

    expect(sections).toHaveLength(1)
    expect(sections[0].sec).toBe('store_policy_content')
    expect(keys.every((key) => KEY_GUIDE[key]?.[0] === 'store_policy_content')).toBe(true)
  })

  it('does not repeat a setting label as a second support line', () => {
    const t = (_key, values) => values?.defaultValue ?? _key
    expect(KEY_GUIDE.site_name[1]).toBe('')
    expect(KEY_GUIDE.footer_description[1]).toBe('')
    expect(settingWhere({ key: 'contact_email', description: 'Email liên hệ' }, t)).toBe('')
  })
})
