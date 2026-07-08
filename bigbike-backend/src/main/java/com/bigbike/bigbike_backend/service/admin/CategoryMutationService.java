package com.bigbike.bigbike_backend.service.admin;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.bigbike.bigbike_backend.api.admin.dto.CategoryTranslationRequest;
import com.bigbike.bigbike_backend.api.admin.dto.UpsertCategoryRequest;
import com.bigbike.bigbike_backend.api.common.ApiErrorDetail;
import com.bigbike.bigbike_backend.api.error.ConflictException;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.api.error.MutationNotImplementedException;
import com.bigbike.bigbike_backend.domain.catalog.Category;
import com.bigbike.bigbike_backend.persistence.entity.catalog.CategoryEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.CategoryJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.repository.catalog.CatalogReadRepository;
import com.bigbike.bigbike_backend.service.admin.support.AuditLogFactory;
import com.bigbike.bigbike_backend.service.audit.AuditLogWriter;
import com.bigbike.bigbike_backend.service.web.WebRevalidationService;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static com.bigbike.bigbike_backend.service.admin.ProductFieldApplier.*;

@Service
public class CategoryMutationService {

    private static final ObjectMapper AUDIT_MAPPER = new ObjectMapper();
    private static final String UNCATEGORIZED_CATEGORY_ID = "uncategorized";

    private final ProductJpaRepository productJpaRepository;
    private final CategoryJpaRepository categoryJpaRepository;
    private final CatalogReadRepository catalogReadRepository;
    private final WebRevalidationService webRevalidationService;
    private final AuditLogWriter auditLogWriter;
    private final AuditLogFactory auditLogFactory;
    private final CatalogRequestValidator catalogRequestValidator;
    private final SlugRedirectHelper slugRedirectHelper;

    public CategoryMutationService(
            ObjectProvider<ProductJpaRepository> productJpaRepositoryProvider,
            ObjectProvider<CategoryJpaRepository> categoryJpaRepositoryProvider,
            CatalogReadRepository catalogReadRepository,
            WebRevalidationService webRevalidationService,
            AuditLogWriter auditLogWriter,
            AuditLogFactory auditLogFactory,
            CatalogRequestValidator catalogRequestValidator,
            SlugRedirectHelper slugRedirectHelper
    ) {
        this.productJpaRepository = productJpaRepositoryProvider.getIfAvailable();
        this.categoryJpaRepository = categoryJpaRepositoryProvider.getIfAvailable();
        this.catalogReadRepository = catalogReadRepository;
        this.webRevalidationService = webRevalidationService;
        this.auditLogWriter = auditLogWriter;
        this.auditLogFactory = auditLogFactory;
        this.catalogRequestValidator = catalogRequestValidator;
        this.slugRedirectHelper = slugRedirectHelper;
    }

    @Transactional
    public Category createCategory(UpsertCategoryRequest request, UUID adminId) {
        requireJpaPersistenceEnabled();

        List<ApiErrorDetail> errors = new ArrayList<>();
        String slug = catalogRequestValidator.validateCategoryRequest(request, null, true, errors);
        CategoryEntity parent = catalogRequestValidator.validateAndResolveParentCategory(request.getParentId(), null, true, errors);
        AdminMutationValidators.throwIfErrors(errors);

        Instant now = Instant.now();
        CategoryEntity entity = new CategoryEntity();
        entity.setId(generateId("cat"));
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
        applyCategoryPatch(entity, request, slug, parent, true);
        categoryJpaRepository.save(entity);
        auditLog("CATEGORY_CREATED", "CATEGORY", adminId, null, categoryJson(entity));
        webRevalidationService.revalidateCategory(entity.getSlug(), null);

        return catalogReadRepository.findCategoryById(entity.getId())
                .orElseThrow(() -> new NotFoundException("Category not found."));
    }

    @Transactional
    public Category updateCategory(String categoryId, UpsertCategoryRequest request, UUID adminId) {
        requireJpaPersistenceEnabled();

        CategoryEntity entity = categoryJpaRepository.findById(categoryId)
                .orElseThrow(() -> new NotFoundException("Category not found."));

        if (UNCATEGORIZED_CATEGORY_ID.equals(entity.getId())) {
            throw new ConflictException(
                    "Không thể chỉnh sửa danh mục \"Chưa phân loại\" — đây là danh mục hệ thống được khoá.");
        }

        String previousSlug = entity.getSlug();
        String previousSlugEn = entity.getSlugEn();
        String before = categoryJson(entity);

        List<ApiErrorDetail> errors = new ArrayList<>();
        String slug = catalogRequestValidator.validateCategoryRequest(request, entity, false, errors);
        CategoryEntity parent = catalogRequestValidator.validateAndResolveParentCategory(request.getParentId(), categoryId, false, errors);
        AdminMutationValidators.throwIfErrors(errors);

        if (Boolean.FALSE.equals(request.getVisible()) && entity.isVisible()) {
            assertNoVisibleChildren(categoryId);
        }

        entity.setUpdatedAt(Instant.now());
        applyCategoryPatch(entity, request, slug, parent, false);
        categoryJpaRepository.save(entity);
        auditLog("CATEGORY_UPDATED", "CATEGORY", adminId, before, categoryJson(entity));
        if (!previousSlug.equals(entity.getSlug())) {
            slugRedirectHelper.autoCreateSlugRedirect("/danh-muc-san-pham/" + previousSlug, "/danh-muc-san-pham/" + entity.getSlug());
        }
        slugRedirectHelper.autoCreateSlugEnRedirect("/danh-muc-san-pham/", previousSlugEn, entity.getSlugEn(), entity.getSlug());
        webRevalidationService.revalidateCategory(entity.getSlug(), previousSlug);

        return catalogReadRepository.findCategoryById(entity.getId())
                .orElseThrow(() -> new NotFoundException("Category not found."));
    }

    @Transactional
    public Category softDeleteCategory(String categoryId, UUID adminId) {
        requireJpaPersistenceEnabled();

        CategoryEntity entity = categoryJpaRepository.findById(categoryId)
                .orElseThrow(() -> new NotFoundException("Category not found."));

        if (UNCATEGORIZED_CATEGORY_ID.equals(entity.getId())) {
            throw new ConflictException(
                    "Không thể xoá danh mục \"Chưa phân loại\" — đây là danh mục hệ thống.");
        }

        List<CategoryEntity> subtree = collectCategorySubtree(entity);
        for (CategoryEntity node : subtree) {
            String before = categoryJson(node);
            node.setDeleted(true);
            node.setUpdatedAt(Instant.now());
            categoryJpaRepository.save(node);
            auditLog("CATEGORY_SOFT_DELETED", "CATEGORY", adminId, before, categoryJson(node));
        }

        webRevalidationService.revalidateCategory(entity.getSlug(), null);

        return catalogReadRepository.findCategoryById(entity.getId())
                .orElseThrow(() -> new NotFoundException("Category not found."));
    }

    @Transactional
    public Category restoreCategory(String categoryId, UUID adminId) {
        requireJpaPersistenceEnabled();

        CategoryEntity entity = categoryJpaRepository.findById(categoryId)
                .orElseThrow(() -> new NotFoundException("Category not found."));

        List<CategoryEntity> subtree = collectCategorySubtree(entity);
        for (CategoryEntity node : subtree) {
            String before = categoryJson(node);
            node.setDeleted(false);
            node.setUpdatedAt(Instant.now());
            categoryJpaRepository.save(node);
            auditLog("CATEGORY_RESTORED", "CATEGORY", adminId, before, categoryJson(node));
        }

        webRevalidationService.revalidateCategory(entity.getSlug(), null);

        return catalogReadRepository.findCategoryById(entity.getId())
                .orElseThrow(() -> new NotFoundException("Category not found."));
    }

    @Transactional
    public void hardDeleteCategory(String categoryId, UUID adminId) {
        requireJpaPersistenceEnabled();

        CategoryEntity entity = categoryJpaRepository.findById(categoryId)
                .orElseThrow(() -> new NotFoundException("Category not found."));

        if (UNCATEGORIZED_CATEGORY_ID.equals(entity.getId())) {
            throw new ConflictException(
                    "Không thể xoá danh mục \"Chưa phân loại\" — đây là danh mục hệ thống chứa sản phẩm chưa được phân loại.");
        }

        if (!entity.isDeleted()) {
            throw new ConflictException(
                    "Chỉ có thể xoá vĩnh viễn các danh mục đã nằm trong Thùng rác (đã xoá mềm).");
        }

        List<CategoryEntity> subtree = collectCategorySubtree(entity);
        List<String> subtreeIds = subtree.stream().map(CategoryEntity::getId).toList();

        List<String> movedProductIds = productJpaRepository.findIdsByCategory_IdIn(subtreeIds);
        if (!movedProductIds.isEmpty()) {
            CategoryEntity uncategorized = categoryJpaRepository.findById(UNCATEGORIZED_CATEGORY_ID)
                    .orElseThrow(() -> new ConflictException(
                            "Danh mục \"Chưa phân loại\" không tồn tại — không thể chuyển sản phẩm. Liên hệ kỹ thuật."));
            productJpaRepository.reassignCategory(uncategorized, subtreeIds, Instant.now());
        }

        for (int i = subtree.size() - 1; i >= 0; i--) {
            CategoryEntity node = subtree.get(i);
            auditLog("CATEGORY_HARD_DELETED", "CATEGORY", adminId, categoryJson(node), null);
            categoryJpaRepository.delete(node);
        }

        webRevalidationService.revalidateCategory(entity.getSlug(), null);
        if (!movedProductIds.isEmpty()) {
            webRevalidationService.revalidateProductsByIds(movedProductIds);
            webRevalidationService.revalidate(
                    "categories", "category:" + UNCATEGORIZED_CATEGORY_ID, "products", "menus");
        }
    }

    private void requireJpaPersistenceEnabled() {
        if (productJpaRepository == null || categoryJpaRepository == null) {
            throw new MutationNotImplementedException(
                    "Catalog mutation APIs require JPA persistence profile. Mock profile is read-only."
            );
        }
    }

    private void auditLog(String action, String resourceType, UUID adminId, String before, String after) {
        auditLogWriter.save(auditLogFactory.build("ADMIN", adminId, action, resourceType, null, before, after));
    }

    private static String categoryJson(CategoryEntity e) {
        Map<String, Object> fields = new java.util.LinkedHashMap<>();
        fields.put("id", nullSafe(e.getId()));
        fields.put("name", nullSafe(e.getName()));
        fields.put("slug", nullSafe(e.getSlug()));
        fields.put("visible", e.isVisible());
        fields.put("description", e.getDescription());
        fields.put("introContent", e.getIntroContent());
        fields.put("imageUrl", e.getImageUrl());
        fields.put("iconUrl", e.getIconUrl());
        fields.put("menuIconUrl", e.getMenuIconUrl());
        fields.put("bannerUrl", e.getBannerUrl());
        fields.put("parentId", e.getParent() == null ? null : e.getParent().getId());
        fields.put("sortOrder", e.getSortOrder());
        fields.put("showOnHomepage", e.getShowOnHomepage());
        return writeAuditJson(fields);
    }

    private static String writeAuditJson(Map<String, Object> fields) {
        try {
            return AUDIT_MAPPER.writeValueAsString(fields);
        } catch (JsonProcessingException ex) {
            return "{\"_serialization_error\":true}";
        }
    }

    private static String nullSafe(String s) {
        return s == null ? "" : s;
    }

    private void applyCategoryPatch(
            CategoryEntity entity,
            UpsertCategoryRequest request,
            String normalizedSlug,
            CategoryEntity normalizedParent,
            boolean create
    ) {
        if (create || normalizedSlug != null) {
            entity.setSlug(normalizedSlug);
        }
        if (create || request.getName() != null) {
            entity.setName(AdminMutationValidators.trimToNull(request.getName()));
        }
        if (create || request.getDescription() != null) {
            entity.setDescription(AdminMutationValidators.trimToNull(request.getDescription()));
        }
        if (create || request.getIntroContent() != null) {
            entity.setIntroContent(AdminMutationValidators.trimToNull(request.getIntroContent()));
        }
        if (create || request.getParentId() != null) {
            entity.setParent(normalizedParent);
        }
        if (create || request.getVisible() != null) {
            entity.setVisible(request.getVisible() == null || request.getVisible());
        }
        if (create || request.getShowOnHomepage() != null) {
            entity.setShowOnHomepage(Boolean.TRUE.equals(request.getShowOnHomepage()));
        }
        if (create || request.getSortOrder() != null) {
            entity.setSortOrder(request.getSortOrder());
        }

        if (request.getImage() != null) {
            if (AdminMutationValidators.trimToNull(request.getImage().getUrl()) != null) {
                applyImage(entity, request.getImage());
            } else {
                clearImage(entity);
            }
        } else if (create) {
            clearImage(entity);
        }

        if (request.getIcon() != null) {
            if (AdminMutationValidators.trimToNull(request.getIcon().getUrl()) != null) {
                applyIcon(entity, request.getIcon());
            } else {
                clearIcon(entity);
            }
        } else if (create) {
            clearIcon(entity);
        }

        if (request.getMenuIcon() != null) {
            entity.setMenuIconUrl(AdminMutationValidators.trimToNull(request.getMenuIcon().getUrl()));
        } else if (create) {
            entity.setMenuIconUrl(null);
        }

        if (request.getBanner() != null) {
            if (AdminMutationValidators.trimToNull(request.getBanner().getUrl()) != null) {
                applyBanner(entity, request.getBanner());
            } else {
                clearBanner(entity);
            }
        } else if (create) {
            clearBanner(entity);
        }

        if (request.getMobileBanner() != null) {
            if (AdminMutationValidators.trimToNull(request.getMobileBanner().getUrl()) != null) {
                applyMobileBanner(entity, request.getMobileBanner());
            } else {
                clearMobileBanner(entity);
            }
        } else if (create) {
            clearMobileBanner(entity);
        }

        if (request.getSeo() != null) {
            applySeo(entity, request.getSeo());
        } else if (create) {
            clearSeo(entity);
        }

        CategoryTranslationRequest translations = request.getTranslations();
        CategoryTranslationRequest.CategoryContentRequest en =
                translations != null ? translations.getEn() : null;
        if (en != null) {
            entity.setSlugEn(AdminMutationValidators.trimToNull(en.getSlug()));
            entity.setNameEn(AdminMutationValidators.trimToNull(en.getName()));
            entity.setDescriptionEn(AdminMutationValidators.trimToNull(en.getDescription()));
            entity.setIntroContentEn(AdminMutationValidators.trimToNull(en.getIntroContent()));
            entity.setSeoTitleEn(AdminMutationValidators.trimToNull(en.getSeoTitle()));
            entity.setSeoDescriptionEn(AdminMutationValidators.trimToNull(en.getSeoDescription()));
        } else if (create) {
            entity.setSlugEn(null);
            entity.setNameEn(null);
            entity.setDescriptionEn(null);
            entity.setIntroContentEn(null);
            entity.setSeoTitleEn(null);
            entity.setSeoDescriptionEn(null);
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

    private void assertNoVisibleChildren(String categoryId) {
        long visibleChildCount = categoryJpaRepository.countByParent_IdAndIsVisibleTrue(categoryId);
        if (visibleChildCount > 0) {
            throw new ConflictException(
                    "Cannot hide category: it has " + visibleChildCount +
                    " visible child categor" + (visibleChildCount == 1 ? "y" : "ies") +
                    ". Hide or re-parent them first."
            );
        }
    }

    private static String generateId(String prefix) {
        return prefix + "_" + UUID.randomUUID().toString().replace("-", "");
    }
}
