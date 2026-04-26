/* Sample catalog / content data for Bigbike UI kit */

const BB_CATEGORIES = [
  { id: "helmet",   name: "Mũ bảo hiểm",  icon: "../../assets/icons/bigbike-icon-01.svg" },
  { id: "jacket",   name: "Áo giáp",      icon: "../../assets/icons/bigbike-icon-03.svg" },
  { id: "gloves",   name: "Găng tay",     icon: "../../assets/icons/bigbike-icon-05.svg" },
  { id: "boots",    name: "Giày moto",    icon: "../../assets/icons/bigbike-icon-07.svg" },
  { id: "intercom", name: "Intercom",     icon: "../../assets/icons/bigbike-icon-09.svg" },
  { id: "touring",  name: "Phụ kiện touring", icon: "../../assets/icons/bigbike-icon-11.svg" },
];

const BB_BRANDS = ["LS2", "Alpinestars", "Scoyco", "Sena", "Furygan", "Helite", "AGV", "Shoei", "Arai", "Shark"];

const BB_PRODUCTS = [
  { id: 1, brand: "LS2", name: "LS2 MX436 Pioneer Dual Sport",    category: "Mũ bảo hiểm", price: 2590000, old: 3240000, rating: 4.8, reviews: 42, stock: "in",    tag: "-20%" },
  { id: 2, brand: "Alpinestars", name: "Alpinestars GP Plus R V4", category: "Áo giáp",    price: 12850000, old: null, rating: 5.0, reviews: 18, stock: "low",   tag: "NEW" },
  { id: 3, brand: "Scoyco", name: "Scoyco MC08 Găng Tay Touring", category: "Găng tay",    price: 420000,  old: 520000, rating: 4.6, reviews: 87, stock: "in",    tag: "-19%" },
  { id: 4, brand: "Sena",   name: "Sena 50S Mesh Intercom",        category: "Intercom",    price: 8490000, old: null, rating: 4.9, reviews: 31, stock: "in",    tag: "HOT" },
  { id: 5, brand: "Furygan", name: "Furygan Brevent 3in1 Jacket",  category: "Áo bảo hộ",  price: 6980000, old: 8200000, rating: 4.7, reviews: 12, stock: "in",    tag: "-15%" },
  { id: 6, brand: "Alpinestars", name: "Alpinestars SMX-6 V2 Vented", category: "Giày moto", price: 7450000, old: null, rating: 4.8, reviews: 22, stock: "preorder" },
  { id: 7, brand: "Helite", name: "Helite Turtle 2 Airbag Vest",    category: "Áo giáp",    price: 14200000, old: null, rating: 5.0, reviews: 6,  stock: "in",   tag: "SAFETY" },
  { id: 8, brand: "LS2",    name: "LS2 FF353 Rapid Solid",          category: "Mũ bảo hiểm", price: 1690000, old: 1890000, rating: 4.5, reviews: 134, stock: "out" },
];

const BB_HERO_SLIDES = [
  {
    kicker: "HOT OFFER · 20% OFF",
    title: "Gear Up.\nDon't Let Behind.",
    sub: "Mũ bảo hiểm, áo giáp, giày moto chính hãng từ LS2, Alpinestars, Furygan — đồng hành cùng rider Việt Nam từ 2013.",
    cta: "Khám phá bộ sưu tập",
    mascot: "../../assets/logo/bigbike-logo-primary.png",
  },
  {
    kicker: "SALE BỘ SƯU TẬP LS2",
    title: "LS2 MX436\nPioneer — 20% OFF",
    sub: "Mũ bảo hiểm dual sport bán chạy nhất, đạt chuẩn ECE 22.05. Chỉ còn 5 ngày, hàng tồn kho TP.HCM.",
    cta: "Mua ngay · 2.590.000 ₫",
    mascot: "../../assets/logo/bigbike-logo-primary.png",
  },
  {
    kicker: "TOURING SUMMER 26",
    title: "Sẵn Sàng Cho\nMọi Hành Trình",
    sub: "Intercom Sena, airbag Helite, giày Alpinestars — gear đủ khoản để rider đi xa, về an toàn.",
    cta: "Tư vấn tour gear",
    mascot: "../../assets/logo/bigbike-logo-primary.png",
  },
];

const BB_ARTICLES = [
  { id: 1, meta: "HƯỚNG DẪN · 25.04.2026", title: "Chọn mũ bảo hiểm đúng size — cheat sheet cho rider Việt", excerpt: "Đo chu vi đầu đúng cách, đối chiếu bảng size LS2 / AGV / Shoei và tránh 3 lỗi phổ biến khi thử mũ tại shop.", img: "../../assets/signage/signage-01.png" },
  { id: 2, meta: "REVIEW · 18.04.2026", title: "Sena 50S — 2 tuần touring Đà Lạt thực chiến", excerpt: "Mesh 2.0 ổn định ở cự ly 2km, pin vẫn trụ 10 tiếng, và 2 điểm cần lưu ý khi đi mưa dầm.", img: "../../assets/signage/signage-05.png" },
  { id: 3, meta: "KIẾN THỨC · 02.04.2026", title: "Airbag vest — có thực sự cần cho rider phổ thông?", excerpt: "So sánh Helite Turtle 2 và Alpinestars Tech-Air, chi phí bảo trì và tình huống mà airbag vest cứu bạn.", img: "../../assets/signage/signage-08.png" },
];

window.BB_CATEGORIES = BB_CATEGORIES;
window.BB_BRANDS = BB_BRANDS;
window.BB_PRODUCTS = BB_PRODUCTS;
window.BB_HERO_SLIDES = BB_HERO_SLIDES;
window.BB_ARTICLES = BB_ARTICLES;

window.formatVnd = function (n) {
  return n.toLocaleString("vi-VN") + " ₫";
};

window.stockLabel = function (s) {
  return {
    in:        { label: "Còn hàng",       cls: "wp-stock-in" },
    low:       { label: "Sắp hết hàng",   cls: "wp-stock-low" },
    out:       { label: "Hết hàng",       cls: "wp-stock-out" },
    preorder:  { label: "Đặt trước",      cls: "wp-stock-preorder" },
    contact:   { label: "Liên hệ tồn kho", cls: "wp-stock-out" },
  }[s] ?? { label: "Đang cập nhật", cls: "wp-stock-out" };
};
