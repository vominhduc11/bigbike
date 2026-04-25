package com.bigbike.bigbike_backend.service.cart;

import com.bigbike.bigbike_backend.api.cart.dto.AddCartItemRequest;
import com.bigbike.bigbike_backend.api.error.ConflictException;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.cart.CartCouponEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.cart.CartEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.cart.CartItemEntity;
import com.bigbike.bigbike_backend.persistence.entity.coupon.CouponEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductVariantJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.cart.CartCouponJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.cart.CartItemJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.cart.CartJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.coupon.CouponJpaRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CartService {

    private static final String STATUS_ACTIVE = "ACTIVE";
    private static final String CURRENCY_VND = "VND";

    private final CartJpaRepository cartRepo;
    private final CartItemJpaRepository cartItemRepo;
    private final CartCouponJpaRepository cartCouponRepo;
    private final ProductJpaRepository productRepo;
    private final ProductVariantJpaRepository variantRepo;
    private final CouponJpaRepository couponRepo;
    private final CartCalculator calculator;

    public CartService(
            CartJpaRepository cartRepo,
            CartItemJpaRepository cartItemRepo,
            CartCouponJpaRepository cartCouponRepo,
            ProductJpaRepository productRepo,
            ProductVariantJpaRepository variantRepo,
            CouponJpaRepository couponRepo,
            CartCalculator calculator
    ) {
        this.cartRepo = cartRepo;
        this.cartItemRepo = cartItemRepo;
        this.cartCouponRepo = cartCouponRepo;
        this.productRepo = productRepo;
        this.variantRepo = variantRepo;
        this.couponRepo = couponRepo;
        this.calculator = calculator;
    }

    @Transactional
    public CartEntity getOrCreateCustomerCart(UUID customerId) {
        return cartRepo.findByCustomerIdAndStatus(customerId, STATUS_ACTIVE)
                .orElseGet(() -> {
                    Instant now = Instant.now();
                    CartEntity cart = new CartEntity();
                    cart.setCustomerId(customerId);
                    cart.setStatus(STATUS_ACTIVE);
                    cart.setCurrency(CURRENCY_VND);
                    cart.setCreatedAt(now);
                    cart.setUpdatedAt(now);
                    return cartRepo.save(cart);
                });
    }

    @Transactional
    public CartEntity getOrCreateGuestCart(String guestId) {
        return cartRepo.findBySessionId(guestId)
                .orElseGet(() -> {
                    Instant now = Instant.now();
                    CartEntity cart = new CartEntity();
                    cart.setSessionId(guestId);
                    cart.setStatus(STATUS_ACTIVE);
                    cart.setCurrency(CURRENCY_VND);
                    cart.setCreatedAt(now);
                    cart.setUpdatedAt(now);
                    return cartRepo.save(cart);
                });
    }

    @Transactional
    public CartEntity addItem(CartEntity cart, AddCartItemRequest req) {
        ProductEntity product = productRepo.findById(req.productId())
                .orElseThrow(() -> new NotFoundException("Product not found: " + req.productId()));

        if (product.getPublishStatus() != PublishStatus.PUBLISHED) {
            throw new ConflictException("Product is not available.");
        }

        ProductVariantEntity variant = null;
        if (req.productVariantId() != null && !req.productVariantId().isBlank()) {
            variant = variantRepo.findByIdAndProductId(req.productVariantId(), product.getId())
                    .orElseThrow(() -> new NotFoundException("Variant not found: " + req.productVariantId()));
            if (!variant.isAvailable()) {
                throw new ConflictException("Product variant is not available.");
            }
        }

        BigDecimal unitPrice = resolveUnitPrice(product, variant);
        if (unitPrice == null || unitPrice.compareTo(BigDecimal.ZERO) < 0) {
            throw new ConflictException("Product does not have a valid price.");
        }

        UUID productUuid = tryParseUUID(product.getId());
        UUID variantUuid = (variant != null) ? tryParseUUID(variant.getId()) : null;

        // Check if same product+variant already in cart
        List<CartItemEntity> existingItems = cartItemRepo.findByCartId(cart.getId());
        Optional<CartItemEntity> existing = existingItems.stream()
                .filter(i -> matchesProductVariant(i, productUuid, variantUuid))
                .findFirst();

        CartItemEntity item;
        if (existing.isPresent()) {
            item = existing.get();
            item.setQuantity(item.getQuantity() + req.quantity());
            item.setUnitPrice(unitPrice);
        } else {
            item = new CartItemEntity();
            item.setCart(cart);
            item.setProductId(productUuid);
            item.setProductVariantId(variantUuid);
            item.setSku(variant != null ? variant.getSku() : product.getSku());
            item.setProductName(product.getName());
            item.setVariantName(variant != null ? variant.getName() : null);
            item.setQuantity(req.quantity());
            item.setUnitPrice(unitPrice);
            item.setRegularPrice(product.getRetailPrice());
            item.setSalePrice(product.getSalePrice());
            item.setCreatedAt(Instant.now());
        }
        item.setUpdatedAt(Instant.now());
        calculator.recalculateItem(item);
        cartItemRepo.save(item);

        return refreshCartTotals(cart);
    }

    @Transactional
    public CartEntity updateItemQuantity(CartEntity cart, UUID itemId, int quantity) {
        CartItemEntity item = findOwnedItem(cart, itemId);
        item.setQuantity(quantity);
        item.setUpdatedAt(Instant.now());
        calculator.recalculateItem(item);
        cartItemRepo.save(item);
        return refreshCartTotals(cart);
    }

    @Transactional
    public CartEntity removeItem(CartEntity cart, UUID itemId) {
        CartItemEntity item = findOwnedItem(cart, itemId);
        cartItemRepo.delete(item);
        return refreshCartTotals(cart);
    }

    @Transactional
    public CartEntity clearCart(CartEntity cart) {
        cartItemRepo.deleteAll(cartItemRepo.findByCartId(cart.getId()));
        cartCouponRepo.deleteAllByCartId(cart.getId());
        return refreshCartTotals(cart);
    }

    public List<CartItemEntity> getItems(CartEntity cart) {
        return cartItemRepo.findByCartId(cart.getId());
    }

    public List<CartCouponEntity> getCoupons(CartEntity cart) {
        return cartCouponRepo.findByCartId(cart.getId());
    }

    @Transactional
    public CartEntity applyCoupon(CartEntity cart, String code) {
        String normalized = code.trim().toUpperCase(Locale.ROOT);

        if (cartCouponRepo.findByCartIdAndCouponCode(cart.getId(), normalized).isPresent()) {
            throw new ConflictException("Mã giảm giá đã được áp dụng.");
        }

        CouponEntity coupon = couponRepo.findByCode(normalized)
                .orElseThrow(() -> new NotFoundException("Mã giảm giá không tồn tại."));

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

        BigDecimal subtotal = cart.getSubtotalAmount();
        if (coupon.getMinAmount() != null && subtotal.compareTo(coupon.getMinAmount()) < 0) {
            throw new ConflictException("Đơn hàng chưa đạt giá trị tối thiểu để áp dụng mã giảm giá.");
        }

        BigDecimal discountAmount;
        if ("PERCENT".equals(coupon.getDiscountType())) {
            discountAmount = subtotal.multiply(coupon.getAmount())
                    .divide(new BigDecimal("100"), 2, RoundingMode.HALF_UP);
        } else {
            discountAmount = coupon.getAmount().setScale(2, RoundingMode.HALF_UP);
        }
        if (coupon.getMaxAmount() != null && discountAmount.compareTo(coupon.getMaxAmount()) > 0) {
            discountAmount = coupon.getMaxAmount().setScale(2, RoundingMode.HALF_UP);
        }
        if (discountAmount.compareTo(subtotal) > 0) {
            discountAmount = subtotal;
        }

        CartCouponEntity cartCoupon = new CartCouponEntity();
        cartCoupon.setCart(cart);
        cartCoupon.setCouponCode(normalized);
        cartCoupon.setDiscountType(coupon.getDiscountType());
        cartCoupon.setDiscountAmount(discountAmount);
        cartCoupon.setCreatedAt(now);
        cartCouponRepo.save(cartCoupon);

        return refreshCartTotals(cart);
    }

    @Transactional
    public CartEntity removeCoupon(CartEntity cart, String code) {
        String normalized = code.trim().toUpperCase(Locale.ROOT);
        CartCouponEntity cartCoupon = cartCouponRepo.findByCartIdAndCouponCode(cart.getId(), normalized)
                .orElseThrow(() -> new NotFoundException("Mã giảm giá không được áp dụng."));
        cartCouponRepo.delete(cartCoupon);
        return refreshCartTotals(cart);
    }

    // ── private helpers ───────────────────────────────────────────────────────

    private CartItemEntity findOwnedItem(CartEntity cart, UUID itemId) {
        CartItemEntity item = cartItemRepo.findById(itemId)
                .orElseThrow(() -> new NotFoundException("Cart item not found."));
        if (!item.getCart().getId().equals(cart.getId())) {
            throw new NotFoundException("Cart item not found.");
        }
        return item;
    }

    private CartEntity refreshCartTotals(CartEntity cart) {
        List<CartItemEntity> items = cartItemRepo.findByCartId(cart.getId());
        List<CartCouponEntity> coupons = cartCouponRepo.findByCartId(cart.getId());
        calculator.recalculateCart(cart, items, coupons);
        cart.setUpdatedAt(Instant.now());
        return cartRepo.save(cart);
    }

    private BigDecimal resolveUnitPrice(ProductEntity product, ProductVariantEntity variant) {
        if (variant != null) {
            BigDecimal variantPrice = variant.getSalePrice() != null
                    ? variant.getSalePrice() : variant.getRetailPrice();
            if (variantPrice != null) {
                return variantPrice.setScale(2, RoundingMode.HALF_UP);
            }
        }
        BigDecimal price = product.getSalePrice() != null
                ? product.getSalePrice() : product.getRetailPrice();
        return price.setScale(2, RoundingMode.HALF_UP);
    }

    private boolean matchesProductVariant(CartItemEntity item, UUID productUuid, UUID variantUuid) {
        boolean productMatch = (productUuid == null)
                ? item.getProductId() == null
                : productUuid.equals(item.getProductId());
        boolean variantMatch = (variantUuid == null)
                ? item.getProductVariantId() == null
                : variantUuid.equals(item.getProductVariantId());
        return productMatch && variantMatch;
    }

    private UUID tryParseUUID(String id) {
        if (id == null) return null;
        try {
            return UUID.fromString(id);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
