package com.bigbike.bigbike_backend.service.cart;

import com.bigbike.bigbike_backend.api.cart.dto.AddCartItemRequest;
import com.bigbike.bigbike_backend.api.error.ConflictException;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
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
import com.bigbike.bigbike_backend.service.coupon.CouponPolicyService;
import com.bigbike.bigbike_backend.service.inventory.SerialLifecycleService;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
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
    private final CouponPolicyService couponPolicy;
    private final SerialLifecycleService serialLifecycleService;

    public CartService(
            CartJpaRepository cartRepo,
            CartItemJpaRepository cartItemRepo,
            CartCouponJpaRepository cartCouponRepo,
            ProductJpaRepository productRepo,
            ProductVariantJpaRepository variantRepo,
            CouponJpaRepository couponRepo,
            CartCalculator calculator,
            CouponPolicyService couponPolicy,
            SerialLifecycleService serialLifecycleService
    ) {
        this.cartRepo = cartRepo;
        this.cartItemRepo = cartItemRepo;
        this.cartCouponRepo = cartCouponRepo;
        this.productRepo = productRepo;
        this.variantRepo = variantRepo;
        this.couponRepo = couponRepo;
        this.calculator = calculator;
        this.couponPolicy = couponPolicy;
        this.serialLifecycleService = serialLifecycleService;
    }

    @Transactional
    public CartEntity getOrCreateCustomerCart(UUID customerId) {
        // findByCustomerIdAndStatus throws NonUniqueResultException if a race condition
        // produced duplicate ACTIVE carts before the unique index existed.
        // Use findByCustomerId + filter so we always survive stale data.
        List<CartEntity> active = cartRepo.findByCustomerId(customerId).stream()
                .filter(c -> STATUS_ACTIVE.equals(c.getStatus()))
                .toList();
        if (!active.isEmpty()) {
            return active.get(0);
        }
        Instant now = Instant.now();
        CartEntity cart = new CartEntity();
        cart.setCustomerId(customerId);
        cart.setStatus(STATUS_ACTIVE);
        cart.setCurrency(CURRENCY_VND);
        cart.setCreatedAt(now);
        cart.setUpdatedAt(now);
        try {
            return cartRepo.save(cart);
        } catch (DataIntegrityViolationException ex) {
            // Another request inserted the cart concurrently; re-read it.
            return cartRepo.findByCustomerId(customerId).stream()
                    .filter(c -> STATUS_ACTIVE.equals(c.getStatus()))
                    .findFirst()
                    .orElseThrow(() -> ex);
        }
    }

    @Transactional
    public CartEntity getOrCreateGuestCart(String guestId) {
        return cartRepo.findBySessionIdAndStatus(guestId, STATUS_ACTIVE).stream().findFirst()
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
            if (variant.getStockState() == ProductStockState.OUT_OF_STOCK) {
                throw new ConflictException("Product variant is out of stock.");
            }
        } else {
            if (Boolean.TRUE.equals(product.getForceOutOfStock())
                    || product.getStockState() == ProductStockState.OUT_OF_STOCK) {
                throw new ConflictException("Product is out of stock.");
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

        int newQuantity = existing.map(i -> i.getQuantity() + req.quantity()).orElse(req.quantity());
        validateQuantityAgainstStock(product, variant, newQuantity);

        CartItemEntity item;
        if (existing.isPresent()) {
            item = existing.get();
            item.setQuantity(newQuantity);
            item.setUnitPrice(unitPrice);
            applyImageSnapshot(item, product, variant);
        } else {
            item = new CartItemEntity();
            item.setCart(cart);
            item.setProductId(productUuid);
            item.setProductPk(product.getId());
            item.setProductVariantId(variantUuid);
            item.setSku(variant != null ? variant.getSku() : product.getSku());
            item.setProductName(product.getName());
            item.setVariantName(variant != null ? variant.getName() : null);
            applyImageSnapshot(item, product, variant);
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
        if (item.getProductId() != null) {
            ProductEntity product = productRepo.findById(item.getProductId().toString()).orElse(null);
            if (product != null) {
                ProductVariantEntity variant = item.getProductVariantId() != null
                        ? variantRepo.findById(item.getProductVariantId().toString()).orElse(null)
                        : null;
                validateQuantityAgainstStock(product, variant, quantity);
            }
        }
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

    @Transactional
    public CartEntity mergeGuestCart(String guestId, CartEntity customerCart) {
        return cartRepo.findBySessionId(guestId).stream().findFirst().map(guestCart -> {
            if (guestCart.getId().equals(customerCart.getId())) return customerCart;

            List<CartItemEntity> customerItems = cartItemRepo.findByCartId(customerCart.getId());
            for (CartItemEntity guestItem : cartItemRepo.findByCartId(guestCart.getId())) {
                UUID pId = guestItem.getProductId();
                UUID vId = guestItem.getProductVariantId();
                Optional<CartItemEntity> existing = customerItems.stream()
                        .filter(i -> matchesProductVariant(i, pId, vId))
                        .findFirst();
                if (existing.isPresent()) {
                    CartItemEntity ci = existing.get();
                    ci.setQuantity(ci.getQuantity() + guestItem.getQuantity());
                    ci.setUpdatedAt(Instant.now());
                    calculator.recalculateItem(ci);
                    cartItemRepo.save(ci);
                } else {
                    guestItem.setCart(customerCart);
                    guestItem.setUpdatedAt(Instant.now());
                    cartItemRepo.save(guestItem);
                }
            }

            guestCart.setStatus("MERGED");
            guestCart.setUpdatedAt(Instant.now());
            cartRepo.save(guestCart);

            return refreshCartTotals(customerCart);
        }).orElse(customerCart);
    }

    public List<CartItemEntity> getItems(CartEntity cart) {
        return cartItemRepo.findByCartId(cart.getId());
    }

    public List<CartCouponEntity> getCoupons(CartEntity cart) {
        return cartCouponRepo.findByCartId(cart.getId());
    }

    @Transactional
    public CartEntity applyCoupon(CartEntity cart, String code, String callerCustomerId) {
        String normalized = couponPolicy.normalizeCode(code);

        // Enforce one coupon per cart
        List<CartCouponEntity> existing = cartCouponRepo.findByCartId(cart.getId());
        if (!existing.isEmpty()) {
            throw new ConflictException("Mỗi đơn hàng chỉ được áp dụng một mã giảm giá.");
        }

        // Pessimistic lock prevents two concurrent requests from both passing the usage limit check
        CouponEntity coupon = couponRepo.findByCodeForUpdate(normalized)
                .orElseThrow(() -> new NotFoundException("Mã giảm giá không tồn tại."));

        List<CartItemEntity> items = cartItemRepo.findByCartId(cart.getId());
        BigDecimal subtotal = items.stream()
                .map(CartItemEntity::getLineSubtotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(2, RoundingMode.HALF_UP);

        couponPolicy.validateChannel(coupon, "ONLINE");
        couponPolicy.validateCustomer(coupon, callerCustomerId);
        couponPolicy.validate(coupon, subtotal);

        BigDecimal discountAmount = couponPolicy.computeDiscount(coupon, subtotal);
        Instant now = Instant.now();

        CartCouponEntity cartCoupon = new CartCouponEntity();
        cartCoupon.setCart(cart);
        cartCoupon.setCouponCode(normalized);
        cartCoupon.setDiscountType(coupon.getDiscountType());
        cartCoupon.setDiscountAmount(discountAmount);
        cartCoupon.setCreatedAt(now);
        try {
            cartCouponRepo.saveAndFlush(cartCoupon);
        } catch (DataIntegrityViolationException ex) {
            // Concurrent request slipped past the service-level pre-check and
            // hit the DB UNIQUE(cart_id) constraint from V73 migration.
            throw new ConflictException("Mỗi đơn hàng chỉ được áp dụng một mã giảm giá.");
        }

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

    private void validateQuantityAgainstStock(ProductEntity product, ProductVariantEntity variant, int quantity) {
        // Serial-tracked items: count available IN_STOCK serials directly. quantity_on_hand
        // and stock_quantity are kept in sync by the DB trigger (V89) but checking the
        // serial table avoids any sync lag and matches what checkout will re-validate.
        if (variant != null && variant.isTrackSerials()) {
            long available = serialLifecycleService.countAvailable(product.getId(), variant.getId());
            if (available < quantity) {
                throwStockShortage(product, (int) Math.min(Integer.MAX_VALUE, available));
            }
            return;
        }
        if (variant == null && product.isTrackSerials()) {
            long available = serialLifecycleService.countAvailable(product.getId(), null);
            if (available < quantity) {
                throwStockShortage(product, (int) Math.min(Integer.MAX_VALUE, available));
            }
            return;
        }

        // Legacy non-serial path — behaviour preserved exactly.
        if (variant != null) {
            if (variant.getQuantityOnHand() < quantity) {
                throwStockShortage(product, variant.getQuantityOnHand());
            }
        } else if (Boolean.TRUE.equals(product.getManageStock()) && product.getStockQuantity() != null) {
            if (product.getStockQuantity() < quantity) {
                throwStockShortage(product, product.getStockQuantity());
            }
        }
    }

    private static void throwStockShortage(ProductEntity product, int onHand) {
        throw new ConflictException(onHand <= 0
                ? "Sản phẩm '" + product.getName() + "' hết hàng."
                : "Sản phẩm '" + product.getName() + "' chỉ còn " + onHand + " trong kho.");
    }

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
        BigDecimal subtotal = items.stream()
                .map(CartItemEntity::getLineSubtotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(2, RoundingMode.HALF_UP);

        List<CartCouponEntity> coupons = cartCouponRepo.findByCartId(cart.getId());
        Instant now = Instant.now();
        List<CartCouponEntity> toRemove = new ArrayList<>();

        for (CartCouponEntity cc : coupons) {
            Optional<CouponEntity> couponOpt = couponRepo.findByCode(cc.getCouponCode());
            if (couponOpt.isEmpty()) {
                toRemove.add(cc);
                continue;
            }
            CouponEntity coupon = couponOpt.get();
            boolean nowInvalid = !"ACTIVE".equals(coupon.getStatus())
                    || (coupon.getExpiresAt() != null && now.isAfter(coupon.getExpiresAt()))
                    || (coupon.getUsageLimit() != null && coupon.getUsageCount() >= coupon.getUsageLimit())
                    || (coupon.getMinAmount() != null && subtotal.compareTo(coupon.getMinAmount()) < 0);
            if (nowInvalid) {
                toRemove.add(cc);
                continue;
            }
            // Recompute — handles PERCENT discount changing with subtotal
            BigDecimal recomputed = couponPolicy.computeDiscount(coupon, subtotal);
            if (cc.getDiscountAmount().compareTo(recomputed) != 0) {
                cc.setDiscountAmount(recomputed);
                cartCouponRepo.save(cc);
            }
        }

        if (!toRemove.isEmpty()) {
            cartCouponRepo.deleteAll(toRemove);
            coupons = cartCouponRepo.findByCartId(cart.getId());
        }

        calculator.recalculateCart(cart, items, coupons);
        cart.setUpdatedAt(now);
        return cartRepo.save(cart);
    }

    /**
     * Cart unit price always comes from the parent product. Variant-level
     * price columns exist in the schema for legacy reasons but are
     * intentionally ignored — the storefront displays a single product price
     * regardless of which variant the customer picks, and the cart must
     * agree.
     */
    private BigDecimal resolveUnitPrice(ProductEntity product, ProductVariantEntity variant) {
        BigDecimal price = product.getSalePrice() != null
                ? product.getSalePrice() : product.getRetailPrice();
        return price.setScale(2, RoundingMode.HALF_UP);
    }

    private void applyImageSnapshot(CartItemEntity item, ProductEntity product, ProductVariantEntity variant) {
        String imageUrl = variant != null && hasText(variant.getImageUrl())
                ? variant.getImageUrl()
                : product.getImageUrl();
        String imageId = variant != null && hasText(variant.getImageId())
                ? variant.getImageId()
                : product.getImageId();
        String imageAlt = variant != null && hasText(variant.getImageAlt())
                ? variant.getImageAlt()
                : product.getImageAlt();
        Integer imageWidth = variant != null && variant.getImageWidth() != null
                ? variant.getImageWidth()
                : product.getImageWidth();
        Integer imageHeight = variant != null && variant.getImageHeight() != null
                ? variant.getImageHeight()
                : product.getImageHeight();
        String imageMimeType = variant != null && hasText(variant.getImageMimeType())
                ? variant.getImageMimeType()
                : product.getImageMimeType();

        item.setProductImageId(imageId);
        item.setProductImageUrl(imageUrl);
        item.setProductImageAlt(imageAlt);
        item.setProductImageWidth(imageWidth);
        item.setProductImageHeight(imageHeight);
        item.setProductImageMimeType(imageMimeType);
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
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
