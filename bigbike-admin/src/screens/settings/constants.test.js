import { describe, expect, it } from 'vitest'
import {
  KEY_GUIDE,
  TAB_META,
  TAB_ORDER,
  inputTypeFor,
  HIDDEN_GROUPS,
  settingWhere,
  validateValue,
} from './constants'
import viLocale from '../../locales/vi.json'
import enLocale from '../../locales/en.json'

describe('frozen store policies', () => {
  it('removes the policy tab and hides stale policy rows from Settings', () => {
    expect(TAB_ORDER).not.toContain('STORE_POLICY')
    expect(TAB_META.STORE_POLICY).toBeUndefined()
    expect(HIDDEN_GROUPS).toContain('STORE_POLICY')
    expect(KEY_GUIDE.policy_warranty_title).toBeUndefined()
    expect(KEY_GUIDE.policy_warranty_body_html).toBeUndefined()
    expect(KEY_GUIDE.policy_return_exchange_title).toBeUndefined()
    expect(KEY_GUIDE.policy_return_exchange_body_html).toBeUndefined()
    expect(viLocale.settings.group_store_policy).toBeUndefined()
    expect(enLocale.settings.group_store_policy).toBeUndefined()
    expect(viLocale.settings.keyLabel.policy_warranty_title).toBeUndefined()
    expect(enLocale.settings.keyLabel.policy_warranty_title).toBeUndefined()
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

describe('retired overdue operational order settings UI', () => {
  it('removes the tab metadata and all dedicated bilingual copy while retaining the backend key contract', () => {
    expect(TAB_ORDER).not.toContain('ORDER_OPERATIONS')
    expect(TAB_META.ORDER_OPERATIONS).toBeUndefined()
    expect(HIDDEN_GROUPS).toContain('ORDER_OPERATIONS')
    expect(KEY_GUIDE.order_overdue_days).toBeUndefined()
    expect(viLocale.settings.group_order_operations).toBeUndefined()
    expect(enLocale.settings.group_order_operations).toBeUndefined()
    expect(viLocale.settings.groupDescription.orderOperations).toBeUndefined()
    expect(enLocale.settings.groupDescription.orderOperations).toBeUndefined()
    expect(viLocale.settings.keyLabel.order_overdue_days).toBeUndefined()
    expect(enLocale.settings.keyLabel.order_overdue_days).toBeUndefined()
    expect(viLocale.settings.keyHint.order_overdue_days).toBeUndefined()
    expect(enLocale.settings.keyHint.order_overdue_days).toBeUndefined()
    expect(viLocale.settings.keyWhere.order_overdue_days).toBeUndefined()
    expect(enLocale.settings.keyWhere.order_overdue_days).toBeUndefined()
    expect(viLocale.settings.section.order_operations_reminders).toBeUndefined()
    expect(enLocale.settings.section.order_operations_reminders).toBeUndefined()
  })

  it('keeps the remaining tab order unchanged', () => {
    expect(TAB_ORDER).toEqual([
      'GENERAL',
      'INVENTORY',
      'CONTACT',
      'PAYMENT',
      'PUBLIC_HERO',
      'SEO',
      'PRODUCT_ASSIGN',
      'REVIEW_MODERATION',
      'AI_ASSISTANT',
    ])
  })
})

describe('automatic review invitations', () => {
  it('has no Settings tab, field guide, validation or admin copy', () => {
    const legacyReviewInvitationKeys = {
      enabled: ['review', 'invitation', 'enabled'].join('_'),
      delayDays: ['review', 'invitation', 'delay', 'days'].join('_'),
      dailyLimit: ['review', 'invitation', 'daily', 'limit'].join('_'),
    }

    expect(TAB_ORDER).not.toContain('REVIEW_INVITATION')
    expect(TAB_META.REVIEW_INVITATION).toBeUndefined()
    expect(KEY_GUIDE[legacyReviewInvitationKeys.enabled]).toBeUndefined()
    expect(KEY_GUIDE[legacyReviewInvitationKeys.delayDays]).toBeUndefined()
    expect(KEY_GUIDE[legacyReviewInvitationKeys.dailyLimit]).toBeUndefined()
    expect(viLocale.settings.group_review_invitation).toBeUndefined()
    expect(enLocale.settings.group_review_invitation).toBeUndefined()
    expect(viLocale.settings.reviewInvitation).toBeUndefined()
    expect(enLocale.settings.reviewInvitation).toBeUndefined()
  })
})
