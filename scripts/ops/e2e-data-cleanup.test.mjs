import test from 'node:test'
import assert from 'node:assert/strict'
import { createCleanupClient, E2EDataCleanupError, matchesE2EMarker, purgeE2EData, scanE2EData } from './e2e-data-cleanup.mjs'

function jsonResponse(status, body) {
  return {
    status,
    headers: new Headers(),
    text: async () => JSON.stringify(body),
  }
}

function listResponse(items = []) {
  return jsonResponse(200, { data: items, pagination: { hasNext: false } })
}

function createMockClient(handler, options = {}) {
  const calls = []
  const client = createCleanupClient({
    baseUrl: 'https://admin.example.invalid',
    accessToken: 'e2e-token',
    maxRetries: 0,
    retryDelayMs: 0,
    sleepImpl: async () => {},
    fetchImpl: async (input, init) => {
      const url = new URL(input)
      calls.push({ method: init.method, url, body: init.body })
      return handler(url, init, calls)
    },
    ...options,
  })
  return { client, calls }
}

test('marker registry does not treat arbitrary test text as E2E data', () => {
  assert.equal(matchesE2EMarker('products', { name: 'sản phẩm test thực tế' }), false)
  assert.equal(matchesE2EMarker('articles', { title: 'Bài viết thật có đường dẫn test' }), false)
  assert.equal(matchesE2EMarker('media', { originalFilename: 'my-test-upload.png' }), false)
  assert.equal(matchesE2EMarker('media', { originalFilename: 'test-upload.png' }), true)
  assert.equal(matchesE2EMarker('media', { filePath: 'uploads/uuid/product-image-2000.jpg' }), true)
  assert.equal(matchesE2EMarker('products', { sku: 'E2E_PRODUCT_EDITOR_123' }), true)
})

test('scanner returns only exact marker matches and never sends DELETE', async () => {
  const { client, calls } = createMockClient((url) => {
    if (url.pathname.endsWith('/admin/products')) {
      return listResponse([
        { id: 'product-e2e', sku: 'E2E_PRODUCT_EDITOR_123', name: 'Mũ thử nghiệm', publishStatus: 'TRASH' },
        { id: 'product-real', sku: 'SHOP-123', name: 'test thực tế', publishStatus: 'DRAFT' },
      ])
    }
    return url.pathname.endsWith('/admin/home-videos')
      ? jsonResponse(200, { data: [] })
      : listResponse([])
  })

  const inventory = await scanE2EData(client)
  assert.deepEqual(inventory.products.map(({ id }) => id), ['product-e2e'])
  assert.equal(calls.some(({ method }) => method === 'DELETE'), false)
})

test('purge deletes a marked product through direct soft and permanent ID endpoints', async () => {
  let exists = true
  const product = { id: 'product-e2e', sku: 'E2E_PRODUCT_EDITOR_123', name: 'Mũ thử nghiệm', publishStatus: 'DRAFT' }
  const { client, calls } = createMockClient((url, init) => {
    if (url.pathname === '/api/v1/auth/me') return jsonResponse(200, { data: { permissions: ['*'] } })
    if (url.pathname.endsWith('/admin/products') && exists) return listResponse([product])
    if (url.pathname.endsWith('/admin/products/product-e2e') && init.method === 'DELETE' && !url.pathname.endsWith('/permanent')) {
      return jsonResponse(204, null)
    }
    if (url.pathname.endsWith('/admin/products/product-e2e/permanent') && init.method === 'DELETE') {
      exists = false
      return jsonResponse(204, null)
    }
    return url.pathname.endsWith('/admin/home-videos') ? jsonResponse(200, { data: [] }) : listResponse([])
  })

  const result = await purgeE2EData(client)
  assert.equal(result.deleted.length, 1)
  assert.equal(result.residual.products.length, 0)
  assert.deepEqual(
    calls.filter(({ method }) => method === 'DELETE').map(({ url }) => url.pathname),
    ['/api/v1/admin/products/product-e2e', '/api/v1/admin/products/product-e2e/permanent'],
  )
})

test('purge recognizes gallery and variant references owned by a marked product', async () => {
  let productExists = true
  let mediaExists = true
  const product = { id: 'product-e2e', sku: 'E2E_PRODUCT_EDITOR_789', name: 'Mũ thử nghiệm', publishStatus: 'DRAFT' }
  const media = { id: 'media-e2e', originalFilename: 'E2E_MEDIA_789.jpg', status: 'ACTIVE' }
  const { client } = createMockClient((url, init) => {
    if (url.pathname === '/api/v1/auth/me') return jsonResponse(200, { data: { permissions: ['*'] } })
    if (url.pathname === '/api/v1/admin/products' && productExists) return listResponse([product])
    if (url.pathname === '/api/v1/admin/products/product-e2e' && init.method === 'DELETE') return jsonResponse(204, null)
    if (url.pathname === '/api/v1/admin/products/product-e2e/permanent' && init.method === 'DELETE') {
      productExists = false
      return jsonResponse(204, null)
    }
    if (url.pathname === '/api/v1/admin/media' && mediaExists) return listResponse([media])
    if (url.pathname === '/api/v1/admin/media/media-e2e' && init.method === 'GET') {
      return jsonResponse(200, {
        data: {
          ...media,
          references: [{ type: 'PRODUCT_VARIANT_GALLERY', id: 'variant-e2e', adminPath: '/admin/products/product-e2e' }],
        },
      })
    }
    if (url.pathname === '/api/v1/admin/media/media-e2e' && init.method === 'DELETE' && !url.searchParams.has('permanent')) {
      return jsonResponse(204, null)
    }
    if (url.pathname === '/api/v1/admin/media/media-e2e' && init.method === 'DELETE' && url.searchParams.get('permanent') === 'true') {
      mediaExists = false
      return jsonResponse(204, null)
    }
    return url.pathname.endsWith('/admin/home-videos') ? jsonResponse(200, { data: [] }) : listResponse([])
  })

  const result = await purgeE2EData(client)
  assert.equal(result.deleted.length, 2)
  assert.equal(result.residual.products.length, 0)
  assert.equal(result.residual.media.length, 0)
})

test('purge uses the article type path for soft-delete and the permanent article path for hard-delete', async () => {
  let exists = true
  const article = {
    id: 'article-e2e',
    type: 'ARTICLE',
    slug: 'e2e-content-123',
    title: 'Bài viết E2E',
    publishStatus: 'DRAFT',
  }
  const { client, calls } = createMockClient((url, init) => {
    if (url.pathname === '/api/v1/auth/me') return jsonResponse(200, { data: { permissions: ['*'] } })
    if (url.pathname === '/api/v1/admin/content' && exists) return listResponse([article])
    if (url.pathname === '/api/v1/admin/content/article/article-e2e' && init.method === 'DELETE') {
      return jsonResponse(204, null)
    }
    if (url.pathname === '/api/v1/admin/content/articles/article-e2e/permanent' && init.method === 'DELETE') {
      exists = false
      return jsonResponse(204, null)
    }
    return url.pathname.endsWith('/admin/home-videos') ? jsonResponse(200, { data: [] }) : listResponse([])
  })

  const result = await purgeE2EData(client)
  assert.equal(result.deleted.length, 1)
  assert.deepEqual(
    calls.filter(({ method }) => method === 'DELETE').map(({ url }) => url.pathname),
    ['/api/v1/admin/content/article/article-e2e', '/api/v1/admin/content/articles/article-e2e/permanent'],
  )
})

test('purge fails with residual IDs when one direct delete fails', async () => {
  const product = { id: 'product-e2e', sku: 'E2E_PRODUCT_EDITOR_456', name: 'Mũ thử nghiệm', publishStatus: 'TRASH' }
  const { client } = createMockClient((url, init) => {
    if (url.pathname === '/api/v1/auth/me') return jsonResponse(200, { data: { permissions: ['*'] } })
    if (url.pathname.endsWith('/admin/products')) return listResponse([product])
    if (url.pathname.endsWith('/admin/products/product-e2e/permanent')) return jsonResponse(500, { message: 'blocked' })
    return url.pathname.endsWith('/admin/home-videos') ? jsonResponse(200, { data: [] }) : listResponse([])
  })

  await assert.rejects(
    () => purgeE2EData(client),
    (error) => {
      assert.ok(error instanceof E2EDataCleanupError)
      assert.equal(error.details.failed[0].record.id, 'product-e2e')
      assert.equal(error.details.residual.products[0].id, 'product-e2e')
      return true
    },
  )
})

test('purge refuses to delete media while an unknown real reference remains', async () => {
  const media = { id: 'media-e2e', originalFilename: 'E2E_MEDIA_123.svg', status: 'ACTIVE' }
  const { client, calls } = createMockClient((url) => {
    if (url.pathname === '/api/v1/auth/me') return jsonResponse(200, { data: { permissions: ['*'] } })
    if (url.pathname.endsWith('/admin/media/media-e2e')) {
      return jsonResponse(200, { data: { ...media, references: [{ type: 'PRODUCT', id: 'real-product', name: 'Hàng thật' }] } })
    }
    if (url.pathname.endsWith('/admin/media')) return listResponse([media])
    return url.pathname.endsWith('/admin/home-videos') ? jsonResponse(200, { data: [] }) : listResponse([])
  })

  await assert.rejects(
    () => purgeE2EData(client),
    (error) => {
      assert.ok(error instanceof E2EDataCleanupError)
      assert.match(error.details.failed[0].error, /không xác định sử dụng/)
      return true
    },
  )
  assert.equal(calls.some(({ method }) => method === 'DELETE'), false)
})

test('purge refuses to delete media when reference data is missing', async () => {
  const media = { id: 'media-e2e', originalFilename: 'E2E_MEDIA_456.svg', status: 'ACTIVE' }
  const { client, calls } = createMockClient((url) => {
    if (url.pathname === '/api/v1/auth/me') return jsonResponse(200, { data: { permissions: ['*'] } })
    if (url.pathname.endsWith('/admin/media/media-e2e')) return jsonResponse(200, { data: media })
    if (url.pathname.endsWith('/admin/media')) return listResponse([media])
    return url.pathname.endsWith('/admin/home-videos') ? jsonResponse(200, { data: [] }) : listResponse([])
  })

  await assert.rejects(
    () => purgeE2EData(client),
    (error) => {
      assert.ok(error instanceof E2EDataCleanupError)
      assert.match(error.details.failed[0].error, /không trả danh sách liên kết/)
      return true
    },
  )
  assert.equal(calls.some(({ method }) => method === 'DELETE'), false)
})

test('purge refuses to hard-delete a marked category linked from a real product', async () => {
  const category = { id: 'category-e2e', slug: 'e2e-category-123', name: 'E2E_CATEGORY_123', deleted: true }
  const realProduct = {
    id: 'real-product',
    sku: 'SHOP-123',
    name: 'Sản phẩm thật',
    publishStatus: 'DRAFT',
    category: { id: 'category-e2e', name: category.name },
  }
  const { client, calls } = createMockClient((url) => {
    if (url.pathname === '/api/v1/auth/me') return jsonResponse(200, { data: { permissions: ['*'] } })
    if (url.pathname.endsWith('/admin/categories')) return listResponse([category])
    if (url.pathname.endsWith('/admin/products') && !url.searchParams.has('q')) return listResponse([realProduct])
    if (url.pathname.endsWith('/admin/categories') && url.searchParams.get('deleted') === 'false') return listResponse([category])
    return url.pathname.endsWith('/admin/home-videos') ? jsonResponse(200, { data: [] }) : listResponse([])
  })

  await assert.rejects(
    () => purgeE2EData(client),
    (error) => {
      assert.ok(error instanceof E2EDataCleanupError)
      assert.match(error.message, /sản phẩm thật/)
      assert.equal(error.details.safetyIssues.length, 1)
      return true
    },
  )
  assert.equal(calls.some(({ method }) => method === 'DELETE'), false)
})
