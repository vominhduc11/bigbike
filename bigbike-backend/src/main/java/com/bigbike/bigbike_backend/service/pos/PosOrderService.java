package com.bigbike.bigbike_backend.service.pos;

import com.bigbike.bigbike_backend.api.error.ConflictException;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.StockMovementEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderLineItemEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderNoteEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.payment.PaymentEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductVariantJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.StockMovementJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderLineItemJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderNoteJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.payment.PaymentJpaRepository;
import com.bigbike.bigbike_backend.service.checkout.OrderKeyGenerator;
import com.bigbike.bigbike_backend.service.checkout.OrderNumberGenerator;
import com.bigbike.bigbike_backend.service.inventory.InventoryPolicyService;
import com.bigbike.bigbike_backend.service.ws.AdminOrderWsService;
import com.bigbike.bigbike_backend.service.ws.OrderWsEvent;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PosOrderService {

    public record PosLineItemRequest(
            String productId,
            String productVariantId,
            int quantity,
            BigDecimal unitPriceOverride  // null = dùng giá DB
    ) {}

    public record PosCreateOrderRequest(
            List<PosLineItemRequest> items,
            String customerName,
            String customerPhone,
            String customerNote,
            String paymentMethod,        // CASH | CARD_TERMINAL | BANK_TRANSFER
            Long tenderedAmount,         // Tiền khách đưa (cho CASH), null cho BANK_TRANSFER/CARD
            String staffNote,
            String posIdempotencyKey,    // Client UUID to prevent duplicate submissions
            String cardReferenceNumber   // Optional: mã giao dịch thẻ / terminal ref
    ) {}

    public record PosOrderResponse(
            UUID orderId,
            String orderNumber,
            String status,
            String paymentStatus,
            String paymentMethod,
            BigDecimal totalAmount,
            Long tenderedAmount,
            Long changeAmount,
            String qrVietQrUrl,       // null nếu không phải BANK_TRANSFER
            String transferContent,   // nội dung chuyển khoản (= order number)
            String bankName,
            String accountNumber,
            String accountHolder
    ) {}

    private static final String CHANNEL_IN_STORE = "IN_STORE";
    private static final String FULFILLMENT_IN_STORE = "IN_STORE";

    private final ProductJpaRepository productRepo;
    private final ProductVariantJpaRepository variantRepo;
    private final StockMovementJpaRepository stockMovementRepo;
    private final OrderJpaRepository orderRepo;
    private final OrderLineItemJpaRepository lineItemRepo;
    private final OrderNoteJpaRepository noteRepo;
    private final PaymentJpaRepository paymentRepo;
    private final OrderNumberGenerator orderNumberGenerator;
    private final OrderKeyGenerator orderKeyGenerator;
    private final AdminOrderWsService wsService;
    private final com.bigbike.bigbike_backend.service.payment.sepay.PaymentInfoService paymentInfoService;
    private final InventoryPolicyService inventoryPolicyService;

    public PosOrderService(
            ProductJpaRepository productRepo,
            ProductVariantJpaRepository variantRepo,
            StockMovementJpaRepository stockMovementRepo,
            OrderJpaRepository orderRepo,
            OrderLineItemJpaRepository lineItemRepo,
            OrderNoteJpaRepository noteRepo,
            PaymentJpaRepository paymentRepo,
            OrderNumberGenerator orderNumberGenerator,
            OrderKeyGenerator orderKeyGenerator,
            AdminOrderWsService wsService,
            com.bigbike.bigbike_backend.service.payment.sepay.PaymentInfoService paymentInfoService,
            InventoryPolicyService inventoryPolicyService
    ) {
        this.productRepo = productRepo;
        this.variantRepo = variantRepo;
        this.stockMovementRepo = stockMovementRepo;
        this.orderRepo = orderRepo;
        this.lineItemRepo = lineItemRepo;
        this.noteRepo = noteRepo;
        this.paymentRepo = paymentRepo;
        this.orderNumberGenerator = orderNumberGenerator;
        this.orderKeyGenerator = orderKeyGenerator;
        this.wsService = wsService;
        this.paymentInfoService = paymentInfoService;
        this.inventoryPolicyService = inventoryPolicyService;
    }

    @Transactional
    public PosOrderResponse createOrder(PosCreateOrderRequest req, String staffId) {
        if (req.items() == null || req.items().isEmpty()) {
            throw new ConflictException("POS order must have at least one item.");
        }
        validatePaymentMethod(req.paymentMethod());

        // Idempotency: return existing order if client retries with same key
        if (req.posIdempotencyKey() != null && !req.posIdempotencyKey().isBlank()) {
            var existing = orderRepo.findByOrderKey(req.posIdempotencyKey());
            if (existing.isPresent()) {
                OrderEntity found = existing.get();
                Long changeAmt = null;
                if ("CASH".equals(found.getPaymentMethod()) && req.tenderedAmount() != null) {
                    changeAmt = req.tenderedAmount() - found.getTotalAmount().setScale(0, RoundingMode.HALF_UP).longValue();
                }
                String qrUrl = null; String transferContent = null;
                String bankName = null; String accountNumber = null; String accountHolder = null;
                if ("BANK_TRANSFER".equals(found.getPaymentMethod())) {
                    var info = paymentInfoService.getPaymentInfo(found.getId());
                    qrUrl = info.qrVietQrUrl(); transferContent = info.transferContent();
                    bankName = info.bankName(); accountNumber = info.accountNumber(); accountHolder = info.accountHolder();
                }
                return new PosOrderResponse(
                        found.getId(), found.getOrderNumber(), found.getStatus(), found.getPaymentStatus(),
                        found.getPaymentMethod(), found.getTotalAmount(), req.tenderedAmount(), changeAmt,
                        qrUrl, transferContent, bankName, accountNumber, accountHolder);
            }
        }

        Instant now = Instant.now();
        List<OrderLineItemEntity> lineItems = new ArrayList<>();
        BigDecimal subtotal = BigDecimal.ZERO;

        for (PosLineItemRequest item : req.items()) {
            ProductEntity product = productRepo.findByIdForUpdate(item.productId())
                    .orElseThrow(() -> new NotFoundException("Product not found: " + item.productId()));

            ProductVariantEntity variant = null;
            if (item.productVariantId() != null && !item.productVariantId().isBlank()) {
                variant = variantRepo.findByIdForUpdate(item.productVariantId())
                        .orElseThrow(() -> new NotFoundException("Variant not found: " + item.productVariantId()));
                if (variant.getQuantityOnHand() < item.quantity()) {
                    throw new ConflictException("Sản phẩm '" + product.getName() + "' chỉ còn "
                            + variant.getQuantityOnHand() + " trong kho.");
                }
            }

            BigDecimal unitPrice = item.unitPriceOverride() != null
                    ? item.unitPriceOverride().setScale(2, RoundingMode.HALF_UP)
                    : resolvePrice(product, variant);
            BigDecimal lineTotal = unitPrice.multiply(BigDecimal.valueOf(item.quantity()))
                    .setScale(2, RoundingMode.HALF_UP);
            subtotal = subtotal.add(lineTotal);

            OrderLineItemEntity li = new OrderLineItemEntity();
            li.setProductId(tryParseUUID(product.getId()));
            li.setProductVariantId(variant != null ? tryParseUUID(variant.getId()) : null);
            li.setSku(variant != null ? variant.getSku() : product.getSku());
            li.setProductName(product.getName());
            li.setVariantName(variant != null ? variant.getName() : null);
            li.setQuantity(item.quantity());
            li.setUnitPrice(unitPrice);
            li.setRegularPrice(product.getRetailPrice());
            li.setSalePrice(product.getSalePrice());
            li.setLineSubtotal(lineTotal);
            li.setLineDiscount(BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP));
            li.setLineTax(BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP));
            li.setLineTotal(lineTotal);
            li.setCreatedAt(now);
            li.setUpdatedAt(now);
            lineItems.add(li);
        }

        // POS: không có phí ship, trả tiền ngay
        boolean isPaidImmediately = "CASH".equals(req.paymentMethod()) || "CARD_TERMINAL".equals(req.paymentMethod());

        OrderEntity order = new OrderEntity();
        order.setOrderNumber(orderNumberGenerator.generate());
        order.setOrderKey(req.posIdempotencyKey() != null && !req.posIdempotencyKey().isBlank()
                ? req.posIdempotencyKey()
                : orderKeyGenerator.generate());
        order.setChannel(CHANNEL_IN_STORE);
        order.setFulfillmentType(FULFILLMENT_IN_STORE);
        order.setPaymentMethod(req.paymentMethod());
        order.setStatus(isPaidImmediately ? "COMPLETED" : "ON_HOLD");
        order.setPaymentStatus(isPaidImmediately ? "PAID" : "UNPAID");
        order.setCustomerPhone(req.customerPhone());
        order.setCustomerNote(req.customerNote());
        order.setCurrency("VND");
        order.setSubtotalAmount(subtotal);
        order.setDiscountAmount(BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP));
        order.setShippingAmount(BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP));
        order.setFeeAmount(BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP));
        order.setTaxAmount(BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP));
        order.setTotalAmount(subtotal);
        order.setPaidAmount(isPaidImmediately ? subtotal : BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP));
        order.setSource("pos");
        if (isPaidImmediately) {
            order.setPaidAt(now);
            order.setCompletedAt(now);
        } else {
            // BANK_TRANSFER at POS: expires in 30 minutes (tại quầy, không chờ 48h)
            order.setPendingPaymentExpiresAt(now.plusSeconds(30 * 60));
        }
        order.setPlacedAt(now);
        order.setCreatedAt(now);
        order.setUpdatedAt(now);

        OrderEntity savedOrder = orderRepo.save(order);

        for (OrderLineItemEntity li : lineItems) {
            li.setOrder(savedOrder);
            lineItemRepo.save(li);
        }

        // Decrement stock immediately (POS = goods leave the shelf now)
        decrementStock(req.items(), savedOrder.getId(), now);

        // Payment record
        PaymentEntity payment = new PaymentEntity();
        payment.setOrder(savedOrder);
        payment.setPaymentMethod(req.paymentMethod());
        payment.setProvider(isPaidImmediately ? "POS" : "MANUAL");
        payment.setStatus(isPaidImmediately ? "PAID" : "PENDING");
        payment.setAmount(subtotal);
        payment.setCurrency("VND");
        if (isPaidImmediately) payment.setPaidAt(now);
        payment.setCreatedAt(now);
        payment.setUpdatedAt(now);
        paymentRepo.save(payment);

        // System note
        String noteExtra = (req.staffNote() != null && !req.staffNote().isBlank() ? " Ghi chú: " + req.staffNote() + "." : "")
                + (req.cardReferenceNumber() != null && !req.cardReferenceNumber().isBlank() ? " Ref: " + req.cardReferenceNumber() + "." : "");
        String note = "Đơn POS tạo bởi nhân viên. Phương thức: " + req.paymentMethod() + "." + noteExtra;
        OrderNoteEntity orderNote = new OrderNoteEntity();
        orderNote.setOrder(savedOrder);
        orderNote.setAuthorType("ADMIN");
        orderNote.setNoteType("SYSTEM");
        orderNote.setContent(note);
        orderNote.setCustomerVisible(false);
        orderNote.setCreatedAt(now);
        noteRepo.save(orderNote);

        wsService.pushEvent(new OrderWsEvent(
                "NEW_ORDER", savedOrder.getId(), savedOrder.getOrderNumber(),
                req.customerName() != null ? req.customerName() : req.customerPhone(),
                subtotal, savedOrder.getStatus(), req.paymentMethod(), now));

        // Build response
        Long changeAmount = null;
        if ("CASH".equals(req.paymentMethod()) && req.tenderedAmount() != null) {
            changeAmount = req.tenderedAmount() - subtotal.setScale(0, RoundingMode.HALF_UP).longValue();
        }

        String qrVietQrUrl = null;
        String transferContent = null;
        String bankName = null;
        String accountNumber = null;
        String accountHolder = null;
        if ("BANK_TRANSFER".equals(req.paymentMethod())) {
            var info = paymentInfoService.getPaymentInfo(savedOrder.getId());
            qrVietQrUrl = info.qrVietQrUrl();
            transferContent = info.transferContent();
            bankName = info.bankName();
            accountNumber = info.accountNumber();
            accountHolder = info.accountHolder();
        }

        return new PosOrderResponse(
                savedOrder.getId(), savedOrder.getOrderNumber(),
                savedOrder.getStatus(), savedOrder.getPaymentStatus(),
                req.paymentMethod(), subtotal,
                req.tenderedAmount(), changeAmount,
                qrVietQrUrl, transferContent, bankName, accountNumber, accountHolder
        );
    }

    private void decrementStock(
            List<PosLineItemRequest> items,
            UUID orderId,
            Instant now
    ) {
        for (PosLineItemRequest item : items) {
            if (item.productVariantId() == null || item.productVariantId().isBlank()) continue;

            ProductVariantEntity v = variantRepo.findByIdForUpdate(item.productVariantId())
                    .orElseThrow(() -> new NotFoundException("Variant không tìm thấy khi trừ kho: " + item.productVariantId()));

            int before = v.getQuantityOnHand();
            int after = before - item.quantity();
            v.setQuantityOnHand(after);
            inventoryPolicyService.recomputeStockState(v);
            variantRepo.save(v);

            StockMovementEntity mv = new StockMovementEntity();
            mv.setVariant(v);
            mv.setMovementType("SALE");
            mv.setQuantityDelta(-item.quantity());
            mv.setReferenceType("ORDER");
            mv.setReferenceId(orderId);
            mv.setNote("POS_SALE");
            mv.setCreatedAt(now);
            mv.setQuantityBefore(before);
            mv.setQuantityAfter(after);
            stockMovementRepo.save(mv);
        }
    }

    private BigDecimal resolvePrice(ProductEntity p, ProductVariantEntity v) {
        if (v != null && v.getSalePrice() != null) return v.getSalePrice().setScale(2, RoundingMode.HALF_UP);
        if (v != null && v.getRetailPrice() != null) return v.getRetailPrice().setScale(2, RoundingMode.HALF_UP);
        if (p.getSalePrice() != null) return p.getSalePrice().setScale(2, RoundingMode.HALF_UP);
        return p.getRetailPrice().setScale(2, RoundingMode.HALF_UP);
    }

    private void validatePaymentMethod(String method) {
        if (!"CASH".equals(method) && !"CARD_TERMINAL".equals(method) && !"BANK_TRANSFER".equals(method)) {
            throw new ConflictException("POS payment method must be CASH, CARD_TERMINAL, or BANK_TRANSFER.");
        }
    }

    private UUID tryParseUUID(String s) {
        try { return UUID.fromString(s); } catch (Exception e) { return null; }
    }
}
