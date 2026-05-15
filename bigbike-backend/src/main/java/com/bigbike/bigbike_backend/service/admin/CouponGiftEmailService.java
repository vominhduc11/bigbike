package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.persistence.entity.coupon.CouponEntity;
import com.bigbike.bigbike_backend.persistence.entity.customer.CustomerEntity;
import com.bigbike.bigbike_backend.service.email.EmailDispatchService;
import java.math.BigDecimal;
import java.text.NumberFormat;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.thymeleaf.context.Context;

@Service
@RequiredArgsConstructor
public class CouponGiftEmailService {

    private static final NumberFormat VND = NumberFormat.getNumberInstance(new Locale("vi", "VN"));

    private final EmailDispatchService emailDispatch;

    @Value("${bigbike.site.base-url:https://bigbike.vn}")
    private String siteBaseUrl;

    @Async
    public void sendGiftEmail(CustomerEntity customer, CouponEntity coupon) {
        if (!emailDispatch.isEnabled()) return;

        String discountLabel = "PERCENT".equals(coupon.getDiscountType())
                ? coupon.getAmount().stripTrailingZeros().toPlainString() + "%"
                : VND.format(coupon.getAmount().longValue()) + " VND";

        String customerName = displayName(customer);

        Context ctx = new Context();
        ctx.setVariable("customerName", customerName);
        ctx.setVariable("couponCode", coupon.getCode());
        ctx.setVariable("discountLabel", discountLabel);
        ctx.setVariable("hasMinAmount",
                coupon.getMinAmount() != null && coupon.getMinAmount().compareTo(BigDecimal.ZERO) > 0);
        ctx.setVariable("minAmountFormatted",
                coupon.getMinAmount() != null ? VND.format(coupon.getMinAmount().longValue()) + " VND" : "");
        ctx.setVariable("hasExpiry", coupon.getExpiresAt() != null);
        ctx.setVariable("expiresAt", coupon.getExpiresAt());
        ctx.setVariable("shopUrl", siteBaseUrl);

        emailDispatch.send(
                customer.getEmail(),
                "[BigBike] Mã giảm giá dành riêng cho bạn: " + coupon.getCode(),
                "coupon-gift",
                ctx);
    }

    private static String displayName(CustomerEntity c) {
        if (c.getDisplayName() != null && !c.getDisplayName().isBlank()) return c.getDisplayName();
        if (c.getEmail() != null) return c.getEmail();
        return "Khách hàng";
    }
}
