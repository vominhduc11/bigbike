import { useMemo, useEffect, useState, useCallback } from 'react'
import {
  Store, Phone, CreditCard, Tag, Globe, Settings,
  Home, Building2, Image as ImageIcon, Package, Users,
  CheckCircle2, AlertCircle, Landmark, ExternalLink, Lock,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { RichTextEditor } from '../components/RichTextEditor'
import { ImageUrlInput } from '../components/ImageUrlInput'
import { IMAGE_RECO } from '../lib/imageRecommendations'
import { fetchSettings, batchUpdateSettings } from '../lib/adminApi'
import { sanitizeHtml } from '../lib/sanitizeHtml'
import { showConfirm } from '../lib/confirm'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

// ── Helpers ───────────────────────────────────────────────────────────────────

function displayValue(val) {
  if (typeof val === 'string' && val.length >= 2 && val.startsWith('"') && val.endsWith('"')) {
    return val.slice(1, -1)
  }
  return val ?? ''
}

const INPUT_TYPE_MAP = {
  email: 'email',
  url: 'url',
  href: 'url',
  phone: 'tel',
  hotline: 'tel',
  threshold: 'number',
  price: 'number',
  amount: 'number',
}

function inputTypeFor(key) {
  const k = key.toLowerCase()
  for (const [seg, type] of Object.entries(INPUT_TYPE_MAP)) {
    if (k.includes(seg)) return type
  }
  return 'text'
}

const PLACEHOLDER_MAP = {
  email: 'vd: contact@bigbike.vn',
  url: 'vd: https://bigbike.vn/...',
  href: 'vd: https://bigbike.vn/...',
  phone: 'vd: 0901 234 567',
  hotline: 'vd: 0901 234 567',
  name: 'vd: BigBike Store',
  threshold: 'vd: 2000000',
  price: 'vd: 500000',
}

function placeholderFor(key) {
  const k = key.toLowerCase()
  for (const [seg, ph] of Object.entries(PLACEHOLDER_MAP)) {
    if (k.includes(seg)) return ph
  }
  return ''
}

function validateValue(key, value) {
  if (!value) return null
  const k = key.toLowerCase()
  if (k.includes('email')) {
    if (!value.includes('@')) return 'settings.valEmail'
  }
  if (k.includes('url') || k.includes('href')) {
    if (!value.startsWith('http://') && !value.startsWith('https://') && !value.startsWith('/')) {
      return 'settings.valUrl'
    }
  }
  if (k.includes('hotline') || k.includes('phone')) {
    if (!/^[\d\s+-]+$/.test(value)) return 'settings.valPhone'
  }
  // Tax rate must be a fraction in [0, 1] (vd 0.10 = 10%).
  if (k.includes('rate')) {
    const n = Number(value)
    if (Number.isNaN(n) || n < 0 || n > 1) {
      return 'settings.valRate'
    }
  }
  // Money / stock thresholds must be non-negative numbers.
  if (k.includes('threshold') || k.includes('amount') || k.includes('min_amount')) {
    const n = Number(value)
    if (Number.isNaN(n) || n < 0) {
      return 'settings.valNumber'
    }
  }
  return null
}

// Groups whose display text is shown on the storefront and can carry an English
// translation. Config / contact / store / tax keys stay Vietnamese-only.
const TRANSLATABLE_GROUPS = new Set(['GENERAL', 'PUBLIC_HOME', 'PUBLIC_HERO', 'SEO'])

// A setting is English-translatable when it lives in a translatable group AND renders
// as text (rich-text, long-text, or a plain text input) — never images/URLs/numbers/phones.
function isTranslatableSetting(setting) {
  const group = (setting.settingGroup || '').toUpperCase()
  if (!TRANSLATABLE_GROUPS.has(group)) return false
  if (setting.valueType === 'IMAGE_URL' || setting.valueType === 'BOOLEAN'
      || setting.valueType === 'INTEGER' || setting.valueType === 'DECIMAL'
      || setting.valueType === 'MONEY') return false
  if (setting.valueType === 'HTML' || setting.valueType === 'LONG_TEXT') return true
  return inputTypeFor(setting.key) === 'text'
}

// ── Tab config ────────────────────────────────────────────────────────────────

const TAB_ORDER = [
  'GENERAL', 'CONTACT', 'PAYMENT', 'PUBLIC_HOME', 'PUBLIC_HERO', 'PROMO', 'SEO', 'STORE', 'TAX', 'INVENTORY',
  'PRODUCT_ASSIGN',
]

// Tabs whose values directly affect pricing / checkout / operations — saving
// these requires an explicit confirmation.
const SENSITIVE_SETTING_TABS = new Set(['STORE', 'TAX'])

// Group/key bị ẩn vì không thuộc trách nhiệm của admin shop:
// - SECURITY: thiết lập kỹ thuật (login attempts, session timeout) — devops set, không phải admin shop
// - PAYMENT_SEPAY: cổng thanh toán SePay đã gỡ khỏi hệ thống (V59) — chỉ còn dữ liệu rác, ẩn khỏi UI
// - COMMERCE: rác import WordPress (key site.currency = VND) trùng với store_currency (nhóm STORE,
//   đã ẩn vì luôn VND). Hàng rào phòng hờ ở UI; bản ghi gốc đã được xoá ở migration V192.
// - PUBLIC_HERO: ảnh banner đầu trang giờ quản lý ở màn riêng "Banner trang" (BannerScreen)
//   với preview ráp sẵn — gỡ khỏi đây để không sửa 2 nơi.
const HIDDEN_GROUPS = new Set(['SECURITY', 'PAYMENT_SEPAY', 'COMMERCE', 'PUBLIC_HERO'])

// Field cụ thể bị ẩn vì giá trị mặc định luôn đúng cho shop VN, đổi gây rủi ro:
// - store_currency: luôn VND
// - store_timezone: luôn Asia/Ho_Chi_Minh
const HIDDEN_KEYS = new Set(['store_currency', 'store_timezone'])

const TAB_META = {
  GENERAL:     { icon: Store,      labelKey: 'settings.group_general' },
  CONTACT:     { icon: Phone,      labelKey: 'settings.group_contact' },
  PAYMENT:     { icon: Landmark,   labelKey: 'settings.group_payment' },
  PUBLIC_HOME: { icon: Home,       labelKey: 'settings.group_public_home' },
  PUBLIC_HERO: { icon: ImageIcon,  labelKey: 'settings.group_public_hero' },
  PROMO:       { icon: Tag,        labelKey: 'settings.group_promo' },
  SEO:         { icon: Globe,      labelKey: 'settings.group_seo' },
  STORE:       { icon: Building2,  labelKey: 'settings.group_store' },
  TAX:         { icon: CreditCard, labelKey: 'settings.group_tax' },
  INVENTORY:   { icon: Package,    labelKey: 'settings.group_inventory' },
  PRODUCT_ASSIGN: { icon: Users,   labelKey: 'settings.group_product_assign' },
}

// Bản dịch tiếng Việt cho từng setting key (admin shop motor đọc dễ hiểu hơn description English từ migrations)
const KEY_LABELS_VI = {
  // general
  site_name: 'Tên website (hiển thị header & footer)',
  footer_tagline: 'Slogan footer',
  footer_description: 'Mô tả ngắn ở footer',
  bct_url: 'URL đăng ký Bộ Công Thương (online.gov.vn)',
  business_registration: 'Giấy chứng nhận ĐKKD (dòng dưới footer)',
  // contact
  hotline_2: 'Hotline phụ',
  contact_email: 'Email liên hệ công khai',
  contact_address: 'Địa chỉ cửa hàng',
  facebook_url: 'Link trang Facebook',
  opening_hours_weekday: 'Giờ mở cửa (T2–T6)',
  opening_hours_weekend: 'Giờ mở cửa (T7/CN)',
  opening_hours_holiday: 'Lịch nghỉ (lễ/Tết)',
  // payment (tài khoản nhận chuyển khoản — admin tự nhập, hiển thị cho khách khi đặt đơn chuyển khoản)
  bank_account_holder: 'Chủ tài khoản nhận chuyển khoản',
  bank_account_number: 'Số tài khoản nhận chuyển khoản',
  bank_name: 'Tên ngân hàng (vd: Vietcombank)',
  bank_branch: 'Chi nhánh ngân hàng (không bắt buộc)',
  messenger_url: 'Link Messenger (popup chat)',
  messenger_display: 'Chữ hiển thị Messenger (popup chat)',
  // public_home (homepage)
  hotline: 'Hotline chính (hiển thị nổi bật)',
  zalo_url: 'Link Zalo (popup liên hệ)',
  zalo_display: 'Chữ hiển thị Zalo (popup liên hệ)',
  promo_title: 'Tiêu đề banner khuyến mãi trang chủ',
  promo_off: 'Nhãn % giảm trên banner (vd: 20% OFF)',
  promo_href: 'URL khi khách click banner khuyến mãi',
  promo_image_url: 'Ảnh banner khuyến mãi',
  home_exp_subtitle: 'Khu trải nghiệm — kicker phụ đề',
  home_exp_title: 'Khu trải nghiệm — tiêu đề chính',
  home_exp_desc: 'Khu trải nghiệm — đoạn mô tả',
  about_title: 'Khu giới thiệu — tiêu đề chính',
  about_subtitle: 'Khu giới thiệu — kicker phụ đề',
  about_content_html: 'Khu giới thiệu — nội dung (rich-text)',
  home_featured_kicker: 'Khu Sản phẩm nổi bật — kicker',
  home_featured_title: 'Khu Sản phẩm nổi bật — tiêu đề',
  home_news_kicker: 'Khu Tin tức — kicker',
  home_news_title: 'Khu Tin tức — tiêu đề',
  home_videos_title: 'Khu Video — tiêu đề',
  // seo
  seo_home_title: 'SEO Title trang chủ (thẻ <title>)',
  seo_home_description: 'SEO Description trang chủ (meta)',
  og_image_url: 'Ảnh khi share Facebook (Open Graph)',
  home_content_bottom_html: 'Nội dung SEO cuối trang chủ (rich-text)',
  // store (operational)
  low_stock_threshold: 'Ngưỡng cảnh báo sắp hết hàng (số lượng)',
  // inventory (operational)
  reservation_ttl_minutes: 'Số phút giữ hàng trong giỏ trước khi nhả lại kho',
  default_warranty_months: 'Thời hạn bảo hành mặc định khi tạo phiếu (tháng)',
  serial_inventory_only: 'Chỉ bán sản phẩm có serial đã nhập kho',
  // public_hero — Tất cả sản phẩm
  hero_products_image_url: 'Ảnh hero — trang Tất cả sản phẩm (desktop)',
  hero_products_mobile_image_url: 'Ảnh hero — trang Tất cả sản phẩm (điện thoại)',
  hero_products_image_alt: 'Alt ảnh hero — Tất cả sản phẩm',
  hero_products_title: 'Tiêu đề hero — Tất cả sản phẩm',
  // public_hero — Thương hiệu
  hero_brands_image_url: 'Ảnh hero — trang Thương hiệu (desktop)',
  hero_brands_mobile_image_url: 'Ảnh hero — trang Thương hiệu (điện thoại)',
  hero_brands_image_alt: 'Alt ảnh hero — Thương hiệu',
  hero_brands_title: 'Tiêu đề hero — Thương hiệu',
  // public_hero — Tin tức
  hero_news_image_url: 'Ảnh hero — trang Tin tức (desktop)',
  hero_news_mobile_image_url: 'Ảnh hero — trang Tin tức (điện thoại)',
  hero_news_image_alt: 'Alt ảnh hero — Tin tức',
  hero_news_title: 'Tiêu đề hero — Tin tức',
  // global hero defaults
  hero_default_bg_url: 'Ảnh nền mặc định hero (dùng khi trang không có ảnh riêng)',
  hero_default_illustration_url: 'Ảnh gear mặc định hero (dùng khi trang không có ảnh minh hoạ riêng)',
  // product_assign (banner phân công trên màn tạo/sửa sản phẩm — chỉ super admin sửa)
  product_assign_title: 'Tiêu đề banner phân công',
  product_assign_role_content: 'Tên vai trò 1 (mặc định: Content)',
  product_assign_items_content: 'Công việc của vai trò Content',
  product_assign_role_seo: 'Tên vai trò 2 (mặc định: SEO)',
  product_assign_items_seo: 'Công việc của vai trò SEO',
  product_assign_role_manager: 'Tên vai trò 3 (mặc định: Quản lý)',
  product_assign_items_manager: 'Công việc của vai trò Quản lý',
}

const KEY_HINTS_VI = {
  promo_image_url:          'Ảnh nằm ngang, ví dụ 1200×400px.',
  og_image_url:             '1200×630px (chuẩn mạng xã hội).',
  hero_products_image_url:         'Ảnh nằm ngang rộng, ví dụ 1920×600px.',
  hero_products_mobile_image_url:  'Ảnh dọc cho điện thoại, ví dụ 750×1125px. Bỏ trống sẽ dùng ảnh desktop.',
  hero_brands_image_url:           'Ảnh nằm ngang rộng, ví dụ 1920×600px.',
  hero_brands_mobile_image_url:    'Ảnh dọc cho điện thoại, ví dụ 750×1125px. Bỏ trống sẽ dùng ảnh desktop.',
  hero_news_image_url:             'Ảnh nằm ngang rộng, ví dụ 1920×600px.',
  hero_news_mobile_image_url:      'Ảnh dọc cho điện thoại, ví dụ 750×1125px. Bỏ trống sẽ dùng ảnh desktop.',
  hero_default_bg_url:             'Ảnh nằm ngang rộng, ví dụ 1920×600px.',
  hero_default_illustration_url:   'PNG nền trong, tỷ lệ gần vuông ~700×600px.',
}

// Chuẩn kích thước khuyến nghị theo từng cấu hình ảnh (so khớp với KEY_HINTS_VI).
// Key không liệt kê sẽ dùng spec chung (chỉ nhắc khi quá nhỏ, không khóa tỉ lệ).
const KEY_RECO = {
  promo_image_url:                 IMAGE_RECO.promo,
  og_image_url:                    IMAGE_RECO.cover,
  hero_products_image_url:         IMAGE_RECO.bannerWide,
  hero_products_mobile_image_url:  IMAGE_RECO.bannerMobile,
  hero_brands_image_url:           IMAGE_RECO.bannerWide,
  hero_brands_mobile_image_url:    IMAGE_RECO.bannerMobile,
  hero_news_image_url:             IMAGE_RECO.bannerWide,
  hero_news_mobile_image_url:      IMAGE_RECO.bannerMobile,
  hero_default_bg_url:             IMAGE_RECO.bannerWide,
  hero_default_illustration_url:   IMAGE_RECO.illustration,
}

const FALLBACK_META = { icon: Settings, labelKey: null }

function tabLabel(group, t) {
  const meta = TAB_META[group?.toUpperCase()] || FALLBACK_META
  if (!meta.labelKey) return group ?? t('settings.groupGeneral')
  const translated = t(meta.labelKey)
  if (translated !== meta.labelKey) return translated
  return meta.fallbackLabel ?? group ?? t('settings.groupGeneral')
}

// ── Hướng dẫn vị trí: mỗi ô render ở đâu trên web + link mở đúng trang ───────────
const STOREFRONT_BASE = (import.meta.env.VITE_STOREFRONT_BASE_URL ?? 'https://bigbike.vn').replace(/\/$/, '')

// Khối hiển thị → tiêu đề + đường dẫn storefront (path = null nghĩa là không hiển thị cho khách).
const SECTION_GUIDE = {
  general_brand:   { title: 'Header & Footer — mọi trang', path: '/' },
  contact_main:    { title: 'Trang Liên hệ + Header/Footer', path: '/lien-he' },
  contact_social:  { title: 'Mạng xã hội — chat nổi + Footer', path: '/lien-he' },
  payment_bank:    { title: 'Hiện khi khách đặt đơn & chọn chuyển khoản', path: null },
  home_promo:      { title: 'Trang chủ › Banner khuyến mãi', path: '/' },
  home_exp:        { title: 'Trang chủ › Khối trải nghiệm', path: '/' },
  home_about:      { title: 'Trang chủ › Khối giới thiệu', path: '/' },
  home_featured:   { title: 'Trang chủ › Khối Sản phẩm nổi bật', path: '/' },
  home_news:       { title: 'Trang chủ › Khối Tin tức', path: '/' },
  home_videos:     { title: 'Trang chủ › Khối Video', path: '/' },
  hero_products:   { title: 'Banner đầu trang Tất cả sản phẩm', path: '/san-pham' },
  hero_brands:     { title: 'Banner đầu trang Thương hiệu', path: '/brands' },
  hero_news:       { title: 'Banner đầu trang Tin tức', path: '/tin-tuc' },
  hero_default:    { title: 'Banner mặc định — trang listing chưa đặt ảnh riêng', path: '/san-pham' },
  seo_home:        { title: 'SEO trang chủ (thẻ meta / khi chia sẻ)', path: '/' },
  internal_store:  { title: 'Nội bộ — không hiển thị cho khách', path: null, internal: true },
  internal_inv:    { title: 'Nội bộ — quy tắc vận hành kho', path: null, internal: true },
  internal_assign: { title: 'Màn Tạo/Sửa sản phẩm (trong admin)', path: null, internal: true },
}
const SECTION_ORDER = Object.keys(SECTION_GUIDE)

// Mỗi ô → [id khối, vị trí cụ thể]. Dòng "📍 vị trí" hiện dưới nhãn để admin biết ô render ở đâu.
const KEY_GUIDE = {
  site_name:             ['general_brand', 'tên shop'],
  footer_tagline:        ['general_brand', 'slogan ở chân trang'],
  footer_description:    ['general_brand', 'đoạn mô tả chân trang'],
  bct_url:               ['general_brand', 'badge Bộ Công Thương'],
  business_registration: ['general_brand', 'dòng giấy phép kinh doanh'],

  contact_email:         ['contact_main', 'email liên hệ'],
  contact_address:       ['contact_main', 'địa chỉ + bản đồ trang Liên hệ'],
  hotline:               ['contact_main', 'hotline chính (header + footer)'],
  hotline_2:             ['contact_main', 'hotline phụ'],
  hotline_3:             ['contact_main', 'hotline thứ ba'],
  opening_hours_weekday: ['contact_main', 'giờ mở cửa T2–T6 (header)'],
  opening_hours_weekend: ['contact_main', 'giờ mở cửa T7/CN'],
  opening_hours_holiday: ['contact_main', 'lịch nghỉ lễ/Tết'],
  facebook_url:          ['contact_social', 'link Facebook'],
  messenger_url:         ['contact_social', 'nút Messenger (chat nổi)'],
  messenger_display:     ['contact_social', 'chữ hiển thị dòng Messenger'],
  zalo_url:              ['contact_social', 'nút Zalo (chat nổi)'],
  zalo_display:          ['contact_social', 'chữ hiển thị dòng Zalo'],
  youtube_url:           ['contact_social', 'link YouTube (footer)'],
  tiktok_url:            ['contact_social', 'link TikTok (footer)'],
  instagram_url:         ['contact_social', 'link Instagram (footer)'],

  bank_account_holder:   ['payment_bank', 'tên chủ tài khoản'],
  bank_account_number:   ['payment_bank', 'số tài khoản'],
  bank_name:             ['payment_bank', 'tên ngân hàng'],
  bank_branch:           ['payment_bank', 'chi nhánh'],

  promo_title:           ['home_promo', 'tiêu đề banner'],
  promo_off:             ['home_promo', 'nhãn % giảm giá'],
  promo_href:            ['home_promo', 'link khi bấm banner'],
  promo_image_url:       ['home_promo', 'ảnh banner'],
  home_exp_subtitle:     ['home_exp', 'dòng chữ nhỏ phía trên'],
  home_exp_title:        ['home_exp', 'tiêu đề'],
  home_exp_desc:         ['home_exp', 'đoạn mô tả'],
  about_title:           ['home_about', 'tiêu đề'],
  about_subtitle:        ['home_about', 'dòng phụ'],
  about_content_html:    ['home_about', 'nội dung'],
  home_featured_kicker:  ['home_featured', 'dòng chữ nhỏ phía trên'],
  home_featured_title:   ['home_featured', 'tiêu đề'],
  home_news_kicker:      ['home_news', 'dòng chữ nhỏ phía trên'],
  home_news_title:       ['home_news', 'tiêu đề'],
  home_videos_title:     ['home_videos', 'tiêu đề'],

  hero_products_image_url:        ['hero_products', 'ảnh nền banner (desktop)'],
  hero_products_mobile_image_url: ['hero_products', 'ảnh nền banner (điện thoại)'],
  hero_products_image_alt:        ['hero_products', 'mô tả ảnh (SEO)'],
  hero_products_title:            ['hero_products', 'tiêu đề trên banner'],
  hero_brands_image_url:          ['hero_brands', 'ảnh nền banner (desktop)'],
  hero_brands_mobile_image_url:   ['hero_brands', 'ảnh nền banner (điện thoại)'],
  hero_brands_image_alt:          ['hero_brands', 'mô tả ảnh (SEO)'],
  hero_brands_title:              ['hero_brands', 'tiêu đề trên banner'],
  hero_news_image_url:            ['hero_news', 'ảnh nền banner (desktop)'],
  hero_news_mobile_image_url:     ['hero_news', 'ảnh nền banner (điện thoại)'],
  hero_news_image_alt:            ['hero_news', 'mô tả ảnh (SEO)'],
  hero_news_title:                ['hero_news', 'tiêu đề trên banner'],
  hero_default_bg_url:           ['hero_default', 'ảnh nền mặc định'],
  hero_default_illustration_url: ['hero_default', 'ảnh minh hoạ mặc định'],

  seo_home_title:           ['seo_home', 'thẻ tiêu đề (tab trình duyệt / Google)'],
  seo_home_description:     ['seo_home', 'mô tả meta (kết quả Google)'],
  og_image_url:             ['seo_home', 'ảnh khi chia sẻ mạng xã hội'],
  home_content_bottom_html: ['seo_home', 'đoạn nội dung cuối trang chủ'],

  low_stock_threshold:      ['internal_store', 'ngưỡng cảnh báo sắp hết hàng'],

  reservation_ttl_minutes:  ['internal_inv', 'thời gian giữ hàng trong giỏ'],
  default_warranty_months:  ['internal_inv', 'hạn bảo hành mặc định'],
  serial_inventory_only:    ['internal_inv', 'chỉ bán hàng đã có serial'],

  product_assign_title:         ['internal_assign', 'tiêu đề banner phân công'],
  product_assign_role_content:  ['internal_assign', 'tên vai trò Content'],
  product_assign_items_content: ['internal_assign', 'việc của Content'],
  product_assign_role_seo:      ['internal_assign', 'tên vai trò SEO'],
  product_assign_items_seo:     ['internal_assign', 'việc của SEO'],
  product_assign_role_manager:  ['internal_assign', 'tên vai trò Quản lý'],
  product_assign_items_manager: ['internal_assign', 'việc của Quản lý'],
}

function groupBySection(items) {
  const map = new Map()
  for (const s of items) {
    const sec = KEY_GUIDE[s.key]?.[0] || '_other'
    if (!map.has(sec)) map.set(sec, [])
    map.get(sec).push(s)
  }
  const idx = (s) => { const i = SECTION_ORDER.indexOf(s); return i === -1 ? 999 : i }
  return [...map.keys()].sort((a, b) => idx(a) - idx(b)).map((sec) => ({ sec, fields: map.get(sec) }))
}

// ── SettingField ──────────────────────────────────────────────────────────────

function SettingField({ setting, where, canUpdate, draft, draftEn, error, onChange, onChangeEn }) {
  const { t } = useTranslation()
  const rawValue = displayValue(setting.value)
  const currentValue = draft !== undefined ? draft : rawValue
  const rawValueEn = displayValue(setting.valueEn)
  const currentValueEn = draftEn !== undefined ? draftEn : rawValueEn
  const translatable = isTranslatableSetting(setting)
  const isDirty = (draft !== undefined && draft !== rawValue) || (draftEn !== undefined && draftEn !== rawValueEn)
  const isHtml = setting.valueType === 'HTML'
  const isImage = setting.valueType === 'IMAGE_URL'
  const isLongText = setting.valueType === 'LONG_TEXT'
  const isBoolean = setting.valueType === 'BOOLEAN'
  const isNumber = setting.valueType === 'INTEGER' || setting.valueType === 'DECIMAL' || setting.valueType === 'MONEY'
  const type = isNumber ? 'number' : inputTypeFor(setting.key)
  const placeholder = placeholderFor(setting.key)
  const label = KEY_LABELS_VI[setting.key] || setting.description || setting.key

  return (
    <div className="form-field">
      <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {label}
        {isDirty && (
          <span
            aria-label={t('settings.unsavedDot')}
            className="settings-dirty-dot"
          />
        )}
      </label>
      {where && (
        <span className="bb-muted" style={{ display: 'block', fontSize: 12, marginTop: -2, marginBottom: 6 }}>
          📍 {where}
        </span>
      )}

      {canUpdate ? (
        isHtml ? (
          <RichTextEditor
            value={currentValue}
            onChange={(html) => onChange(setting.key, html)}
            placeholder={t('settings.htmlPlaceholder')}
            hasError={Boolean(error)}
            enableImagePicker
          />
        ) : isImage ? (
          <>
            <ImageUrlInput
              value={currentValue}
              onChange={(url) => onChange(setting.key, url)}
              error={error}
              recommend={KEY_RECO[setting.key] || IMAGE_RECO.general}
            />
            {KEY_HINTS_VI[setting.key] && (
              <span className="hint">{KEY_HINTS_VI[setting.key]}</span>
            )}
          </>
        ) : isLongText ? (
          <Textarea
            className={error ? 'border-danger' : undefined}
            rows={3}
            value={currentValue}
            placeholder={placeholder || (rawValue ? '' : t('settings.empty'))}
            onChange={(e) => onChange(setting.key, e.target.value)}
            aria-describedby={error ? `err-${setting.key}` : undefined}
          />
        ) : isBoolean ? (
          <Select value={currentValue || 'false'} onValueChange={(v) => onChange(setting.key, v)}>
            <SelectTrigger className={error ? 'border-danger' : undefined}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">{t('settings.boolOn')}</SelectItem>
              <SelectItem value="false">{t('settings.boolOff')}</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <Input
            className={error ? 'border-danger' : undefined}
            type={type}
            inputMode={type === 'number' ? 'numeric' : undefined}
            step={setting.valueType === 'DECIMAL' ? 'any' : undefined}
            value={currentValue}
            placeholder={placeholder || (rawValue ? '' : t('settings.empty'))}
            onChange={(e) => onChange(setting.key, e.target.value)}
            aria-describedby={error ? `err-${setting.key}` : undefined}
          />
        )
      ) : isHtml ? (
        <div
          className="text-sm"
          style={{ padding: '8px 12px', background: 'var(--admin-color-surface-muted)', borderRadius: 7 }}
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(rawValue) || `<em>${t('settings.htmlEmpty')}</em>` }}
        />
      ) : isImage && rawValue ? (
        <img src={rawValue} alt="" style={{ maxWidth: 240, borderRadius: 8 }} loading="lazy" />
      ) : (
        <div
          className="text-sm"
          style={{ padding: '8px 12px', background: 'var(--admin-color-surface-muted)', borderRadius: 7 }}
        >
          {rawValue || <em className="muted">{t('settings.valueEmpty')}</em>}
        </div>
      )}

      {canUpdate && translatable && (
        <div style={{ marginTop: 8 }}>
          <span className="hint" style={{ display: 'block', marginBottom: 4 }}>{t('settings.englishLabel')}</span>
          {isHtml ? (
            <RichTextEditor
              value={currentValueEn}
              onChange={(html) => onChangeEn(setting.key, html)}
              placeholder={t('settings.englishPlaceholder')}
              enableImagePicker
            />
          ) : isLongText ? (
            <Textarea
              rows={3}
              value={currentValueEn}
              placeholder={t('settings.englishPlaceholder')}
              onChange={(e) => onChangeEn(setting.key, e.target.value)}
            />
          ) : (
            <Input
              value={currentValueEn}
              placeholder={t('settings.englishPlaceholder')}
              onChange={(e) => onChangeEn(setting.key, e.target.value)}
            />
          )}
        </div>
      )}

      {error && (
        <span id={`err-${setting.key}`} className="bb-muted" style={{ color: 'var(--bb-danger)' }}>{error}</span>
      )}
    </div>
  )
}

// ── SettingTabPanel ───────────────────────────────────────────────────────────

function SettingTabPanel({ title, items, canUpdate, drafts, draftsEn, errors, onDraftChange, onDraftChangeEn, onSave, onDiscard, saving }) {
  const { t } = useTranslation()
  const dirtyCount = items.filter(
    (s) => drafts[s.key] !== undefined || draftsEn[s.key] !== undefined
  ).length

  const hasError = items.some((s) => errors[s.key])

  return (
    <div className="bb-card">
      <div className="bb-card-header"><h3>{title}</h3></div>
      <div className="bb-card-body">
        {groupBySection(items).map(({ sec, fields }) => {
          const meta = SECTION_GUIDE[sec]
          const url = meta?.path ? STOREFRONT_BASE + meta.path : null
          return (
            <div key={sec}>
              <div
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: 8, margin: '18px 0 12px', paddingBottom: 6,
                  borderBottom: '1px solid var(--bb-border)',
                }}
              >
                <span style={{ fontWeight: 600, fontSize: 13 }}>{meta?.title || 'Khác'}</span>
                {url ? (
                  <a
                    href={`${url}#bbf=${sec}`} target="_blank" rel="noreferrer"
                    className="bb-btn bb-btn-secondary bb-btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}
                  >
                    <ExternalLink size={13} /> Xem trên web
                  </a>
                ) : meta?.internal ? (
                  <span className="bb-muted" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, whiteSpace: 'nowrap' }}>
                    <Lock size={12} /> Nội bộ
                  </span>
                ) : null}
              </div>
              {fields.map((setting) => (
                <SettingField
                  key={setting.key}
                  setting={setting}
                  where={KEY_GUIDE[setting.key]?.[1]}
                  canUpdate={canUpdate}
                  draft={drafts[setting.key]}
                  draftEn={draftsEn[setting.key]}
                  error={errors[setting.key]}
                  onChange={onDraftChange}
                  onChangeEn={onDraftChangeEn}
                />
              ))}
            </div>
          )
        })}
      </div>

      {canUpdate && dirtyCount > 0 && (
        <div className="card-foot">
          <span className="settings-unsaved-hint">
            <AlertCircle size={14} />
            {t('settings.unsavedCount', { count: dirtyCount })}
          </span>
          <div className="flex gap-2">
            <button type="button" className="bb-btn bb-btn-secondary bb-btn-sm" onClick={onDiscard} disabled={saving}>
              {t('common.cancel')}
            </button>
            <button type="button" className="bb-btn bb-btn-primary bb-btn-sm" onClick={onSave} disabled={saving || hasError}>
              {t('settings.saveCount', { count: dirtyCount })}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── SettingsScreen ────────────────────────────────────────────────────────────

export function SettingsScreen({ canUpdate, isSuperAdmin = false }) {
  const { t } = useTranslation()
  const [state, setState] = useState({ status: 'loading', items: [], warning: '' })
  const [fetchKey, setFetchKey] = useState(0)
  const [activeTabOverride, setActiveTabOverride] = useState(null)
  const [drafts, setDrafts] = useState({})
  const [draftsEn, setDraftsEn] = useState({})
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  useEffect(() => {
    let active = true
    fetchSettings()
      .then((r) => {
        if (!active) return
        setState({ status: 'success', items: r.items, warning: '' })
      })
      .catch((e) => {
        if (!active) return
        setState({ status: 'error', items: [], warning: '', error: e.message })
      })
    return () => { active = false }
  }, [fetchKey])

  const groups = useMemo(() => {
    const map = new Map()
    for (const s of state.items) {
      if (HIDDEN_KEYS.has(s.key)) continue
      // Super-admin-only settings (vd phân công sản phẩm) chỉ hiện với super admin.
      if (s.superAdminOnly && !isSuperAdmin) continue
      const g = (s.settingGroup || 'GENERAL').toUpperCase()
      if (HIDDEN_GROUPS.has(g)) continue
      if (!map.has(g)) map.set(g, [])
      map.get(g).push(s)
    }
    // Sort tabs by defined order, unknown groups go last
    const sorted = new Map()
    for (const key of TAB_ORDER) {
      if (map.has(key)) sorted.set(key, map.get(key))
    }
    for (const [key, val] of map) {
      if (!sorted.has(key)) sorted.set(key, val)
    }
    return sorted
  }, [state.items, isSuperAdmin])

  // Derive active tab: user pick takes priority, else first available tab
  const firstTab = groups.size > 0 ? [...groups.keys()][0] : null
  const activeTab = (activeTabOverride && groups.has(activeTabOverride)) ? activeTabOverride : firstTab

  const activeItems = useMemo(() => {
    if (!activeTab) return []
    return groups.get(activeTab) || []
  }, [activeTab, groups])

  const handleDraftChange = useCallback((key, value) => {
    setDrafts((p) => ({ ...p, [key]: value }))
    // Validate inline
    const err = validateValue(key, value)
    setErrors((p) => ({ ...p, [key]: err ? t(err) : '' }))
  }, [t])

  // English drafts: text-only, no validation (titles/descriptions).
  const handleDraftChangeEn = useCallback((key, value) => {
    setDraftsEn((p) => ({ ...p, [key]: value }))
  }, [])

  const handleDiscard = useCallback(() => {
    const keys = activeItems.map((s) => s.key)
    const dropKeys = (obj) => {
      const n = { ...obj }
      keys.forEach((k) => delete n[k])
      return n
    }
    setDrafts(dropKeys)
    setDraftsEn(dropKeys)
    setErrors(dropKeys)
  }, [activeItems])

  const handleSave = useCallback(async () => {
    // Validate all dirty fields in this tab (VI values only; EN is free text)
    const dirty = activeItems.filter((s) => drafts[s.key] !== undefined || draftsEn[s.key] !== undefined)
    const newErrors = {}
    for (const s of dirty) {
      if (drafts[s.key] === undefined) continue
      const err = validateValue(s.key, drafts[s.key])
      if (err) newErrors[s.key] = t(err)
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors((p) => ({ ...p, ...newErrors }))
      return
    }

    if (SENSITIVE_SETTING_TABS.has(activeTab)) {
      const ok = await showConfirm(
        t('settings.confirmSaveMessage'),
        t('settings.confirmSaveTitle'),
      )
      if (!ok) return
    }

    setSaving(true)
    setSaveSuccess(false)
    try {
      const result = await batchUpdateSettings(
        dirty.map((s) => {
          const u = { key: s.key }
          if (drafts[s.key] !== undefined) u.value = drafts[s.key]
          if (draftsEn[s.key] !== undefined) u.valueEn = draftsEn[s.key]
          return u
        })
      )
      // Update state with fresh items from server
      setState((p) => {
        const updated = new Map(result.items.map((item) => [item.key, item]))
        return { ...p, items: p.items.map((s) => updated.get(s.key) || s) }
      })
      // Clear drafts for saved keys
      const savedKeys = dirty.map((s) => s.key)
      const dropSaved = (obj) => {
        const n = { ...obj }
        savedKeys.forEach((k) => delete n[k])
        return n
      }
      setDrafts(dropSaved)
      setDraftsEn(dropSaved)
      setErrors(dropSaved)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2500)
    } catch (e) {
      // Show error on all dirty fields — batch is all-or-nothing so mark all dirty fields
      const errMsg = e.message || t('settings.saveError')
      setErrors((p) => ({ ...p, ...Object.fromEntries(dirty.map((s) => [s.key, errMsg])) }))
    } finally {
      setSaving(false)
    }
  }, [activeItems, drafts, draftsEn, activeTab, t])

  if (state.status === 'loading') {
    return <StatePanel tone="info" title={t('settings.loading')} description={t('common.pleaseWait')} />
  }
  if (state.status === 'error') {
    return (
      <StatePanel
        tone="danger"
        title={t('settings.loadError')}
        description={state.error}
        actionLabel={t('common.retry')}
        onAction={() => setFetchKey((k) => k + 1)}
      />
    )
  }

  return (
    <div>
      <div className="bb-screen-header">
        <div className="bb-screen-title">
          <p className="bb-screen-eyebrow">{t('settings.eyebrow')}</p>
          <h1>{t('settings.title')}</h1>
          <p className="bb-muted">{t('settings.description')}</p>
        </div>
      </div>

      {state.warning && <ReadOnlyBanner warning={state.warning} />}

      {state.items.length === 0 ? (
        <StatePanel tone="neutral" title={t('settings.noSettings')} description={t('settings.noSettingsDesc')} />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[200px_1fr]">
          {/* Tab sidebar — prototype .settings-nav */}
          <nav className="settings-nav" aria-label={t('settings.tabsAria')}>
            {[...groups.entries()].map(([group, items]) => {
              const meta = TAB_META[group] || FALLBACK_META
              const Icon = meta.icon
              const label = tabLabel(group, t)
              const isActive = activeTab === group
              const dirtyInGroup = items.filter((s) => drafts[s.key] !== undefined || draftsEn[s.key] !== undefined).length

              return (
                <button
                  key={group}
                  type="button"
                  className={isActive ? 'active' : ''}
                  onClick={() => setActiveTabOverride(group)}
                  aria-current={isActive ? 'true' : undefined}
                >
                  <Icon size={15} />
                  <span style={{ flex: 1 }}>{label}</span>
                  {dirtyInGroup > 0 && (
                    <span className="bb-badge bb-badge-warning" aria-label={t('settings.tabChangeCount', { count: dirtyInGroup })}>
                      {dirtyInGroup}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>

          {/* Content panel */}
          <div>
            {saveSuccess && (
              <div
                role="status"
                className="settings-save-banner mb-3"
              >
                <CheckCircle2 size={15} />
                {t('settings.saveSuccess')}
              </div>
            )}

            {activeTab && (
              <SettingTabPanel
                title={tabLabel(activeTab, t)}
                items={activeItems}
                canUpdate={canUpdate}
                drafts={drafts}
                draftsEn={draftsEn}
                errors={errors}
                onDraftChange={handleDraftChange}
                onDraftChangeEn={handleDraftChangeEn}
                onSave={handleSave}
                onDiscard={handleDiscard}
                saving={saving}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
