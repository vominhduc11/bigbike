package com.bigbike.bigbike_backend.api.customer;

import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiListResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.api.error.UnauthorizedException;
import com.bigbike.bigbike_backend.domain.catalog.Product;
import com.bigbike.bigbike_backend.domain.customer.CustomerPrincipal;
import com.bigbike.bigbike_backend.persistence.entity.commerce.WishlistItemEntity;
import com.bigbike.bigbike_backend.persistence.repository.commerce.WishlistItemJpaRepository;
import com.bigbike.bigbike_backend.service.catalog.CatalogReadService;
import com.bigbike.bigbike_backend.service.common.PageResult;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Validated
@RequestMapping("/api/v1/customer/wishlist")
@RequiredArgsConstructor
public class CustomerWishlistController {

    private final WishlistItemJpaRepository wishlistRepo;
    private final CatalogReadService catalogReadService;
    private final ApiResponseFactory apiResponseFactory;

    @GetMapping("/products")
    public ApiListResponse<Product> getWishlistProducts(
            @RequestParam(defaultValue = "1") @Min(1) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size,
            HttpServletRequest request
    ) {
        UUID customerId = requireCustomerId();
        List<String> productIds = wishlistRepo
                .findByCustomerIdOrderByAddedAtDesc(customerId)
                .stream()
                .map(WishlistItemEntity::getProductId)
                .toList();
        PageResult<Product> result = catalogReadService.getWishlistProducts(productIds, page, size, "vi");
        return apiResponseFactory.list(result, request);
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
            @Valid @RequestBody WishlistProductRequest body,
            HttpServletRequest request
    ) {
        UUID customerId = requireCustomerId();
        String productId = body.productId().trim();

        boolean alreadyExists = wishlistRepo.existsByCustomerIdAndProductId(customerId, productId);
        if (!alreadyExists) {
            WishlistItemEntity item = new WishlistItemEntity();
            item.setCustomerId(customerId);
            item.setProductId(productId);
            item.setAddedAt(Instant.now());
            wishlistRepo.save(item);
        }

        return apiResponseFactory.data(Map.of("productId", productId, "added", !alreadyExists), request);
    }

    @DeleteMapping("/{productId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void removeFromWishlist(@PathVariable @Size(max = 64) String productId, HttpServletRequest request) {
        UUID customerId = requireCustomerId();
        wishlistRepo.deleteByCustomerIdAndProductId(customerId, productId);
    }

    public record WishlistProductRequest(
            @NotBlank
            @Size(max = 64)
            String productId
    ) {}

    private UUID requireCustomerId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof CustomerPrincipal cp) {
            return cp.customerId();
        }
        throw new UnauthorizedException("Customer authentication required.");
    }
}
