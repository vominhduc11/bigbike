/** Thông tin pháp nhân theo tài liệu của chủ shop ngày 01/10/2026 (POLICY_PAGE_RULE_004). */
export const BUSINESS_IDENTITY = {
  name: "HỘ KINH DOANH BIGBIKE.VN - BẢO HỘ MÔ TÔ",
  representative: "Lý Ngọc Minh Thư",
  registrationNumber: "079190004735",
} as const;

export function getBusinessLicense(locale: string): string {
  const details =
    locale === "en"
      ? "issued on 28 November 2025 by the People's Committee of Hoa Binh Ward"
      : "cấp ngày 28 tháng 11 năm 2025 tại UBND phường Hoà Bình";
  const label = locale === "en" ? "Business Registration No." : "GPKD số";
  return `${label} ${BUSINESS_IDENTITY.registrationNumber} ${details}.`;
}

export function getBusinessRegistration(locale: string): string {
  return `${BUSINESS_IDENTITY.name} — ${getBusinessLicense(locale)}`;
}
