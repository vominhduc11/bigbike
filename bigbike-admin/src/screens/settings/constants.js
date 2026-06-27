// Constants and pure helpers for SettingsScreen.
// Extracted from SettingsScreen.jsx to keep the screen file focused on behaviour
// and to keep fast-refresh happy (non-component exports live in .js).
import {
  Store, Phone, Globe, Settings,
  Home, Building2, Image as ImageIcon, Users,
  Landmark,
} from 'lucide-react'
import { IMAGE_RECO } from '../../lib/imageRecommendations'

// ── Helpers ───────────────────────────────────────────────────────────────────

export function displayValue(val) {
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

export function inputTypeFor(key) {
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

export function placeholderFor(key) {
  const k = key.toLowerCase()
  for (const [seg, ph] of Object.entries(PLACEHOLDER_MAP)) {
    if (k.includes(seg)) return ph
  }
  return ''
}

export function validateValue(key, value) {
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
export function isTranslatableSetting(setting) {
  const group = (setting.settingGroup || '').toUpperCase()
  if (!TRANSLATABLE_GROUPS.has(group)) return false
  if (setting.valueType === 'IMAGE_URL' || setting.valueType === 'BOOLEAN'
      || setting.valueType === 'INTEGER' || setting.valueType === 'DECIMAL'
      || setting.valueType === 'MONEY') return false
  if (setting.valueType === 'HTML' || setting.valueType === 'LONG_TEXT') return true
  return inputTypeFor(setting.key) === 'text'
}

// ── Tab config ────────────────────────────────────────────────────────────────

// Tab "Banner trang" KHÔNG phải một settingGroup thật — nó nhúng trình sửa banner
// (BannerScreen) có khung xem trước ráp sẵn vào trong màn Cài đặt. Id dùng riêng,
// không trùng group nào để không lẫn với các tab render bằng SettingTabPanel.
export const BANNERS_TAB_ID = '__banners__'

export const TAB_ORDER = [
  'GENERAL', 'CONTACT', 'PAYMENT', 'PUBLIC_HOME', 'PUBLIC_HERO', 'SEO', 'STORE',
  'PRODUCT_ASSIGN',
]

// Tabs whose values directly affect pricing / checkout / operations — saving
// these requires an explicit confirmation.
export const SENSITIVE_SETTING_TABS = new Set(['STORE'])

// Group/key bị ẩn vì không thuộc trách nhiệm của admin shop:
// - PUBLIC_HERO: ảnh banner đầu trang render bằng trình riêng (BannerScreen) có preview ráp sẵn,
//   nay nhúng làm tab "Banner trang" NGAY TRONG màn Cài đặt (xem BANNERS_TAB_ID) — ẩn khỏi danh
//   sách tab generic để không hiện 2 lần / sửa 2 nơi.
// - CONTACT: thông tin liên hệ (hotline/địa chỉ/giờ/mạng xã hội, gồm cả zalo_display/messenger_display)
//   là dữ liệu CHUNG cho header/footer + trang Liên hệ (tĩnh) + trang Giới thiệu. Trang Liên hệ nay
//   là TRANG TĨNH, không còn trình dựng — không màn admin nào sửa nhóm này (cố định theo yêu cầu owner).
//   Bản ghi vẫn ở site_settings để web/header/footer đọc; muốn cho sửa lại thì bỏ 'CONTACT' khỏi
//   HIDDEN_GROUPS để hiện lại tab Cài đặt › Liên hệ.
// (PUBLIC_ABOUT đã gỡ hẳn V274 — trang Giới thiệu là trang tĩnh, không còn nhóm settings.)
export const HIDDEN_GROUPS = new Set(['PUBLIC_HERO', 'CONTACT'])

// Field cụ thể bị ẩn vì giá trị mặc định luôn đúng cho shop VN, đổi gây rủi ro:
// - store_currency: luôn VND
// - store_timezone: luôn Asia/Ho_Chi_Minh
export const HIDDEN_KEYS = new Set(['store_currency', 'store_timezone'])

export const TAB_META = {
  GENERAL:     { icon: Store,      labelKey: 'settings.group_general' },
  CONTACT:     { icon: Phone,      labelKey: 'settings.group_contact' },
  PAYMENT:     { icon: Landmark,   labelKey: 'settings.group_payment' },
  PUBLIC_HOME: { icon: Home,       labelKey: 'settings.group_public_home' },
  PUBLIC_HERO: { icon: ImageIcon,  labelKey: 'settings.group_public_hero' },
  SEO:         { icon: Globe,      labelKey: 'settings.group_seo' },
  STORE:       { icon: Building2,  labelKey: 'settings.group_store' },
  PRODUCT_ASSIGN: { icon: Users,   labelKey: 'settings.group_product_assign' },
}

// Bản dịch tiếng Việt cho từng setting key (admin shop motor đọc dễ hiểu hơn description English từ migrations)
export const KEY_LABELS_VI = {
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
  shopee_url: 'Link gian hàng Shopee',
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
  // public_product — toàn bộ nội dung PDP giờ quản theo TỪNG sản phẩm (trang sửa sản phẩm):
  // khối "cam kết" dưới nút mua (V232) + dải "tin cậy" trên tên sản phẩm (V233). Không còn setting chung.
  // seo
  seo_home_title: 'SEO Title trang chủ (thẻ <title>)',
  seo_home_description: 'SEO Description trang chủ (meta)',
  og_image_url: 'Ảnh khi share Facebook (Open Graph)',
  home_content_bottom_html: 'Nội dung SEO cuối trang chủ (rich-text)',
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

export const KEY_HINTS_VI = {
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
export const KEY_RECO = {
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

export const FALLBACK_META = { icon: Settings, labelKey: null }

export function tabLabel(group, t) {
  const meta = TAB_META[group?.toUpperCase()] || FALLBACK_META
  if (!meta.labelKey) return group ?? t('settings.groupGeneral')
  const translated = t(meta.labelKey)
  if (translated !== meta.labelKey) return translated
  return meta.fallbackLabel ?? group ?? t('settings.groupGeneral')
}

// ── Hướng dẫn vị trí: mỗi ô render ở đâu trên web + link mở đúng trang ───────────
export const STOREFRONT_BASE = (import.meta.env.VITE_STOREFRONT_BASE_URL ?? 'https://bigbike.vn').replace(/\/$/, '')

// Khối hiển thị → tiêu đề + đường dẫn storefront (path = null nghĩa là không hiển thị cho khách).
export const SECTION_GUIDE = {
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
  internal_assign: { title: 'Màn Tạo/Sửa sản phẩm (trong admin)', path: null, internal: true },
}
export const SECTION_ORDER = Object.keys(SECTION_GUIDE)

// Mỗi ô → [id khối, vị trí cụ thể]. Dòng "📍 vị trí" hiện dưới nhãn để admin biết ô render ở đâu.
export const KEY_GUIDE = {
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
  shopee_url:            ['contact_social', 'link Shopee (footer)'],

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

  product_assign_title:         ['internal_assign', 'tiêu đề banner phân công'],
  product_assign_role_content:  ['internal_assign', 'tên vai trò Content'],
  product_assign_items_content: ['internal_assign', 'việc của Content'],
  product_assign_role_seo:      ['internal_assign', 'tên vai trò SEO'],
  product_assign_items_seo:     ['internal_assign', 'việc của SEO'],
  product_assign_role_manager:  ['internal_assign', 'tên vai trò Quản lý'],
  product_assign_items_manager: ['internal_assign', 'việc của Quản lý'],
}

export function groupBySection(items) {
  const map = new Map()
  for (const s of items) {
    const sec = KEY_GUIDE[s.key]?.[0] || '_other'
    if (!map.has(sec)) map.set(sec, [])
    map.get(sec).push(s)
  }
  const idx = (s) => { const i = SECTION_ORDER.indexOf(s); return i === -1 ? 999 : i }
  return [...map.keys()].sort((a, b) => idx(a) - idx(b)).map((sec) => ({ sec, fields: map.get(sec) }))
}
