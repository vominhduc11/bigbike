package com.bigbike.bigbike_backend.repository.catalog;

import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.persistence.entity.catalog.CategoryEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Deque;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.data.jpa.domain.Specification;

/** Shared product-list predicates used by admin listing and CSV export. */
public final class ProductFilterSpecifications {

    private ProductFilterSpecifications() {
    }

    public static Specification<ProductEntity> forAdminList(
            String query,
            String publishStatus,
            String stockState,
            String brandId,
            Collection<String> categoryIds,
            String gender
    ) {
        Collection<PublishStatus> statuses = adminListStatuses(publishStatus);
        boolean excludeTrash = publishStatus == null || publishStatus.isBlank()
                || "ALL".equalsIgnoreCase(publishStatus);
        return build(query, statuses, excludeTrash, stockState, brandId, categoryIds, gender);
    }

    public static Specification<ProductEntity> build(
            String query,
            Collection<PublishStatus> statuses,
            boolean excludeTrash,
            String stockState,
            String brandId,
            Collection<String> categoryIds,
            String gender
    ) {
        return (root, criteriaQuery, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (statuses != null && !statuses.isEmpty()) {
                predicates.add(root.get("publishStatus").in(statuses));
            } else if (excludeTrash) {
                predicates.add(cb.notEqual(root.get("publishStatus"), PublishStatus.TRASH));
            }
            if (stockState != null && !stockState.isBlank()
                    && !"ALL".equalsIgnoreCase(stockState)) {
                predicates.add(cb.equal(root.get("stockState"),
                        ProductStockState.valueOf(stockState.toUpperCase(Locale.ROOT))));
            }
            if (query != null && !query.isBlank()) {
                predicates.add(productTextSearch(root, cb, query));
            }
            if (brandId != null && !brandId.isBlank()) {
                predicates.add(cb.equal(root.join("brand", JoinType.LEFT).get("id"), brandId));
            }
            if (categoryIds != null && !categoryIds.isEmpty()) {
                predicates.add(root.join("categories", JoinType.INNER).get("id").in(categoryIds));
                criteriaQuery.distinct(true);
            }
            if (gender != null && !gender.isBlank()) {
                if ("NULL".equalsIgnoreCase(gender)) {
                    predicates.add(cb.isNull(root.get("gender")));
                } else {
                    predicates.add(cb.equal(cb.lower(root.get("gender")), gender.trim().toLowerCase(Locale.ROOT)));
                }
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    /** Matches the existing admin list: ALL means DRAFT + PUBLISHED, not TRASH. */
    private static Collection<PublishStatus> adminListStatuses(String publishStatus) {
        if (publishStatus == null || publishStatus.isBlank()
                || "ALL".equalsIgnoreCase(publishStatus)) {
            return EnumSet.of(PublishStatus.DRAFT, PublishStatus.PUBLISHED);
        }
        if ("ALL_INCLUDING_TRASH".equalsIgnoreCase(publishStatus)) {
            return null;
        }
        return EnumSet.of(PublishStatus.valueOf(publishStatus.toUpperCase(Locale.ROOT)));
    }

    public static Set<String> resolveCategoryIds(
            String categoryId,
            Collection<CategoryEntity> categories
    ) {
        if (categoryId == null || categoryId.isBlank()) {
            return Set.of();
        }
        Map<String, List<String>> childrenByParent = new HashMap<>();
        for (CategoryEntity category : categories) {
            if (category.isDeleted()) {
                continue;
            }
            if (category.getParent() != null && !category.getParent().isDeleted()) {
                childrenByParent.computeIfAbsent(category.getParent().getId(), ignored -> new ArrayList<>())
                        .add(category.getId());
            }
        }
        Set<String> visited = new HashSet<>();
        Deque<String> queue = new ArrayDeque<>(List.of(categoryId));
        while (!queue.isEmpty()) {
            String current = queue.poll();
            if (!visited.add(current)) {
                continue;
            }
            queue.addAll(childrenByParent.getOrDefault(current, List.of()));
        }
        return visited;
    }

    private static Expression<String> unaccentLower(CriteriaBuilder cb, Expression<?> value) {
        return cb.function("unaccent", String.class, cb.lower(value.as(String.class)));
    }

    /** ANDs meaningful tokens while allowing every token to match any public identifier field. */
    public static Predicate productTextSearch(
            jakarta.persistence.criteria.Root<ProductEntity> root,
            CriteriaBuilder cb,
            String rawQuery
    ) {
        List<String> tokens = ProductSearchTerms.tokens(rawQuery);
        if (tokens.isEmpty()) return cb.disjunction();

        Expression<String> name = unaccentLower(cb, root.get("name"));
        Expression<String> slug = unaccentLower(cb, root.get("slug"));
        Expression<String> sku = unaccentLower(cb, cb.coalesce(root.get("sku"), ""));
        Expression<String> nameEn = unaccentLower(cb, cb.coalesce(root.get("nameEn"), ""));
        Expression<String> slugEn = unaccentLower(cb, cb.coalesce(root.get("slugEn"), ""));
        Expression<String> shortDescription = unaccentLower(
                cb, cb.coalesce(root.get("shortDescription"), ""));
        List<Predicate> allTokens = new ArrayList<>();
        for (String token : tokens) {
            Expression<String> term = cb.literal("%" + token + "%");
            allTokens.add(cb.or(
                    cb.like(name, term),
                    cb.like(slug, term),
                    cb.like(sku, term),
                    cb.like(nameEn, term),
                    cb.like(slugEn, term),
                    cb.like(shortDescription, term)));
        }
        return cb.and(allTokens.toArray(new Predicate[0]));
    }
}
