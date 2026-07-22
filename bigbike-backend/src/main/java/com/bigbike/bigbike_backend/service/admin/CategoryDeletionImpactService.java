package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.CategoryPermanentDeleteImpactResponse;
import com.bigbike.bigbike_backend.api.error.ConflictException;
import com.bigbike.bigbike_backend.api.error.MutationNotImplementedException;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.persistence.entity.catalog.CategoryEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.CategoryJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class CategoryDeletionImpactService {

    private static final String UNCATEGORIZED_CATEGORY_ID = "uncategorized";

    private final ProductJpaRepository productJpaRepository;
    private final CategoryJpaRepository categoryJpaRepository;

    public CategoryDeletionImpactService(
            ObjectProvider<ProductJpaRepository> productJpaRepositoryProvider,
            ObjectProvider<CategoryJpaRepository> categoryJpaRepositoryProvider
    ) {
        this.productJpaRepository = productJpaRepositoryProvider.getIfAvailable();
        this.categoryJpaRepository = categoryJpaRepositoryProvider.getIfAvailable();
    }

    public CategoryPermanentDeleteImpactResponse preview(List<String> categoryIds) {
        requireJpaPersistenceEnabled();

        LinkedHashSet<String> requestedIds = new LinkedHashSet<>(categoryIds);
        Map<String, List<CategoryEntity>> subtreeByRequestedId = new LinkedHashMap<>();

        for (String categoryId : requestedIds) {
            CategoryEntity category = categoryJpaRepository.findById(categoryId)
                    .orElseThrow(() -> new NotFoundException("Category not found."));
            validatePermanentDelete(category);
            subtreeByRequestedId.put(categoryId, collectCategorySubtree(category));
        }

        Set<String> requestedIdsCoveredByAnotherTree = new LinkedHashSet<>();
        for (Map.Entry<String, List<CategoryEntity>> entry : subtreeByRequestedId.entrySet()) {
            for (CategoryEntity node : entry.getValue()) {
                if (!node.getId().equals(entry.getKey()) && requestedIds.contains(node.getId())) {
                    requestedIdsCoveredByAnotherTree.add(node.getId());
                }
            }
        }

        List<String> rootCategoryIds = requestedIds.stream()
                .filter(id -> !requestedIdsCoveredByAnotherTree.contains(id))
                .toList();

        Map<String, CategoryEntity> impactedCategories = new LinkedHashMap<>();
        for (String rootId : rootCategoryIds) {
            for (CategoryEntity node : subtreeByRequestedId.get(rootId)) {
                impactedCategories.putIfAbsent(node.getId(), node);
            }
        }

        List<String> impactedCategoryIds = new ArrayList<>(impactedCategories.keySet());
        List<ProductEntity> affectedProducts = productJpaRepository.findDistinctByCategories_IdIn(impactedCategoryIds);
        int reassignedProductCount = (int) affectedProducts.stream()
                .filter(product -> product.getCategories().stream()
                        .allMatch(category -> impactedCategoryIds.contains(category.getId())))
                .count();

        return new CategoryPermanentDeleteImpactResponse(
                requestedIds.size(),
                rootCategoryIds,
                impactedCategories.size() - rootCategoryIds.size(),
                affectedProducts.size(),
                reassignedProductCount
        );
    }

    private void validatePermanentDelete(CategoryEntity category) {
        if (UNCATEGORIZED_CATEGORY_ID.equals(category.getId())) {
            throw new ConflictException(
                    "Không thể xoá danh mục \"Chưa phân loại\" — đây là danh mục hệ thống chứa sản phẩm chưa được phân loại.");
        }
        if (!category.isDeleted()) {
            throw new ConflictException(
                    "Chỉ có thể xem trước việc xoá vĩnh viễn cho danh mục đã nằm trong Thùng rác.");
        }
    }

    private List<CategoryEntity> collectCategorySubtree(CategoryEntity root) {
        List<CategoryEntity> ordered = new ArrayList<>();
        Deque<CategoryEntity> queue = new ArrayDeque<>();
        queue.add(root);
        while (!queue.isEmpty()) {
            CategoryEntity node = queue.poll();
            ordered.add(node);
            queue.addAll(categoryJpaRepository.findByParent_Id(node.getId()));
        }
        return ordered;
    }

    private void requireJpaPersistenceEnabled() {
        if (productJpaRepository == null || categoryJpaRepository == null) {
            throw new MutationNotImplementedException(
                    "Category permanent-delete impact requires JPA persistence profile."
            );
        }
    }
}
