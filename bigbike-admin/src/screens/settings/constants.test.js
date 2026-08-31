import { describe, expect, it } from 'vitest'
import {
  KEY_GUIDE,
  TAB_META,
  TAB_ORDER,
  groupBySection,
  inputTypeFor,
  isTranslatableSetting,
  settingWhere,
  validateValue,
} from './constants'
import viLocale from '../../locales/vi.json'
import enLocale from '../../locales/en.json'

describe('shared store policy settings', () => {
  it('exposes warranty and returns as one bilingual admin group', () => {
    expect(TAB_ORDER).toContain('STORE_POLICY')
    expect(TAB_META.STORE_POLICY).toBeDefined()
    expect(
      isTranslatableSetting({
        key: 'policy_warranty_body_html',
        settingGroup: 'STORE_POLICY',
        valueType: 'HTML',
      }),
    ).toBe(true)
    expect(
      isTranslatableSetting({
        key: 'policy_return_exchange_title',
        settingGroup: 'STORE_POLICY',
        valueType: 'STRING',
      }),
    ).toBe(true)
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

describe('daily out-of-stock digest settings', () => {
  it('keeps the controls in a dedicated inventory tab and validates strict HH:mm', () => {
    expect(TAB_ORDER).toContain('INVENTORY')
    expect(TAB_META.INVENTORY).toBeDefined()
    expect(KEY_GUIDE.inventory_out_of_stock_digest_enabled?.[0]).toBe('inventory_digest')
    expect(KEY_GUIDE.inventory_out_of_stock_digest_time?.[0]).toBe('inventory_digest')
    expect(inputTypeFor('inventory_out_of_stock_digest_time')).toBe('time')
    expect(validateValue('inventory_out_of_stock_digest_time', '08:00')).toBeNull()
    expect(validateValue('inventory_out_of_stock_digest_time', '8:00')).toBe('settings.valTime')
    expect(validateValue('inventory_out_of_stock_digest_time', '24:00')).toBe('settings.valTime')
  })
})

describe('overdue operational order reminder settings', () => {
  it('exposes a dedicated bilingual order-operations tab and requires a positive whole day', () => {
    expect(TAB_ORDER).toContain('ORDER_OPERATIONS')
    expect(TAB_META.ORDER_OPERATIONS).toBeDefined()
    expect(KEY_GUIDE.order_overdue_days?.[0]).toBe('order_operations_reminders')
    expect(validateValue('order_overdue_days', '2')).toBeNull()
    expect(validateValue('order_overdue_days', '0')).toBe('settings.valPositiveInteger')
    expect(validateValue('order_overdue_days', '1.5')).toBe('settings.valPositiveInteger')
    expect(viLocale.settings.group_order_operations).toBe('Vận hành đơn hàng')
    expect(enLocale.settings.group_order_operations).toBe('Order operations')
    expect(viLocale.settings.keyHint.order_overdue_days).toContain(
      'đơn lịch sử không bao giờ bị nhắc',
    )
    expect(enLocale.settings.keyHint.order_overdue_days).toContain(
      'historical orders are never reminded',
    )
  })
})

describe('review invitation settings', () => {
  it('exposes one operations tab with the owner-approved ranges in both languages', () => {
    expect(TAB_ORDER).toContain('REVIEW_INVITATION')
    expect(TAB_META.REVIEW_INVITATION).toBeDefined()
    expect(KEY_GUIDE.review_invitation_enabled?.[0]).toBe('review_invitation_delivery')
    expect(KEY_GUIDE.review_invitation_delay_days?.[0]).toBe('review_invitation_delivery')
    expect(KEY_GUIDE.review_invitation_daily_limit?.[0]).toBe('review_invitation_delivery')
    expect(validateValue('review_invitation_delay_days', '7')).toBeNull()
    expect(validateValue('review_invitation_delay_days', '0')).toBe(
      'settings.valReviewInvitationDelay',
    )
    expect(validateValue('review_invitation_delay_days', '91')).toBe(
      'settings.valReviewInvitationDelay',
    )
    expect(validateValue('review_invitation_daily_limit', '20')).toBeNull()
    expect(validateValue('review_invitation_daily_limit', '0')).toBe(
      'settings.valReviewInvitationLimit',
    )
    expect(validateValue('review_invitation_daily_limit', '51')).toBe(
      'settings.valReviewInvitationLimit',
    )
    expect(viLocale.settings.group_review_invitation).toBe('Mời khách đánh giá')
    expect(enLocale.settings.group_review_invitation).toBe('Review invitations')
  })
})
