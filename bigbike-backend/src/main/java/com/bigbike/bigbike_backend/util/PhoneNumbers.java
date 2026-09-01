package com.bigbike.bigbike_backend.util;

import java.util.regex.Pattern;

/**
 * Chuẩn hóa số điện thoại Việt Nam để dùng làm khóa nhận diện khách trên mọi luồng.
 *
 * <p>Quy tắc: bỏ mọi ký tự không phải chữ số, quy tiền tố quốc tế {@code +84}/{@code 84}
 * về {@code 0} để hai cách viết cùng một số ({@code 0987654321} và {@code +84987654321})
 * khớp nhau khi tra cứu. Đây là helper chuẩn hóa SĐT đầu tiên của backend.
 */
public final class PhoneNumbers {

    private static final Pattern VIETNAMESE_MOBILE_INPUT =
            Pattern.compile("^\\+?[0-9().\\s-]+$");
    private static final Pattern VIETNAMESE_MOBILE =
            Pattern.compile("^0(?:3|5|7|8|9)\\d{8}$");

    private PhoneNumbers() {}

    /**
     * Trả về dạng chuẩn (đầu số {@code 0}) của một SĐT thô, hoặc {@code null} nếu rỗng/không có chữ số.
     */
    public static String normalize(String raw) {
        if (raw == null) {
            return null;
        }
        String digits = raw.replaceAll("[^0-9]", "");
        if (digits.isEmpty()) {
            return null;
        }
        // +84xxxxxxxxx / 84xxxxxxxxx → 0xxxxxxxxx (SĐT VN sau mã 84 còn 9-10 chữ số)
        if (digits.startsWith("84") && digits.length() >= 11) {
            digits = "0" + digits.substring(2);
        }
        return digits;
    }

    /**
     * Normalizes a customer-registration phone number only when it is an approved
     * Vietnamese mobile display format. The broad {@link #normalize(String)} helper
     * remains available for legacy lookups, where historical data cannot be rejected.
     */
    public static String normalizeVietnameseMobile(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String trimmed = raw.trim();
        if (!VIETNAMESE_MOBILE_INPUT.matcher(trimmed).matches()) {
            return null;
        }
        String normalized = normalize(trimmed);
        return normalized != null && VIETNAMESE_MOBILE.matcher(normalized).matches()
                ? normalized
                : null;
    }

    /**
     * Biến thể dạng quốc tế {@code +84…} của một SĐT đã chuẩn hóa (đầu số {@code 0}),
     * dùng để tra cứu thêm những hồ sơ cũ lỡ lưu theo dạng {@code +84}. Trả về {@code null}
     * nếu không áp dụng được.
     */
    public static String toInternationalVariant(String normalized) {
        if (normalized != null && normalized.startsWith("0") && normalized.length() > 1) {
            return "+84" + normalized.substring(1);
        }
        return null;
    }
}
