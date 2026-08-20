package com.bigbike.bigbike_backend.api.cart;

import com.bigbike.bigbike_backend.api.cart.dto.AddCartItemRequest;
import com.bigbike.bigbike_backend.api.cart.dto.CartResponse;
import com.bigbike.bigbike_backend.api.cart.dto.UpdateCartItemRequest;
import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.config.CustomerAuthCookies;
import com.bigbike.bigbike_backend.config.CustomerSessionFilter;
import com.bigbike.bigbike_backend.domain.customer.CustomerPrincipal;
import com.bigbike.bigbike_backend.mapper.CartMapper;
import com.bigbike.bigbike_backend.persistence.entity.commerce.cart.CartEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.cart.CartItemEntity;
import com.bigbike.bigbike_backend.service.cart.CartService;
import com.bigbike.bigbike_backend.service.chat.ChatInteractionService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
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
@RequiredArgsConstructor
public class CartController {

    public static final String GUEST_COOKIE = CustomerAuthCookies.COOKIE_GUEST_ID;
    private static final String CSRF_COOKIE = CustomerAuthCookies.COOKIE_CSRF;

    private final CartService cartService;
    private final ApiResponseFactory apiResponseFactory;
    private final CartMapper cartMapper;
    private final ChatInteractionService chatInteractionService;
    // Guest cookies go through the shared builder so they carry the same Domain/Secure/SameSite
    // attributes as the session cookies — a host-only bb_csrf breaks the storefront's CSRF header.
    private final CustomerAuthCookies cookies;

    @GetMapping
    public ApiDataResponse<CartResponse> getCart(HttpServletRequest request, HttpServletResponse response) {
        CartEntity cart = resolveCart(request, response);
        List<CartItemEntity> items = cartService.getItems(cart);
        return apiResponseFactory.data(
                cartMapper.toResponse(cart, items, cartService.findUnavailableItemIds(items)), request);
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
        int leadPromptSequence = chatInteractionService.offerSecondLeadAfterVerifiedCart(
                req.assistantConversationId(), updated.getCustomerId());
        return apiResponseFactory.data(
                cartMapper.toResponse(
                        updated, items, cartService.findUnavailableItemIds(items), leadPromptSequence), request);
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
        return apiResponseFactory.data(
                cartMapper.toResponse(updated, items, cartService.findUnavailableItemIds(items)), request);
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
        return apiResponseFactory.data(
                cartMapper.toResponse(updated, items, cartService.findUnavailableItemIds(items)), request);
    }

    // Both DELETE /cart and DELETE /cart/clear empty the cart — frontends use the latter.
    @DeleteMapping(path = {"", "/clear"})
    public ApiDataResponse<CartResponse> clearCart(HttpServletRequest request, HttpServletResponse response) {
        CartEntity cart = resolveCart(request, response);
        CartEntity updated = cartService.clearCart(cart);
        List<CartItemEntity> items = cartService.getItems(updated);
        return apiResponseFactory.data(
                cartMapper.toResponse(updated, items, cartService.findUnavailableItemIds(items)), request);
    }

    // ── cart resolution ───────────────────────────────────────────────────────

    private CartEntity resolveCart(HttpServletRequest request, HttpServletResponse response) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof CustomerPrincipal cp) {
            CartEntity customerCart = cartService.getOrCreateCustomerCart(cp.customerId());
            String guestId = CustomerSessionFilter.extractCookie(request, GUEST_COOKIE);
            if (guestId != null) {
                customerCart = cartService.mergeGuestCart(guestId, customerCart);
                clearGuestCookie(response);
            }
            return customerCart;
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
        cookies.setGuestId(response, guestId);
    }

    private void clearGuestCookie(HttpServletResponse response) {
        cookies.clearGuestId(response);
    }

    private void setCsrfCookie(HttpServletResponse response, String csrfValue) {
        cookies.setGuestCsrf(response, csrfValue);
    }

    // ── mapping helpers ───────────────────────────────────────────────────────

}
