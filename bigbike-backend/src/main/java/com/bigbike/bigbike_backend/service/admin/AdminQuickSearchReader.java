package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.quicksearch.AdminQuickSearchGroup;
import com.bigbike.bigbike_backend.api.admin.dto.quicksearch.AdminQuickSearchItem;
import com.bigbike.bigbike_backend.api.admin.dto.quicksearch.AdminQuickSearchVariant;
import com.bigbike.bigbike_backend.api.admin.dto.quicksearch.AdminQuickSearchVariantOption;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.persistence.entity.catalog.AttributeValueEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantOptionEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderAddressEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderEntity;
import com.bigbike.bigbike_backend.persistence.entity.content.ArticleEntity;
import com.bigbike.bigbike_backend.persistence.entity.customer.CustomerEntity;
import com.bigbike.bigbike_backend.persistence.repository.auth.AdminUserJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.BrandJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.CategoryJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderAddressJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.content.ArticleJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.customer.CustomerJpaRepository;
import com.bigbike.bigbike_backend.repository.catalog.ProductFilterSpecifications;
import com.bigbike.bigbike_backend.util.AdminSearchText;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Read-only group readers for the admin top-bar search. Each method owns a separate
 * transaction so a database failure in one group can be reported locally without
 * discarding successful results from the other groups.
 */
@Service
@RequiredArgsConstructor
class AdminQuickSearchReader {

    private static final int PREVIEW_LIMIT = 5;
    private static final String UNCATEGORIZED_BRAND_ID = "uncategorized-brand";

    private final OrderJpaRepository orderRepository;
    private final OrderAddressJpaRepository orderAddressRepository;
    private final CustomerJpaRepository customerRepository;
    private final ProductJpaRepository productRepository;
    private final CategoryJpaRepository categoryRepository;
    private final BrandJpaRepository brandRepository;
    private final ArticleJpaRepository articleRepository;
    private final AdminUserJpaRepository adminUserRepository;

    @Transactional(readOnly = true, propagation = Propagation.REQUIRES_NEW)
    AdminQuickSearchGroup searchOrders(String query) {
        List<OrderEntity> orders = orderRepository.findAll(
                AdminOrderSupport.buildFilterSpecification(null, query, null, null));
        List<java.util.UUID> orderIds = orders.stream()
                .map(OrderEntity::getId)
                .filter(Objects::nonNull)
                .toList();
        Map<java.util.UUID, String> shippingNames = orderIds.isEmpty()
                ? Map.of()
                : orderAddressRepository.findByOrderIdInAndType(orderIds, "SHIPPING").stream()
                        .filter(address -> address.getOrder() != null && address.getOrder().getId() != null)
                        .filter(address -> !isBlank(address.getFullName()))
                        .collect(Collectors.toMap(
                                address -> address.getOrder().getId(),
                                OrderAddressEntity::getFullName,
                                (first, ignored) -> first,
                                LinkedHashMap::new));

        List<Ranked> ranked = orders.stream()
                .map(order -> {
                    String shippingName = shippingNames.get(order.getId());
                    List<Field> fields = fields(
                            new Field("orderNumber", order.getOrderNumber()),
                            new Field("orderKey", order.getOrderKey()),
                            new Field("customerEmail", order.getCustomerEmail()),
                            new Field("customerPhone", order.getCustomerPhone()),
                            new Field("customerName", order.getCustomerName()),
                            new Field("shippingRecipientName", shippingName));
                    return ranked(
                            query,
                            fields,
                            AdminQuickSearchItem.order(
                                    id(order.getId()),
                                    order.getOrderNumber(),
                                    order.getStatus(),
                                    order.getCustomerName(),
                                    shippingName,
                                    order.getCustomerEmail(),
                                    order.getCustomerPhone(),
                                    order.getTotalAmount(),
                                    order.getCurrency(),
                                    bestField(query, fields)),
                            firstNonBlank(order.getOrderNumber(), order.getCustomerName(), shippingName));
                })
                .toList();
        return ready(ranked);
    }

    @Transactional(readOnly = true, propagation = Propagation.REQUIRES_NEW)
    AdminQuickSearchGroup searchCustomers(String query) {
        List<CustomerEntity> customers = customerRepository.findAll(
                AdminCustomerService.buildSpec(query, null, null, null));
        List<Ranked> ranked = customers.stream()
                .map(customer -> {
                    List<Field> fields = fields(
                            new Field("displayName", customer.getDisplayName()),
                            new Field("firstName", customer.getFirstName()),
                            new Field("lastName", customer.getLastName()),
                            new Field("email", customer.getEmail()),
                            new Field("phone", customer.getPhone()));
                    return ranked(
                            query,
                            fields,
                            AdminQuickSearchItem.customer(
                                    id(customer.getId()),
                                    customer.getDisplayName(),
                                    customer.getEmail(),
                                    customer.getPhone(),
                                    customer.getStatus(),
                                    bestField(query, fields)),
                            firstNonBlank(customer.getDisplayName(), customer.getEmail(), customer.getPhone()));
                })
                .toList();
        return ready(ranked);
    }

    @Transactional(readOnly = true, propagation = Propagation.REQUIRES_NEW)
    AdminQuickSearchGroup searchProducts(String query) {
        List<ProductEntity> candidates = productRepository.findAll(
                ProductFilterSpecifications.forAdminList(query, null, null, null, List.of(), null));
        if (candidates.isEmpty()) {
            return AdminQuickSearchGroup.ready(0, List.of());
        }

        List<String> ids = candidates.stream()
                .map(ProductEntity::getId)
                .filter(Objects::nonNull)
                .toList();
        Map<String, ProductEntity> withVariants = ids.isEmpty()
                ? Map.of()
                : productRepository.findByIdsWithVariants(ids).stream()
                        .collect(Collectors.toMap(ProductEntity::getId, Function.identity(), (first, ignored) -> first));

        List<Ranked> ranked = candidates.stream()
                .map(candidate -> withVariants.getOrDefault(candidate.getId(), candidate))
                .map(product -> {
                    List<Field> fields = new ArrayList<>(fields(
                            new Field("name", product.getName()),
                            new Field("nameEn", product.getNameEn()),
                            new Field("slug", product.getSlug()),
                            new Field("slugEn", product.getSlugEn()),
                            new Field("sku", product.getSku())));
                    List<AdminQuickSearchVariant> matchedVariants = safeVariants(product).stream()
                            .filter(variant -> AdminSearchText.matchesAllTokens(
                                    query, Collections.singletonList(variant.getSku())))
                            .map(AdminQuickSearchReader::toVariant)
                            .toList();
                    safeVariants(product).stream()
                            .map(ProductVariantEntity::getSku)
                            .filter(value -> !isBlank(value))
                            .forEach(value -> fields.add(new Field("variantSku", value)));
                    return ranked(
                            query,
                            fields,
                            AdminQuickSearchItem.product(
                                    product.getId(),
                                    product.getName(),
                                    product.getSku(),
                                    bestField(query, fields),
                                    matchedVariants),
                            firstNonBlank(product.getName(), product.getSku(), product.getSlug()));
                })
                .toList();
        return ready(ranked);
    }

    @Transactional(readOnly = true, propagation = Propagation.REQUIRES_NEW)
    AdminQuickSearchGroup searchCategories(String query) {
        List<Ranked> ranked = categoryRepository.findAll().stream()
                .filter(category -> !category.isDeleted())
                .map(category -> {
                    List<Field> fields = fields(
                            new Field("name", category.getName()),
                            new Field("nameEn", category.getNameEn()),
                            new Field("slug", category.getSlug()),
                            new Field("slugEn", category.getSlugEn()));
                    return ranked(
                            query,
                            fields,
                            AdminQuickSearchItem.named(
                                    category.getId(), category.getName(), category.getSlug(), bestField(query, fields)),
                            firstNonBlank(category.getName(), category.getSlug()));
                })
                .toList();
        return ready(ranked);
    }

    @Transactional(readOnly = true, propagation = Propagation.REQUIRES_NEW)
    AdminQuickSearchGroup searchBrands(String query) {
        List<Ranked> ranked = brandRepository.findAll().stream()
                .filter(brand -> brand.isVisible())
                .filter(brand -> !UNCATEGORIZED_BRAND_ID.equals(brand.getId()))
                .map(brand -> {
                    List<Field> fields = fields(
                            new Field("name", brand.getName()),
                            new Field("slug", brand.getSlug()));
                    return ranked(
                            query,
                            fields,
                            AdminQuickSearchItem.named(
                                    brand.getId(), brand.getName(), brand.getSlug(), bestField(query, fields)),
                            firstNonBlank(brand.getName(), brand.getSlug()));
                })
                .toList();
        return ready(ranked);
    }

    @Transactional(readOnly = true, propagation = Propagation.REQUIRES_NEW)
    AdminQuickSearchGroup searchArticles(String query) {
        List<Ranked> ranked = articleRepository.findAll().stream()
                .filter(article -> article.getPublishStatus() != PublishStatus.TRASH)
                .map(article -> {
                    List<Field> fields = fields(
                            new Field("title", article.getTitle()),
                            new Field("titleEn", article.getTitleEn()),
                            new Field("slug", article.getSlug()),
                            new Field("slugEn", article.getSlugEn()),
                            new Field("excerpt", article.getExcerpt()),
                            new Field("excerptEn", article.getExcerptEn()));
                    return ranked(
                            query,
                            fields,
                            AdminQuickSearchItem.article(
                                    article.getId(), article.getTitle(), article.getSlug(), bestField(query, fields)),
                            firstNonBlank(article.getTitle(), article.getSlug()));
                })
                .toList();
        return ready(ranked);
    }

    @Transactional(readOnly = true, propagation = Propagation.REQUIRES_NEW)
    AdminQuickSearchGroup searchAdminUsers(String query) {
        List<Ranked> ranked = adminUserRepository.findAll().stream()
                .map(user -> {
                    List<Field> fields = fields(
                            new Field("displayName", user.getDisplayName()),
                            new Field("email", user.getEmail()));
                    return ranked(
                            query,
                            fields,
                            AdminQuickSearchItem.adminUser(
                                    id(user.getId()),
                                    user.getDisplayName(),
                                    user.getEmail(),
                                    user.getRole(),
                                    user.getStatus(),
                                    bestField(query, fields)),
                            firstNonBlank(user.getDisplayName(), user.getEmail()));
                })
                .toList();
        return ready(ranked);
    }

    private static AdminQuickSearchVariant toVariant(ProductVariantEntity variant) {
        List<AdminQuickSearchVariantOption> options = safeOptions(variant).stream()
                .map(option -> new AdminQuickSearchVariantOption(
                        option.getOptionName(),
                        option.getOptionValue(),
                        attributeValueId(option.getAttributeValue())))
                .toList();
        return new AdminQuickSearchVariant(
                variant.getId(), variant.getSku(), variant.getName(), options);
    }

    private static String attributeValueId(AttributeValueEntity value) {
        return value == null ? null : value.getId();
    }

    private static List<ProductVariantEntity> safeVariants(ProductEntity product) {
        return product.getVariants() == null ? List.of() : product.getVariants();
    }

    private static List<ProductVariantOptionEntity> safeOptions(ProductVariantEntity variant) {
        return variant.getOptions() == null ? List.of() : variant.getOptions();
    }

    private static AdminQuickSearchGroup ready(List<Ranked> ranked) {
        List<Ranked> matched = ranked.stream()
                .filter(result -> result.rank() != Integer.MAX_VALUE)
                .toList();
        List<AdminQuickSearchItem> items = matched.stream()
                .sorted(RANKED_COMPARATOR)
                .limit(PREVIEW_LIMIT)
                .map(Ranked::item)
                .toList();
        return AdminQuickSearchGroup.ready(matched.size(), items);
    }

    private static Ranked ranked(
            String query,
            Collection<Field> fields,
            AdminQuickSearchItem item,
            String stableLabel
    ) {
        int rank = AdminSearchText.rank(query, fields.stream().map(Field::value).toList());
        return new Ranked(rank, AdminSearchText.stableKey(stableLabel), item.id(), item);
    }

    private static String bestField(String query, List<Field> fields) {
        int bestRank = Integer.MAX_VALUE;
        String bestField = null;
        for (Field field : fields) {
            int rank = AdminSearchText.rank(query, Collections.singletonList(field.value()));
            if (rank < bestRank) {
                bestRank = rank;
                bestField = field.name();
            }
        }
        return bestField;
    }

    private static List<Field> fields(Field... fields) {
        return List.of(fields);
    }

    private static String firstNonBlank(String... values) {
        for (String value : values) {
            if (!isBlank(value)) return value;
        }
        return "";
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private static String id(Object value) {
        return value == null ? null : value.toString();
    }

    private record Field(String name, String value) {
    }

    private record Ranked(int rank, String stableLabel, String id, AdminQuickSearchItem item) {
    }

    private static final Comparator<Ranked> RANKED_COMPARATOR = Comparator
            .comparingInt(Ranked::rank)
            .thenComparing(Ranked::stableLabel, Comparator.nullsFirst(String::compareTo))
            .thenComparing(Ranked::id, Comparator.nullsFirst(String::compareTo));
}
