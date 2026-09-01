import { describe, expect, it, vi } from 'vitest'
import {
  getMediaFolderLabel,
  getMediaFolderPath,
  getSystemFolderDeleteWarning,
} from './mediaFolderUtils'

const t = vi.fn((key) => `translated:${key}`)

describe('mediaFolderUtils', () => {
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
