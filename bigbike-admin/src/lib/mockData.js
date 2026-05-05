import {
  normalizeBrand,
  normalizeCategory,
  normalizeContentItem,
  normalizeCoupon,
  normalizeCustomer,
  normalizeMediaItem,
  normalizeOrder,
  normalizePagination,
  normalizeProduct,
  normalizeRedirect,
  normalizeSetting,
} from './contracts'

const ISO_NOW = new Date().toISOString()

const CATEGORY_DATA = [
  {
    id: 'cat-helmet',
    slug: 'mu-bao-hiem',
    name: 'Mũ bảo hiểm',
    description: 'Danh mục mũ bảo hiểm fullface, 3/4 và touring.',
    isVisible: true,
    sortOrder: 1,
    createdAt: '2026-04-10T03:00:00Z',
    updatedAt: ISO_NOW,
    image: {
      url: 'https://images.unsplash.com/photo-1610642372651-3e0e4af7fcd2',
      alt: 'Motorcycle helmet',
    },
  },
  {
    id: 'cat-jacket',
    slug: 'ao-giap-biker',
    name: 'Áo giáp biker',
    description: 'Áo giáp đi touring và đi phố cho biker.',
    isVisible: true,
    sortOrder: 2,
    createdAt: '2026-04-12T03:00:00Z',
    updatedAt: ISO_NOW,
  },
  {
    id: 'cat-intercom',
    slug: 'intercom-bluetooth',
    name: 'Intercom Bluetooth',
    description: 'Thiết bị liên lạc mũ bảo hiểm.',
    isVisible: false,
    sortOrder: 3,
    createdAt: '2026-04-12T03:00:00Z',
    updatedAt: ISO_NOW,
  },
].map(normalizeCategory)

const BRAND_DATA = [
  {
    id: 'brand-ls2',
    slug: 'ls2',
    name: 'LS2',
    description: 'Thương hiệu mũ bảo hiểm quốc tế.',
    isVisible: true,
    logo: {
      url: 'https://images.unsplash.com/photo-1558981359-219d6364c9c8',
      alt: 'LS2 helmet logo',
    },
    createdAt: '2026-04-12T03:00:00Z',
    updatedAt: ISO_NOW,
  },
  {
    id: 'brand-cardo',
    slug: 'cardo',
    name: 'Cardo',
    description: 'Intercom cho biker.',
    isVisible: true,
    createdAt: '2026-04-13T03:00:00Z',
    updatedAt: ISO_NOW,
  },
  {
    id: 'brand-alpinestars',
    slug: 'alpinestars',
    name: 'Alpinestars',
    description: 'Đồ bảo hộ cho biker và touring.',
    isVisible: true,
    createdAt: '2026-04-13T03:00:00Z',
    updatedAt: ISO_NOW,
  },
].map(normalizeBrand)

const PRODUCTS_DATA = [
  {
    id: 'prod-ls2-ff800',
    sku: 'LS2-FF800-BLK-L',
    slug: 'ls2-ff800-black',
    name: 'Mũ bảo hiểm LS2 FF800 Black',
    shortDescription: 'Mũ fullface cho touring và đi phố.',
    description:
      'Mũ fullface LS2 FF800 có kính âm, phù hợp touring đường dài.',
    brand: { id: 'brand-ls2', slug: 'ls2', name: 'LS2' },
    category: { id: 'cat-helmet', slug: 'mu-bao-hiem', name: 'Mũ bảo hiểm' },
    categories: [{ id: 'cat-helmet', slug: 'mu-bao-hiem', name: 'Mũ bảo hiểm' }],
    image: {
      url: 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87',
      alt: 'LS2 FF800 Black',
    },
    gallery: [
      {
        url: 'https://images.unsplash.com/photo-1576239766030-d2f2c703b3c9',
        alt: 'LS2 side view',
      },
    ],
    videos: [],
    price: { retailPrice: 2850000, compareAtPrice: 3200000, salePrice: 2690000, currency: 'VND' },
    publishStatus: 'PUBLISHED',
    stockState: 'IN_STOCK',
    createdAt: '2026-04-10T03:00:00Z',
    updatedAt: ISO_NOW,
  },
  {
    id: 'prod-ls2-rapid',
    sku: 'LS2-RAPID-WHT-M',
    slug: 'ls2-rapid-white',
    name: 'Mũ bảo hiểm LS2 Rapid White',
    shortDescription: 'Mũ fullface entry cho đi phố.',
    brand: { id: 'brand-ls2', slug: 'ls2', name: 'LS2' },
    category: { id: 'cat-helmet', slug: 'mu-bao-hiem', name: 'Mũ bảo hiểm' },
    categories: [{ id: 'cat-helmet', slug: 'mu-bao-hiem', name: 'Mũ bảo hiểm' }],
    image: {
      url: 'https://images.unsplash.com/photo-1619468129361-605ebea04b44',
      alt: 'LS2 Rapid White',
    },
    gallery: [],
    videos: [],
    price: { retailPrice: 1850000, currency: 'VND' },
    publishStatus: 'DRAFT',
    stockState: 'LOW_STOCK',
    createdAt: '2026-04-11T03:00:00Z',
    updatedAt: ISO_NOW,
  },
  {
    id: 'prod-astars-jacket-v2',
    sku: 'ASTARS-JACKET-V2-L',
    slug: 'alpinestars-v2-jacket',
    name: 'Áo giáp Alpinestars V2',
    shortDescription: 'Áo giáp touring có protect vai và khuỷu.',
    brand: { id: 'brand-alpinestars', slug: 'alpinestars', name: 'Alpinestars' },
    category: { id: 'cat-jacket', slug: 'ao-giap-biker', name: 'Áo giáp biker' },
    categories: [{ id: 'cat-jacket', slug: 'ao-giap-biker', name: 'Áo giáp biker' }],
    image: {
      url: 'https://images.unsplash.com/photo-1556906781-9a412961c28c',
      alt: 'Alpinestars jacket',
    },
    gallery: [],
    videos: [],
    price: { retailPrice: 3590000, currency: 'VND' },
    publishStatus: 'PUBLISHED',
    stockState: 'PREORDER',
    createdAt: '2026-04-11T03:00:00Z',
    updatedAt: ISO_NOW,
  },
  {
    id: 'prod-cardo-spirit',
    sku: 'CARDO-SPIRIT-2UP',
    slug: 'cardo-spirit',
    name: 'Cardo Spirit Intercom',
    shortDescription: 'Intercom bluetooth cho mũ bảo hiểm.',
    brand: { id: 'brand-cardo', slug: 'cardo', name: 'Cardo' },
    category: {
      id: 'cat-intercom',
      slug: 'intercom-bluetooth',
      name: 'Intercom Bluetooth',
    },
    categories: [
      {
        id: 'cat-intercom',
        slug: 'intercom-bluetooth',
        name: 'Intercom Bluetooth',
      },
    ],
    image: {
      url: 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87',
      alt: 'Cardo Spirit',
    },
    gallery: [],
    videos: [
      {
        url: 'https://www.youtube.com/watch?v=R4B8V6Ai5qs',
        title: 'Cardo Spirit introduction',
        provider: 'YOUTUBE',
      },
    ],
    price: { retailPrice: 2490000, currency: 'VND' },
    publishStatus: 'HIDDEN',
    stockState: 'OUT_OF_STOCK',
    createdAt: '2026-04-12T03:00:00Z',
    updatedAt: ISO_NOW,
  },
  {
    id: 'prod-astars-gloves',
    sku: 'ASTARS-GLOVES-BLK',
    slug: 'alpinestars-gloves-city',
    name: 'Găng tay Alpinestars City',
    shortDescription: 'Găng tay đi phố có bảo vệ khớp ngón.',
    brand: { id: 'brand-alpinestars', slug: 'alpinestars', name: 'Alpinestars' },
    category: { id: 'cat-jacket', slug: 'ao-giap-biker', name: 'Áo giáp biker' },
    categories: [{ id: 'cat-jacket', slug: 'ao-giap-biker', name: 'Áo giáp biker' }],
    image: {
      url: 'https://images.unsplash.com/photo-1619953942547-233eab5a70d6',
      alt: 'Alpinestars gloves',
    },
    gallery: [],
    videos: [],
    price: { retailPrice: 990000, currency: 'VND' },
    publishStatus: 'ARCHIVED',
    stockState: 'CONTACT_FOR_STOCK',
    createdAt: '2026-04-12T03:00:00Z',
    updatedAt: ISO_NOW,
  },
].map(normalizeProduct)

const CONTENT_DATA = [
  {
    id: 'article-helmet-size-guide',
    type: 'ARTICLE',
    slug: 'huong-dan-chon-size-mu-bao-hiem',
    title: 'Hướng dẫn chọn size mũ bảo hiểm đúng chuẩn',
    excerpt: 'Checklist đo vòng đầu và chọn size mũ fullface.',
    body: 'Nội dung bài viết sẽ được quản lý qua CMS admin.',
    publishStatus: 'PUBLISHED',
    createdAt: '2026-04-09T03:00:00Z',
    updatedAt: ISO_NOW,
    publishedAt: '2026-04-15T03:00:00Z',
  },
  {
    id: 'article-intercom-guide',
    type: 'ARTICLE',
    slug: 'kinh-nghiem-chon-intercom',
    title: 'Kinh nghiệm chọn intercom cho rider touring',
    excerpt: 'So sánh pin, chuẩn chống nước và khoảng cách đàm thoại.',
    body: 'Nội dung bài viết sẽ được quản lý qua CMS admin.',
    publishStatus: 'DRAFT',
    createdAt: '2026-04-11T03:00:00Z',
    updatedAt: ISO_NOW,
  },
  {
    id: 'page-shipping-policy',
    type: 'PAGE',
    slug: 'chinh-sach-giao-hang',
    title: 'Chính sách giao hàng',
    body: 'Nội dung policy sẽ được hiệu chỉnh ở phase content chi tiết.',
    publishStatus: 'PUBLISHED',
    createdAt: '2026-04-08T03:00:00Z',
    updatedAt: ISO_NOW,
    publishedAt: '2026-04-12T03:00:00Z',
  },
  {
    id: 'page-warranty-policy',
    type: 'PAGE',
    slug: 'chinh-sach-bao-hanh',
    title: 'Chính sách bảo hành',
    body: 'Nội dung policy sẽ được hiệu chỉnh ở phase content chi tiết.',
    publishStatus: 'HIDDEN',
    createdAt: '2026-04-08T03:00:00Z',
    updatedAt: ISO_NOW,
  },
].map(normalizeContentItem)

const REDIRECT_DATA = [
  {
    id: 'redir-old-ls2',
    sourcePattern: '/old-ls2-ff800',
    targetUrl: '/san-pham/ls2-ff800-black',
    redirectType: 'PERMANENT',
    statusCode: 301,
    enabled: true,
    hitCount: 42,
    lastHitAt: '2026-05-01T10:15:00Z',
    notes: 'WordPress permalink migration',
    legacyId: 9001,
    createdAt: '2026-04-18T03:00:00Z',
    updatedAt: ISO_NOW,
  },
  {
    id: 'redir-old-blog',
    sourcePattern: '/huong-dan-chon-size-mu-cu',
    targetUrl: '/tin-tuc/huong-dan-chon-size-mu',
    redirectType: 'TEMPORARY',
    statusCode: 302,
    enabled: false,
    hitCount: 8,
    lastHitAt: '2026-04-27T08:30:00Z',
    notes: 'Disabled after content merge',
    legacyId: 9002,
    createdAt: '2026-04-20T03:00:00Z',
    updatedAt: ISO_NOW,
  },
  {
    id: 'redir-old-brand',
    sourcePattern: '/brand/ls2-helmet',
    targetUrl: '/brands/ls2',
    redirectType: 'PERMANENT',
    statusCode: 308,
    enabled: true,
    hitCount: 15,
    lastHitAt: '2026-04-30T09:00:00Z',
    notes: 'Legacy brand slug',
    legacyId: 9003,
    createdAt: '2026-04-22T03:00:00Z',
    updatedAt: ISO_NOW,
  },
].map(normalizeRedirect)

function normalizeSearch(value) {
  return (value || '').toString().trim().toLowerCase()
}

function sortByRule(items, rule) {
  const [field, direction] = (rule || '').split(':')
  const multiplier = direction === 'asc' ? 1 : -1
  const safeField = field || 'updatedAt'

  return [...items].sort((left, right) => {
    const leftValue = left[safeField]
    const rightValue = right[safeField]

    if (typeof leftValue === 'number' && typeof rightValue === 'number') {
      return (leftValue - rightValue) * multiplier
    }

    const leftText = (leftValue || '').toString()
    const rightText = (rightValue || '').toString()

    return leftText.localeCompare(rightText) * multiplier
  })
}

function paginate(items, query) {
  const page = Math.max(1, Number(query.page || 1))
  const pageSize = Math.max(1, Number(query.pageSize || 10))
  const totalItems = items.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const normalizedPage = Math.min(page, totalPages)
  const start = (normalizedPage - 1) * pageSize
  const end = start + pageSize

  return {
    items: items.slice(start, end),
    pagination: normalizePagination({
      page: normalizedPage,
      pageSize,
      totalItems,
      totalPages,
      hasPrevious: normalizedPage > 1,
      hasNext: normalizedPage < totalPages,
    }),
  }
}

export function queryMockProducts(query) {
  const search = normalizeSearch(query?.search)
  const publishStatus = query?.publishStatus

  let items = PRODUCTS_DATA.filter((item) => {
    const matchesSearch =
      !search ||
      item.name.toLowerCase().includes(search) ||
      (item.sku || '').toLowerCase().includes(search) ||
      item.slug.toLowerCase().includes(search)

    const matchesPublish = publishStatus === 'TRASH'
      ? item.publishStatus === 'TRASH'
      : !publishStatus || publishStatus === 'ALL'
        ? item.publishStatus !== 'TRASH'
        : item.publishStatus === publishStatus

    const matchesStock =
      !query?.stockState ||
      query.stockState === 'ALL' ||
      item.stockState === query.stockState

    return matchesSearch && matchesPublish && matchesStock
  })

  items = sortByRule(items, query?.sort || 'updatedAt:desc')
  return paginate(items, query || {})
}

export function queryMockCategories(query) {
  const search = normalizeSearch(query.search)
  let items = CATEGORY_DATA.filter((item) => {
    const matchesSearch =
      !search ||
      item.name.toLowerCase().includes(search) ||
      item.slug.toLowerCase().includes(search)

    const matchesVisible =
      !query.visibility ||
      query.visibility === 'ALL' ||
      (query.visibility === 'VISIBLE' ? item.isVisible : !item.isVisible)

    return matchesSearch && matchesVisible
  })

  items = sortByRule(items, query.sort || 'updatedAt:desc')
  return paginate(items, query)
}

export function queryMockBrands(query) {
  const search = normalizeSearch(query.search)
  let items = BRAND_DATA.filter((item) => {
    const matchesSearch =
      !search ||
      item.name.toLowerCase().includes(search) ||
      item.slug.toLowerCase().includes(search)

    const matchesVisible =
      !query.visibility ||
      query.visibility === 'ALL' ||
      (query.visibility === 'VISIBLE' ? item.isVisible : !item.isVisible)

    return matchesSearch && matchesVisible
  })

  items = sortByRule(items, query.sort || 'updatedAt:desc')
  return paginate(items, query)
}

export function queryMockContent(query) {
  const search = normalizeSearch(query.search)
  let items = CONTENT_DATA.filter((item) => {
    const matchesSearch =
      !search ||
      item.title.toLowerCase().includes(search) ||
      item.slug.toLowerCase().includes(search)

    const matchesType =
      !query.type || query.type === 'ALL' || item.type === query.type

    const matchesPublish =
      !query.publishStatus ||
      query.publishStatus === 'ALL' ||
      item.publishStatus === query.publishStatus

    return matchesSearch && matchesType && matchesPublish
  })

  items = sortByRule(items, query.sort || 'updatedAt:desc')
  return paginate(items, query)
}

export function queryMockRedirects(query) {
  const search = normalizeSearch(query?.q || query?.search)
  const statusCode = query?.statusCode !== undefined && query?.statusCode !== null && query?.statusCode !== '' && query?.statusCode !== 'ALL'
    ? Number(query.statusCode)
    : null
  const enabled = query?.enabled === 'ALL' ? undefined : query?.enabled

  let items = REDIRECT_DATA.filter((item) => {
    const matchesSearch =
      !search ||
      item.sourcePattern.toLowerCase().includes(search) ||
      item.targetUrl.toLowerCase().includes(search) ||
      (item.notes || '').toLowerCase().includes(search) ||
      String(item.legacyId || '').includes(search)

    const matchesEnabled =
      enabled === undefined ||
      enabled === null ||
      enabled === '' ||
      String(item.enabled) === String(enabled)

    const matchesStatusCode =
      statusCode === null || Number(item.statusCode) === statusCode

    return matchesSearch && matchesEnabled && matchesStatusCode
  })

  items = sortByRule(items, query?.sort || 'updatedAt:desc')
  return paginate(items, query)
}

export function getMockProductById(productId) {
  return PRODUCTS_DATA.find((item) => item.id === productId)
}

export function getMockCategoryById(categoryId) {
  return CATEGORY_DATA.find((item) => item.id === categoryId)
}

export function getMockBrandById(brandId) {
  return BRAND_DATA.find((item) => item.id === brandId)
}

export function getMockContentById(contentType, contentId) {
  return CONTENT_DATA.find(
    (item) => item.type === contentType && item.id === contentId,
  )
}

export function getMockRedirectById(redirectId) {
  return REDIRECT_DATA.find((item) => item.id === redirectId)
}

export const ROLE_PERMISSION_MAP = {
  SUPER_ADMIN: ['*'],
  ADMIN: [
    'products.read', 'products.update',
    'catalog.read', 'catalog.update',
    'content.read', 'content.update',
    'orders.read', 'orders.update',
    'customers.read', 'customers.update',
    'media.read', 'media.update',
    'settings.read', 'settings.update',
    'coupons.read', 'coupons.update',
    'menus.read', 'menus.write',
    'sliders.read', 'sliders.write',
    'shipping.read', 'shipping.write',
    'reviews.read', 'reviews.write',
    'admin-users.read', 'admin-users.write',
    'audit-logs.read',
    'home_videos.read', 'home_videos.write',
    'redirects.read', 'redirects.write',
  ],
  MANAGER: [
    'products.read', 'catalog.read', 'content.read',
    'orders.read', 'customers.read', 'media.read',
  ],
  CONTENT_EDITOR: ['content.read', 'content.update', 'media.read'],
  SEO_EDITOR: ['content.read', 'content.update', 'redirects.read', 'redirects.write'],
  VIEWER: ['products.read', 'catalog.read', 'content.read'],
}

// ── Mock Orders ──────────────────────────────────────────────────────────────

const ORDER_DATA = [
  { id: 'ord-001', orderNumber: 'BB-2026-001', customerEmail: 'khach@example.com', customerName: 'Nguyễn Văn A', orderStatus: 'PENDING', paymentStatus: 'PENDING', paymentMethod: 'COD', subtotal: 2500000, shippingFee: 50000, discount: 0, total: 2550000, createdAt: '2026-04-20T10:00:00Z', updatedAt: ISO_NOW, items: [{ id: 'oi-1', productName: 'Mũ AGV K1', quantity: 1, unitPrice: 2500000, subtotal: 2500000 }] },
  { id: 'ord-002', orderNumber: 'BB-2026-002', customerEmail: 'tran@example.com', customerName: 'Trần Thị B', orderStatus: 'CONFIRMED', paymentStatus: 'PAID', paymentMethod: 'BANK_TRANSFER', subtotal: 4800000, shippingFee: 0, discount: 200000, total: 4600000, createdAt: '2026-04-21T08:30:00Z', updatedAt: ISO_NOW, items: [{ id: 'oi-2', productName: 'Áo giáp Alpinestars', quantity: 1, unitPrice: 4800000, subtotal: 4800000 }] },
  { id: 'ord-003', orderNumber: 'BB-2026-003', customerEmail: 'le@example.com', customerName: 'Lê Văn C', orderStatus: 'DELIVERED', paymentStatus: 'PAID', paymentMethod: 'COD', subtotal: 1200000, shippingFee: 30000, discount: 0, total: 1230000, createdAt: '2026-04-18T14:15:00Z', updatedAt: ISO_NOW, items: [] },
]

export function queryMockOrders(query) {
  let items = ORDER_DATA.map(normalizeOrder)
  if (query?.orderStatus && query.orderStatus !== 'ALL') {
    items = items.filter((o) => o.orderStatus === query.orderStatus)
  }
  if (query?.search) {
    const q = query.search.toLowerCase()
    items = items.filter((o) => o.orderNumber?.toLowerCase().includes(q) || o.customerEmail?.toLowerCase().includes(q))
  }
  const pageSize = Number(query?.pageSize) || 10
  const page = Number(query?.page) || 1
  const start = (page - 1) * pageSize
  return {
    items: items.slice(start, start + pageSize),
    pagination: normalizePagination({ page, pageSize, totalItems: items.length, totalPages: Math.ceil(items.length / pageSize) }),
  }
}

// ── Mock Customers ───────────────────────────────────────────────────────────

const CUSTOMER_DATA = [
  { id: 'cust-001', email: 'khach@example.com', fullName: 'Nguyễn Văn A', phone: '0901234567', status: 'ACTIVE', orderCount: 5, totalSpent: 12500000, createdAt: '2025-06-15T00:00:00Z', updatedAt: ISO_NOW },
  { id: 'cust-002', email: 'tran@example.com', fullName: 'Trần Thị B', phone: '0912345678', status: 'ACTIVE', orderCount: 2, totalSpent: 4600000, createdAt: '2026-01-10T00:00:00Z', updatedAt: ISO_NOW },
  { id: 'cust-003', email: 'inactive@example.com', fullName: 'Phạm Văn D', phone: '0923456789', status: 'INACTIVE', orderCount: 0, totalSpent: 0, createdAt: '2026-02-20T00:00:00Z', updatedAt: ISO_NOW },
]

export function queryMockCustomers(query) {
  let items = CUSTOMER_DATA.map(normalizeCustomer)
  if (query?.status && query.status !== 'ALL') {
    items = items.filter((c) => c.status === query.status)
  }
  if (query?.search) {
    const q = query.search.toLowerCase()
    items = items.filter((c) => c.email?.toLowerCase().includes(q) || c.fullName?.toLowerCase().includes(q))
  }
  const pageSize = Number(query?.pageSize) || 10
  const page = Number(query?.page) || 1
  const start = (page - 1) * pageSize
  return {
    items: items.slice(start, start + pageSize),
    pagination: normalizePagination({ page, pageSize, totalItems: items.length, totalPages: Math.ceil(items.length / pageSize) }),
  }
}

// ── Mock Media ───────────────────────────────────────────────────────────────

const MEDIA_DATA = [
  { id: 'med-001', filename: '2024/05/mu-bao-hiem.jpg', publicUrl: 'https://images.unsplash.com/photo-1610642372651-3e0e4af7fcd2?w=400', mimeType: 'image/jpeg', fileSize: 245000, width: 800, height: 600, altText: 'Mũ bảo hiểm', storageProvider: 'MINIO', createdAt: '2024-05-10T00:00:00Z', updatedAt: ISO_NOW },
  { id: 'med-002', filename: '2024/06/ao-giap.jpg', publicUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400', mimeType: 'image/jpeg', fileSize: 189000, width: 800, height: 600, altText: 'Áo giáp biker', storageProvider: 'MINIO', createdAt: '2024-06-01T00:00:00Z', updatedAt: ISO_NOW },
  { id: 'med-003', filename: '2024/07/gang-tay.jpg', publicUrl: 'https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=400', mimeType: 'image/jpeg', fileSize: 123000, width: 600, height: 400, altText: 'Găng tay', storageProvider: 'LEGACY_WP', createdAt: '2024-07-15T00:00:00Z', updatedAt: ISO_NOW },
]

export function queryMockMedia(query) {
  let items = MEDIA_DATA.map(normalizeMediaItem)
  if (query?.search) {
    const q = query.search.toLowerCase()
    items = items.filter((m) => m.filename?.toLowerCase().includes(q) || m.altText?.toLowerCase().includes(q))
  }
  const pageSize = Number(query?.pageSize) || 20
  const page = Number(query?.page) || 1
  const start = (page - 1) * pageSize
  return {
    items: items.slice(start, start + pageSize),
    pagination: normalizePagination({ page, pageSize, totalItems: items.length, totalPages: Math.ceil(items.length / pageSize) }),
  }
}

// ── RBAC ─────────────────────────────────────────────────────────────────────

export function buildMockAdminUser(role = 'ADMIN') {
  const normalizedRole = ROLE_PERMISSION_MAP[role] ? role : 'ADMIN'
  const permissions = ROLE_PERMISSION_MAP[normalizedRole]

  return {
    id: 'mock-admin-user',
    fullName: 'BigBike Admin',
    email: 'admin@bigbike.local',
    roles: [normalizedRole],
    permissions,
  }
}

// ── Mock Admin Users ─────────────────────────────────────────────────────────

const ADMIN_USERS_DATA = [
  { id: 'adm-001', email: 'admin@bigbike.local', displayName: 'BigBike Admin', role: 'SUPER_ADMIN', status: 'ACTIVE', lastLoginAt: ISO_NOW, createdAt: '2025-01-01T00:00:00Z', updatedAt: ISO_NOW },
  { id: 'adm-002', email: 'editor@bigbike.local', displayName: 'Nội dung Editor', role: 'CONTENT_EDITOR', status: 'ACTIVE', lastLoginAt: '2026-04-25T08:00:00Z', createdAt: '2025-06-01T00:00:00Z', updatedAt: ISO_NOW },
  { id: 'adm-003', email: 'viewer@bigbike.local', displayName: 'Viewer Test', role: 'VIEWER', status: 'INACTIVE', lastLoginAt: null, createdAt: '2026-01-15T00:00:00Z', updatedAt: ISO_NOW },
]

export function queryMockAdminUsers(query) {
  let items = ADMIN_USERS_DATA
  if (query?.search) {
    const q = query.search.toLowerCase()
    items = items.filter((u) => u.email.toLowerCase().includes(q) || u.displayName.toLowerCase().includes(q))
  }
  const pageSize = Number(query?.pageSize) || 20
  const page = Number(query?.page) || 1
  const start = (page - 1) * pageSize
  return {
    items: items.slice(start, start + pageSize),
    pagination: normalizePagination({ page, pageSize, totalItems: items.length, totalPages: Math.ceil(items.length / pageSize) }),
  }
}

// ── Mock Reviews ─────────────────────────────────────────────────────────────

const REVIEWS_DATA = [
  { id: 'rev-001', productId: 'prod-agv-k1', authorName: 'Nguyễn Văn A', authorEmail: 'khach@example.com', rating: 5, body: 'Mũ rất tốt, đầu vào vừa, đẹp lắm!', status: 'APPROVED', createdAt: '2026-04-10T09:00:00Z', updatedAt: ISO_NOW },
  { id: 'rev-002', productId: 'prod-ls2-ff352', authorName: 'Trần Thị B', authorEmail: 'tran@example.com', rating: 3, body: 'Tạm ổn, giao hàng hơi chậm.', status: 'PENDING', createdAt: '2026-04-20T11:30:00Z', updatedAt: ISO_NOW },
  { id: 'rev-003', productId: 'prod-agv-k1', authorName: 'Spam Bot', authorEmail: 'spam@evil.com', rating: 1, body: 'Buy cheap stuff at example.com!!!', status: 'SPAM', createdAt: '2026-04-22T03:00:00Z', updatedAt: ISO_NOW },
]

export function queryMockReviews(query) {
  let items = REVIEWS_DATA
  if (query?.status && query.status !== 'ALL') {
    items = items.filter((r) => r.status === query.status)
  }
  if (query?.search) {
    const q = query.search.toLowerCase()
    items = items.filter((r) => r.authorName.toLowerCase().includes(q) || r.body.toLowerCase().includes(q))
  }
  const pageSize = Number(query?.pageSize) || 20
  const page = Number(query?.page) || 1
  const start = (page - 1) * pageSize
  return {
    items: items.slice(start, start + pageSize),
    pagination: normalizePagination({ page, pageSize, totalItems: items.length, totalPages: Math.ceil(items.length / pageSize) }),
  }
}

// ── Mock Sliders ─────────────────────────────────────────────────────────────

const SLIDERS_DATA = [
  { id: 'sld-001', location: 'home', sortOrder: 1, isActive: true, desktopImage: { url: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200', alt: 'Banner 1' }, mobileImage: null, externalLink: '/collections/new', productId: null },
  { id: 'sld-002', location: 'home', sortOrder: 2, isActive: false, desktopImage: { url: 'https://images.unsplash.com/photo-1610642372651-3e0e4af7fcd2?w=1200', alt: 'Banner 2' }, mobileImage: null, externalLink: null, productId: 'prod-agv-k1' },
  { id: 'sld-003', location: 'category', sortOrder: 1, isActive: true, desktopImage: { url: 'https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=1200', alt: 'Category banner' }, mobileImage: null, externalLink: '/collections/helmets', productId: null },
]

export function queryMockSliders(location) {
  const items = SLIDERS_DATA.filter((s) => !location || s.location === location)
  return { items }
}

// ── Mock Coupons ─────────────────────────────────────────────────────────────

const COUPONS_DATA = [
  { id: 'cpn-001', code: 'BIGBIKE10', name: 'Giảm 10% toàn bộ', discountType: 'PERCENT', amount: 10, minimumAmount: 500000, usageLimit: 100, usageCount: 23, status: 'ACTIVE', expiresAt: '2026-12-31T16:59:59Z', createdAt: '2026-01-01T00:00:00Z', updatedAt: ISO_NOW },
  { id: 'cpn-002', code: 'FREESHIP', name: 'Giảm phí vận chuyển', discountType: 'FIXED', amount: 50000, minimumAmount: 0, usageLimit: null, usageCount: 87, status: 'ACTIVE', expiresAt: null, createdAt: '2026-02-01T00:00:00Z', updatedAt: ISO_NOW },
  { id: 'cpn-003', code: 'SUMMER2025', name: 'Summer Sale 2025', discountType: 'PERCENT', amount: 15, minimumAmount: 1000000, usageLimit: 50, usageCount: 50, status: 'EXPIRED', expiresAt: '2025-09-30T16:59:59Z', createdAt: '2025-06-01T00:00:00Z', updatedAt: ISO_NOW },
].map(normalizeCoupon)

export function queryMockCoupons(query) {
  let items = COUPONS_DATA
  if (query?.status && query.status !== 'ALL') {
    items = items.filter((c) => c.status === query.status)
  }
  if (query?.search) {
    const q = query.search.toLowerCase()
    items = items.filter((c) => c.code.toLowerCase().includes(q))
  }
  const pageSize = Number(query?.pageSize) || 10
  const page = Number(query?.page) || 1
  const start = (page - 1) * pageSize
  return {
    items: items.slice(start, start + pageSize),
    pagination: normalizePagination({ page, pageSize, totalItems: items.length, totalPages: Math.ceil(items.length / pageSize) }),
  }
}

// ── Mock Settings ─────────────────────────────────────────────────────────────

const SETTINGS_DATA = [
  // general
  { settingKey: 'site_name',         settingValue: 'BigBike',              settingGroup: 'general',      description: 'Public site name displayed in the header/footer.' },
  { settingKey: 'footer_tagline',    settingValue: 'BIGBIKE MONG ĐƯỢC LẮNG NGHE VÀ THẤU HIỂU BẠN HƠN', settingGroup: 'general', description: 'Tagline displayed as the heading in the footer brand column.' },
  { settingKey: 'footer_description',settingValue: 'BigBike chuyên cung cấp gear moto chính hãng.', settingGroup: 'general', description: 'Short description paragraph in the footer brand column.' },
  { settingKey: 'bct_url',           settingValue: 'https://online.gov.vn', settingGroup: 'general',     description: 'URL linking to the online.gov.vn registration page for the BCT trust badge.' },
  // contact
  { settingKey: 'hotline',           settingValue: '0906.90.2404',          settingGroup: 'contact',     description: 'Main hotline number displayed in the header and footer.' },
  { settingKey: 'hotline_2',         settingValue: '0764.640.679',          settingGroup: 'contact',     description: 'Secondary hotline number displayed in the footer.' },
  { settingKey: 'contact_email',     settingValue: 'info@bigbike.vn',       settingGroup: 'contact',     description: 'Public contact email displayed in the footer.' },
  { settingKey: 'contact_address',   settingValue: '79/30/52 Âu Cơ, Phường 14, Quận 11, TP.HCM', settingGroup: 'contact', description: 'Public store address displayed in the footer.' },
  { settingKey: 'facebook_url',      settingValue: '',                      settingGroup: 'contact',     description: 'Facebook page URL displayed in the footer.' },
  { settingKey: 'messenger_url',     settingValue: '',                      settingGroup: 'contact',     description: 'Facebook Messenger deep link displayed in the floating chat popup.' },
  { settingKey: 'google_maps_url',   settingValue: '',                      settingGroup: 'contact',     description: 'URL nhúng bản đồ Google Maps hiển thị trên trang Liên hệ.' },
  // seo
  { settingKey: 'seo_home_title',    settingValue: 'BigBike - Đồ bảo hộ moto chính hãng', settingGroup: 'seo', description: 'Homepage SEO title.' },
  { settingKey: 'seo_home_description', settingValue: 'BigBike - shop đồ bảo hộ moto uy tín tại TP.HCM.', settingGroup: 'seo', description: 'Homepage SEO description.' },
  { settingKey: 'og_image_url',      settingValue: '',                      settingGroup: 'seo',         description: 'Default Open Graph image URL.' },
  { settingKey: 'seo_home_h1',       settingValue: '',                      settingGroup: 'seo',         description: 'Tiêu đề H1 chính trên trang chủ.' },
  // public_home
  { settingKey: 'promo_title',       settingValue: 'LS2 DUAL SPORT MX436 PIONEER', settingGroup: 'public_home', description: 'Homepage promotional banner title.' },
  { settingKey: 'promo_off',         settingValue: '20% OFF',               settingGroup: 'public_home', description: 'Homepage promotional discount label.' },
  { settingKey: 'promo_href',        settingValue: '/san-pham',             settingGroup: 'public_home', description: 'Homepage promotional banner target URL.' },
  { settingKey: 'promo_image_url',   settingValue: '',                      settingGroup: 'public_home', description: 'Homepage promotional banner image URL.' },
  { settingKey: 'home_exp_subtitle', settingValue: 'GÓC TRẢI NGHIỆM CÙNG BIGBIKE', settingGroup: 'public_home', description: 'Homepage experience section kicker/subtitle text.' },
  { settingKey: 'home_exp_title',    settingValue: 'PHỤ KIỆN ĐI PHƯỢT MOTO CAO CẤP', settingGroup: 'public_home', description: 'Homepage experience section heading title.' },
  { settingKey: 'home_exp_desc',     settingValue: '',                      settingGroup: 'public_home', description: 'Homepage experience section description paragraph.' },
  { settingKey: 'zalo_url',         settingValue: '',                      settingGroup: 'public_home', description: 'Homepage floating contact Zalo URL.' },
  // store
  { settingKey: 'store_currency',    settingValue: 'VND',                   settingGroup: 'STORE',       description: 'Default currency code used for all orders and displays.' },
  { settingKey: 'store_timezone',    settingValue: 'Asia/Ho_Chi_Minh',      settingGroup: 'STORE',       description: 'Timezone used for order timestamps and scheduled jobs.' },
  { settingKey: 'order_min_amount',  settingValue: '0',                     settingGroup: 'STORE',       description: 'Minimum order total required to check out (in base currency units).' },
  { settingKey: 'low_stock_threshold', settingValue: '5',                   settingGroup: 'STORE',       description: 'Quantity at which a variant is flagged as low-stock in the admin dashboard.' },
  // tax
  { settingKey: 'tax_enabled',       settingValue: 'false',                 settingGroup: 'TAX',         description: 'Enable automatic tax calculation on orders. Set to true to activate.' },
  { settingKey: 'tax_rate',          settingValue: '0.10',                  settingGroup: 'TAX',         description: 'Default VAT rate as a decimal (e.g. 0.10 = 10%). Applied when tax_enabled = true.' },
  { settingKey: 'tax_label',         settingValue: 'VAT',                   settingGroup: 'TAX',         description: 'Display label shown on invoices and order summaries.' },
  { settingKey: 'tax_inclusive',     settingValue: 'false',                 settingGroup: 'TAX',         description: 'Whether product prices already include tax.' },
  { settingKey: 'tax_registration_number', settingValue: '',                settingGroup: 'TAX',         description: 'Business tax registration / MST number shown on invoices.' },
  // security
  { settingKey: 'login_max_attempts',   settingValue: '5',                  settingGroup: 'SECURITY',    description: 'Maximum consecutive failed login attempts before account is temporarily locked.' },
  { settingKey: 'session_timeout_minutes', settingValue: '60',              settingGroup: 'SECURITY',    description: 'Admin session idle timeout in minutes.' },
].map(normalizeSetting)

export function queryMockSettings() {
  return { items: SETTINGS_DATA }
}

// ── Mock Shipping ─────────────────────────────────────────────────────────────

const SHIPPING_ZONES_DATA = [
  { id: 'zone-hcm', name: 'TP. Hồ Chí Minh', regionCode: 'HCM', sortOrder: 1, enabled: true, createdAt: '2025-01-01T00:00:00Z', updatedAt: ISO_NOW },
  { id: 'zone-hn', name: 'Hà Nội', regionCode: 'HN', sortOrder: 2, enabled: true, createdAt: '2025-01-01T00:00:00Z', updatedAt: ISO_NOW },
  { id: 'zone-other', name: 'Tỉnh thành khác', regionCode: 'OTHER', sortOrder: 3, enabled: true, createdAt: '2025-01-01T00:00:00Z', updatedAt: ISO_NOW },
]

const SHIPPING_METHODS_DATA = [
  { id: 'mth-001', zoneId: 'zone-hcm', methodCode: 'STANDARD', title: 'Giao hàng tiêu chuẩn', description: '2-3 ngày', cost: 30000, minOrderAmount: 0, sortOrder: 1, enabled: true },
  { id: 'mth-002', zoneId: 'zone-hcm', methodCode: 'EXPRESS', title: 'Giao hàng nhanh', description: 'Trong ngày', cost: 60000, minOrderAmount: 0, sortOrder: 2, enabled: true },
  { id: 'mth-003', zoneId: 'zone-hn', methodCode: 'STANDARD', title: 'Giao hàng tiêu chuẩn', description: '3-5 ngày', cost: 40000, minOrderAmount: 0, sortOrder: 1, enabled: true },
]

export function queryMockShippingZones(query) {
  let items = SHIPPING_ZONES_DATA
  if (query?.search) {
    const q = query.search.toLowerCase()
    items = items.filter((z) => z.name.toLowerCase().includes(q))
  }
  const pageSize = Number(query?.pageSize) || 20
  const page = Number(query?.page) || 1
  const start = (page - 1) * pageSize
  return {
    items: items.slice(start, start + pageSize),
    pagination: normalizePagination({ page, pageSize, totalItems: items.length, totalPages: Math.ceil(items.length / pageSize) }),
  }
}

export function queryMockShippingMethods(zoneId) {
  return { items: SHIPPING_METHODS_DATA.filter((m) => !zoneId || m.zoneId === zoneId) }
}

// ── Mock Dashboard ────────────────────────────────────────────────────────────

function generateRevenueSeries(days) {
  const today = new Date()
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() - (days - 1 - i))
    const dow = d.getDay()
    const isWeekend = dow === 0 || dow === 6
    const seed = d.getDate() + d.getMonth() * 31
    const base = isWeekend ? 9000000 : 24000000
    const variance = ((seed * 17 + 11) % 28) * 1000000
    const trend = Math.round((i / days) * 6000000)
    const revenue = Math.round((base + variance + trend) / 500000) * 500000
    const orders = isWeekend ? 4 + (seed % 9) : 11 + (seed % 16)
    // ISO yyyy-MM-dd — matches BE contract, FE formats for display
    const iso = d.toISOString().slice(0, 10)
    return { date: iso, revenue, orders }
  })
}

export function getMockDashboardSummary(period = '30d') {
  const days = period === '7d' ? 7 : period === '90d' ? 90 : 30
  const revenueData = generateRevenueSeries(days)
  const todayRevenue = revenueData[revenueData.length - 1].revenue
  const prevRevenue = revenueData[revenueData.length - 2].revenue
  const todayRevenuePct = prevRevenue > 0 ? ((todayRevenue - prevRevenue) / prevRevenue) * 100 : null
  const todayOrders = revenueData[revenueData.length - 1].orders
  const prevOrders = revenueData[revenueData.length - 2].orders

  return {
    kpi: {
      todayRevenue,
      todayRevenuePct: todayRevenuePct !== null ? Math.round(todayRevenuePct * 10) / 10 : null,
      todayOrders,
      todayOrdersDelta: todayOrders - prevOrders,
      pendingOrders: 5,
      activeProducts: 124,
    },
    revenueData,
    // Only real OrderStatus values — label/color are mapped by FE from i18n/constants
    orderStatusBreakdown: [
      { status: 'COMPLETED',  count: 67 },
      { status: 'PROCESSING', count: 12 },
      { status: 'PENDING',    count: 5  },
      { status: 'ON_HOLD',    count: 3  },
      { status: 'CANCELLED',  count: 5  },
      { status: 'REFUNDED',   count: 2  },
    ],
    recentOrders: ORDER_DATA.map(normalizeOrder),
    topProducts: [
      { productId: 'prod-ls2-ff800',       name: 'Mũ bảo hiểm LS2 FF800',        units: 42, revenue: 119700000 },
      { productId: 'prod-astars-jacket-v2', name: 'Áo giáp Alpinestars V2',        units: 28, revenue: 100520000 },
      { productId: 'prod-astars-gloves',    name: 'Găng tay Alpinestars City',      units: 31, revenue: 30690000  },
      { productId: 'prod-cardo-spirit',     name: 'Cardo Spirit Intercom',          units: 19, revenue: 47310000  },
      { productId: 'prod-ls2-rapid',        name: 'Mũ bảo hiểm LS2 Rapid White',   units: 15, revenue: 27750000  },
    ],
  }
}

// ── Mock Analytics ────────────────────────────────────────────────────────────

export function queryMockAnalytics(from, to) {
  const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 86400000)
  const toDate = to ? new Date(to) : new Date()
  const days = Math.max(1, Math.round((toDate - fromDate) / 86400000) + 1)

  const dailyRevenue = Array.from({ length: days }, (_, i) => {
    const d = new Date(fromDate)
    d.setDate(d.getDate() + i)
    const dow = d.getDay()
    const isWeekend = dow === 0 || dow === 6
    const seed = d.getDate() + d.getMonth() * 31
    const base = isWeekend ? 9000000 : 24000000
    const variance = ((seed * 17 + 11) % 28) * 1000000
    const trend = Math.round((i / days) * 6000000)
    const revenue = Math.round((base + variance + trend) / 500000) * 500000
    const orders = isWeekend ? 4 + (seed % 9) : 11 + (seed % 16)
    return {
      date: d.toLocaleDateString('vi-VN', { month: 'numeric', day: 'numeric' }),
      revenue,
      orders,
    }
  })

  const totalRevenue = dailyRevenue.reduce((s, d) => s + d.revenue, 0)
  const orderCount = dailyRevenue.reduce((s, d) => s + d.orders, 0)

  return {
    summary: {
      totalRevenue,
      orderCount,
      avgOrderValue: orderCount > 0 ? Math.round(totalRevenue / orderCount) : 0,
      refundAmount: Math.round(totalRevenue * 0.02),
    },
    dailyRevenue,
    topProducts: [
      { productName: 'Mũ bảo hiểm LS2 FF800', revenue: 119700000, unitsSold: 42 },
      { productName: 'Áo giáp Alpinestars V2', revenue: 100520000, unitsSold: 28 },
      { productName: 'Intercom Cardo Spirit', revenue: 47310000, unitsSold: 19 },
      { productName: 'Găng tay Alpinestars City', revenue: 30690000, unitsSold: 31 },
      { productName: 'Mũ bảo hiểm LS2 Rapid', revenue: 27750000, unitsSold: 15 },
    ],
    topCustomers: [
      { email: 'nguyen.van.a@example.com', orderCount: 12, totalSpent: 48500000 },
      { email: 'tran.thi.b@example.com', orderCount: 9, totalSpent: 31200000 },
      { email: 'le.van.c@example.com', orderCount: 7, totalSpent: 26800000 },
    ],
  }
}
