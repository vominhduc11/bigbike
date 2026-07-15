package com.bigbike.bigbike_backend.service.cart;

import com.bigbike.bigbike_backend.api.cart.dto.AddCartItemRequest;
import com.bigbike.bigbike_backend.api.error.ConflictException;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.cart.CartEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.cart.CartItemEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductVariantJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.cart.CartItemJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.cart.CartJpaRepository;
import com.bigbike.bigbike_backend.service.pricing.VariantPricing;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class CartService {

    private static final String STATUS_ACTIVE = "ACTIVE";
    private static final String CURRENCY_VND = "VND";

    private final CartJpaRepository cartRepo;
    private final CartItemJpaRepository cartItemRepo;
    private final ProductJpaRepository productRepo;
    private final ProductVariantJpaRepository variantRepo;
    private final CartCalculator calculator;

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
        // STOCK_RULE_004: forceOutOfStock is a product-level hard override — it blocks
        // adding to cart even when an individual variant is still marked available.
        if (Boolean.TRUE.equals(product.getForceOutOfStock())) {
            throw new ConflictException("Product is out of stock.");
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
            if (product.getStockState() == ProductStockState.OUT_OF_STOCK) {
                throw new ConflictException("Product is out of stock.");
            }
        }

        BigDecimal unitPrice = resolveUnitPrice(product, variant);
        if (unitPrice == null || unitPrice.compareTo(BigDecimal.ZERO) < 0) {
            throw new ConflictException("Product does not have a valid price.");
        }

        UUID productUuid = tryParseUUID(product.getId());
        UUID variantUuid = (variant != null) ? tryParseUUID(variant.getId()) : null;
        String variantPk = (variant != null) ? variant.getId() : null;

        // Targeted query — avoids loading all cart items just to find one matching product+variant.
        // Keyed on the varchar PKs (UUID columns are null for migrated wp-* catalog, see V176).
        Optional<CartItemEntity> existing = cartItemRepo
                .findByCartIdAndProductPkAndProductVariantPk(cart.getId(), product.getId(), variantPk);

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
            item.setProductVariantPk(variantPk);
            item.setSku(variant != null ? variant.getSku() : product.getSku());
            item.setProductName(product.getName());
            item.setVariantName(variant != null ? variant.getName() : null);
            applyImageSnapshot(item, product, variant);
            item.setQuantity(req.quantity());
            item.setUnitPrice(unitPrice);
            item.setRegularPrice(VariantPricing.regularPrice(product, variant));
            item.setSalePrice(VariantPricing.salePrice(product, variant));
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
        // Resolve by varchar PK so migrated wp-* lines (UUID columns null, see V176) are re-validated too.
        if (item.getProductPk() != null) {
            ProductEntity product = productRepo.findById(item.getProductPk()).orElse(null);
            if (product != null) {
                ProductVariantEntity variant = item.getProductVariantPk() != null
                        ? variantRepo.findById(item.getProductVariantPk()).orElse(null)
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
        return refreshCartTotals(cart);
    }

    @Transactional
    public CartEntity mergeGuestCart(String guestId, CartEntity customerCart) {
        return cartRepo.findBySessionIdAndStatus(guestId, STATUS_ACTIVE).stream().findFirst().map(guestCart -> {
            if (guestCart.getId().equals(customerCart.getId())) return customerCart;

            List<CartItemEntity> customerItems = cartItemRepo.findByCartId(customerCart.getId());
            for (CartItemEntity guestItem : cartItemRepo.findByCartId(guestCart.getId())) {
                String pPk = guestItem.getProductPk();
                String vPk = guestItem.getProductVariantPk();
                Optional<CartItemEntity> existing = customerItems.stream()
                        .filter(i -> matchesProductVariant(i, pPk, vPk))
                        .findFirst();
                if (existing.isPresent()) {
                    CartItemEntity ci = existing.get();
                    ci.setQuantity(ci.getQuantity() + guestItem.getQuantity());
                    ci.setUpdatedAt(Instant.now());
                    calculator.recalculateItem(ci);
                    cartItemRepo.save(ci);
                    cartItemRepo.delete(guestItem);
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

    public Set<UUID> findUnavailableItemIds(List<CartItemEntity> items) {
        if (items.isEmpty()) return Set.of();

        // Resolve by varchar PK so migrated wp-* lines (UUID columns null, see V176) are checked too.
        // Mirrors the checkout purchase gate (validateCartAgainstStock) so the cart flags
        // an item as unavailable in the same cases checkout would reject it.
        Set<String> productPks = items.stream()
                .map(CartItemEntity::getProductPk)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        Map<String, ProductEntity> productsById = productRepo.findAllById(productPks).stream()
                .collect(Collectors.toMap(ProductEntity::getId, p -> p));

        Set<String> variantPks = items.stream()
                .map(CartItemEntity::getProductVariantPk)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        Map<String, Boolean> variantEnabled = variantPks.isEmpty() ? Map.of()
                : variantRepo.findAllById(variantPks).stream()
                        .collect(Collectors.toMap(
                                ProductVariantEntity::getId,
                                ProductVariantEntity::isAvailable));

        Set<UUID> unavailable = new HashSet<>();
        for (CartItemEntity item : items) {
            String productPk = item.getProductPk();
            String variantPk = item.getProductVariantPk();
            ProductEntity product = productPk != null ? productsById.get(productPk) : null;
            boolean productOk = productPk == null
                    || (product != null
                            && product.getPublishStatus() == PublishStatus.PUBLISHED
                            && !Boolean.TRUE.equals(product.getForceOutOfStock())
                            && (variantPk != null
                                    || product.getStockState() != ProductStockState.OUT_OF_STOCK));
            boolean variantOk = variantPk == null || Boolean.TRUE.equals(variantEnabled.get(variantPk));
            if (!productOk || !variantOk) {
                unavailable.add(item.getId());
            }
        }
        return unavailable;
    }

    // ── private helpers ───────────────────────────────────────────────────────

    private void validateQuantityAgainstStock(ProductEntity product, ProductVariantEntity variant, int quantity) {
        // Boolean availability only (owner decision 2026-06-23): block when out of stock,
        // never by quantity. Method name/call sites kept.
        // STOCK_RULE_004: product-level forceOutOfStock hard-blocks variants too.
        boolean outOfStock = Boolean.TRUE.equals(product.getForceOutOfStock())
                || ((variant != null)
                        ? !variant.isAvailable()
                        : product.getStockState() == ProductStockState.OUT_OF_STOCK);
        if (outOfStock) {
            throw new ConflictException("Sản phẩm '" + product.getName() + "' hết hàng.");
        }
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
        calculator.recalculateCart(cart, items);
        cart.setUpdatedAt(Instant.now());
        return cartRepo.save(cart);
    }

    private BigDecimal resolveUnitPrice(ProductEntity product, ProductVariantEntity variant) {
        return VariantPricing.resolveUnitPrice(product, variant);
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

    private boolean matchesProductVariant(CartItemEntity item, String productPk, String variantPk) {
        boolean productMatch = (productPk == null)
                ? item.getProductPk() == null
                : productPk.equals(item.getProductPk());
        boolean variantMatch = (variantPk == null)
                ? item.getProductVariantPk() == null
                : variantPk.equals(item.getProductVariantPk());
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
