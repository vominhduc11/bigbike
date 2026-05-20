const MB_PROVINCES = new Set([
  "Hà Nội", "Hải Phòng", "Quảng Ninh", "Bắc Ninh", "Bắc Giang", "Bắc Kạn",
  "Thái Nguyên", "Cao Bằng", "Lạng Sơn", "Lào Cai", "Yên Bái", "Hà Giang",
  "Tuyên Quang", "Phú Thọ", "Vĩnh Phúc", "Hòa Bình", "Sơn La", "Điện Biên",
  "Lai Châu", "Hà Nam", "Nam Định", "Ninh Bình", "Thái Bình", "Hải Dương", "Hưng Yên",
]);

const MT_PROVINCES = new Set([
  "Đà Nẵng", "Thanh Hóa", "Nghệ An", "Hà Tĩnh", "Quảng Bình", "Quảng Trị",
  "Thừa Thiên Huế", "Quảng Nam", "Quảng Ngãi", "Bình Định", "Phú Yên",
  "Khánh Hòa", "Ninh Thuận", "Bình Thuận", "Kon Tum", "Gia Lai",
  "Đắk Lắk", "Đắk Nông", "Lâm Đồng",
]);

export function getVietnamRegion(province: string): "MB" | "MT" | "MN" | null {
  if (!province) return null;
  if (MB_PROVINCES.has(province)) return "MB";
  if (MT_PROVINCES.has(province)) return "MT";
  return "MN";
}
