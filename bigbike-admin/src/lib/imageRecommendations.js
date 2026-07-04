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
//                      client theo vị trí (đổi 2026-07-04). Sàn kích thước duy nhất còn lại nằm
//                      ở server (AdminMediaService, 500×400 chung cho mọi vị trí).
//   ratio  = [w, h]  — tỉ lệ khung hiển thị thật; lệch quá ratioTolerance → chặn lưu (wrongRatio).
//   ratio  = null    — khung không ép tỉ lệ cố định (ảnh tự do / native-render) — vị trí này
//                      KHÔNG còn tiêu chí nào để chặn ở client.
export const IMAGE_RECO = {
  // Ảnh sản phẩm (PDP + gallery): khung vuông tối đa 903×903 (desktop ≥1920px, ProductGallery.tsx) —
  // kính lúp zoom 2.5× cần nguồn ≥1300×1300 nhưng đã nằm trong ngưỡng 2×903 nên không cần cộng thêm.
  productImage: { idealW: 1800, idealH: 1800, minW: 1800, minH: 1800, ratio: [1, 1], ratioTolerance: 0.12 },
  // Ảnh danh mục (lưới danh mục trang chủ, HomeCategoryGrid.tsx): cột ~255×255 (desktop 1200-1919px),
  // không ép aspect-ratio bằng CSS nhưng giữ vuông để lưới thẳng hàng.
  categoryImage: { idealW: 520, idealH: 520, minW: 520, minH: 520, ratio: [1, 1], ratioTolerance: 0.15 },
  // Banner ngang full-bleed (category/brand hero bg, banner trang listing san-pham/brands/tin-tuc,
  // hero mặc định): WpCategoryHero .page-title — full viewport × 450px (desktop 1920×450, background-cover).
  bannerWide: { idealW: 3840, idealH: 900, minW: 3840, minH: 900, ratio: [64, 15], ratioTolerance: 0.2 },
  // Banner mobile của các trang listing (hero_*_mobile_image_url) — cùng WpCategoryHero, dải nền
  // ngang cố định cao 250px, KHÔNG phải ảnh dọc (390×250, background-cover).
  heroMobile: { idealW: 780, idealH: 500, minW: 780, minH: 500, ratio: [39, 25], ratioTolerance: 0.2 },
  // Slide trang chủ desktop (HeroSlider.tsx): w-full h-[max(40vw,300px)] → 1920×768 ở 1920px viewport.
  sliderDesktop: { idealW: 3840, idealH: 1536, minW: 3840, minH: 1536, ratio: [5, 2], ratioTolerance: 0.2 },
  // Slide trang chủ mobile (HeroSlider.tsx): aspect-[411/548] đúng 3:4 → 390×520 ở mobile 390px.
  sliderMobile: { idealW: 780, idealH: 1040, minW: 780, minH: 1040, ratio: [3, 4], ratioTolerance: 0.12 },
  // Logo hãng: vừa hiển thị cao tối đa 64px trong lưới hãng (object-contain, không ép tỉ lệ),
  // vừa dùng làm minh hoạ hero trang chi tiết hãng (native-render, giống illustration) — ngữ cảnh
  // sau đòi hỏi cao hơn: giữ khung 400×200 hiện có × 2.
  logo: { idealW: 800, idealH: 400, minW: 800, minH: 400, ratio: null },
  // Ảnh OG/chia sẻ mạng xã hội (og_image_url, seoOgImageUrl): KHÔNG có khung hiển thị trên
  // bigbike-web (chỉ nằm trong thẻ <meta og:image>, Facebook/Zalo tự crop) — không áp công thức
  // 2× nội bộ, dùng thẳng chuẩn 1200×630 khuyến nghị của Open Graph (đã đủ nét ở mọi nơi hiển thị).
  cover: { idealW: 1200, idealH: 630, minW: 1200, minH: 630, ratio: [40, 21], ratioTolerance: 0.15 },
  // Ảnh PNG nền trong chồng carousel "Góc trải nghiệm" trang chủ (ExperienceCarousel.tsx overlay):
  // rộng tối đa ~266px (desktop), không ép chiều cao (giữ nguyên tỉ lệ file PNG cắt sẵn).
  squareMedium: { idealW: 600, idealH: 600, minW: 600, minH: 600, ratio: null },
  // Ảnh minh hoạ hero (WpCategoryHero .img — category heroImageUrl, brand-detail logo-as-hero,
  // hero_default/hero_*_illustration_url): render ở KÍCH THƯỚC GỐC (không CSS resize), ảnh mặc định
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

// menuIconUrl (icon danh mục trong mega-menu + bộ lọc): icon 1 màu, khuyến nghị SVG, hiển thị
// cố định 20×16px qua CSS mask — KHÔNG kiểm tra kích thước (SVG là vector, không có khái niệm
// "mờ vì thiếu pixel"; PNG thay thế cũng chỉ hiển thị 20×16px nên mọi file hợp lệ đều đủ nét).
// Không thêm field vào IMAGE_RECO cho vị trí này — ImageUrlInput không nhận `recommend` sẽ tự bỏ qua.

// So tỉ lệ thực tế của ảnh/video với spec khuyến nghị (kích thước không còn bị chặn, chỉ tỉ lệ).
// Trả về null nếu đạt; hoặc mảng lý do: 'wrongRatio'.
export function evaluateImageDimensions(width, height, spec) {
  if (!width || !height || !spec) return null
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
