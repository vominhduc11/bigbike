package com.bigbike.bigbike_backend.api.checkout;

import com.bigbike.bigbike_backend.api.cart.CartController;
import com.bigbike.bigbike_backend.api.checkout.dto.CheckoutOptionsResponse;
import com.bigbike.bigbike_backend.api.checkout.dto.CheckoutRequest;
import com.bigbike.bigbike_backend.api.checkout.dto.OrderSummaryResponse;
import com.bigbike.bigbike_backend.api.checkout.dto.QuickBuyRequest;
import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.config.ClientIpResolver;
import com.bigbike.bigbike_backend.config.CustomerSessionFilter;
import com.bigbike.bigbike_backend.domain.customer.CustomerPrincipal;
import com.bigbike.bigbike_backend.persistence.entity.commerce.cart.CartEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.cart.CartItemEntity;
import com.bigbike.bigbike_backend.service.cart.CartService;
import com.bigbike.bigbike_backend.service.checkout.CheckoutService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class CheckoutController {

    private static final String IDEMPOTENCY_HEADER = "Idempotency-Key";
    private static final int GUEST_TTL = 60 * 60 * 24 * 30; // 30 days
    private static final Pattern IDEMPOTENCY_KEY_PATTERN = Pattern.compile("^[a-zA-Z0-9\\-]{1,128}$");

    @Value("${bigbike.cookies.secure:false}")
    private boolean secureCookies;

    private final CheckoutService checkoutService;
    private final CartService cartService;
    private final ClientIpResolver clientIpResolver;
    private final ApiResponseFactory apiResponseFactory;

    @PostMapping("/checkout")
    public ApiDataResponse<OrderSummaryResponse> checkout(
            @Valid @RequestBody CheckoutRequest req,
            HttpServletRequest request
    ) {
        CustomerPrincipal cp = resolveCustomerPrincipal();
        CartEntity cart = resolveCart(cp, request);
        List<CartItemEntity> items = cartService.getItems(cart);
        UUID customerId = cp != null ? cp.customerId() : null;
        String guestSessionId = cp == null ? cart.getSessionId() : null;
        String idempotencyKey = validateIdempotencyKey(request.getHeader(IDEMPOTENCY_HEADER));
        String clientIp = clientIpResolver.resolve(request);
        String userAgent = request.getHeader("User-Agent");
        OrderSummaryResponse result = checkoutService.checkoutFromCart(
                cart, items, req, customerId, guestSessionId, idempotencyKey, clientIp, userAgent);
        return apiResponseFactory.data(result, request);
    }

    @PostMapping("/orders/quick-buy")
    public ApiDataResponse<OrderSummaryResponse> quickBuy(
            @Valid @RequestBody QuickBuyRequest req,
            HttpServletRequest request,
            HttpServletResponse response
    ) {
        CustomerPrincipal cp = resolveCustomerPrincipal();
        UUID customerId = cp != null ? cp.customerId() : null;
        String guestSessionId = cp == null ? resolveOrCreateGuestId(request, response) : null;
        String idempotencyKey = validateIdempotencyKey(request.getHeader(IDEMPOTENCY_HEADER));
        String clientIp = clientIpResolver.resolve(request);
        String userAgent = request.getHeader("User-Agent");
        OrderSummaryResponse result = checkoutService.quickBuy(
                req, customerId, guestSessionId, idempotencyKey, clientIp, userAgent);
        return apiResponseFactory.data(result, request);
    }

    @GetMapping("/checkout/options")
    public ApiDataResponse<CheckoutOptionsResponse> getOptions(HttpServletRequest request) {
        return apiResponseFactory.data(checkoutService.getOptions(), request);
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private CustomerPrincipal resolveCustomerPrincipal() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof CustomerPrincipal cp) {
            return cp;
        }
        return null;
    }

    private CartEntity resolveCart(CustomerPrincipal cp, HttpServletRequest request) {
        if (cp != null) {
            return cartService.getOrCreateCustomerCart(cp.customerId());
        }
        String guestId = CustomerSessionFilter.extractCookie(request, CartController.GUEST_COOKIE);
        if (guestId == null) {
            // Guest with no cart — creates a new empty cart; checkout will fail on EMPTY_CART
            guestId = UUID.randomUUID().toString();
        }
        return cartService.getOrCreateGuestCart(guestId);
    }

    private String resolveOrCreateGuestId(HttpServletRequest request, HttpServletResponse response) {
        String guestId = CustomerSessionFilter.extractCookie(request, CartController.GUEST_COOKIE);
        if (guestId == null) {
            guestId = UUID.randomUUID().toString();
            ResponseCookie cookie = ResponseCookie.from(CartController.GUEST_COOKIE, guestId)
                    .httpOnly(false)
                    .secure(secureCookies)
                    .path("/")
                    .maxAge(GUEST_TTL)
                    .sameSite("Strict")
                    .build();
            response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
        }
        return guestId;
    }

    private String validateIdempotencyKey(String key) {
        if (key == null || key.isBlank()) {
            return null; // optional — CheckoutService handles null via IdempotencyReservation.none()
        }
        if (!IDEMPOTENCY_KEY_PATTERN.matcher(key).matches()) {
            throw ValidationException.fromField("idempotencyKey", "INVALID_FORMAT",
                    "Idempotency-Key must be 1-128 alphanumeric or hyphen characters");
        }
        return key;
    }
}
