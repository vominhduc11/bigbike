import type { PublicMenu } from "@/lib/contracts/public";

export const MOCK_MAIN_MENU: PublicMenu = {
  location: "primary",
  name: "Main menu",
  items: [
    { id: "m1", parentId: null, label: "TRANG CHỦ", url: "/", sortOrder: 0, openInNewTab: false, cssClass: null },
    { id: "m2", parentId: null, label: "SẢN PHẨM", url: "/san-pham/", sortOrder: 1, openInNewTab: false, cssClass: null },
    // Children of SẢN PHẨM
    { id: "m2-1", parentId: "m2", label: "Mũ Bảo Hiểm", url: "/danh-muc-san-pham/non-bao-hiem-moto/", sortOrder: 0, openInNewTab: false, cssClass: null },
    { id: "m2-1-1", parentId: "m2-1", label: "Mũ Fullface", url: "/danh-muc-san-pham/mu-bao-hiem-fullface/", sortOrder: 0, openInNewTab: false, cssClass: null },
    { id: "m2-1-2", parentId: "m2-1", label: "Mũ Lật Hàm", url: "/danh-muc-san-pham/mu-bao-hiem-fullface-lat-ham/", sortOrder: 1, openInNewTab: false, cssClass: null },
    { id: "m2-1-3", parentId: "m2-1", label: "Mũ 3/4", url: "/danh-muc-san-pham/mu-bao-hiem-3-4/", sortOrder: 2, openInNewTab: false, cssClass: null },
    { id: "m2-1-4", parentId: "m2-1", label: "Mũ Cào Cào & Dual Sport", url: "/danh-muc-san-pham/mu-bao-hiem-cao-cao-dual-sport/", sortOrder: 3, openInNewTab: false, cssClass: null },
    { id: "m2-2", parentId: "m2", label: "Áo Quần Bảo Hộ", url: "/danh-muc-san-pham/quan-ao-bao-ho-moto/", sortOrder: 1, openInNewTab: false, cssClass: null },
    { id: "m2-2-1", parentId: "m2-2", label: "Áo Bảo Hộ Vải", url: "/danh-muc-san-pham/ao-bao-ho-vai-textile-jackets-vi/", sortOrder: 0, openInNewTab: false, cssClass: null },
    { id: "m2-2-2", parentId: "m2-2", label: "Áo Airbag", url: "/danh-muc-san-pham/ao-bao-ho-tui-khi/", sortOrder: 1, openInNewTab: false, cssClass: null },
    { id: "m2-2-3", parentId: "m2-2", label: "Áo Da / Liền Quần", url: "/danh-muc-san-pham/ao-lien-quan-alpinestars-vi/", sortOrder: 2, openInNewTab: false, cssClass: null },
    { id: "m2-2-4", parentId: "m2-2", label: "Quần Bảo Hộ", url: "/danh-muc-san-pham/quan-bao-ho-quan-giap-vi/", sortOrder: 3, openInNewTab: false, cssClass: null },
    { id: "m2-3", parentId: "m2", label: "Găng Tay", url: "/danh-muc-san-pham/gang-tay/", sortOrder: 2, openInNewTab: false, cssClass: null },
    { id: "m2-4", parentId: "m2", label: "Giày Bảo Hộ", url: "/danh-muc-san-pham/giay-bao-ho/", sortOrder: 3, openInNewTab: false, cssClass: null },
    { id: "m2-5", parentId: "m2", label: "Giáp Bảo Hộ", url: "/danh-muc-san-pham/giap-bao-ho-tay-chan-dai-lung-phu-kien-giap/", sortOrder: 4, openInNewTab: false, cssClass: null },
    { id: "m2-6", parentId: "m2", label: "Balo & Túi", url: "/danh-muc-san-pham/balo-deo-lung-tui-deo-tui-treo-xe/", sortOrder: 5, openInNewTab: false, cssClass: null },
    { id: "m2-7", parentId: "m2", label: "Tai Nghe Bluetooth", url: "/danh-muc-san-pham/tai-nghe-bluetooth-gan-mu-bao-hiem/", sortOrder: 6, openInNewTab: false, cssClass: null },
    { id: "m2-8", parentId: "m2", label: "Phụ Kiện Đi Mưa", url: "/danh-muc-san-pham/phu-kien-di-mua/", sortOrder: 7, openInNewTab: false, cssClass: null },
    { id: "m3", parentId: null, label: "THƯƠNG HIỆU", url: "/brands/", sortOrder: 2, openInNewTab: false, cssClass: null },
    { id: "m4", parentId: null, label: "TIN TỨC", url: "/tin-tuc/", sortOrder: 3, openInNewTab: false, cssClass: null },
    { id: "m5", parentId: null, label: "LIÊN HỆ", url: "/lien-he/", sortOrder: 4, openInNewTab: false, cssClass: null },
  ],
};

export const MOCK_GUIDE_MENU: PublicMenu = {
  location: "guide",
  name: "Guide menu",
  items: [
    { id: "g1", parentId: null, label: "Hướng dẫn mua hàng", url: "/huong-dan/mua-hang/", sortOrder: 0, openInNewTab: false, cssClass: null },
    { id: "g2", parentId: null, label: "Cách chọn size mũ bảo hiểm", url: "/huong-dan/size-mu/", sortOrder: 1, openInNewTab: false, cssClass: null },
    { id: "g3", parentId: null, label: "Cách chọn size găng tay", url: "/huong-dan/size-gang-tay/", sortOrder: 2, openInNewTab: false, cssClass: null },
    { id: "g4", parentId: null, label: "Cách chọn áo giáp phù hợp", url: "/tin-tuc/", sortOrder: 3, openInNewTab: false, cssClass: null },
  ],
};

export const MOCK_FOOTER_MENU: PublicMenu = {
  location: "footer",
  name: "Footer",
  items: [
    // Nhóm 1: Thông tin
    { id: "f1", parentId: null, label: "Giới thiệu", url: "/gioi-thieu/", sortOrder: 0, openInNewTab: false, cssClass: "footer-about" },
    { id: "f2", parentId: null, label: "Liên hệ", url: "/lien-he/", sortOrder: 1, openInNewTab: false, cssClass: "footer-about" },
    { id: "f3", parentId: null, label: "Tin tức", url: "/tin-tuc/", sortOrder: 2, openInNewTab: false, cssClass: "footer-about" },
    // Nhóm 2: Chính sách
    { id: "f4", parentId: null, label: "Chính sách bảo mật", url: "/chinh-sach/bao-mat/", sortOrder: 3, openInNewTab: false, cssClass: "footer-policy" },
    { id: "f5", parentId: null, label: "Chính sách bảo hành", url: "/chinh-sach/bao-hanh/", sortOrder: 4, openInNewTab: false, cssClass: "footer-policy" },
    { id: "f6", parentId: null, label: "Chính sách đổi trả", url: "/chinh-sach/doi-tra/", sortOrder: 5, openInNewTab: false, cssClass: "footer-policy" },
    { id: "f7", parentId: null, label: "Điều khoản sử dụng", url: "/chinh-sach/dieu-khoan/", sortOrder: 6, openInNewTab: false, cssClass: "footer-policy" },
    // Nhóm 3: Hướng dẫn
    { id: "f8", parentId: null, label: "Hướng dẫn mua hàng", url: "/huong-dan/mua-hang/", sortOrder: 7, openInNewTab: false, cssClass: "footer-guide" },
    { id: "f9", parentId: null, label: "Cách đo size mũ", url: "/huong-dan/size-mu/", sortOrder: 8, openInNewTab: false, cssClass: "footer-guide" },
    { id: "f10", parentId: null, label: "Cách đo size găng tay", url: "/huong-dan/size-gang-tay/", sortOrder: 9, openInNewTab: false, cssClass: "footer-guide" },
  ],
};
