// Constants and pure helpers for SettingsScreen.
// Extracted from SettingsScreen.jsx to keep the screen file focused on behaviour
// and to keep fast-refresh happy (non-component exports live in .js).
import {
  Store, Phone, Globe, Settings,
  Image as ImageIcon, Users,
  Bot, Landmark, ShieldCheck,
} from 'lucide-react'
import { IMAGE_RECO } from '../../lib/imageRecommendations'

// ── Helpers ───────────────────────────────────────────────────────────────────

export function displayValue(val) {
  if (typeof val === 'string' && val.length >= 2 && val.startsWith('"') && val.endsWith('"')) {
    return val.slice(1, -1)
  }
  return val ?? ''
}

export function isSettingDirty(setting, drafts, draftsEn) {
  const viDirty = drafts[setting.key] !== undefined
    && displayValue(drafts[setting.key]) !== displayValue(setting.value)
  const enDirty = draftsEn[setting.key] !== undefined
    && displayValue(draftsEn[setting.key]) !== displayValue(setting.valueEn)
  return viDirty || enDirty
}

export function isWideSetting(setting) {
  return ['HTML', 'IMAGE_URL', 'LONG_TEXT'].includes(setting.valueType)
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

// Đổi khoá kỹ thuật (vd `home_content_bottom_html`) thành chuỗi dễ đọc khi không có
// nhãn nghiệp vụ — dùng làm fallback cuối cùng thay vì phơi khoá thô ra giao diện.
export function humanizeKey(key) {
  return String(key || '')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
}

// Nhãn/hint/vị trí của từng ô cài đặt đi qua i18n để chủ shop đọc bằng ngôn ngữ nghiệp
// vụ, đồng thời cho phép bản dịch tiếng Anh ghi đè. defaultValue giữ nguyên chuỗi tiếng
// Việt hiện có (KEY_LABELS_VI/KEY_HINTS_VI/KEY_GUIDE) nên UI không đổi khi chưa dịch.
export function settingLabel(setting, t) {
  const fallback = KEY_LABELS_VI[setting.key] || setting.description || humanizeKey(setting.key)
  return t(`settings.keyLabel.${setting.key}`, { defaultValue: fallback })
}

export function settingHint(setting, t) {
  const fallback = KEY_HINTS_VI[setting.key]
  if (!fallback) return ''
  return t(`settings.keyHint.${setting.key}`, { defaultValue: fallback })
}

export function settingWhere(setting, t) {
  const fallback = KEY_GUIDE[setting.key]?.[1]
  if (!fallback) return ''
  return t(`settings.keyWhere.${setting.key}`, { defaultValue: fallback })
}

export function sectionTitle(sec, t) {
  const meta = SECTION_GUIDE[sec]
  if (!meta) return t('settings.sectionOther', { defaultValue: 'Khác' })
  return t(`settings.section.${sec}`, { defaultValue: meta.title })
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
const TRANSLATABLE_GROUPS = new Set(['GENERAL', 'PUBLIC_HERO', 'SEO', 'AI_ASSISTANT'])

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

// Setting keys required in Vietnamese (mirrors `.required()` in the backend
// SettingDefinitionRegistry — currently only `site_name`). TRANSLATION_RULE_002: the
// English value is required too for keys that are BOTH required AND translatable.
export const REQUIRED_SETTING_KEYS = new Set(['site_name'])

// ── Tab config ────────────────────────────────────────────────────────────────

// Tab "Banner trang" KHÔNG phải một settingGroup thật — nó nhúng trình sửa banner
// (BannerScreen) có khung xem trước ráp sẵn vào trong màn Cài đặt. Id dùng riêng,
// không trùng group nào để không lẫn với các tab render bằng SettingTabPanel.
export const BANNERS_TAB_ID = '__banners__'

// Tab "Phân công" cũng KHÔNG phải settingGroup render qua SettingTabPanel — nhóm product_assign
// nhường chỗ cho AssignmentRolesScreen (danh sách vai trò động, xem HIDDEN_GROUPS bên dưới),
// cùng cơ chế synthetic tab như BANNERS_TAB_ID.
export const ASSIGN_TAB_ID = '__product_assign__'

// Giới hạn số vai trò trên banner Phân công — khớp tay với MIN_ASSIGNMENT_ROLES/
// MAX_ASSIGNMENT_ROLES trong SettingValueValidator.java (không có cơ chế share hằng số
// giữa JVM/JS, đổi 1 bên nhớ đổi bên kia).
export const MIN_ASSIGNMENT_ROLES = 1
export const MAX_ASSIGNMENT_ROLES = 6

export const TAB_ORDER = [
  'GENERAL', 'CONTACT', 'PAYMENT', 'PUBLIC_HERO', 'SEO',
  'PRODUCT_ASSIGN', 'REVIEW_MODERATION', 'AI_ASSISTANT',
]

// Tabs whose values directly affect pricing / checkout / operations — saving
// these requires an explicit confirmation. (Trống từ V310 — nhóm STORE duy nhất
// từng nằm ở đây đã gỡ hẳn vì không điều khiển gì; giữ cơ chế cho tab tương lai.)
export const SENSITIVE_SETTING_TABS = new Set(['PAYMENT'])

// Group/key bị ẩn vì không thuộc trách nhiệm của admin shop:
// - PUBLIC_HERO: ảnh banner đầu trang render bằng trình riêng (BannerScreen) có preview ráp sẵn,
//   nay nhúng làm tab "Banner trang" NGAY TRONG màn Cài đặt (xem BANNERS_TAB_ID) — ẩn khỏi danh
//   sách tab generic để không hiện 2 lần / sửa 2 nơi.
// - CONTACT: thông tin liên hệ (hotline/địa chỉ/giờ/mạng xã hội, gồm cả zalo_display/messenger_display)
//   là dữ liệu CHUNG cho header + trang Liên hệ (tĩnh) + trang Giới thiệu + trang chủ/sản phẩm/khung
//   chat nổi (footer đã hardcode riêng từ 2026-07-03, không còn đọc nhóm này — xem WpFooter.tsx).
//   Trang Liên hệ nay là TRANG TĨNH, không còn trình dựng — không màn admin nào sửa nhóm này (cố định
//   theo yêu cầu owner). Bản ghi vẫn ở site_settings để web/header đọc; muốn cho sửa lại thì bỏ
//   'CONTACT' khỏi HIDDEN_GROUPS để hiện lại tab Cài đặt › Liên hệ.
// - PAYMENT: hiển thị lại theo PAY_RULE_001 (2026-07-21): khách có thể chọn chuyển khoản
//   thủ công, nên chủ shop phải cập nhật được tài khoản nhận tiền mà không sửa trực tiếp DB.
// - PRODUCT_ASSIGN: banner Phân công (product_assign_title + product_assign_roles, JSON động
//   1-6 vai trò từ V318) render bằng trình riêng AssignmentRolesScreen (nhúng làm tab "Phân công"
//   NGAY TRONG màn Cài đặt, xem ASSIGN_TAB_ID) — ẩn khỏi luồng SettingTabPanel/SettingField chung
//   vì cần UI thêm/xóa vai trò động mà form field tĩnh không đáp ứng được.
// (PUBLIC_ABOUT đã gỡ hẳn V274 — trang Giới thiệu là trang tĩnh, không còn nhóm settings.)
export const HIDDEN_GROUPS = new Set(['PUBLIC_HERO', 'CONTACT', 'PRODUCT_ASSIGN'])

// Field cụ thể bị ẩn — hiện không còn field nào (nhóm STORE duy nhất từng ở đây đã gỡ hẳn V310).
export const HIDDEN_KEYS = new Set()

export const TAB_META = {
  GENERAL: {
    icon: Store,
    labelKey: 'settings.group_general',
    descriptionKey: 'settings.groupDescription.general',
  },
  CONTACT: {
    icon: Phone,
    labelKey: 'settings.group_contact',
    descriptionKey: 'settings.groupDescription.contact',
  },
  PAYMENT: {
    icon: Landmark,
    labelKey: 'settings.group_payment',
    descriptionKey: 'settings.groupDescription.payment',
  },
  PUBLIC_HERO: {
    icon: ImageIcon,
    labelKey: 'settings.group_public_hero',
    descriptionKey: 'settings.groupDescription.publicHero',
  },
  SEO: {
    icon: Globe,
    labelKey: 'settings.group_seo',
    descriptionKey: 'settings.groupDescription.seo',
  },
  PRODUCT_ASSIGN: {
    icon: Users,
    labelKey: 'settings.group_product_assign',
    descriptionKey: 'settings.groupDescription.productAssign',
  },
  REVIEW_MODERATION: {
    icon: ShieldCheck,
    labelKey: 'settings.group_review_moderation',
    descriptionKey: 'settings.groupDescription.reviewModeration',
  },
  AI_ASSISTANT: {
    icon: Bot,
    labelKey: 'settings.group_ai_assistant',
    descriptionKey: 'settings.groupDescription.aiAssistant',
  },
}

// Bản dịch tiếng Việt cho từng setting key (admin shop motor đọc dễ hiểu hơn description English từ migrations)
export const KEY_LABELS_VI = {
  // general
  site_name: 'Tên shop (SEO trang chủ/bài viết, khối liên hệ trang sản phẩm)',
  // footer_tagline/bct_url/business_registration: gỡ V308 — footer đã hardcode, không còn tác dụng.
  footer_description: 'Mô tả ngắn (panel thông tin shop trên header mobile)',
  // contact
  hotline_2: 'Hotline phụ',
  hotline_3: 'Hotline thứ ba',
  contact_email: 'Email liên hệ công khai',
  contact_address: 'Địa chỉ cửa hàng',
  facebook_url: 'Link trang Facebook',
  shopee_url: 'Link gian hàng Shopee',
  opening_hours_weekday: 'Giờ mở cửa (T2–T6)',
  opening_hours_weekend: 'Giờ mở cửa (T7/CN)',
  opening_hours_holiday: 'Lịch nghỉ (lễ/Tết)',
  // review_moderation (kiểm duyệt đánh giá tự động — REVIEW_RULE_012/013)
  review_moderation_enabled: 'Bật kiểm duyệt đánh giá tự động',
  review_moderation_block_profanity: 'Chặn chửi tục, từ thô tục',
  review_moderation_block_harassment: 'Chặn xúc phạm, công kích, kỳ thị',
  review_moderation_block_advertising: 'Chặn quảng cáo, link, số điện thoại',
  review_moderation_block_sensitive: 'Chặn nội dung 18+, chính trị, lạc đề',
  review_moderation_daily_limit: 'Số lượt AI tối đa mỗi ngày',
  review_moderation_banned_words: 'Danh sách từ cấm của shop',
  // ai_assistant (Trợ lý BigBike — CHAT_RULE_001..024)
  ai_assistant_enabled: 'Bật Trợ lý BigBike',
  ai_assistant_daily_limit: 'Số lượt gọi AI tối đa mỗi ngày',
  ai_assistant_recent_turn_pairs: 'Số cặp hỏi–đáp gần nhất Trợ lý BigBike được đọc',
  ai_assistant_search_ai_interpretation_enabled: 'Cho Trợ lý BigBike hiểu cách nói tự nhiên khi tìm hàng',
  ai_assistant_greeting: 'Câu chào đầu khung chat',
  ai_assistant_quick_prompts: 'Các nút gợi ý nhanh',
  // payment (tài khoản nhận chuyển khoản — admin tự nhập, hiển thị cho khách khi đặt đơn chuyển khoản)
  bank_account_holder: 'Chủ tài khoản nhận chuyển khoản',
  bank_account_number: 'Số tài khoản nhận chuyển khoản',
  bank_name: 'Tên ngân hàng (vd: Vietcombank)',
  bank_branch: 'Chi nhánh ngân hàng (không bắt buộc)',
  messenger_url: 'Link Messenger (popup chat)',
  messenger_display: 'Chữ hiển thị Messenger (popup chat)',
  // contact (hotline/zalo hiển thị nổi bật — 4 khối trang chủ dùng nhóm public_home đã gỡ
  // hẳn V311: banner promo, trải nghiệm, giới thiệu, kicker/tiêu đề Sản phẩm nổi bật/Tin
  // tức/Video hardcode thẳng bigbike-web, quyết định chủ shop 2026-07-03)
  hotline: 'Hotline chính (hiển thị nổi bật)',
  zalo_url: 'Link Zalo (popup liên hệ)',
  zalo_display: 'Chữ hiển thị Zalo (popup liên hệ)',
  // public_product — toàn bộ nội dung PDP giờ quản theo TỪNG sản phẩm (trang sửa sản phẩm):
  // khối "cam kết" dưới nút mua (V232) + dải "tin cậy" trên tên sản phẩm (V233). Không còn setting chung.
  // SEO trang chủ mở lại theo SETTINGS_RULE_003 (2026-08-16).
  seo_home_title: 'Tiêu đề SEO trang chủ',
  seo_home_description: 'Mô tả SEO trang chủ',
  seo_home_h1: 'Tiêu đề chính trang chủ',
  home_content_bottom_html: 'Nội dung SEO cuối trang chủ (rich-text)',
  // public_hero — Tất cả sản phẩm
  hero_products_image_url: 'Ảnh hero — trang Tất cả sản phẩm (desktop)',
  hero_products_image_alt: 'Alt ảnh hero — Tất cả sản phẩm',
  hero_products_title: 'Tiêu đề hero — Tất cả sản phẩm',
  // public_hero — Thương hiệu
  hero_brands_image_url: 'Ảnh hero — trang Thương hiệu (desktop)',
  hero_brands_image_alt: 'Alt ảnh hero — Thương hiệu',
  hero_brands_title: 'Tiêu đề hero — Thương hiệu',
  // public_hero — Tin tức
  hero_news_image_url: 'Ảnh hero — trang Tin tức (desktop)',
  hero_news_image_alt: 'Alt ảnh hero — Tin tức',
  hero_news_title: 'Tiêu đề hero — Tin tức',
  // global hero defaults
  hero_default_bg_url: 'Ảnh nền mặc định hero (dùng khi trang không có ảnh riêng)',
  hero_default_illustration_url: 'Ảnh gear mặc định hero (dùng khi trang không có ảnh minh hoạ riêng)',
  // product_assign: KHÔNG còn ở đây — nhóm này render qua AssignmentRolesScreen riêng
  // (xem HIDDEN_GROUPS), không qua SettingField/KEY_LABELS_VI chung.
}

export const KEY_HINTS_VI = {
  review_moderation_enabled:
    'Phải khai khoá dịch vụ AI ở máy chủ trước. Chưa khai thì mọi đánh giá vẫn nằm ở Chờ duyệt như hiện nay.',
  review_moderation_daily_limit:
    'Chặn chi phí khi bị spam. Vượt ngưỡng thì ngừng gọi AI tới hết ngày, đánh giá nằm ở Chờ duyệt. Đặt 0 để tắt hẳn phần gọi AI mà vẫn giữ danh sách từ cấm.',
  review_moderation_banned_words:
    'Mỗi từ một dòng, hoặc ngăn bằng dấu phẩy. Không phân biệt hoa thường và dấu tiếng Việt — gõ "lừa đảo" là bắt được cả "lua dao". Từ trong danh sách này luôn bị chặn, kể cả khi tắt hết 4 loại ở trên.',
  ai_assistant_enabled:
    'Khi tắt, khách vẫn thấy nút chat nhưng mở ra bảng Hotline, Zalo và Messenger như trước.',
  ai_assistant_daily_limit:
    'Giới hạn lượt AI theo ngày giờ Việt Nam; mặc định 120 lượt/ngày. Hết lượt, Trợ lý BigBike tự chuyển về bảng liên hệ và không làm mất kênh hỗ trợ.',
  ai_assistant_recent_turn_pairs:
    'Từ 0 đến 12, mặc định 12. Đặt 0 để Trợ lý BigBike không đọc lịch sử; nội dung gửi AI được che thông tin riêng tư và cắt gọn.',
  ai_assistant_search_ai_interpretation_enabled:
    'Bật để Trợ lý BigBike hiểu viết tắt và cách nói tự nhiên, còn hệ thống vẫn đối chiếu kết quả trước khi trả khách. Tắt để quay về cách tìm hàng cũ ngay, không cần triển khai lại.',
  ai_assistant_greeting:
    'Nhập riêng tiếng Việt và tiếng Anh. Dòng đầu cần nói rõ Trợ lý BigBike là trợ lý ảo AI.',
  ai_assistant_quick_prompts:
    'Mỗi dòng là một nút. Nhập từ 3 đến 4 dòng cho từng ngôn ngữ.',
  hero_products_image_url:         'Ảnh nằm ngang rộng, ví dụ 1920×600px.',
  hero_brands_image_url:           'Ảnh nằm ngang rộng, ví dụ 1920×600px.',
  hero_news_image_url:             'Ảnh nằm ngang rộng, ví dụ 1920×600px.',
  hero_default_bg_url:             'Ảnh nằm ngang rộng, ví dụ 1920×600px.',
  hero_default_illustration_url:   'PNG nền trong, tỷ lệ gần vuông ~700×600px.',
  seo_home_title:                  'Nhập tiêu đề hiện trên Google và trong thẻ trình duyệt.',
  seo_home_description:            'Nhập đoạn mô tả Google; để trống sẽ dùng mô tả trang chủ theo ngôn ngữ.',
  seo_home_h1:                     'Nhập đúng một tiêu đề chính hiển thị trên trang chủ.',
}

// Chuẩn kích thước khuyến nghị theo từng cấu hình ảnh (so khớp với KEY_HINTS_VI).
// Key không liệt kê sẽ dùng spec chung (chỉ nhắc khi quá nhỏ, không khóa tỉ lệ).
export const KEY_RECO = {
  hero_products_image_url:         IMAGE_RECO.bannerWide,
  hero_brands_image_url:           IMAGE_RECO.bannerWide,
  hero_news_image_url:             IMAGE_RECO.bannerWide,
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

export function tabDescription(group, t) {
  const meta = TAB_META[group?.toUpperCase()] || FALLBACK_META
  if (!meta.descriptionKey) return ''
  return t(meta.descriptionKey)
}

// ── Hướng dẫn vị trí: mỗi ô render ở đâu trên web ───────────

// Khối hiển thị → tiêu đề.
export const SECTION_GUIDE = {
  general_brand: {
    title: 'SEO & thông tin shop — mọi trang',
    description: 'Thông tin nhận diện chính được dùng xuyên suốt website.',
  },
  contact_main: {
    title: 'Trang Liên hệ + Header',
    description: 'Thông tin khách nhìn thấy khi cần liên hệ với cửa hàng.',
  },
  contact_social: {
    title: 'Mạng xã hội — chat nổi + trang Liên hệ',
    description: 'Các kênh hỗ trợ và mạng xã hội công khai của cửa hàng.',
  },
  payment_bank: {
    title: 'Tài khoản nhận chuyển khoản',
    description: 'Thông tin hiển thị cho khách khi chọn thanh toán chuyển khoản.',
  },
  hero_products: {
    title: 'Banner đầu trang Tất cả sản phẩm',
    description: 'Hình ảnh và nội dung mở đầu trang danh sách sản phẩm.',
  },
  hero_brands: {
    title: 'Banner đầu trang Thương hiệu',
    description: 'Hình ảnh và nội dung mở đầu trang thương hiệu.',
  },
  hero_news: {
    title: 'Banner đầu trang Tin tức',
    description: 'Hình ảnh và nội dung mở đầu trang tin tức.',
  },
  hero_default: {
    title: 'Banner mặc định',
    description: 'Dùng khi trang danh sách chưa có ảnh riêng.',
  },
  seo_home: {
    title: 'Nội dung SEO cuối trang chủ',
    description: 'Nội dung dài hỗ trợ tìm kiếm, hiển thị ở cuối trang chủ.',
  },
  review_moderation_switch: {
    title: 'Bật kiểm duyệt tự động',
    description: 'Khi bật, đánh giá mới của khách được máy lọc trước. Máy chỉ được chặn, không bao giờ tự đăng đánh giá lên web — phần duyệt vẫn do bạn bấm.',
  },
  review_moderation_kinds: {
    title: 'Loại nội dung cần chặn',
    description: 'Tắt một loại nghĩa là không chặn vì loại đó nữa; hệ thống vẫn ghi chú lại để bạn tự xem.',
  },
  review_moderation_words: {
    title: 'Danh sách từ cấm của shop',
    description: 'Chặn ngay lập tức, không tốn phí và không phụ thuộc dịch vụ AI.',
  },
  ai_assistant_switch: {
    title: 'Vận hành và ngân sách của Trợ lý BigBike',
    description: 'Bật/tắt trợ lý và giới hạn số lượt có dùng AI trong ngày. Khi không khả dụng, widget tự quay về bảng liên hệ.',
  },
  ai_assistant_copy: {
    title: 'Nội dung đầu khung chat',
    description: 'Câu chào và các câu hỏi gợi ý có bản tiếng Việt và tiếng Anh riêng.',
  },
}
export const SECTION_ORDER = Object.keys(SECTION_GUIDE)

// Mỗi ô → [id khối, vị trí cụ thể]. Dòng "📍 vị trí" hiện dưới nhãn để admin biết ô render ở đâu.
export const KEY_GUIDE = {
  site_name:             ['general_brand', 'tên hiển thị — SEO trang chủ/bài viết + khối liên hệ trang sản phẩm'],
  // footer_tagline/bct_url/business_registration: gỡ V308 — footer đã hardcode.
  footer_description:    ['general_brand', 'đoạn mô tả — panel thông tin shop trên header mobile'],

  contact_email:         ['contact_main', 'email liên hệ'],
  contact_address:       ['contact_main', 'địa chỉ + bản đồ trang Liên hệ'],
  hotline:               ['contact_main', 'hotline chính (header — footer đã hardcode riêng)'],
  hotline_2:             ['contact_main', 'hotline phụ'],
  hotline_3:             ['contact_main', 'hotline thứ ba'],
  opening_hours_weekday: ['contact_main', 'giờ mở cửa T2–T6 (header)'],
  opening_hours_weekend: ['contact_main', 'giờ mở cửa T7/CN'],
  opening_hours_holiday: ['contact_main', 'lịch nghỉ lễ/Tết'],
  facebook_url:          ['contact_social', 'link Facebook (trang Liên hệ — footer đã hardcode riêng)'],
  messenger_url:         ['contact_social', 'nút Messenger (chat nổi)'],
  messenger_display:     ['contact_social', 'chữ hiển thị dòng Messenger'],
  zalo_url:              ['contact_social', 'nút Zalo (chat nổi)'],
  zalo_display:          ['contact_social', 'chữ hiển thị dòng Zalo'],
  youtube_url:           ['contact_social', 'link YouTube (trang Liên hệ — footer đã hardcode riêng)'],
  tiktok_url:            ['contact_social', 'link TikTok (trang Liên hệ — footer đã hardcode riêng)'],
  instagram_url:         ['contact_social', 'link Instagram (trang Liên hệ — footer đã hardcode riêng)'],
  shopee_url:            ['contact_social', 'link Shopee (trang Liên hệ — footer đã hardcode riêng)'],

  bank_account_holder:   ['payment_bank', 'tên chủ tài khoản'],
  bank_account_number:   ['payment_bank', 'số tài khoản'],
  bank_name:             ['payment_bank', 'tên ngân hàng'],
  bank_branch:           ['payment_bank', 'chi nhánh'],


  hero_products_image_url:        ['hero_products', 'ảnh nền banner (desktop)'],
  hero_products_image_alt:        ['hero_products', 'mô tả ảnh (SEO)'],
  hero_products_title:            ['hero_products', 'tiêu đề trên banner'],
  hero_brands_image_url:          ['hero_brands', 'ảnh nền banner (desktop)'],
  hero_brands_image_alt:          ['hero_brands', 'mô tả ảnh (SEO)'],
  hero_brands_title:              ['hero_brands', 'tiêu đề trên banner'],
  hero_news_image_url:            ['hero_news', 'ảnh nền banner (desktop)'],
  hero_news_image_alt:            ['hero_news', 'mô tả ảnh (SEO)'],
  hero_news_title:                ['hero_news', 'tiêu đề trên banner'],
  hero_default_bg_url:           ['hero_default', 'ảnh nền mặc định'],
  hero_default_illustration_url: ['hero_default', 'ảnh minh hoạ mặc định'],

  seo_home_title: ['seo_home', 'tiêu đề SEO trang chủ'],
  seo_home_description: ['seo_home', 'mô tả SEO trang chủ'],
  seo_home_h1: ['seo_home', 'tiêu đề chính duy nhất trên trang chủ'],
  home_content_bottom_html: ['seo_home', 'đoạn nội dung cuối trang chủ'],

  // product_assign: KHÔNG còn ở đây — xem ghi chú ở KEY_LABELS_VI/HIDDEN_GROUPS phía trên.

  // review_moderation: tách 2 khối để công tắc tổng không nằm lẫn với 4 loại vi phạm,
  // và danh sách từ cấm (áp dụng độc lập với 4 loại đó) đứng riêng một khối.
  review_moderation_enabled:            ['review_moderation_switch', 'bật/tắt toàn bộ'],
  review_moderation_block_profanity:    ['review_moderation_kinds', 'chửi tục, thô tục → Thùng rác'],
  review_moderation_block_harassment:   ['review_moderation_kinds', 'xúc phạm, công kích, kỳ thị → Thùng rác'],
  review_moderation_block_advertising:  ['review_moderation_kinds', 'quảng cáo, link, số điện thoại → Spam'],
  review_moderation_block_sensitive:    ['review_moderation_kinds', '18+, chính trị, nội dung lạc đề → Thùng rác'],
  review_moderation_daily_limit:        ['review_moderation_switch', 'trần chi phí mỗi ngày'],
  review_moderation_banned_words:       ['review_moderation_words', 'danh sách từ cấm tự quản'],
  ai_assistant_enabled:                 ['ai_assistant_switch', 'bật/tắt Trợ lý BigBike trên toàn website'],
  ai_assistant_daily_limit:             ['ai_assistant_switch', 'trần lượt gọi AI mỗi ngày, giờ Việt Nam'],
  ai_assistant_recent_turn_pairs:        ['ai_assistant_switch', '0–12 cặp gần nhất để hiểu câu nối'],
  ai_assistant_search_ai_interpretation_enabled: ['ai_assistant_switch', 'chuyển giữa cách hiểu tìm hàng mới và cũ'],
  ai_assistant_greeting:                ['ai_assistant_copy', 'câu chào khi khách mở khung chat'],
  ai_assistant_quick_prompts:           ['ai_assistant_copy', '3–4 nút câu hỏi nhanh trong khung chat'],
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

export function sectionDescription(sec, t) {
  const fallback = SECTION_GUIDE[sec]?.description || ''
  if (!fallback) return ''
  return t(`settings.sectionDescription.${sec}`, { defaultValue: fallback })
}

// ── Autosave utilities (F9) ──────────────────────────────────────────────────
// Mirrors product-detail/constants.js + category-detail/constants.js — same
// localStorage draft mechanism. Cài đặt là màn đơn (không có id/isCreate riêng
// từng bản ghi) nên key cố định, gộp chung drafts VI + EN của MỌI tab vào một
// bản nháp duy nhất (đổi tab nội bộ không mất draft, nên autosave cũng không
// cần tách theo tab).
export const AUTOSAVE_TTL_MS = 60 * 60 * 1000

export function getAutosaveKey() {
  return 'settings-autosave'
}

export function saveFormToStorage(key, form) {
  try {
    localStorage.setItem(key, JSON.stringify({ form, ts: Date.now() }))
  } catch { /* quota */ }
}

export function loadFormFromStorage(key) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.ts || Date.now() - parsed.ts > AUTOSAVE_TTL_MS) {
      localStorage.removeItem(key)
      return null
    }
    return parsed
  } catch { return null }
}

export function clearFormFromStorage(key) {
  try { localStorage.removeItem(key) } catch { /* ignore */ }
}
