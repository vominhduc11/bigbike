package com.bigbike.bigbike_backend.service.pos;

import com.bigbike.bigbike_backend.api.error.ConflictException;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.persistence.entity.audit.AuditLogEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.StockMovementEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderLineItemEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderNoteEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.payment.PaymentEntity;
import com.bigbike.bigbike_backend.persistence.repository.audit.AuditLogJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductVariantJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.StockMovementJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderLineItemJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderNoteJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.payment.PaymentJpaRepository;
import com.bigbike.bigbike_backend.persistence.entity.commerce.receivable.ReceivableEntity;
import com.bigbike.bigbike_backend.persistence.entity.customer.CustomerEntity;
import com.bigbike.bigbike_backend.persistence.repository.customer.CustomerJpaRepository;
import com.bigbike.bigbike_backend.service.checkout.OrderKeyGenerator;
import com.bigbike.bigbike_backend.service.checkout.OrderNumberGenerator;
import com.bigbike.bigbike_backend.service.inventory.InventoryPolicyService;
import com.bigbike.bigbike_backend.service.receivable.CreditPolicyService;
import com.bigbike.bigbike_backend.service.receivable.ReceivableService;
import com.bigbike.bigbike_backend.service.ws.AdminOrderWsService;
import com.bigbike.bigbike_backend.service.ws.OrderWsEvent;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
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
            String paymentMethod,        // CASH | CARD_TERMINAL | CREDIT
            Long tenderedAmount,         // Tiền khách đưa (cho CASH), null cho CARD/CREDIT
            String staffNote,
            String posIdempotencyKey,    // Client UUID to prevent duplicate submissions
            String cardReferenceNumber,  // Optional: mã giao dịch thẻ / terminal ref
            String customerId,           // Required for CREDIT payment method
            Long downPayment             // Optional: partial upfront payment for CREDIT orders
    ) {}

    public record PosOrderResponse(
            UUID orderId,
            String orderNumber,
            String status,
            String paymentStatus,
            String paymentMethod,
            BigDecimal totalAmount,
            Long tenderedAmount,
            Long changeAmount
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
    private final AuditLogJpaRepository auditLogRepo;
    private final OrderNumberGenerator orderNumberGenerator;
    private final OrderKeyGenerator orderKeyGenerator;
    private final AdminOrderWsService wsService;
    private final InventoryPolicyService inventoryPolicyService;
    private final CreditPolicyService creditPolicyService;
    private final ReceivableService receivableService;
    private final CustomerJpaRepository customerRepo;

    public PosOrderService(
            ProductJpaRepository productRepo,
            ProductVariantJpaRepository variantRepo,
            StockMovementJpaRepository stockMovementRepo,
            OrderJpaRepository orderRepo,
            OrderLineItemJpaRepository lineItemRepo,
            OrderNoteJpaRepository noteRepo,
            PaymentJpaRepository paymentRepo,
            AuditLogJpaRepository auditLogRepo,
            OrderNumberGenerator orderNumberGenerator,
            OrderKeyGenerator orderKeyGenerator,
            AdminOrderWsService wsService,
            InventoryPolicyService inventoryPolicyService,
            CreditPolicyService creditPolicyService,
            ReceivableService receivableService,
            CustomerJpaRepository customerRepo
    ) {
        this.productRepo = productRepo;
        this.variantRepo = variantRepo;
        this.stockMovementRepo = stockMovementRepo;
        this.orderRepo = orderRepo;
        this.lineItemRepo = lineItemRepo;
        this.noteRepo = noteRepo;
        this.paymentRepo = paymentRepo;
        this.auditLogRepo = auditLogRepo;
        this.orderNumberGenerator = orderNumberGenerator;
        this.orderKeyGenerator = orderKeyGenerator;
        this.wsService = wsService;
        this.inventoryPolicyService = inventoryPolicyService;
        this.creditPolicyService = creditPolicyService;
        this.receivableService = receivableService;
        this.customerRepo = customerRepo;
    }

    @Transactional
    public PosOrderResponse createOrder(PosCreateOrderRequest req, String staffId, boolean canOverridePrice,
                                        boolean canOverrideCreditLimit, String clientIp, String userAgent) {
        if (req.items() == null || req.items().isEmpty()) {
            throw new ConflictException("POS order must have at least one item.");
        }
        validatePaymentMethod(req.paymentMethod());

        // Credit validation must happen before idempotency check (need customer entity below)
        CustomerEntity creditCustomer = null;
        if ("CREDIT".equals(req.paymentMethod())) {
            if (req.customerId() == null || req.customerId().isBlank()) {
                throw new ConflictException("customerId là bắt buộc khi thanh toán bằng CREDIT.");
            }
            UUID custId = UUID.fromString(req.customerId());
            // Amount unknown yet — we validate after totaling; store customer for later
            creditCustomer = customerRepo.findById(custId)
                    .orElseThrow(() -> new NotFoundException("Customer not found: " + req.customerId()));
        }

        // Idempotency: return existing order if client retries with same key
        if (req.posIdempotencyKey() != null && !req.posIdempotencyKey().isBlank()) {
            var existing = orderRepo.findByOrderKey(req.posIdempotencyKey());
            if (existing.isPresent()) {
                OrderEntity found = existing.get();
                Long changeAmt = null;
                if ("CASH".equals(found.getPaymentMethod()) && req.tenderedAmount() != null) {
                    changeAmt = req.tenderedAmount() - found.getTotalAmount().setScale(0, RoundingMode.HALF_UP).longValue();
                }
                return new PosOrderResponse(
                        found.getId(), found.getOrderNumber(), found.getStatus(), found.getPaymentStatus(),
                        found.getPaymentMethod(), found.getTotalAmount(), req.tenderedAmount(), changeAmt);
            }
        }

        Instant now = Instant.now();
        List<OrderLineItemEntity> lineItems = new ArrayList<>();
        BigDecimal subtotal = BigDecimal.ZERO;

        for (PosLineItemRequest item : req.items()) {
            if (item.productId() == null || item.productId().isBlank()) {
                throw new ConflictException("productId là bắt buộc cho mỗi dòng hàng.");
            }
            // P0 #4: productVariantId is required
            if (item.productVariantId() == null || item.productVariantId().isBlank()) {
                throw new ConflictException("productVariantId là bắt buộc cho mỗi dòng hàng POS.");
            }
            if (item.quantity() <= 0) {
                throw new ConflictException("Số lượng phải là số nguyên dương (>= 1).");
            }
            // P0 #5: price override permission + validation
            if (item.unitPriceOverride() != null) {
                if (!canOverridePrice) {
                    throw new ConflictException("Không có quyền override giá (pos.price_override).");
                }
                if (item.unitPriceOverride().compareTo(BigDecimal.ZERO) <= 0) {
                    throw new ConflictException("unitPriceOverride phải lớn hơn 0.");
                }
            }

            ProductEntity product = productRepo.findByIdForUpdate(item.productId())
                    .orElseThrow(() -> new NotFoundException("Product not found: " + item.productId()));

            // P0 #4: re-check product is still published
            if (product.getPublishStatus() != PublishStatus.PUBLISHED) {
                throw new ConflictException("Sản phẩm '" + product.getName() + "' không còn được bán.");
            }

            ProductVariantEntity variant = variantRepo.findByIdForUpdate(item.productVariantId())
                    .orElseThrow(() -> new NotFoundException("Variant not found: " + item.productVariantId()));

            // P0 #4: variant must belong to product
            if (variant.getProduct() != null && !variant.getProduct().getId().equals(product.getId())) {
                throw new ConflictException("Variant '" + item.productVariantId()
                        + "' không thuộc sản phẩm '" + product.getName() + "'.");
            }
            // P0 #4: variant must be available
            if (!variant.isAvailable()) {
                throw new ConflictException("Phiên bản '" + variant.getName() + "' không còn khả dụng.");
            }
            if (variant.getQuantityOnHand() < item.quantity()) {
                throw new ConflictException("Sản phẩm '" + product.getName() + "' chỉ còn "
                        + variant.getQuantityOnHand() + " trong kho.");
            }

            BigDecimal basePrice = resolvePrice(product, variant);
            BigDecimal unitPrice;
            if (item.unitPriceOverride() != null) {
                // P0 #5: override must not exceed base price ceiling check is intentionally omitted
                // (manual overrides can be discounts, not just markups); zero/negative already blocked above
                unitPrice = item.unitPriceOverride().setScale(2, RoundingMode.HALF_UP);
            } else {
                unitPrice = basePrice;
            }

            BigDecimal lineTotal = unitPrice.multiply(BigDecimal.valueOf(item.quantity()))
                    .setScale(2, RoundingMode.HALF_UP);
            subtotal = subtotal.add(lineTotal);

            OrderLineItemEntity li = new OrderLineItemEntity();
            li.setProductId(tryParseUUID(product.getId()));
            li.setProductPk(product.getId());
            li.setProductVariantId(tryParseUUID(variant.getId()));
            li.setSku(variant.getSku() != null ? variant.getSku() : product.getSku());
            li.setProductName(product.getName());
            li.setVariantName(variant.getName());
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

        // Validate credit limit now that we know subtotal
        if ("CREDIT".equals(req.paymentMethod()) && creditCustomer != null) {
            creditPolicyService.validateCreditEligibility(
                    creditCustomer.getId(), subtotal, canOverrideCreditLimit);
        }

        // Validate tiền mặt đủ nếu được gửi lên
        if ("CASH".equals(req.paymentMethod()) && req.tenderedAmount() != null) {
            long totalLong = subtotal.setScale(0, java.math.RoundingMode.HALF_UP).longValue();
            if (req.tenderedAmount() < totalLong) {
                throw new ConflictException("Tiền khách đưa (" + req.tenderedAmount()
                        + ") nhỏ hơn tổng đơn hàng (" + totalLong + ").");
            }
        }

        boolean isCreditOrder = "CREDIT".equals(req.paymentMethod());
        BigDecimal downPayment = isCreditOrder && req.downPayment() != null
                ? BigDecimal.valueOf(req.downPayment()).setScale(2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        // POS: không có phí ship; CREDIT = bán chịu, CASH/CARD = trả tiền ngay
        OrderEntity order = new OrderEntity();
        order.setOrderNumber(orderNumberGenerator.generate());
        order.setOrderKey(req.posIdempotencyKey() != null && !req.posIdempotencyKey().isBlank()
                ? req.posIdempotencyKey()
                : orderKeyGenerator.generate());
        order.setChannel(CHANNEL_IN_STORE);
        order.setFulfillmentType(FULFILLMENT_IN_STORE);
        order.setPaymentMethod(req.paymentMethod());
        order.setStatus("COMPLETED");  // Hàng giao ngay tại POS dù CREDIT hay không
        order.setPaymentStatus(isCreditOrder
                ? (downPayment.compareTo(BigDecimal.ZERO) > 0 ? "PARTIALLY_PAID" : "UNPAID")
                : "PAID");
        if (creditCustomer != null) {
            order.setCustomerId(creditCustomer.getId());
        }
        order.setCustomerPhone(req.customerPhone());
        order.setCustomerNote(req.customerNote());
        // P0 #2: persist customerName
        order.setCustomerName(req.customerName());
        order.setCurrency("VND");
        order.setSubtotalAmount(subtotal);
        order.setDiscountAmount(BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP));
        order.setShippingAmount(BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP));
        order.setFeeAmount(BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP));
        order.setTaxAmount(BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP));
        order.setTotalAmount(subtotal);
        order.setPaidAmount(isCreditOrder ? downPayment : subtotal);
        order.setSource("pos");
        if (!isCreditOrder) order.setPaidAt(now);
        order.setCompletedAt(now);
        order.setPlacedAt(now);
        order.setCreatedAt(now);
        order.setUpdatedAt(now);
        // P0 #1: persist staffId
        if (staffId != null) {
            try { order.setCreatedByAdminId(UUID.fromString(staffId)); } catch (IllegalArgumentException ignored) {}
        }

        OrderEntity savedOrder;
        try {
            savedOrder = orderRepo.save(order);
            // Flush within transaction so constraint violation surfaces here
            orderRepo.flush();
        } catch (DataIntegrityViolationException ex) {
            // Idempotency race: concurrent request already inserted same order_key
            if (req.posIdempotencyKey() != null && !req.posIdempotencyKey().isBlank()) {
                OrderEntity found = orderRepo.findByOrderKey(req.posIdempotencyKey())
                        .orElseThrow(() -> ex);
                Long changeAmt = null;
                if ("CASH".equals(found.getPaymentMethod()) && req.tenderedAmount() != null) {
                    changeAmt = req.tenderedAmount() - found.getTotalAmount().setScale(0, RoundingMode.HALF_UP).longValue();
                }
                return new PosOrderResponse(
                        found.getId(), found.getOrderNumber(), found.getStatus(), found.getPaymentStatus(),
                        found.getPaymentMethod(), found.getTotalAmount(), req.tenderedAmount(), changeAmt);
            }
            throw ex;
        }

        for (OrderLineItemEntity li : lineItems) {
            li.setOrder(savedOrder);
            lineItemRepo.save(li);
        }

        // Decrement stock immediately (POS = goods leave the shelf now)
        decrementStock(req.items(), savedOrder.getId(), now);

        // Payment record (only create if money was actually collected)
        if (!isCreditOrder || downPayment.compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal collected = isCreditOrder ? downPayment : subtotal;
            PaymentEntity payment = new PaymentEntity();
            payment.setOrder(savedOrder);
            payment.setPaymentMethod(isCreditOrder ? "CASH" : req.paymentMethod());
            payment.setProvider("POS");
            payment.setStatus("PAID");
            payment.setAmount(collected);
            payment.setCurrency("VND");
            payment.setPaidAt(now);
            payment.setCreatedAt(now);
            payment.setUpdatedAt(now);
            paymentRepo.save(payment);
        }

        // Create receivable for CREDIT orders
        if (isCreditOrder && creditCustomer != null) {
            try {
                receivableService.createReceivableForOrder(
                        savedOrder, creditCustomer, downPayment, "POS",
                        staffId != null ? tryParseUUID(staffId) : null);
            } catch (Exception e) {
                // Receivable creation failure must not silently succeed — rethrow so TX rolls back
                throw new ConflictException("Tạo công nợ thất bại: " + e.getMessage());
            }
        }

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

        // P0 #3: audit log
        String auditPayload = "{\"orderId\":\"" + savedOrder.getId() + "\""
                + ",\"orderNumber\":\"" + savedOrder.getOrderNumber() + "\""
                + ",\"staffId\":\"" + (staffId != null ? staffId : "") + "\""
                + ",\"totalAmount\":" + subtotal.setScale(0, RoundingMode.HALF_UP).longValue()
                + ",\"paymentMethod\":\"" + req.paymentMethod() + "\""
                + ",\"itemCount\":" + req.items().size()
                + ",\"source\":\"POS\"}";
        AuditLogEntity auditLog = new AuditLogEntity();
        auditLog.setActorType("ADMIN");
        if (staffId != null) {
            try { auditLog.setActorId(UUID.fromString(staffId)); } catch (IllegalArgumentException ignored) {}
        }
        auditLog.setAction(isCreditOrder ? "POS_CREDIT_ORDER_CREATED" : "POS_ORDER_CREATED");
        auditLog.setResourceType("ORDER");
        auditLog.setResourceId(savedOrder.getId());
        auditLog.setAfterData(auditPayload);
        auditLog.setIpAddress(clientIp);
        auditLog.setUserAgent(userAgent);
        auditLog.setCreatedAt(now);
        auditLogRepo.save(auditLog);

        wsService.pushEvent(new OrderWsEvent(
                "NEW_ORDER", savedOrder.getId(), savedOrder.getOrderNumber(),
                req.customerName() != null ? req.customerName() : req.customerPhone(),
                subtotal, savedOrder.getStatus(), req.paymentMethod(), now));

        // Build response
        Long changeAmount = null;
        if ("CASH".equals(req.paymentMethod()) && req.tenderedAmount() != null) {
            changeAmount = req.tenderedAmount() - subtotal.setScale(0, RoundingMode.HALF_UP).longValue();
        }

        return new PosOrderResponse(
                savedOrder.getId(), savedOrder.getOrderNumber(),
                savedOrder.getStatus(), savedOrder.getPaymentStatus(),
                req.paymentMethod(), subtotal,
                req.tenderedAmount(), changeAmount
        );
    }

    // Backward-compatible overload for existing callers without credit params
    @Transactional
    public PosOrderResponse createOrder(PosCreateOrderRequest req, String staffId, boolean canOverridePrice) {
        return createOrder(req, staffId, canOverridePrice, false, null, null);
    }

    // Backward-compatible overload for callers without IP/UA
    @Transactional
    public PosOrderResponse createOrder(PosCreateOrderRequest req, String staffId, boolean canOverridePrice,
                                        boolean canOverrideCreditLimit) {
        return createOrder(req, staffId, canOverridePrice, canOverrideCreditLimit, null, null);
    }

    private void decrementStock(
            List<PosLineItemRequest> items,
            UUID orderId,
            Instant now
    ) {
        for (PosLineItemRequest item : items) {
            // productVariantId is always non-null here (validated in createOrder)
            ProductVariantEntity v = variantRepo.findByIdForUpdate(item.productVariantId())
                    .orElseThrow(() -> new NotFoundException("Variant không tìm thấy khi trừ kho: " + item.productVariantId()));

            int before = v.getQuantityOnHand();
            int after = before - item.quantity();
            v.setQuantityOnHand(after);
            inventoryPolicyService.recomputeStockState(v);
            variantRepo.save(v);

            StockMovementEntity mv = new StockMovementEntity();
            mv.setVariant(v);
            mv.setMovementType("OUT");
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
        if (!"CASH".equals(method) && !"CARD_TERMINAL".equals(method) && !"CREDIT".equals(method)) {
            throw new ConflictException("POS payment method must be CASH, CARD_TERMINAL, or CREDIT.");
        }
    }

    private UUID tryParseUUID(String s) {
        try { return UUID.fromString(s); } catch (Exception e) { return null; }
    }
}
