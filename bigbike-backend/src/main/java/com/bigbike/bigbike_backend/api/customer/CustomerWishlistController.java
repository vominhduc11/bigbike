package com.bigbike.bigbike_backend.api.customer;

import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.api.error.UnauthorizedException;
import com.bigbike.bigbike_backend.domain.customer.CustomerPrincipal;
import com.bigbike.bigbike_backend.persistence.entity.commerce.WishlistItemEntity;
import com.bigbike.bigbike_backend.persistence.repository.commerce.WishlistItemJpaRepository;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/customer/wishlist")
public class CustomerWishlistController {

    private final WishlistItemJpaRepository wishlistRepo;
    private final ApiResponseFactory apiResponseFactory;

    public CustomerWishlistController(
            WishlistItemJpaRepository wishlistRepo,
            ApiResponseFactory apiResponseFactory
    ) {
        this.wishlistRepo = wishlistRepo;
        this.apiResponseFactory = apiResponseFactory;
    }

    @GetMapping
    public ApiDataResponse<List<String>> getWishlist(HttpServletRequest request) {
        UUID customerId = requireCustomerId();
        List<String> productIds = wishlistRepo
                .findByCustomerIdOrderByAddedAtDesc(customerId)
                .stream()
                .map(WishlistItemEntity::getProductId)
                .toList();
        return apiResponseFactory.data(productIds, request);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public ApiDataResponse<Map<String, Object>> addToWishlist(
            @RequestBody Map<String, String> body,
            HttpServletRequest request
    ) {
        UUID customerId = requireCustomerId();
        String productId = body.get("productId");
        if (productId == null || productId.isBlank()) {
            throw new IllegalArgumentException("productId là bắt buộc.");
        }

        boolean alreadyExists = wishlistRepo.existsByCustomerIdAndProductId(customerId, productId);
        if (!alreadyExists) {
            WishlistItemEntity item = new WishlistItemEntity();
            item.setCustomerId(customerId);
            item.setProductId(productId.trim());
            item.setAddedAt(Instant.now());
            wishlistRepo.save(item);
        }

        return apiResponseFactory.data(Map.of("productId", productId, "added", !alreadyExists), request);
    }

    @DeleteMapping("/{productId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void removeFromWishlist(@PathVariable String productId) {
        UUID customerId = requireCustomerId();
        wishlistRepo.deleteByCustomerIdAndProductId(customerId, productId);
    }

    private UUID requireCustomerId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof CustomerPrincipal cp) {
            return cp.customerId();
        }
        throw new UnauthorizedException("Customer authentication required.");
    }
}
