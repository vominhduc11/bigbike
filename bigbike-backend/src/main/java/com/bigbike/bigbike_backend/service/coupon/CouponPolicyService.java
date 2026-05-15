package com.bigbike.bigbike_backend.service.coupon;

import com.bigbike.bigbike_backend.api.error.ConflictException;
import com.bigbike.bigbike_backend.persistence.entity.coupon.CouponEntity;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.Locale;
import org.springframework.stereotype.Service;

@Service
public class CouponPolicyService {

    public String normalizeCode(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new ConflictException("Mã giảm giá không được để trống.");
        }
        return raw.trim().toUpperCase(Locale.ROOT);
    }

    /**
     * Validates that the coupon is allowed for the given customer (UUID string or null for guest).
     * If coupon has a customerId restriction, the caller must be that customer.
     */
    public void validateCustomer(CouponEntity coupon, String callerCustomerId) {
        if (coupon.getCustomerId() == null) return;
        if (callerCustomerId == null || callerCustomerId.isBlank()) {
            throw new ConflictException("Mã giảm giá này chỉ dành cho khách hàng đã đăng ký.");
        }
        try {
            if (!coupon.getCustomerId().equals(java.util.UUID.fromString(callerCustomerId))) {
                throw new ConflictException("Mã giảm giá này không áp dụng cho tài khoản của bạn.");
            }
        } catch (IllegalArgumentException e) {
            throw new ConflictException("Mã giảm giá này không áp dụng cho tài khoản của bạn.");
        }
    }

    /**
     * Validates that the coupon is allowed on the given sales channel.
     * channel: "ONLINE" for web/mobile cart, "POS" for point-of-sale.
     */
    public void validateChannel(CouponEntity coupon, String channel) {
        String c = coupon.getChannel() != null ? coupon.getChannel() : "ALL";
        if ("ALL".equals(c)) return;
        if (!c.equals(channel)) {
            if ("POS".equals(c)) {
                throw new ConflictException("Mã giảm giá này chỉ dùng được tại quầy (POS).");
            } else {
                throw new ConflictException("Mã giảm giá này chỉ dùng được khi mua online.");
            }
        }
    }

    /**
     * Validates that a coupon is applicable for the given cart subtotal.
     * Throws ConflictException with a user-facing message if any rule is violated.
     */
    public void validate(CouponEntity coupon, BigDecimal subtotal) {
        Instant now = Instant.now();
        if (!"ACTIVE".equals(coupon.getStatus())) {
            throw new ConflictException("Mã giảm giá không còn hiệu lực.");
        }
        if (coupon.getStartsAt() != null && now.isBefore(coupon.getStartsAt())) {
            throw new ConflictException("Mã giảm giá chưa có hiệu lực.");
        }
        if (coupon.getExpiresAt() != null && now.isAfter(coupon.getExpiresAt())) {
            throw new ConflictException("Mã giảm giá đã hết hạn.");
        }
        if (coupon.getUsageLimit() != null && coupon.getUsageCount() >= coupon.getUsageLimit()) {
            throw new ConflictException("Mã giảm giá đã đạt giới hạn sử dụng.");
        }
        if (coupon.getMinAmount() != null && subtotal.compareTo(coupon.getMinAmount()) < 0) {
            throw new ConflictException("Đơn hàng chưa đạt giá trị tối thiểu để áp dụng mã giảm giá.");
        }
    }

    /**
     * Computes the coupon discount for the given subtotal.
     * Applies maximumAmount cap and ensures discount does not exceed subtotal.
     */
    public BigDecimal computeDiscount(CouponEntity coupon, BigDecimal subtotal) {
        BigDecimal discount;
        if ("PERCENT".equals(coupon.getDiscountType())) {
            discount = subtotal.multiply(coupon.getAmount())
                    .divide(new BigDecimal("100"), 2, RoundingMode.HALF_UP);
        } else {
            discount = coupon.getAmount().setScale(2, RoundingMode.HALF_UP);
        }
        if (coupon.getMaxAmount() != null && discount.compareTo(coupon.getMaxAmount()) > 0) {
            discount = coupon.getMaxAmount().setScale(2, RoundingMode.HALF_UP);
        }
        return discount.compareTo(subtotal) > 0 ? subtotal : discount;
    }
}
