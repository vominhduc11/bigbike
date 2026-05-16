package com.bigbike.bigbike_backend.migration.wordpress.importer;

import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressOrderMapper.MappedOrder;
import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressOrderMapper.MappedOrderPayment;
import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressWooCommerceOrderItemMapper.MappedCouponItem;
import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressWooCommerceOrderItemMapper.MappedFeeItem;
import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressWooCommerceOrderItemMapper.MappedLineItem;
import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressWooCommerceOrderItemMapper.MappedShippingItem;
import com.bigbike.bigbike_backend.migration.wordpress.writeplan.MigrationDomain;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderAddressEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderAppliedCouponEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderFeeItemEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderLineItemEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderShippingItemEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.payment.PaymentEntity;
import com.bigbike.bigbike_backend.persistence.entity.customer.CustomerEntity;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderAddressJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderAppliedCouponJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderFeeItemJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderLineItemJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderShippingItemJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.payment.PaymentJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.customer.CustomerJpaRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class OrderImporter implements DomainImporter {

    private final OrderJpaRepository orderRepo;
    private final OrderAddressJpaRepository addressRepo;
    private final OrderLineItemJpaRepository lineItemRepo;
    private final OrderShippingItemJpaRepository shippingItemRepo;
    private final OrderFeeItemJpaRepository feeItemRepo;
    private final OrderAppliedCouponJpaRepository appliedCouponRepo;
    private final PaymentJpaRepository paymentRepo;
    private final CustomerJpaRepository customerRepo;

    public OrderImporter(
            OrderJpaRepository orderRepo,
            OrderAddressJpaRepository addressRepo,
            OrderLineItemJpaRepository lineItemRepo,
            OrderShippingItemJpaRepository shippingItemRepo,
            OrderFeeItemJpaRepository feeItemRepo,
            OrderAppliedCouponJpaRepository appliedCouponRepo,
            PaymentJpaRepository paymentRepo,
            CustomerJpaRepository customerRepo) {
        this.orderRepo = orderRepo;
        this.addressRepo = addressRepo;
        this.lineItemRepo = lineItemRepo;
        this.shippingItemRepo = shippingItemRepo;
        this.feeItemRepo = feeItemRepo;
        this.appliedCouponRepo = appliedCouponRepo;
        this.paymentRepo = paymentRepo;
        this.customerRepo = customerRepo;
    }

    @Override
    public MigrationDomain domain() {
        return MigrationDomain.ORDERS;
    }

    @Override
    public MigrationExecutionReport.DomainResult execute(MigrationExecutionOptions options) {
        throw new UnsupportedOperationException("Use importBatch()");
    }

    @Transactional
    public MigrationExecutionReport.DomainResult importBatch(
            List<MappedOrder> orders, MigrationExecutionOptions options) {

        int inserted = 0, updated = 0, skipped = 0, failed = 0;
        List<String> warnings = new ArrayList<>();
        List<String> errors = new ArrayList<>();

        for (MappedOrder mo : orders) {
            if (mo.orderNumber() == null || mo.orderNumber().isBlank()) {
                skipped++;
                continue;
            }
            try {
                Optional<OrderEntity> existing = orderRepo.findByLegacyId(mo.sourceId());
                if (existing.isEmpty() && mo.orderNumber() != null) {
                    existing = orderRepo.findByOrderNumber(mo.orderNumber());
                }
                OrderEntity entity;
                boolean isNew;
                if (existing.isPresent()) {
                    entity = existing.get();
                    isNew = false;
                } else {
                    entity = new OrderEntity();
                    entity.setCreatedAt(Instant.now());
                    isNew = true;
                }

                entity.setLegacyId(mo.sourceId());
                entity.setOrderNumber(mo.orderNumber());
                entity.setOrderKey(mo.orderKey());
                entity.setStatus(mo.status() != null ? mo.status() : "PENDING_PAYMENT");
                entity.setPaymentStatus(mo.paymentStatus() != null ? mo.paymentStatus() : "UNPAID");
                entity.setCurrency(mo.currency() != null ? mo.currency() : "VND");
                entity.setCustomerEmail(mo.billingEmail());
                entity.setCustomerPhone(mo.billingPhone());
                entity.setCustomerNote(mo.customerNote());
                entity.setSubtotalAmount(safe(mo.subtotalAmount()));
                entity.setDiscountAmount(safe(mo.discountAmount()));
                entity.setShippingAmount(safe(mo.shippingAmount()));
                entity.setFeeAmount(safe(mo.feeAmount()));
                entity.setTaxAmount(safe(mo.taxAmount()));
                entity.setTotalAmount(safe(mo.totalAmount()));
                entity.setPaidAmount(safe(mo.paidAmount()));
                entity.setIpAddress(mo.ipAddress());
                entity.setUserAgent(mo.userAgent());

                if (mo.placedAt() != null) entity.setPlacedAt(mo.placedAt().toInstant(ZoneOffset.UTC));
                if (mo.paidAt() != null)   entity.setPaidAt(mo.paidAt().toInstant(ZoneOffset.UTC));
                if (mo.completedAt() != null) entity.setCompletedAt(mo.completedAt().toInstant(ZoneOffset.UTC));
                if (mo.cancelledAt() != null) entity.setCancelledAt(mo.cancelledAt().toInstant(ZoneOffset.UTC));

                // Link customer by legacyId (WordPress user id)
                if (mo.customerWpUserId() != null && mo.customerWpUserId() > 0) {
                    customerRepo.findByLegacyId(mo.customerWpUserId())
                            .map(CustomerEntity::getId)
                            .ifPresent(entity::setCustomerId);
                }

                entity.setUpdatedAt(Instant.now());
                warnings.addAll(mo.warnings());

                if (!options.dryRun()) {
                    entity = orderRepo.save(entity);
                    importOrderAddresses(entity, mo);
                    importLineItems(entity, mo.lineItemsDetailed());
                    importShippingItems(entity, mo.shippingItems());
                    importFeeItems(entity, mo.feeItems());
                    importAppliedCoupons(entity, mo.couponItems());
                    if (mo.payment() != null) importPayment(entity, mo.payment());
                }
                if (isNew) inserted++; else updated++;
            } catch (Exception e) {
                failed++;
                errors.add("Order orderNumber=" + mo.orderNumber()
                        + " legacyId=" + mo.sourceId() + ": " + e.getMessage());
                if (options.failFast()) throw new RuntimeException(errors.get(errors.size() - 1), e);
            }
        }
        return new MigrationExecutionReport.DomainResult(
                MigrationDomain.ORDERS, inserted, updated, skipped, failed, warnings, errors);
    }

    private void importOrderAddresses(OrderEntity order, MappedOrder mo) {
        // Billing
        if (mo.billingAddress1() != null && !mo.billingAddress1().isBlank()) {
            OrderAddressEntity billing = addressRepo
                    .findByOrderIdAndType(order.getId(), "BILLING")
                    .orElseGet(() -> {
                        OrderAddressEntity e = new OrderAddressEntity();
                        e.setCreatedAt(Instant.now());
                        return e;
                    });
            billing.setOrder(order);
            billing.setType("BILLING");
            billing.setFullName(join(mo.billingFirstName(), mo.billingLastName()));
            billing.setEmail(mo.billingEmail());
            billing.setPhone(mo.billingPhone());
            billing.setAddressLine1(mo.billingAddress1());
            billing.setAddressLine2(mo.billingAddress2());
            billing.setDistrict(mo.billingCity());
            billing.setProvince(mo.billingState());
            billing.setCountry(mo.billingCountry() != null ? mo.billingCountry() : "VN");
            billing.setUpdatedAt(Instant.now());
            addressRepo.save(billing);
        }
        // Shipping
        if (mo.shippingAddress1() != null && !mo.shippingAddress1().isBlank()) {
            OrderAddressEntity shipping = addressRepo
                    .findByOrderIdAndType(order.getId(), "SHIPPING")
                    .orElseGet(() -> {
                        OrderAddressEntity e = new OrderAddressEntity();
                        e.setCreatedAt(Instant.now());
                        return e;
                    });
            shipping.setOrder(order);
            shipping.setType("SHIPPING");
            shipping.setFullName(join(mo.shippingFirstName(), mo.shippingLastName()));
            shipping.setPhone(mo.billingPhone());
            shipping.setAddressLine1(mo.shippingAddress1());
            shipping.setAddressLine2(mo.shippingAddress2());
            shipping.setDistrict(mo.shippingCity());
            shipping.setProvince(mo.shippingState());
            shipping.setCountry(mo.shippingCountry() != null ? mo.shippingCountry() : "VN");
            shipping.setUpdatedAt(Instant.now());
            addressRepo.save(shipping);
        }
    }

    private void importLineItems(OrderEntity order, List<MappedLineItem> items) {
        if (items == null) return;
        for (MappedLineItem li : items) {
            OrderLineItemEntity entity = lineItemRepo.findByLegacyItemId(li.legacyItemId())
                    .orElseGet(() -> {
                        OrderLineItemEntity e = new OrderLineItemEntity();
                        e.setCreatedAt(Instant.now());
                        return e;
                    });
            entity.setOrder(order);
            entity.setLegacyItemId(li.legacyItemId());
            entity.setProductName(li.productName() != null ? li.productName() : "Unknown");
            entity.setSku(li.sku());
            entity.setQuantity(li.quantity());
            entity.setUnitPrice(safe(li.lineTotal()).compareTo(BigDecimal.ZERO) > 0 && li.quantity() > 0
                    ? safe(li.lineTotal()).divide(BigDecimal.valueOf(li.quantity()), 2, java.math.RoundingMode.HALF_UP)
                    : BigDecimal.ZERO);
            entity.setLineSubtotal(safe(li.lineSubtotal()));
            entity.setLineDiscount(BigDecimal.ZERO);
            entity.setLineTax(safe(li.lineTax()));
            entity.setLineTotal(safe(li.lineTotal()));
            entity.setUpdatedAt(Instant.now());
            lineItemRepo.save(entity);
        }
    }

    private void importShippingItems(OrderEntity order, List<MappedShippingItem> items) {
        if (items == null) return;
        // Load existing by orderId for dedup by legacyItemId
        List<OrderShippingItemEntity> existing = shippingItemRepo.findByOrderId(order.getId());
        for (MappedShippingItem si : items) {
            OrderShippingItemEntity entity = existing.stream()
                    .filter(e -> e.getLegacyItemId() != null && e.getLegacyItemId() == si.legacyItemId())
                    .findFirst()
                    .orElseGet(() -> {
                        OrderShippingItemEntity e = new OrderShippingItemEntity();
                        e.setCreatedAt(Instant.now());
                        return e;
                    });
            entity.setOrder(order);
            entity.setLegacyItemId(si.legacyItemId());
            entity.setMethodTitle(si.methodTitle() != null ? si.methodTitle() : "Shipping");
            entity.setMethodCode(si.methodId());
            entity.setAmount(safe(si.cost()));
            entity.setUpdatedAt(Instant.now());
            shippingItemRepo.save(entity);
        }
    }

    private void importFeeItems(OrderEntity order, List<MappedFeeItem> items) {
        if (items == null) return;
        List<OrderFeeItemEntity> existing = feeItemRepo.findByOrderId(order.getId());
        for (MappedFeeItem fi : items) {
            OrderFeeItemEntity entity = existing.stream()
                    .filter(e -> e.getLegacyItemId() != null && e.getLegacyItemId() == fi.legacyItemId())
                    .findFirst()
                    .orElseGet(() -> {
                        OrderFeeItemEntity e = new OrderFeeItemEntity();
                        e.setCreatedAt(Instant.now());
                        return e;
                    });
            entity.setOrder(order);
            entity.setLegacyItemId(fi.legacyItemId());
            entity.setName(fi.name() != null ? fi.name() : "Fee");
            entity.setAmount(safe(fi.lineTotal()));
            entity.setTaxAmount(safe(fi.lineTax()));
            entity.setUpdatedAt(Instant.now());
            feeItemRepo.save(entity);
        }
    }

    private void importAppliedCoupons(OrderEntity order, List<MappedCouponItem> items) {
        if (items == null) return;
        List<OrderAppliedCouponEntity> existing = appliedCouponRepo.findByOrderId(order.getId());
        for (MappedCouponItem ci : items) {
            if (ci.code() == null || ci.code().isBlank()) continue;
            OrderAppliedCouponEntity entity = existing.stream()
                    .filter(e -> ci.code().equalsIgnoreCase(e.getCode()))
                    .findFirst()
                    .orElseGet(() -> {
                        OrderAppliedCouponEntity e = new OrderAppliedCouponEntity();
                        e.setCreatedAt(Instant.now());
                        return e;
                    });
            entity.setOrder(order);
            entity.setCode(ci.code());
            entity.setDiscountAmount(safe(ci.discountAmount()));
            appliedCouponRepo.save(entity);
        }
    }

    private void importPayment(OrderEntity order, MappedOrderPayment payment) {
        List<PaymentEntity> existing = paymentRepo.findByOrderId(order.getId());
        PaymentEntity entity = existing.isEmpty() ? null : existing.get(0);
        if (entity == null) {
            entity = new PaymentEntity();
            entity.setCreatedAt(Instant.now());
        }
        entity.setOrder(order);
        entity.setPaymentMethod(payment.paymentMethod() != null ? payment.paymentMethod() : "cod");
        entity.setProvider(payment.provider());
        entity.setStatus(payment.status() != null ? payment.status() : "PENDING");
        entity.setAmount(safe(payment.amount()));
        entity.setCurrency(payment.currency() != null ? payment.currency() : "VND");
        entity.setTransactionId(payment.transactionId());
        if (payment.paidAt() != null) entity.setPaidAt(payment.paidAt().toInstant(ZoneOffset.UTC));
        entity.setUpdatedAt(Instant.now());
        paymentRepo.save(entity);
    }

    private BigDecimal safe(BigDecimal v) {
        return v != null ? v : BigDecimal.ZERO;
    }

    private String join(String first, String last) {
        if (first == null && last == null) return "";
        if (first == null) return last;
        if (last == null) return first;
        return (first + " " + last).trim();
    }
}
