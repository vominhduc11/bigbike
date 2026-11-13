import { describe, expect, it, vi } from 'vitest'
import {
  getMediaFolderLabel,
  getMediaFolderOptions,
  getMediaFolderPath,
  getSystemFolderDeleteWarning,
} from './mediaFolderUtils'

const t = vi.fn((key) => `translated:${key}`)

describe('mediaFolderUtils', () => {
  it('preserves option order, translation, renamed parents and missing-parent fallback', () => {
    const folders = [
      { id: 'child', name: 'AGV', parentId: 'products' },
      { id: 'products', name: 'Sản phẩm', systemKey: 'root:products' },
      { id: 'orphan', name: 'Kho tạm', parentId: 'missing' },
    ]
    const original = structuredClone(folders)
    expect(getMediaFolderOptions(folders, t)).toEqual([
      { value: 'child', label: 'translated:media.folderTree.products › AGV' },
      { value: 'products', label: 'translated:media.folderTree.products' },
      { value: 'orphan', label: 'Kho tạm' },
    ])
    expect(folders).toEqual(original)
    folders[1].name = 'Kho sản phẩm'
    expect(getMediaFolderOptions(folders, t)[0].label).toBe('Kho sản phẩm › AGV')
    expect(getMediaFolderOptions(undefined, t)).toEqual([])
  })

  it('terminates cyclic legacy paths and keeps their existing labels', () => {
    const folders = [
      { id: 'a', name: 'A', parentId: 'b' },
      { id: 'b', name: 'B', parentId: 'a' },
    ]
    expect(getMediaFolderOptions(folders, t)).toEqual([
      { value: 'a', label: 'B › A' },
      { value: 'b', label: 'A › B' },
    ])
  })

  it('uses the translated system label only while the seeded name is unchanged', () => {
    expect(getMediaFolderLabel({ name: 'Sản phẩm', systemKey: 'root:products' }, t)).toBe(
      'translated:media.folderTree.products',
    )
    expect(getMediaFolderLabel({ name: 'Kho sản phẩm', systemKey: 'root:products' }, t)).toBe(
      'Kho sản phẩm',
    )
  })

  it('keeps a renamed system folder in every path and warning', () => {
    const folders = [
      { id: 'products', name: 'Kho sản phẩm', systemKey: 'root:products', parentId: null },
      { id: 'agv', name: 'Mũ AGV', systemKey: 'products:agv', parentId: 'products' },
    ]

    expect(getMediaFolderPath('agv', folders, t)).toBe('Kho sản phẩm › Mũ AGV')
    expect(getSystemFolderDeleteWarning(folders[1], t)).toBe(
      'translated:media.systemFolderDeleteImpact.productBrand',
    )
    expect(t).toHaveBeenLastCalledWith('media.systemFolderDeleteImpact.productBrand', {
      name: 'Mũ AGV',
    })
  })
})
