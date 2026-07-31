import { describe, expect, it } from 'vitest'
import {
  ADMIN_ACCESS_POLICIES,
  canAccessPolicy,
  missingPolicyPermissions,
  policyForRoute,
} from './adminAccessPolicy'

function checker(permissions) {
  const granted = new Set(permissions)
  return permission => granted.has('*') || granted.has(permission)
}

describe('admin access policy registry', () => {
  it('uses the same policy for Dashboard navigation and route access', () => {
    expect(policyForRoute('dashboard')).toBe('dashboard')
    expect(ADMIN_ACCESS_POLICIES.dashboard.allOf).toEqual(['orders.read'])
    expect(canAccessPolicy('dashboard', checker(['orders.read']))).toBe(true)
  })

  it('does not expose a module for a malformed write-only permission set', () => {
    expect(canAccessPolicy('productsRead', checker(['products.update']))).toBe(false)
    expect(canAccessPolicy('productsWrite', checker(['products.update']))).toBe(false)
  })

  it('requires read, write and catalog data on product create', () => {
    const hasPermission = checker(['products.read', 'products.update'])
    expect(canAccessPolicy(policyForRoute('product-create'), hasPermission)).toBe(false)
    expect(missingPolicyPermissions('productsWrite', hasPermission)).toEqual(['catalog.read'])
  })

  it('requires both product permissions for Featured Products', () => {
    expect(canAccessPolicy('featuredProducts', checker(['products.read']))).toBe(false)
    expect(canAccessPolicy('featuredProducts', checker(['products.read', 'products.update']))).toBe(true)
  })

  it('allows wildcard to satisfy allOf policies', () => {
    expect(canAccessPolicy('slidersFullEdit', checker(['*']))).toBe(true)
  })
})
