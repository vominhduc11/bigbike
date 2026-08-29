// Khuyến nghị kích thước + NGƯỠNG CHẶN tỉ lệ ảnh/video cho từng vị trí hiển thị trên bigbike-web.
//
// Phương pháp (audit 2026-07-03, đổi luật 2026-07-04 — bỏ chặn theo kích thước, xem
// docs/engineering/DATA_CONTRACT.md § Media Dimension Rules):
//   1. Đo khung hiển thị THẬT (CSS px, màn hình thường/1×) bằng cách đọc trực tiếp component +
//      CSS của bigbike-web (không suy đoán) — desktop tham chiếu 1920×1080, mobile 390×844.
//   2. idealW/idealH = minW/minH = 2 × khung hiển thị thật đó (hệ số retina 2×).
//   3. Vị trí dùng chung 1 field cho nhiều ngữ cảnh hiển thị (vd banner vừa làm nền desktop vừa
//      làm nền mobile qua background-size:cover) → lấy ngữ cảnh ĐÒI HỎI độ phân giải cao nhất.
//
// Ý nghĩa các trường:
//   idealW / idealH  — kích thước khuyến nghị hiển thị cho admin NGAY TẠI ô upload (đã ở mức 2×).
//   minW   / minH    — CHỈ còn là số khuyến nghị (trùng idealW/idealH) — KHÔNG còn chặn lưu ở
//                      client theo vị trí (đổi 2026-07-04). Media Library không có sàn pixel
//                      chung ở server.
//   ratio  = [w, h]  — tỉ lệ khung hiển thị thật; lệch quá ratioTolerance → chặn lưu (wrongRatio).
//   ratio  = null    — khung không ép tỉ lệ cố định (ảnh tự do / native-render) — vị trí này
//                      KHÔNG còn tiêu chí nào để chặn ở client.
export const IMAGE_RECO = {
  // Ảnh sản phẩm (PDP + gallery): khung vuông tối đa 903×903 (desktop ≥1920px, ProductGallery.tsx) —
  // kính lúp zoom 2.5× cần nguồn ≥1300×1300 nhưng đã nằm trong ngưỡng 2×903 nên không cần cộng thêm.
  productImage: { idealW: 1800, idealH: 1800, minW: 1800, minH: 1800, ratio: [1, 1], ratioTolerance: 0.12 },
  // Ảnh danh mục (lưới danh mục trang chủ, HomeCategoryGrid.tsx): khung 64/80/96px theo
  // thiết bị. Không có sàn pixel; ảnh mới phải vuông tuyệt đối để mọi file hiển thị cùng cỡ.
  categoryImage: { idealW: null, idealH: null, minW: null, minH: null, ratio: [1, 1], exactRatio: true },
  // Banner ngang full-bleed (category/brand hero bg, banner trang listing san-pham/brands/tin-tuc,
  // hero mặc định): WpCategoryHero .page-title — full viewport × 450px (desktop 1920×450, background-cover).
  bannerWide: { idealW: 3840, idealH: 900, minW: 3840, minH: 900, ratio: [64, 15], ratioTolerance: 0.2 },
  // Slide trang chủ desktop (HeroSlider.tsx): w-full h-[max(40vw,300px)] → 1920×768 ở 1920px viewport.
  sliderDesktop: { idealW: 3840, idealH: 1536, minW: 3840, minH: 1536, ratio: [5, 2], ratioTolerance: 0.2 },
  // Slide trang chủ mobile: container max-md aspect-[411/548] ≈ 3:4; viewport tham chiếu 390px.
  // Ảnh này tùy chọn, website fallback về sliderDesktop khi không có.
  sliderMobile: { idealW: 780, idealH: 1040, minW: 780, minH: 1040, ratio: [3, 4], ratioTolerance: 0.12 },
  // Logo thương hiệu: JPEG/JPG, PNG hoặc WebP, vuông 1:1 (sai lệch tối đa 1%).
  // Admin sẽ mở khung cắt vuông để người dùng tự chọn vùng logo; ảnh cũ vẫn được đọc và cảnh báo.
  logo: {
    idealW: 800,
    idealH: 800,
    minW: 400,
    minH: 400,
    ratio: [1, 1],
    ratioTolerance: 0.01,
    brandLogo: true,
    allowCrop: true,
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    requiresTransparency: false,
  },
  // Ảnh OG/chia sẻ mạng xã hội (seoOgImageUrl per-sản phẩm/danh mục/bài viết): KHÔNG có khung hiển thị trên
  // bigbike-web (chỉ nằm trong thẻ <meta og:image>, Facebook/Zalo tự crop) — không áp công thức
  // 2× nội bộ, dùng thẳng chuẩn 1200×630 khuyến nghị của Open Graph (đã đủ nét ở mọi nơi hiển thị).
  cover: { idealW: 1200, idealH: 630, minW: 1200, minH: 630, ratio: [40, 21], ratioTolerance: 0.15 },
  // Ảnh PNG nền trong chồng carousel "Góc trải nghiệm" trang chủ (ExperienceCarousel.tsx overlay):
  // rộng tối đa ~266px (desktop), không ép chiều cao (giữ nguyên tỉ lệ file PNG cắt sẵn).
  squareMedium: { idealW: 600, idealH: 600, minW: 600, minH: 600, ratio: null },
  // Ảnh minh hoạ hero (PageHero — category heroImageUrl, brand-detail logo-as-hero,
  // hero_default/hero_*_illustration_url): khung tối đa 451×400, object-contain; ảnh mặc định
  // hệ thống mu-bao-hiem.png là 451×400 — đây chính là khung 1× tham chiếu.
  illustration: { idealW: 900, idealH: 800, minW: 900, minH: 800, ratio: null },
  // Ảnh thu nhỏ carousel Video (trang chủ + "Video sản phẩm" PDP, VideoCard.tsx): thẻ DỌC
  // aspect-ratio 9/16, rộng tối đa ~242px ở desktop 1920px — KHÔNG phải 16:9 ngang.
  videoThumb: { idealW: 500, idealH: 900, minW: 500, minH: 900, ratio: [9, 16], ratioTolerance: 0.12 },
  // File video tải lên carousel Video (VideoModal.tsx, player DỌC): khung tối đa 420×747 (desktop) —
  // cùng carousel dọc 9/16 ở trên nên video gốc cũng phải quay dọc, KHÔNG phải 16:9 ngang.
  video: { idealW: 850, idealH: 1500, minW: 850, minH: 1500, ratio: [9, 16], ratioTolerance: 0.12 },
  // Video nhúng trong khối nội dung (block "video", mô tả sản phẩm/bài viết): khung NGANG 16:9
  // rộng bằng cột nội dung (~1170px desktop, product description container).
  contentVideo: { idealW: 2340, idealH: 1320, minW: 2340, minH: 1320, ratio: [16, 9], ratioTolerance: 0.12 },
  // Ảnh chèn khối "image" trong nội dung (mô tả sản phẩm/bài viết) + ảnh chèn rich-text chung
  // (FAQ, callout, mô tả hãng...): lấy ngữ cảnh rộng nhất — full cột nội dung ~1170px desktop.
  general: { idealW: 2340, idealH: 1560, minW: 2340, minH: 1560, ratio: null },
  // Ảnh khối "feature" (ảnh cạnh chữ) trong nội dung: nửa cột nội dung, ÉP tỉ lệ 4:3
  // (ProductDescriptionBlocks.tsx aspect-[4/3] object-cover) → ~565×424 desktop.
  featureImage: { idealW: 1130, idealH: 850, minW: 1130, minH: 850, ratio: [4, 3], ratioTolerance: 0.1 },
}

// The root header menu uses the shared categoryImage as a 24×24px CSS mask.
// There is no separate menu-icon field or additional pixel-size threshold; the categoryImage
// exact-square rule above remains the only ratio validation for a new/replaced category image.

// So tỉ lệ thực tế của ảnh/video với spec khuyến nghị (kích thước không còn bị chặn, chỉ tỉ lệ).
// Spec exactRatio dành riêng cho ảnh thumbnail danh mục: mọi lệch dù chỉ một pixel đều bị chặn.
// Trả về null nếu đạt; hoặc mảng lý do: 'wrongRatio'/'unreadableDimensions'.
export function evaluateImageDimensions(width, height, spec) {
  if (!spec) return null
  if (spec.exactRatio) {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      return ['unreadableDimensions']
    }
    return width === height ? null : ['wrongRatio']
  }
  if (!width || !height) return null
  const reasons = []
  if (spec.ratio) {
    const target = spec.ratio[0] / spec.ratio[1]
    const actual = width / height
    const tolerance = spec.ratioTolerance ?? 0.15
    if (Math.abs(actual - target) / target > tolerance) {
      reasons.push('wrongRatio')
    }
  }
  return reasons.length ? reasons : null
}
