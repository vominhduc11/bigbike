package com.bigbike.bigbike_backend.api.cart;

import com.bigbike.bigbike_backend.api.cart.dto.AddCartItemRequest;
import com.bigbike.bigbike_backend.api.cart.dto.ApplyCouponRequest;
import com.bigbike.bigbike_backend.api.cart.dto.CartItemResponse;
import com.bigbike.bigbike_backend.api.cart.dto.CartResponse;
import com.bigbike.bigbike_backend.api.cart.dto.CartTotalsResponse;
import com.bigbike.bigbike_backend.api.cart.dto.UpdateCartItemRequest;
import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.config.CustomerSessionFilter;
import com.bigbike.bigbike_backend.domain.customer.CustomerPrincipal;
import com.bigbike.bigbike_backend.persistence.entity.commerce.cart.CartCouponEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.cart.CartEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.cart.CartItemEntity;
import com.bigbike.bigbike_backend.service.cart.CartService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/cart")
public class CartController {

    public static final String GUEST_COOKIE = "bb_guest_id";
    private static final String CSRF_COOKIE = "bb_csrf";
    private static final int GUEST_TTL = 60 * 60 * 24 * 30; // 30 days

    private final CartService cartService;
    private final ApiResponseFactory apiResponseFactory;

    public CartController(CartService cartService, ApiResponseFactory apiResponseFactory) {
        this.cartService = cartService;
        this.apiResponseFactory = apiResponseFactory;
    }

    @GetMapping
    public ApiDataResponse<CartResponse> getCart(HttpServletRequest request, HttpServletResponse response) {
        CartEntity cart = resolveCart(request, response);
        List<CartItemEntity> items = cartService.getItems(cart);
        List<CartCouponEntity> coupons = cartService.getCoupons(cart);
        return apiResponseFactory.data(toResponse(cart, items, coupons), request);
    }

    @PostMapping("/items")
    public ApiDataResponse<CartResponse> addItem(
            @Valid @RequestBody AddCartItemRequest req,
            HttpServletRequest request,
            HttpServletResponse response
    ) {
        CartEntity cart = resolveCart(request, response);
        CartEntity updated = cartService.addItem(cart, req);
        List<CartItemEntity> items = cartService.getItems(updated);
        List<CartCouponEntity> coupons = cartService.getCoupons(updated);
        return apiResponseFactory.data(toResponse(updated, items, coupons), request);
    }

    @PatchMapping("/items/{itemId}")
    public ApiDataResponse<CartResponse> updateItem(
            @PathVariable UUID itemId,
            @Valid @RequestBody UpdateCartItemRequest req,
            HttpServletRequest request,
            HttpServletResponse response
    ) {
        CartEntity cart = resolveCart(request, response);
        CartEntity updated = cartService.updateItemQuantity(cart, itemId, req.quantity());
        List<CartItemEntity> items = cartService.getItems(updated);
        List<CartCouponEntity> coupons = cartService.getCoupons(updated);
        return apiResponseFactory.data(toResponse(updated, items, coupons), request);
    }

    @DeleteMapping("/items/{itemId}")
    public ApiDataResponse<CartResponse> removeItem(
            @PathVariable UUID itemId,
            HttpServletRequest request,
            HttpServletResponse response
    ) {
        CartEntity cart = resolveCart(request, response);
        CartEntity updated = cartService.removeItem(cart, itemId);
        List<CartItemEntity> items = cartService.getItems(updated);
        List<CartCouponEntity> coupons = cartService.getCoupons(updated);
        return apiResponseFactory.data(toResponse(updated, items, coupons), request);
    }

    @DeleteMapping
    public ApiDataResponse<CartResponse> clearCart(HttpServletRequest request, HttpServletResponse response) {
        CartEntity cart = resolveCart(request, response);
        CartEntity updated = cartService.clearCart(cart);
        List<CartItemEntity> items = cartService.getItems(updated);
        List<CartCouponEntity> coupons = cartService.getCoupons(updated);
        return apiResponseFactory.data(toResponse(updated, items, coupons), request);
    }

    @PostMapping("/coupons")
    public ApiDataResponse<CartResponse> applyCoupon(
            @Valid @RequestBody ApplyCouponRequest req,
            HttpServletRequest request,
            HttpServletResponse response
    ) {
        CartEntity cart = resolveCart(request, response);
        CartEntity updated = cartService.applyCoupon(cart, req.code());
        List<CartItemEntity> items = cartService.getItems(updated);
        List<CartCouponEntity> coupons = cartService.getCoupons(updated);
        return apiResponseFactory.data(toResponse(updated, items, coupons), request);
    }

    @DeleteMapping("/coupons/{code}")
    public ApiDataResponse<CartResponse> removeCoupon(
            @PathVariable String code,
            HttpServletRequest request,
            HttpServletResponse response
    ) {
        CartEntity cart = resolveCart(request, response);
        CartEntity updated = cartService.removeCoupon(cart, code);
        List<CartItemEntity> items = cartService.getItems(updated);
        List<CartCouponEntity> coupons = cartService.getCoupons(updated);
        return apiResponseFactory.data(toResponse(updated, items, coupons), request);
    }

    // ── cart resolution ───────────────────────────────────────────────────────

    private CartEntity resolveCart(HttpServletRequest request, HttpServletResponse response) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof CustomerPrincipal cp) {
            return cartService.getOrCreateCustomerCart(cp.customerId());
        }
        // Guest flow
        String guestId = CustomerSessionFilter.extractCookie(request, GUEST_COOKIE);
        if (guestId == null) {
            guestId = UUID.randomUUID().toString();
            setGuestCookie(response, guestId);
        }
        // Issue CSRF cookie for guest if not present (enables subsequent mutations)
        String existingCsrf = CustomerSessionFilter.extractCookie(request, CSRF_COOKIE);
        if (existingCsrf == null) {
            setCsrfCookie(response, UUID.randomUUID().toString());
        }
        return cartService.getOrCreateGuestCart(guestId);
    }

    // ── cookie helpers ────────────────────────────────────────────────────────

    private void setGuestCookie(HttpServletResponse response, String guestId) {
        ResponseCookie cookie = ResponseCookie.from(GUEST_COOKIE, guestId)
                .httpOnly(false)
                .secure(false)
                .path("/")
                .maxAge(GUEST_TTL)
                .sameSite("Strict")
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }

    private void setCsrfCookie(HttpServletResponse response, String csrfValue) {
        ResponseCookie cookie = ResponseCookie.from(CSRF_COOKIE, csrfValue)
                .httpOnly(false)
                .secure(false)
                .path("/")
                .maxAge(GUEST_TTL)
                .sameSite("Strict")
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }

    // ── mapping helpers ───────────────────────────────────────────────────────

    private CartResponse toResponse(CartEntity cart, List<CartItemEntity> items, List<CartCouponEntity> coupons) {
        List<CartItemResponse> itemResponses = items.stream()
                .map(this::toItemResponse)
                .toList();
        CartTotalsResponse totals = new CartTotalsResponse(
                cart.getSubtotalAmount(),
                cart.getDiscountAmount(),
                cart.getShippingAmount(),
                cart.getFeeAmount(),
                cart.getTotalAmount()
        );
        List<String> couponCodes = coupons.stream()
                .map(CartCouponEntity::getCouponCode)
                .toList();
        return new CartResponse(cart.getId(), cart.getStatus(), cart.getCurrency(), itemResponses, totals, couponCodes);
    }

    private CartItemResponse toItemResponse(CartItemEntity item) {
        return new CartItemResponse(
                item.getId(),
                item.getProductId() != null ? item.getProductId().toString() : null,
                item.getProductVariantId() != null ? item.getProductVariantId().toString() : null,
                item.getSku(),
                item.getProductName(),
                item.getVariantName(),
                item.getQuantity(),
                item.getUnitPrice(),
                item.getLineSubtotal(),
                item.getLineDiscount(),
                item.getLineTotal()
        );
    }
}
