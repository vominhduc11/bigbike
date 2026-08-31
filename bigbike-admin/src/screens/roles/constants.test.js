import { describe, expect, it } from 'vitest'
import {
  BUILTIN_CATALOG,
  closePermissionDependencies,
  dependentClosure,
  groupCatalogByModule,
  requiredBy,
} from './constants'

const catalog = groupCatalogByModule(BUILTIN_CATALOG)

describe('permission dependency helpers', () => {
  it('adds every direct dependency for a write permission', () => {
    const result = closePermissionDependencies(new Set(['products.update']), catalog)

    expect([...result.permissions]).toEqual(expect.arrayContaining([
      'products.update',
      'products.read',
      'catalog.read',
    ]))
    expect([...result.autoAdded.keys()]).toEqual(expect.arrayContaining([
      'products.read',
      'catalog.read',
    ]))
  })

  it('closes cross-module dependencies for Home Highlights and Admin Users', () => {
    const result = closePermissionDependencies(
      new Set(['home_highlights.write', 'admin-users.write']),
      catalog,
    )

    expect(result.permissions).toEqual(new Set([
      'home_highlights.write',
      'admin-users.write',
      'home_highlights.read',
      'products.read',
      'admin-users.read',
      'roles.read',
    ]))
  })

  it('removes all active dependents when a required read permission is removed', () => {
    const active = new Set(['products.update', 'products.read', 'catalog.read', 'catalog.update'])

    expect(dependentClosure('catalog.read', active, catalog)).toEqual(
      new Set(['catalog.read', 'products.update', 'catalog.update']),
    )
  })

  it('reports why a checked dependency is required', () => {
    const active = new Set(['admin-users.write', 'admin-users.read', 'roles.read'])

    expect(requiredBy('roles.read', active, catalog)).toEqual(['admin-users.write'])
  })

  it('keeps chat history view-only with no reply permission', () => {
    const chat = catalog.find((group) => group.moduleKey === 'chat')

    expect(chat.permissions.map((permission) => permission.key)).toEqual(['chat.read'])
  })

  it('normalizes old catalog entries into module metadata', () => {
    const grouped = groupCatalogByModule([
      { groupKey: 'legacy', permissions: [{ key: 'orders.read', sensitive: false }] },
    ])

    expect(grouped).toEqual([
      {
        groupKey: 'roles.module.orders',
        moduleKey: 'orders',
        permissions: [{
          key: 'orders.read',
          moduleKey: 'orders',
          kind: 'READ',
          sensitive: false,
          requires: [],
        }],
      },
    ])
  })
})
