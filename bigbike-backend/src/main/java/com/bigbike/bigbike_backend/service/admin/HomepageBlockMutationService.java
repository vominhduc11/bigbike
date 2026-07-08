package com.bigbike.bigbike_backend.service.admin;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.bigbike.bigbike_backend.api.admin.dto.SetHomepageBlocksRequest;
import com.bigbike.bigbike_backend.api.common.ApiErrorDetail;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.api.error.MutationNotImplementedException;
import com.bigbike.bigbike_backend.domain.catalog.HomepageBlock;
import com.bigbike.bigbike_backend.domain.catalog.Product;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
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
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class HomepageBlockMutationService {

    private static final ObjectMapper AUDIT_MAPPER = new ObjectMapper();

    private final ProductJpaRepository productJpaRepository;
    private final CatalogReadRepository catalogReadRepository;
    private final WebRevalidationService webRevalidationService;
    private final AuditLogWriter auditLogWriter;
    private final AuditLogFactory auditLogFactory;

    public HomepageBlockMutationService(
            ObjectProvider<ProductJpaRepository> productJpaRepositoryProvider,
            CatalogReadRepository catalogReadRepository,
            WebRevalidationService webRevalidationService,
            AuditLogWriter auditLogWriter,
            AuditLogFactory auditLogFactory
    ) {
        this.productJpaRepository = productJpaRepositoryProvider.getIfAvailable();
        this.catalogReadRepository = catalogReadRepository;
        this.webRevalidationService = webRevalidationService;
        this.auditLogWriter = auditLogWriter;
        this.auditLogFactory = auditLogFactory;
    }

    @Transactional
    public List<Product> setHomepageBlocks(SetHomepageBlocksRequest request, UUID adminId) {
        requireJpaPersistenceEnabled();

        List<String> featuredIds = request.getFeaturedGrid() == null ? List.of() : request.getFeaturedGrid();

        List<ProductEntity> currentlyPinned = productJpaRepository.findByHomepageBlockIn(List.of(HomepageBlock.FEATURED_GRID));
        Set<String> allAffectedIds = new HashSet<>();
        currentlyPinned.forEach(p -> allAffectedIds.add(p.getId()));
        allAffectedIds.addAll(featuredIds);

        List<ProductEntity> allEntities = productJpaRepository.findAllById(allAffectedIds);
        Map<String, ProductEntity> byId = new HashMap<>();
        for (ProductEntity e : allEntities) {
            byId.put(e.getId(), e);
        }

        List<ApiErrorDetail> errors = new ArrayList<>();
        for (int i = 0; i < featuredIds.size(); i++) {
            String id = featuredIds.get(i);
            ProductEntity entity = byId.get(id);
            if (entity == null) {
                errors.add(new ApiErrorDetail("featuredGrid[" + i + "]", "NOT_FOUND", "Product '" + id + "' not found."));
            } else if (entity.getPublishStatus() != PublishStatus.PUBLISHED) {
                errors.add(new ApiErrorDetail("featuredGrid[" + i + "]", "NOT_PUBLISHED",
                        "Product '" + id + "' must be PUBLISHED to appear on the homepage."));
            }
        }
        AdminMutationValidators.throwIfErrors(errors);

        Set<String> newFeaturedSet = new HashSet<>(featuredIds);
        Instant now = Instant.now();

        for (ProductEntity entity : allEntities) {
            String id = entity.getId();
            if (newFeaturedSet.contains(id)) {
                entity.setHomepageBlock(HomepageBlock.FEATURED_GRID);
                entity.setHomepageOrder(featuredIds.indexOf(id));
                entity.setUpdatedAt(now);
            } else {
                entity.setHomepageBlock(HomepageBlock.NONE);
                entity.setHomepageOrder(null);
                entity.setUpdatedAt(now);
            }
        }

        productJpaRepository.saveAll(allEntities);
        auditLog("PRODUCT_HOMEPAGE_BLOCKS_SET", "PRODUCT", adminId, null,
                writeAuditJson(Map.of("featuredProductIds", featuredIds)));
        webRevalidationService.revalidate("products");

        List<Product> result = new ArrayList<>();
        for (String id : featuredIds) {
            catalogReadRepository.findProductById(id).ifPresent(result::add);
        }
        return result;
    }

    private void requireJpaPersistenceEnabled() {
        if (productJpaRepository == null) {
            throw new MutationNotImplementedException(
                    "Catalog mutation APIs require JPA persistence profile. Mock profile is read-only."
            );
        }
    }

    private void auditLog(String action, String resourceType, UUID adminId, String before, String after) {
        auditLogWriter.save(auditLogFactory.build("ADMIN", adminId, action, resourceType, null, before, after));
    }

    private static String writeAuditJson(Map<String, Object> fields) {
        try {
            return AUDIT_MAPPER.writeValueAsString(fields);
        } catch (JsonProcessingException ex) {
            return "{\"_serialization_error\":true}";
        }
    }
}
