package com.bigbike.bigbike_backend.service.checkout;

import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderEntity;
import com.bigbike.bigbike_backend.service.email.EmailDispatchService;
import java.math.BigDecimal;
import java.text.NumberFormat;
import java.util.Locale;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.thymeleaf.context.Context;

@Service
@Slf4j
public class OrderNotificationService {

    private static final NumberFormat VND = NumberFormat.getNumberInstance(new Locale("vi", "VN"));

    /** Statuses that customers care enough about to receive an email notification. */
    private static final Set<String> CUSTOMER_NOTIFIABLE_STATUSES =
            Set.of("PROCESSING", "COMPLETED", "CANCELLED");

    private final EmailDispatchService emailDispatch;
    private final String adminEmail;
    private final String adminBaseUrl;
    private final String siteBaseUrl;

    public OrderNotificationService(
            EmailDispatchService emailDispatch,
            @Value("${bigbike.mail.admin:info@bigbike.vn}") String adminEmail,
            @Value("${bigbike.admin.base-url:https://admin.bigbike.vn}") String adminBaseUrl,
            @Value("${bigbike.site.base-url:https://bigbike.vn}") String siteBaseUrl) {
        this.emailDispatch = emailDispatch;
        this.adminEmail = adminEmail;
        this.adminBaseUrl = adminBaseUrl;
        this.siteBaseUrl = siteBaseUrl;
    }

    // ── Customer: order confirmation ──────────────────────────────────────────

    @Async
    public void sendOrderConfirmation(OrderEntity order, String paymentMethod) {
        String customerEmail = order.getCustomerEmail();
        if (customerEmail == null || customerEmail.isBlank()) {
            log.debug("Order {} has no customer email — confirmation skipped.", order.getOrderNumber());
            return;
        }
        if (!emailDispatch.isEnabled()) {
            log.info("Mail not configured — order confirmation skipped for order {}.", order.getOrderNumber());
            return;
        }

        Context ctx = new Context();
        ctx.setVariable("customerName", safeCustomerName(order));
        ctx.setVariable("orderNumber", order.getOrderNumber());
        ctx.setVariable("totalFormatted", formatVnd(order.getTotalAmount()));
        ctx.setVariable("hasPayment", paymentMethod != null && !paymentMethod.isBlank());
        ctx.setVariable("paymentLabel", paymentLabel(paymentMethod));
        ctx.setVariable("isCod", "COD".equalsIgnoreCase(paymentMethod));
        ctx.setVariable("isBacs", "BACS".equalsIgnoreCase(paymentMethod));
        ctx.setVariable("orderUrl", siteBaseUrl + "/don-hang/xac-nhan"
                + "?so=" + order.getOrderNumber() + "&key=" + order.getOrderKey());

        emailDispatch.send(
                customerEmail,
                "[BigBike] Xác nhận đơn hàng #" + order.getOrderNumber(),
                "order-confirmation",
                ctx);

        log.info("Order confirmation sent for order {}.", order.getOrderNumber());
    }

    // ── Admin: new order notification ─────────────────────────────────────────

    @Async
    public void sendAdminNewOrderNotification(OrderEntity order, String paymentMethod) {
        if (!emailDispatch.isEnabled()) return;

        Context ctx = new Context();
        ctx.setVariable("orderNumber", order.getOrderNumber());
        ctx.setVariable("customerName", safeCustomerName(order));
        ctx.setVariable("customerEmail", order.getCustomerEmail());
        ctx.setVariable("customerPhone", order.getCustomerPhone());
        ctx.setVariable("totalFormatted", formatVnd(order.getTotalAmount()));
        ctx.setVariable("hasPayment", paymentMethod != null && !paymentMethod.isBlank());
        ctx.setVariable("paymentLabel", paymentLabel(paymentMethod));
        ctx.setVariable("source", order.getSource() != null ? order.getSource() : "WEB");
        ctx.setVariable("adminOrderUrl", adminBaseUrl + "/orders/" + order.getId());

        emailDispatch.send(
                adminEmail,
                "[BigBike] Đơn hàng mới #" + order.getOrderNumber() + " — " + formatVnd(order.getTotalAmount()),
                "admin-new-order",
                ctx);
    }

    // ── Customer: order status update ─────────────────────────────────────────

    @Async
    public void sendOrderStatusUpdate(OrderEntity order, String newStatus) {
        if (!CUSTOMER_NOTIFIABLE_STATUSES.contains(newStatus)) return;

        String customerEmail = order.getCustomerEmail();
        if (customerEmail == null || customerEmail.isBlank()) return;
        if (!emailDispatch.isEnabled()) return;

        StatusContent content = buildStatusContent(newStatus);

        Context ctx = new Context();
        ctx.setVariable("customerName", safeCustomerName(order));
        ctx.setVariable("orderNumber", order.getOrderNumber());
        ctx.setVariable("totalFormatted", formatVnd(order.getTotalAmount()));
        ctx.setVariable("statusLabel", content.label());
        ctx.setVariable("badgeColor", content.badgeColor());
        ctx.setVariable("badgeTextColor", content.badgeTextColor());
        ctx.setVariable("headline", content.headline());
        ctx.setVariable("bodyText", content.bodyText());
        ctx.setVariable("orderUrl", siteBaseUrl + "/don-hang/xac-nhan"
                + "?so=" + order.getOrderNumber() + "&key=" + order.getOrderKey());

        emailDispatch.send(
                customerEmail,
                "[BigBike] " + content.subjectPrefix() + " #" + order.getOrderNumber(),
                "order-status-update",
                ctx);

        log.info("Order status update ({}) sent for order {}.", newStatus, order.getOrderNumber());
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static String safeCustomerName(OrderEntity order) {
        // Chào bằng TÊN khách khi đơn có tên (AUD-052) — email/SĐT chỉ là dự phòng.
        if (order.getCustomerName() != null && !order.getCustomerName().isBlank()) {
            return order.getCustomerName();
        }
        if (order.getCustomerEmail() != null && !order.getCustomerEmail().isBlank()) {
            return order.getCustomerEmail();
        }
        if (order.getCustomerPhone() != null && !order.getCustomerPhone().isBlank()) {
            return order.getCustomerPhone();
        }
        return "Khách hàng";
    }

    private static String formatVnd(BigDecimal amount) {
        if (amount == null) return "—";
        return VND.format(amount.toBigIntegerExact()) + " VND";
    }

    private static String paymentLabel(String method) {
        if (method == null) return "—";
        return switch (method.toUpperCase(Locale.ROOT)) {
            case "COD"  -> "Thanh toán khi nhận hàng (COD)";
            case "BANK_TRANSFER" -> "Chuyển khoản ngân hàng";
            case "BACS" -> "Chuyển khoản ngân hàng";
            default     -> method;
        };
    }

    private record StatusContent(
            String label, String badgeColor, String badgeTextColor,
            String headline, String bodyText, String subjectPrefix) {}

    private static StatusContent buildStatusContent(String status) {
        return switch (status) {
            case "PROCESSING" -> new StatusContent(
                    "ĐANG XỬ LÝ", "#dbeafe", "#1e40af",
                    "Đơn hàng đang được xử lý",
                    "Chúng tôi đã nhận và đang chuẩn bị đơn hàng của bạn. Bạn sẽ được thông báo khi đơn hàng hoàn thành.",
                    "Đơn hàng đang xử lý");
            case "COMPLETED" -> new StatusContent(
                    "HOÀN THÀNH", "#dcfce7", "#166534",
                    "Đơn hàng đã hoàn thành!",
                    "Đơn hàng của bạn đã được giao thành công. Cảm ơn bạn đã tin tưởng BigBike!",
                    "Đơn hàng hoàn thành");
            // Không hứa mốc thời gian hoàn tiền: luồng refund đã gỡ (2026-06-23) — tiền
            // được shop đối soát/hoàn thủ công ngoài hệ thống (AUD-006).
            case "CANCELLED" -> new StatusContent(
                    "ĐÃ HỦY", "#fee2e2", "#991b1b",
                    "Đơn hàng đã bị hủy",
                    "Đơn hàng của bạn đã được hủy. Nếu bạn đã thanh toán, BigBike sẽ chủ động liên hệ để hoàn lại tiền cho bạn. Cần hỗ trợ ngay, vui lòng gọi hotline 0906.902.404.",
                    "Đơn hàng bị hủy");
            default -> new StatusContent(
                    status, "#f3f4f6", "#374151",
                    "Cập nhật đơn hàng",
                    "Trạng thái đơn hàng của bạn đã được cập nhật.",
                    "Cập nhật đơn hàng");
        };
    }
}
