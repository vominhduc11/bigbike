import {
  normalizeBrand,
  normalizeCategory,
  normalizeContentItem,
  normalizePagination,
  normalizeProduct,
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
  const search = normalizeSearch(query.search)

  let items = PRODUCTS_DATA.filter((item) => {
    const matchesSearch =
      !search ||
      item.name.toLowerCase().includes(search) ||
      (item.sku || '').toLowerCase().includes(search) ||
      item.slug.toLowerCase().includes(search)

    const matchesPublish =
      !query.publishStatus ||
      query.publishStatus === 'ALL' ||
      item.publishStatus === query.publishStatus

    const matchesStock =
      !query.stockState ||
      query.stockState === 'ALL' ||
      item.stockState === query.stockState

    return matchesSearch && matchesPublish && matchesStock
  })

  items = sortByRule(items, query.sort || 'updatedAt:desc')
  return paginate(items, query)
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

export const ROLE_PERMISSION_MAP = {
  SUPER_ADMIN: ['*'],
  ADMIN: [
    'products.read',
    'products.update',
    'catalog.read',
    'catalog.update',
    'content.read',
    'content.update',
  ],
  MANAGER: [
    'products.read',
    'catalog.read',
    'content.read',
  ],
  CONTENT_EDITOR: ['content.read', 'content.update'],
  VIEWER: ['products.read', 'catalog.read', 'content.read'],
}

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
