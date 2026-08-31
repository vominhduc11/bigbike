import { afterEach, describe, expect, it, vi } from 'vitest'
import { exportCustomersCsv, exportFullProductCatalogCsv, exportOrdersCsv } from './adminApi'

describe('exportFullProductCatalogCsv', () => {
  afterEach(() => vi.restoreAllMocks())

  it('sends the default filtered scope and pricing preset', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      blob: async () => new Blob(['id,name_vi\n1,Sản phẩm']),
      headers: new Headers({ 'Content-Disposition': 'attachment; filename="products-full.csv"' }),
    })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    await exportFullProductCatalogCsv()

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock.mock.calls[0][0]).toBe(
      '/api/v1/admin/products/export.csv?scope=FILTERED&preset=PRICING',
    )
    expect(click).toHaveBeenCalledOnce()
  })

  it('sends screen filters, selected IDs, and custom columns', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      blob: async () => new Blob(['sku,name_vi\nBB-1,Sản phẩm']),
      headers: new Headers({
        'Content-Disposition': 'attachment; filename="sanpham_dang-chon.csv"',
      }),
    })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    await exportFullProductCatalogCsv({
      scope: 'SELECTED',
      q: 'mũ',
      categoryId: 'cat-1',
      brandId: 'brand-1',
      publishStatus: 'ALL',
      stockState: 'OUT_OF_STOCK',
      includeDraft: true,
      includeTrash: true,
      ids: ['p-1', 'p-2'],
      preset: 'CONTENT_SEO',
      columns: ['name_vi', 'sku'],
    })

    expect(fetchMock.mock.calls[0][0]).toBe(
      '/api/v1/admin/products/export.csv' +
        '?scope=SELECTED&q=m%C5%A9&categoryId=cat-1&brandId=brand-1&publishStatus=ALL&stockState=OUT_OF_STOCK' +
        '&includeDraft=true&includeTrash=true&ids=p-1%2Cp-2&preset=CONTENT_SEO&columns=name_vi%2Csku',
    )
  })
})

describe('exportOrdersCsv', () => {
  afterEach(() => vi.restoreAllMocks())

  it('sends the complete Orders-screen filter set', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      blob: async () => new Blob(['order_number,status\nBB-1,PROCESSING']),
      headers: new Headers({ 'Content-Disposition': 'attachment; filename="orders.csv"' }),
    })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    await exportOrdersCsv({
      q: '0909 123 456',
      status: 'PROCESSING',
      from: '2026-07-20',
      to: '2026-07-24',
      orderScope: 'HISTORICAL',
      attention: 'OVERDUE',
    })

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock.mock.calls[0][0]).toBe(
      '/api/v1/admin/reports/orders/export' +
        '?q=0909%20123%20456&status=PROCESSING&from=2026-07-20&to=2026-07-24' +
        '&orderScope=HISTORICAL&attention=OVERDUE',
    )
  })
})

describe('exportCustomersCsv', () => {
  afterEach(() => vi.restoreAllMocks())

  it('sends the complete Customers-screen filter set', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      blob: async () => new Blob(['email,status\nkhach@bigbike.test,ACTIVE']),
      headers: new Headers({ 'Content-Disposition': 'attachment; filename="customers.csv"' }),
    })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    await exportCustomersCsv({
      q: 'Nguyễn Văn A',
      status: 'ACTIVE',
      synthetic: 'false',
      emailVerified: 'true',
    })

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock.mock.calls[0][0]).toBe(
      '/api/v1/admin/reports/customers/export' +
        '?q=Nguy%E1%BB%85n%20V%C4%83n%20A&status=ACTIVE&synthetic=false&emailVerified=true',
    )
  })
})
