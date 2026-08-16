package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.legacy.AdminLegacyDiscontinuedProductResponse;
import com.bigbike.bigbike_backend.api.admin.dto.legacy.LegacyDiscontinuedProductRequest;
import com.bigbike.bigbike_backend.api.admin.dto.legacy.LegacyDiscontinuedProductUpdateRequest;
import com.bigbike.bigbike_backend.api.error.ConflictException;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.api.public_.dto.PublicLegacyDiscontinuedProductResponse;
import com.bigbike.bigbike_backend.persistence.entity.catalog.CategoryEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.LegacyDiscontinuedProductEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.CategoryJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.LegacyDiscontinuedProductJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.LegacyDiscontinuedProductSpecification;
import com.bigbike.bigbike_backend.service.admin.support.AuditLogFactory;
import com.bigbike.bigbike_backend.service.audit.AuditLogWriter;
import com.bigbike.bigbike_backend.service.common.PageResult;
import java.time.Instant;
import java.util.Locale;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

@Service
@RequiredArgsConstructor
public class LegacyDiscontinuedProductService {

    private static final int DEFAULT_SIZE = 20;
    private static final int MAX_SIZE = 100;

    private final LegacyDiscontinuedProductJpaRepository legacyRepo;
    private final CategoryJpaRepository categoryRepo;
    private final AuditLogWriter auditLogWriter;
    private final AuditLogFactory auditLogFactory;
    private final ObjectMapper objectMapper;

    public PageResult<AdminLegacyDiscontinuedProductResponse> list(int page, int size, String q, Boolean enabled) {
        int normalizedPage = Math.max(1, page);
        int normalizedSize = size <= 0 ? DEFAULT_SIZE : Math.min(size, MAX_SIZE);
        Page<LegacyDiscontinuedProductEntity> dbPage = legacyRepo.findAll(
                LegacyDiscontinuedProductSpecification.withFilters(q, enabled),
                PageRequest.of(normalizedPage - 1, normalizedSize, Sort.by(
                        Sort.Order.desc("updatedAt"), Sort.Order.desc("createdAt"), Sort.Order.desc("id"))));
        return new PageResult<>(
                dbPage.getContent().stream().map(this::toAdminResponse).toList(),
                normalizedPage, normalizedSize, dbPage.getTotalElements(), dbPage.getTotalPages());
    }

    public AdminLegacyDiscontinuedProductResponse get(UUID id) {
        return toAdminResponse(find(id));
    }

    public PublicLegacyDiscontinuedProductResponse getPublic(String slug, String lang) {
        LegacyDiscontinuedProductEntity entry = legacyRepo.findBySlugAndEnabledTrue(normalizeSlug(slug))
                .orElseThrow(() -> new NotFoundException("Legacy discontinued product not found."));
        boolean english = "en".equalsIgnoreCase(lang);
        String displayName = english && hasText(entry.getNameEn()) ? entry.getNameEn() : entry.getName();
        return new PublicLegacyDiscontinuedProductResponse(
                entry.getSlug(), displayName, entry.getBrandName(), entry.getCategorySlug(), entry.getImageUrl(), true);
    }

    @Transactional
    public AdminLegacyDiscontinuedProductResponse create(UUID adminId, LegacyDiscontinuedProductRequest request) {
        String slug = normalizeSlug(request.slug());
        if (legacyRepo.existsBySlug(slug)) {
            throw new ConflictException("Legacy discontinued product slug already exists: " + slug);
        }
        LegacyDiscontinuedProductEntity entity = new LegacyDiscontinuedProductEntity();
        entity.setId(UUID.randomUUID());
        entity.setSlug(slug);
        applyRequired(entity, request.name(), request.categorySlug());
        entity.setNameEn(blankToNull(request.nameEn()));
        entity.setBrandName(blankToNull(request.brandName()));
        entity.setImageUrl(normalizeImageUrl(request.imageUrl()));
        entity.setEnabled(request.enabled() == null || request.enabled());
        Instant now = Instant.now();
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
        entity = legacyRepo.save(entity);
        writeAudit("LEGACY_DISCONTINUED_PRODUCT_CREATED", adminId, entity, null);
        return toAdminResponse(entity);
    }

    @Transactional
    public AdminLegacyDiscontinuedProductResponse update(
            UUID id,
            UUID adminId,
            LegacyDiscontinuedProductUpdateRequest request
    ) {
        LegacyDiscontinuedProductEntity entity = find(id);
        String before = snapshot(entity);
        if (request.slug() != null) {
            String slug = normalizeSlug(request.slug());
            if (legacyRepo.existsBySlugAndIdNot(slug, id)) {
                throw new ConflictException("Legacy discontinued product slug already exists: " + slug);
            }
            entity.setSlug(slug);
        }
        if (request.name() != null) {
            entity.setName(requireName(request.name()));
        }
        if (request.categorySlug() != null) {
            entity.setCategorySlug(requirePublicCategory(request.categorySlug()));
        }
        if (request.nameEn() != null) entity.setNameEn(blankToNull(request.nameEn()));
        if (request.brandName() != null) entity.setBrandName(blankToNull(request.brandName()));
        if (request.imageUrl() != null) entity.setImageUrl(normalizeImageUrl(request.imageUrl()));
        if (request.enabled() != null) entity.setEnabled(request.enabled());
        entity.setUpdatedAt(Instant.now());
        entity = legacyRepo.save(entity);
        writeAudit("LEGACY_DISCONTINUED_PRODUCT_UPDATED", adminId, entity, before);
        return toAdminResponse(entity);
    }

    private void applyRequired(LegacyDiscontinuedProductEntity entity, String name, String categorySlug) {
        entity.setName(requireName(name));
        entity.setCategorySlug(requirePublicCategory(categorySlug));
    }

    private String requireName(String value) {
        String normalized = blankToNull(value);
        if (normalized == null) {
            throw ValidationException.fromField("name", "REQUIRED", "Legacy product name is required.");
        }
        return normalized;
    }

    private String requirePublicCategory(String value) {
        String slug = normalizeSlug(value);
        CategoryEntity category = categoryRepo.findBySlug(slug)
                .orElseThrow(() -> ValidationException.fromField(
                        "categorySlug", "INVALID_CATEGORY", "Category must exist and be public."));
        if (!category.isVisible() || category.isDeleted()) {
            throw ValidationException.fromField(
                    "categorySlug", "INVALID_CATEGORY", "Category must exist and be public.");
        }
        return slug;
    }

    private String normalizeSlug(String value) {
        String normalized = blankToNull(value);
        if (normalized == null) {
            throw ValidationException.fromField("slug", "REQUIRED", "Legacy slug is required.");
        }
        normalized = normalized.toLowerCase(Locale.ROOT);
        if (!normalized.matches("^[a-z0-9]+(?:-[a-z0-9]+)*$")) {
            throw ValidationException.fromField("slug", "INVALID_SLUG", "Legacy slug is invalid.");
        }
        return normalized;
    }

    private String normalizeImageUrl(String value) {
        String normalized = blankToNull(value);
        if (normalized == null) return null;
        if (!normalized.startsWith("/media/") && !normalized.startsWith("/wp-content/uploads/")) {
            throw ValidationException.fromField(
                    "imageUrl", "INVALID_IMAGE_URL", "Legacy image must use a verified BigBike media path.");
        }
        return normalized;
    }

    private LegacyDiscontinuedProductEntity find(UUID id) {
        return legacyRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("Legacy discontinued product not found."));
    }

    private AdminLegacyDiscontinuedProductResponse toAdminResponse(LegacyDiscontinuedProductEntity entity) {
        return new AdminLegacyDiscontinuedProductResponse(
                entity.getId(), entity.getSlug(), entity.getName(), entity.getNameEn(), entity.getBrandName(),
                entity.getCategorySlug(), entity.getImageUrl(), entity.isEnabled(), entity.getCreatedAt(), entity.getUpdatedAt());
    }

    private void writeAudit(String action, UUID adminId, LegacyDiscontinuedProductEntity entity, String before) {
        auditLogWriter.save(auditLogFactory.build(
                "ADMIN", adminId, action, "LEGACY_DISCONTINUED_PRODUCT", entity.getId(), before, snapshot(entity)));
    }

    private String snapshot(LegacyDiscontinuedProductEntity entity) {
        try {
            return objectMapper.writeValueAsString(toAdminResponse(entity));
        } catch (Exception ignored) {
            return null;
        }
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private static String blankToNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
