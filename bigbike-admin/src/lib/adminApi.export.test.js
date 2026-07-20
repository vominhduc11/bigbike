import { afterEach, describe, expect, it, vi } from 'vitest'
import { exportFullProductCatalogCsv } from './adminApi'

describe('exportFullProductCatalogCsv', () => {
  afterEach(() => vi.restoreAllMocks())

  it('calls the unfiltered full-catalog endpoint, regardless of ProductListScreen filters', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      blob: async () => new Blob(['id,name_vi\n1,Sản phẩm']),
      headers: new Headers({ 'Content-Disposition': 'attachment; filename="products-full.csv"' }),
    })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    await exportFullProductCatalogCsv()

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/admin/products/export.csv')
    expect(fetchMock.mock.calls[0][0]).not.toContain('?')
    expect(click).toHaveBeenCalledOnce()
  })
})
