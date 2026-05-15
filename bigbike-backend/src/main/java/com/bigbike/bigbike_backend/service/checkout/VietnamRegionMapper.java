package com.bigbike.bigbike_backend.service.checkout;

import java.util.Map;
import java.util.Set;

/**
 * Maps Vietnamese province names to region codes (MB/MT/MN).
 * Province names must match exactly what is stored in order shipping addresses
 * (sourced from vn-address-data.ts on the frontend).
 */
final class VietnamRegionMapper {

    static final Set<String> KNOWN_REGION_CODES = Set.of("MB", "MT", "MN");

    private static final Map<String, String> PROVINCE_TO_REGION = Map.ofEntries(
            // ── Miền Bắc ──────────────────────────────────────────────────────
            Map.entry("Hà Nội",         "MB"),
            Map.entry("Hà Giang",       "MB"),
            Map.entry("Cao Bằng",       "MB"),
            Map.entry("Bắc Kạn",        "MB"),
            Map.entry("Tuyên Quang",    "MB"),
            Map.entry("Lào Cai",        "MB"),
            Map.entry("Điện Biên",      "MB"),
            Map.entry("Lai Châu",       "MB"),
            Map.entry("Sơn La",         "MB"),
            Map.entry("Yên Bái",        "MB"),
            Map.entry("Hoà Bình",       "MB"),
            Map.entry("Thái Nguyên",    "MB"),
            Map.entry("Lạng Sơn",       "MB"),
            Map.entry("Quảng Ninh",     "MB"),
            Map.entry("Bắc Giang",      "MB"),
            Map.entry("Phú Thọ",        "MB"),
            Map.entry("Vĩnh Phúc",      "MB"),
            Map.entry("Bắc Ninh",       "MB"),
            Map.entry("Hải Dương",      "MB"),
            Map.entry("Hải Phòng",      "MB"),
            Map.entry("Hưng Yên",       "MB"),
            Map.entry("Thái Bình",      "MB"),
            Map.entry("Hà Nam",         "MB"),
            Map.entry("Nam Định",       "MB"),
            Map.entry("Ninh Bình",      "MB"),
            // ── Miền Trung ────────────────────────────────────────────────────
            Map.entry("Thanh Hoá",      "MT"),
            Map.entry("Nghệ An",        "MT"),
            Map.entry("Hà Tĩnh",        "MT"),
            Map.entry("Quảng Bình",     "MT"),
            Map.entry("Quảng Trị",      "MT"),
            Map.entry("Thừa Thiên Huế", "MT"),
            Map.entry("Đà Nẵng",        "MT"),
            Map.entry("Quảng Nam",      "MT"),
            Map.entry("Quảng Ngãi",     "MT"),
            Map.entry("Bình Định",      "MT"),
            Map.entry("Phú Yên",        "MT"),
            Map.entry("Khánh Hoà",      "MT"),
            Map.entry("Ninh Thuận",     "MT"),
            Map.entry("Bình Thuận",     "MT"),
            Map.entry("Kon Tum",        "MT"),
            Map.entry("Gia Lai",        "MT"),
            Map.entry("Đắk Lắk",       "MT"),
            Map.entry("Đắk Nông",       "MT"),
            Map.entry("Lâm Đồng",       "MT"),
            // ── Miền Nam ──────────────────────────────────────────────────────
            Map.entry("Bình Phước",         "MN"),
            Map.entry("Tây Ninh",           "MN"),
            Map.entry("Bình Dương",         "MN"),
            Map.entry("Đồng Nai",           "MN"),
            Map.entry("Bà Rịa - Vũng Tàu", "MN"),
            Map.entry("TP. Hồ Chí Minh",   "MN"),
            Map.entry("Long An",            "MN"),
            Map.entry("Tiền Giang",         "MN"),
            Map.entry("Bến Tre",            "MN"),
            Map.entry("Trà Vinh",           "MN"),
            Map.entry("Vĩnh Long",          "MN"),
            Map.entry("Đồng Tháp",          "MN"),
            Map.entry("An Giang",           "MN"),
            Map.entry("Kiên Giang",         "MN"),
            Map.entry("Cần Thơ",            "MN"),
            Map.entry("Hậu Giang",          "MN"),
            Map.entry("Sóc Trăng",          "MN"),
            Map.entry("Bạc Liêu",           "MN"),
            Map.entry("Cà Mau",             "MN")
    );

    private VietnamRegionMapper() {}

    /** Returns region code for the given province name, or null if unknown. */
    static String getRegion(String provinceName) {
        if (provinceName == null || provinceName.isBlank()) return null;
        return PROVINCE_TO_REGION.get(provinceName.trim());
    }
}
