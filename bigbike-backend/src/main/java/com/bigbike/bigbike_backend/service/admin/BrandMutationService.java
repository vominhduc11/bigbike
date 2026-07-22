package com.bigbike.bigbike_backend.service.admin;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.bigbike.bigbike_backend.api.admin.dto.BrandTranslationRequest;
import com.bigbike.bigbike_backend.api.admin.dto.UpsertBrandRequest;
import com.bigbike.bigbike_backend.api.common.ApiErrorDetail;
import com.bigbike.bigbike_backend.api.error.ConflictException;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.api.error.MutationNotImplementedException;
import com.bigbike.bigbike_backend.domain.catalog.Brand;
import com.bigbike.bigbike_backend.persistence.entity.catalog.BrandEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.BrandJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.repository.catalog.CatalogReadRepository;
import com.bigbike.bigbike_backend.service.admin.support.AuditLogFactory;
import com.bigbike.bigbike_backend.service.audit.AuditLogWriter;
import com.bigbike.bigbike_backend.service.web.WebRevalidationService;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static com.bigbike.bigbike_backend.service.admin.ProductFieldApplier.*;

@Service
public class BrandMutationService {

    private static final ObjectMapper AUDIT_MAPPER = new ObjectMapper();
    private static final String UNCATEGORIZED_BRAND_ID = "uncategorized-brand";

    private final ProductJpaRepository productJpaRepository;
    private final BrandJpaRepository brandJpaRepository;
    private final CatalogReadRepository catalogReadRepository;
    private final WebRevalidationService webRevalidationService;
    private final AuditLogWriter auditLogWriter;
    private final AuditLogFactory auditLogFactory;
    private final CatalogRequestValidator catalogRequestValidator;
    private final SlugRedirectHelper slugRedirectHelper;

    public BrandMutationService(
            ObjectProvider<ProductJpaRepository> productJpaRepositoryProvider,
            ObjectProvider<BrandJpaRepository> brandJpaRepositoryProvider,
            CatalogReadRepository catalogReadRepository,
            WebRevalidationService webRevalidationService,
            AuditLogWriter auditLogWriter,
            AuditLogFactory auditLogFactory,
            CatalogRequestValidator catalogRequestValidator,
            SlugRedirectHelper slugRedirectHelper
    ) {
        this.productJpaRepository = productJpaRepositoryProvider.getIfAvailable();
        this.brandJpaRepository = brandJpaRepositoryProvider.getIfAvailable();
        this.catalogReadRepository = catalogReadRepository;
        this.webRevalidationService = webRevalidationService;
        this.auditLogWriter = auditLogWriter;
        this.auditLogFactory = auditLogFactory;
        this.catalogRequestValidator = catalogRequestValidator;
        this.slugRedirectHelper = slugRedirectHelper;
    }

    @Transactional
    public Brand createBrand(UpsertBrandRequest request, UUID adminId) {
        requireJpaPersistenceEnabled();

        List<ApiErrorDetail> errors = new ArrayList<>();
        String slug = catalogRequestValidator.validateBrandRequest(request, null, true, errors);
        AdminMutationValidators.throwIfErrors(errors);

        Instant now = Instant.now();
        BrandEntity entity = new BrandEntity();
        entity.setId(generateId("brand"));
        entity.setVisible(true);
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
        applyBrandPatch(entity, request, slug, true);
        brandJpaRepository.save(entity);
        auditLog("BRAND_CREATED", "BRAND", adminId, null, brandJson(entity));
        webRevalidationService.revalidateBrand(entity.getSlug(), null);

        return catalogReadRepository.findBrandById(entity.getId())
                .orElseThrow(() -> new NotFoundException("Brand not found."));
    }

    @Transactional
    public Brand updateBrand(String brandId, UpsertBrandRequest request, UUID adminId) {
        requireJpaPersistenceEnabled();

        BrandEntity entity = brandJpaRepository.findById(brandId)
                .orElseThrow(() -> new NotFoundException("Brand not found."));

        if (UNCATEGORIZED_BRAND_ID.equals(entity.getId())) {
            throw new ConflictException(
                    "Không thể chỉnh sửa thương hiệu \"Chưa phân loại\" — đây là thương hiệu hệ thống được khoá.");
        }

        String previousSlug = entity.getSlug();
        String before = brandJson(entity);

        List<ApiErrorDetail> errors = new ArrayList<>();
        String slug = catalogRequestValidator.validateBrandRequest(request, entity, false, errors);
        AdminMutationValidators.throwIfErrors(errors);

        entity.setUpdatedAt(Instant.now());
        applyBrandPatch(entity, request, slug, false);
        brandJpaRepository.save(entity);
        auditLog("BRAND_UPDATED", "BRAND", adminId, before, brandJson(entity));
        if (!previousSlug.equals(entity.getSlug())) {
            slugRedirectHelper.autoCreateSlugRedirect("/brands/" + previousSlug, "/brands/" + entity.getSlug());
        }
        webRevalidationService.revalidateBrand(entity.getSlug(), previousSlug);

        return catalogReadRepository.findBrandById(entity.getId())
                .orElseThrow(() -> new NotFoundException("Brand not found."));
    }

    @Transactional
    public Brand deleteBrand(String brandId, UUID adminId) {
        requireJpaPersistenceEnabled();
        BrandEntity entity = brandJpaRepository.findById(brandId)
                .orElseThrow(() -> new NotFoundException("Brand not found."));
        if (UNCATEGORIZED_BRAND_ID.equals(entity.getId())) {
            throw new ConflictException(
                    "Không thể xoá thương hiệu \"Chưa phân loại\" — đây là thương hiệu hệ thống.");
        }
        if (!entity.isVisible()) {
            return catalogReadRepository.findBrandById(entity.getId())
                    .orElseThrow(() -> new NotFoundException("Brand not found."));
        }
        String before = brandJson(entity);
        entity.setVisible(false);
        entity.setUpdatedAt(Instant.now());
        brandJpaRepository.save(entity);
        auditLog("BRAND_SOFT_DELETED", "BRAND", adminId, before, brandJson(entity));
        webRevalidationService.revalidateBrand(entity.getSlug(), null);
        return catalogReadRepository.findBrandById(entity.getId())
                .orElseThrow(() -> new NotFoundException("Brand not found."));
    }

    @Transactional
    public Brand restoreBrand(String brandId, UUID adminId) {
        requireJpaPersistenceEnabled();
        BrandEntity entity = brandJpaRepository.findById(brandId)
                .orElseThrow(() -> new NotFoundException("Brand not found."));
        if (UNCATEGORIZED_BRAND_ID.equals(entity.getId())) {
            throw new ConflictException(
                    "Không thể khôi phục thương hiệu \"Chưa phân loại\" — đây là thương hiệu hệ thống luôn bị ẩn.");
        }
        if (entity.isVisible()) {
            return catalogReadRepository.findBrandById(entity.getId())
                    .orElseThrow(() -> new NotFoundException("Brand not found."));
        }
        String before = brandJson(entity);
        entity.setVisible(true);
        entity.setUpdatedAt(Instant.now());
        brandJpaRepository.save(entity);
        auditLog("BRAND_RESTORED", "BRAND", adminId, before, brandJson(entity));
        webRevalidationService.revalidateBrand(entity.getSlug(), null);
        return catalogReadRepository.findBrandById(entity.getId())
                .orElseThrow(() -> new NotFoundException("Brand not found."));
    }

    @Transactional
    public int hardDeleteBrand(String brandId, UUID adminId) {
        requireJpaPersistenceEnabled();
        BrandEntity entity = brandJpaRepository.findById(brandId)
                .orElseThrow(() -> new NotFoundException("Brand not found."));
        if (UNCATEGORIZED_BRAND_ID.equals(entity.getId())) {
            throw new ConflictException(
                    "Không thể xoá thương hiệu \"Chưa phân loại\" — đây là thương hiệu hệ thống.");
        }
        if (entity.isVisible()) {
            throw new ConflictException("Only trashed brands can be permanently deleted.");
        }

        List<String> reassignedProductIds = productJpaRepository.findIdsByBrand_Id(brandId);
        if (!reassignedProductIds.isEmpty()) {
            BrandEntity uncategorized = brandJpaRepository.findById(UNCATEGORIZED_BRAND_ID)
                    .orElseThrow(() -> new ConflictException(
                            "Thương hiệu \"Chưa phân loại\" không tồn tại — không thể chuyển sản phẩm. Liên hệ kỹ thuật."));
            productJpaRepository.reassignBrand(uncategorized, brandId, Instant.now());
        }

        auditLog("BRAND_HARD_DELETED", "BRAND", adminId, brandJson(entity), null);
        brandJpaRepository.delete(entity);
        webRevalidationService.revalidateBrand(entity.getSlug(), null);
        if (!reassignedProductIds.isEmpty()) {
            webRevalidationService.revalidateProductsByIds(reassignedProductIds);
        }
        return reassignedProductIds.size();
    }

    private void requireJpaPersistenceEnabled() {
        if (productJpaRepository == null || brandJpaRepository == null) {
            throw new MutationNotImplementedException(
                    "Catalog mutation APIs require JPA persistence profile. Mock profile is read-only."
            );
        }
    }

    private void auditLog(String action, String resourceType, UUID adminId, String before, String after) {
        auditLogWriter.save(auditLogFactory.build("ADMIN", adminId, action, resourceType, null, before, after));
    }

    private static String brandJson(BrandEntity e) {
        Map<String, Object> fields = new java.util.LinkedHashMap<>();
        fields.put("id", nullSafe(e.getId()));
        fields.put("name", nullSafe(e.getName()));
        fields.put("slug", nullSafe(e.getSlug()));
        fields.put("visible", e.isVisible());
        fields.put("showOnHomepage", e.isShowOnHomepage());
        fields.put("description", e.getDescription());
        fields.put("logoUrl", e.getLogoUrl());
        fields.put("bannerUrl", e.getBannerUrl());
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

    private void applyBrandPatch(
            BrandEntity entity,
            UpsertBrandRequest request,
            String normalizedSlug,
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
        if (create || request.getShowOnHomepage() != null) {
            entity.setShowOnHomepage(request.getShowOnHomepage() == null || request.getShowOnHomepage());
        }

        if (request.getLogo() != null) {
            applyLogo(entity, request.getLogo());
        } else if (create) {
            clearLogo(entity);
        }

        if (request.getBanner() != null) {
            applyBanner(entity, request.getBanner());
        } else if (create) {
            clearBanner(entity);
        }

        if (request.getMobileBanner() != null) {
            applyMobileBanner(entity, request.getMobileBanner());
        } else if (create) {
            clearMobileBanner(entity);
        }

        if (request.getSeo() != null) {
            applySeo(entity, request.getSeo());
        } else if (create) {
            clearSeo(entity);
        }

        BrandTranslationRequest translations = request.getTranslations();
        BrandTranslationRequest.BrandContentRequest en =
                translations != null ? translations.getEn() : null;
        if (en != null) {
            entity.setDescriptionEn(AdminMutationValidators.trimToNull(en.getDescription()));
            entity.setSeoTitleEn(AdminMutationValidators.trimToNull(en.getSeoTitle()));
            entity.setSeoDescriptionEn(AdminMutationValidators.trimToNull(en.getSeoDescription()));
        } else if (create) {
            entity.setDescriptionEn(null);
            entity.setSeoTitleEn(null);
            entity.setSeoDescriptionEn(null);
        }
        if (create || request.getName() != null) {
            entity.setNameEn(null);
        }
        if (create || request.getSlug() != null) {
            entity.setSlugEn(null);
        }
    }

    private static String generateId(String prefix) {
        return prefix + "_" + UUID.randomUUID().toString().replace("-", "");
    }
}
