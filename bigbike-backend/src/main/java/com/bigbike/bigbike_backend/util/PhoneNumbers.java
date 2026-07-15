package com.bigbike.bigbike_backend.util;

/**
 * Chuẩn hóa số điện thoại Việt Nam để dùng làm khóa nhận diện khách trên mọi luồng.
 *
 * <p>Quy tắc: bỏ mọi ký tự không phải chữ số, quy tiền tố quốc tế {@code +84}/{@code 84}
 * về {@code 0} để hai cách viết cùng một số ({@code 0987654321} và {@code +84987654321})
 * khớp nhau khi tra cứu. Đây là helper chuẩn hóa SĐT đầu tiên của backend.
 */
public final class PhoneNumbers {

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
