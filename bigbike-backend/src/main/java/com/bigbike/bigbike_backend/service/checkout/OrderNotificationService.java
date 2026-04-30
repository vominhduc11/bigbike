package com.bigbike.bigbike_backend.service.checkout;

import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.returns.ReturnEntity;
import com.bigbike.bigbike_backend.service.email.EmailDispatchService;
import java.math.BigDecimal;
import java.text.NumberFormat;
import java.util.Locale;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.thymeleaf.context.Context;

@Service
public class OrderNotificationService {

    private static final Logger log = LoggerFactory.getLogger(OrderNotificationService.class);
    private static final NumberFormat VND = NumberFormat.getNumberInstance(new Locale("vi", "VN"));

    /** Statuses that customers care enough about to receive an email notification. */
    private static final Set<String> CUSTOMER_NOTIFIABLE_STATUSES =
            Set.of("PROCESSING", "COMPLETED", "CANCELLED", "REFUNDED", "FAILED");

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
    public void sendOrderStatusUpdate(OrderEntity order, String newStatus, String customerVisibleNote) {
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
        ctx.setVariable("hasNote", customerVisibleNote != null && !customerVisibleNote.isBlank());
        ctx.setVariable("note", customerVisibleNote);
        ctx.setVariable("orderUrl", siteBaseUrl + "/don-hang/xac-nhan"
                + "?so=" + order.getOrderNumber() + "&key=" + order.getOrderKey());

        emailDispatch.send(
                customerEmail,
                "[BigBike] " + content.subjectPrefix() + " #" + order.getOrderNumber(),
                "order-status-update",
                ctx);

        log.info("Order status update ({}) sent for order {}.", newStatus, order.getOrderNumber());
    }

    // ── Return notifications ──────────────────────────────────────────────────

    public void sendReturnReceived(ReturnEntity ret, String customerEmail, String orderNumber) {
        if (customerEmail == null || customerEmail.isBlank()) return;
        if (!emailDispatch.isEnabled()) {
            log.info("Mail not configured — return-received notification skipped for {}.", ret.getReturnNumber());
            return;
        }
        Context ctx = new Context();
        ctx.setVariable("customerName", customerEmail);
        ctx.setVariable("returnNumber", ret.getReturnNumber());
        ctx.setVariable("orderNumber", orderNumber);
        ctx.setVariable("reasonLabel", reasonLabel(ret.getReason()));
        ctx.setVariable("returnsUrl", siteBaseUrl + "/tai-khoan/doi-tra");
        emailDispatch.send(customerEmail,
                "[BigBike] Đã nhận yêu cầu đổi trả " + ret.getReturnNumber(),
                "return-received", ctx);
    }

    public void sendReturnApproved(ReturnEntity ret, String customerEmail, String orderNumber) {
        if (customerEmail == null || customerEmail.isBlank()) return;
        if (!emailDispatch.isEnabled()) return;
        Context ctx = new Context();
        ctx.setVariable("customerName", customerEmail);
        ctx.setVariable("returnNumber", ret.getReturnNumber());
        ctx.setVariable("orderNumber", orderNumber);
        ctx.setVariable("hasAdminNote", ret.getAdminNote() != null && !ret.getAdminNote().isBlank());
        ctx.setVariable("adminNote", ret.getAdminNote());
        ctx.setVariable("returnsUrl", siteBaseUrl + "/tai-khoan/doi-tra");
        emailDispatch.send(customerEmail,
                "[BigBike] Yêu cầu đổi trả " + ret.getReturnNumber() + " đã được duyệt",
                "return-approved", ctx);
    }

    public void sendReturnRejected(ReturnEntity ret, String customerEmail, String orderNumber) {
        if (customerEmail == null || customerEmail.isBlank()) return;
        if (!emailDispatch.isEnabled()) return;
        Context ctx = new Context();
        ctx.setVariable("customerName", customerEmail);
        ctx.setVariable("returnNumber", ret.getReturnNumber());
        ctx.setVariable("orderNumber", orderNumber);
        ctx.setVariable("hasAdminNote", ret.getAdminNote() != null && !ret.getAdminNote().isBlank());
        ctx.setVariable("adminNote", ret.getAdminNote());
        ctx.setVariable("returnsUrl", siteBaseUrl + "/tai-khoan/doi-tra");
        emailDispatch.send(customerEmail,
                "[BigBike] Yêu cầu đổi trả " + ret.getReturnNumber() + " không được chấp thuận",
                "return-rejected", ctx);
    }

    public void sendReturnRefunded(ReturnEntity ret, String customerEmail, String orderNumber) {
        if (customerEmail == null || customerEmail.isBlank()) return;
        if (!emailDispatch.isEnabled()) return;
        Context ctx = new Context();
        ctx.setVariable("customerName", customerEmail);
        ctx.setVariable("returnNumber", ret.getReturnNumber());
        ctx.setVariable("orderNumber", orderNumber);
        ctx.setVariable("refundFormatted", formatVnd(ret.getRefundAmount()));
        ctx.setVariable("returnsUrl", siteBaseUrl + "/tai-khoan/doi-tra");
        emailDispatch.send(customerEmail,
                "[BigBike] Hoàn tiền " + formatVnd(ret.getRefundAmount()) + " — " + ret.getReturnNumber(),
                "return-refunded", ctx);
    }

    public void sendReturnGoodsReceived(ReturnEntity ret, String customerEmail, String orderNumber) {
        if (customerEmail == null || customerEmail.isBlank()) return;
        if (!emailDispatch.isEnabled()) {
            log.info("Mail not configured — return-goods-received notification skipped for {}.", ret.getReturnNumber());
            return;
        }
        Context ctx = new Context();
        ctx.setVariable("customerName", customerEmail);
        ctx.setVariable("returnNumber", ret.getReturnNumber());
        ctx.setVariable("orderNumber", orderNumber);
        ctx.setVariable("returnsUrl", siteBaseUrl + "/tai-khoan/doi-tra");
        emailDispatch.send(customerEmail,
                "[BigBike] BigBike đã nhận hàng trả — " + ret.getReturnNumber(),
                "return-goods-received", ctx);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static String safeCustomerName(OrderEntity order) {
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

    private static String reasonLabel(String reason) {
        if (reason == null) return "Khác";
        return switch (reason.toUpperCase(Locale.ROOT)) {
            case "DEFECTIVE"        -> "Hàng bị lỗi";
            case "WRONG_ITEM"       -> "Sai sản phẩm";
            case "NOT_AS_DESCRIBED" -> "Không như mô tả";
            case "CHANGED_MIND"     -> "Đổi ý";
            default                 -> "Khác";
        };
    }

    private static String paymentLabel(String method) {
        if (method == null) return "—";
        return switch (method.toUpperCase(Locale.ROOT)) {
            case "COD"  -> "Thanh toán khi nhận hàng (COD)";
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
                    "Chúng tôi đã nhận và đang chuẩn bị đơn hàng của bạn. Bạn sẽ được thông báo khi hàng được giao cho đơn vị vận chuyển.",
                    "Đơn hàng đang xử lý");
            case "COMPLETED" -> new StatusContent(
                    "HOÀN THÀNH", "#dcfce7", "#166534",
                    "Đơn hàng đã hoàn thành!",
                    "Đơn hàng của bạn đã được giao thành công. Cảm ơn bạn đã tin tưởng BigBike!",
                    "Đơn hàng hoàn thành");
            case "CANCELLED" -> new StatusContent(
                    "ĐÃ HỦY", "#fee2e2", "#991b1b",
                    "Đơn hàng đã bị hủy",
                    "Đơn hàng của bạn đã được hủy. Nếu bạn đã thanh toán, chúng tôi sẽ hoàn tiền trong vòng 3–5 ngày làm việc.",
                    "Đơn hàng bị hủy");
            case "REFUNDED" -> new StatusContent(
                    "ĐÃ HOÀN TIỀN", "#e0f2fe", "#075985",
                    "Hoàn tiền thành công",
                    "Chúng tôi đã xử lý hoàn tiền cho đơn hàng của bạn. Tiền sẽ được trả về tài khoản trong 3–5 ngày làm việc.",
                    "Hoàn tiền đơn hàng");
            case "FAILED" -> new StatusContent(
                    "THẤT BẠI", "#fef9c3", "#854d0e",
                    "Đơn hàng gặp sự cố",
                    "Rất tiếc, đơn hàng của bạn không thể được xử lý. Vui lòng liên hệ hotline 0906.902.404 để được hỗ trợ.",
                    "Đơn hàng thất bại");
            default -> new StatusContent(
                    status, "#f3f4f6", "#374151",
                    "Cập nhật đơn hàng",
                    "Trạng thái đơn hàng của bạn đã được cập nhật.",
                    "Cập nhật đơn hàng");
        };
    }
}
