// Khuyến nghị kích thước ảnh/video cho từng vị trí hiển thị trên web.
//
// Số liệu lấy từ cách bigbike-web render thật (ví dụ ảnh sản phẩm = khung vuông
// 1:1, tải ở 1200px, có zoom 2.5×) và từ các gợi ý kích thước đã có sẵn trong
// hệ thống admin (banner 1920×600, logo 400×200, bìa bài viết 1200×630…).
//
// Ý nghĩa các trường:
//   idealW / idealH  — kích thước nên dùng, hiển thị trong gợi ý.
//   minW   / minH    — ngưỡng sàn; nhỏ hơn sẽ cảnh báo "có thể bị mờ".
//   ratio  = [w, h]  — tỉ lệ khung hiển thị mong muốn; lệch quá ratioTolerance
//                      sẽ cảnh báo "sai tỉ lệ" (web cắt xén hoặc thêm viền).
//   ratio  = null    — không ràng buộc tỉ lệ (logo, ảnh tự do, ảnh dọc).

export const IMAGE_RECO = {
  // Ảnh sản phẩm: web để khung vuông 1:1, tải 1200px, có zoom 2.5× → cần vuông & lớn.
  productImage: { idealW: 1200, idealH: 1200, minW: 800, minH: 800, ratio: [1, 1], ratioTolerance: 0.12 },
  // Ảnh danh mục: vuông ~400×400.
  categoryImage: { idealW: 400, idealH: 400, minW: 300, minH: 300, ratio: [1, 1], ratioTolerance: 0.15 },
  // Banner ngang rộng (hãng/danh mục/hero): ~1920×600.
  bannerWide: { idealW: 1920, idealH: 600, minW: 1280, minH: 360, ratio: [16, 5], ratioTolerance: 0.2 },
  // Banner mobile: ảnh dọc hoặc vuông ~768×900 — không khóa tỉ lệ.
  bannerMobile: { idealW: 768, idealH: 900, minW: 600, minH: 600, ratio: null },
  // Slider trang chủ desktop: ~1920×800.
  sliderDesktop: { idealW: 1920, idealH: 800, minW: 1280, minH: 500, ratio: [12, 5], ratioTolerance: 0.2 },
  // Logo: tỉ lệ tự do (vuông hoặc ngang), nên dùng PNG nền trong ~400×200.
  logo: { idealW: 400, idealH: 200, minW: 200, minH: 100, ratio: null },
  // Ảnh bìa bài viết / OG mạng xã hội: ~1200×630 (tỉ lệ 1.91:1).
  cover: { idealW: 1200, idealH: 630, minW: 800, minH: 420, ratio: [1200, 630], ratioTolerance: 0.15 },
  // Ảnh khuyến mãi ngang: ~1200×400.
  promo: { idealW: 1200, idealH: 400, minW: 800, minH: 260, ratio: [3, 1], ratioTolerance: 0.2 },
  // Ảnh vuông/dọc cỡ trung (ảnh sản phẩm trong bài viết): ~800×800, tỉ lệ tự do.
  squareMedium: { idealW: 800, idealH: 800, minW: 500, minH: 500, ratio: null },
  // Ảnh minh hoạ nền trong (hero illustration): ~700×600, tỉ lệ tự do.
  illustration: { idealW: 700, idealH: 600, minW: 400, minH: 360, ratio: null },
  // Ảnh thu nhỏ video: 16:9, ~1280×720.
  videoThumb: { idealW: 1280, idealH: 720, minW: 854, minH: 480, ratio: [16, 9], ratioTolerance: 0.1 },
  // File video: 16:9, ~1280×720 trở lên.
  video: { idealW: 1280, idealH: 720, minW: 854, minH: 480, ratio: [16, 9], ratioTolerance: 0.12 },
  // Ảnh chèn vào nội dung / ảnh chung chưa rõ vị trí: chỉ nhắc ngưỡng tối thiểu, tỉ lệ tự do.
  general: { idealW: 1200, idealH: 800, minW: 600, minH: 400, ratio: null },
}

// So kích thước thực tế của ảnh với spec khuyến nghị.
// Trả về null nếu đạt; hoặc mảng lý do: 'tooSmall' | 'wrongRatio'.
export function evaluateImageDimensions(width, height, spec) {
  if (!width || !height || !spec) return null
  const reasons = []
  if ((spec.minW && width < spec.minW) || (spec.minH && height < spec.minH)) {
    reasons.push('tooSmall')
  }
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
