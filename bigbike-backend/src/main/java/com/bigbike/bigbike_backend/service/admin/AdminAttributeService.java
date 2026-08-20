package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.AttributeSummaryResponse;
import com.bigbike.bigbike_backend.api.admin.dto.AttributeValueResponse;
import com.bigbike.bigbike_backend.api.admin.dto.CreateAttributeRequest;
import com.bigbike.bigbike_backend.api.admin.dto.CreateAttributeValueRequest;
import com.bigbike.bigbike_backend.api.admin.dto.UpdateAttributeRequest;
import com.bigbike.bigbike_backend.api.admin.dto.UpdateAttributeValueRequest;
import com.bigbike.bigbike_backend.api.error.ConflictException;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.mapper.AttributeMapper;
import com.bigbike.bigbike_backend.util.ProductSlugGenerator;
import com.bigbike.bigbike_backend.persistence.entity.catalog.AttributeEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.AttributeValueEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.AttributeJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.AttributeValueJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductVariantOptionJpaRepository;
import com.bigbike.bigbike_backend.service.admin.support.AuditLogFactory;
import com.bigbike.bigbike_backend.service.audit.AuditLogWriter;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AdminAttributeService {

    private final AttributeJpaRepository attributeRepo;
    private final AttributeValueJpaRepository valueRepo;
    private final ProductVariantOptionJpaRepository variantOptionRepo;
    private final AuditLogWriter auditLogWriter;
    private final AttributeMapper attributeMapper;
    private final AuditLogFactory auditLogFactory;
    private final CatalogReferenceCacheEvictor catalogReferenceCacheEvictor;

    @Transactional(readOnly = true)
    @Cacheable(cacheNames = CatalogReferenceCacheEvictor.ATTRIBUTES, key = "'summary'")
    public List<AttributeSummaryResponse> listAttributes() {
        return attributeRepo.findAllByOrderByNameAsc().stream()
                .map(a -> new AttributeSummaryResponse(
                        a.getId(),
                        a.getCode(),
                        a.getName(),
                        a.getNameEn(),
                        a.getKind(),
                        a.getValues().size()
                ))
                .toList();
    }

    @Transactional(readOnly = true)
    @Cacheable(cacheNames = CatalogReferenceCacheEvictor.ATTRIBUTES, key = "'values:' + #attributeId")
    public List<AttributeValueResponse> listValues(String attributeId) {
        attributeRepo.findById(attributeId)
                .orElseThrow(() -> new NotFoundException("Attribute not found: " + attributeId));
        return valueRepo.findAllByAttributeIdOrderBySortOrderAsc(attributeId).stream()
                .map(attributeMapper::toResponse)
                .toList();
    }

    /**
     * Rename an attribute's display name. The {@code code} (machine key) stays
     * immutable so variant options that resolve via the code keep working.
     */
    @Transactional
    public AttributeSummaryResponse updateAttributeName(String attributeId, UpdateAttributeRequest request, UUID adminId) {
        AttributeEntity attribute = attributeRepo.findById(attributeId)
                .orElseThrow(() -> new NotFoundException("Attribute not found: " + attributeId));
        String before = attributeSnapshot(attribute);
        attribute.setName(request.name().trim());
        // Presence-flag: omit nameEn → unchanged; send blank → clears the English name.
        if (request.nameEn() != null) {
            attribute.setNameEn(normalizeOptional(request.nameEn()));
        }
        AttributeEntity saved = attributeRepo.save(attribute);
        auditLogWriter.save(auditLogFactory.build(
                "ADMIN", adminId, "ATTRIBUTE_UPDATED", "ATTRIBUTE", null, before, attributeSnapshot(saved)));
        catalogReferenceCacheEvictor.evictAllAfterCommit();
        return new AttributeSummaryResponse(
                saved.getId(),
                saved.getCode(),
                saved.getName(),
                saved.getNameEn(),
                saved.getKind(),
                saved.getValues().size()
        );
    }

    /**
     * Create a brand-new attribute type (e.g. "Chất liệu"). {@code code} is
     * derived from the name using the same diacritic-insensitive kebab-case rule
     * as attribute values; a name that collides with an existing code is rejected
     * (the code is the machine key variant options resolve through).
     */
    @Transactional
    public AttributeSummaryResponse createAttribute(CreateAttributeRequest request, UUID adminId) {
        String name = request.name().trim();
        String code = ProductSlugGenerator.toSlug(name);
        if (code.isBlank()) {
            throw ValidationException.fromField("name", "INVALID_CODE",
                    "Tên không tạo được mã hợp lệ. Vui lòng dùng chữ hoặc số.");
        }
        attributeRepo.findByCode(code).ifPresent(existing -> {
            throw new ConflictException("Loại thuộc tính đã tồn tại: " + code);
        });

        AttributeEntity entity = new AttributeEntity();
        entity.setId("attr-" + UUID.randomUUID());
        entity.setCode(code);
        entity.setName(name);
        entity.setNameEn(normalizeOptional(request.nameEn()));
        entity.setKind("select");
        entity.setVariation(true);
        AttributeEntity saved = attributeRepo.save(entity);
        auditLogWriter.save(auditLogFactory.build(
                "ADMIN", adminId, "ATTRIBUTE_CREATED", "ATTRIBUTE", null, null, attributeSnapshot(saved)));
        catalogReferenceCacheEvictor.evictAllAfterCommit();
        return new AttributeSummaryResponse(
                saved.getId(),
                saved.getCode(),
                saved.getName(),
                saved.getNameEn(),
                saved.getKind(),
                0
        );
    }

    /**
     * Delete an attribute type. Blocked when any variant option still resolves
     * to it — deleting it would silently strip that attribute off live product
     * variants. Deleting an unused attribute cascades its (also unused) values
     * at the database level ({@code fk_attribute_values_attribute_id ... on delete cascade}).
     */
    @Transactional
    public void deleteAttribute(String attributeId, UUID adminId) {
        AttributeEntity attribute = attributeRepo.findById(attributeId)
                .orElseThrow(() -> new NotFoundException("Attribute not found: " + attributeId));
        long usageCount = variantOptionRepo.countByAttribute_Id(attributeId);
        if (usageCount > 0) {
            throw new ConflictException(
                    "Thuộc tính \"" + attribute.getName() + "\" đang được " + usageCount
                            + " biến thể sử dụng, không thể xóa.");
        }
        String before = attributeSnapshot(attribute);
        attributeRepo.delete(attribute);
        auditLogWriter.save(auditLogFactory.build(
                "ADMIN", adminId, "ATTRIBUTE_DELETED", "ATTRIBUTE", null, before, null));
        catalogReferenceCacheEvictor.evictAllAfterCommit();
    }

    /**
     * Delete a single attribute value (e.g. one colour). Blocked when any
     * variant option still resolves to it, for the same reason as attribute
     * deletion above.
     */
    @Transactional
    public void deleteAttributeValue(String valueId, UUID adminId) {
        AttributeValueEntity value = valueRepo.findById(valueId)
                .orElseThrow(() -> new NotFoundException("Attribute value not found: " + valueId));
        long usageCount = variantOptionRepo.countByAttributeValue_Id(valueId);
        if (usageCount > 0) {
            throw new ConflictException(
                    "Giá trị \"" + value.getLabel() + "\" đang được " + usageCount
                            + " biến thể sử dụng, không thể xóa.");
        }
        String before = attributeValueSnapshot(value);
        valueRepo.delete(value);
        auditLogWriter.save(auditLogFactory.build(
                "ADMIN", adminId, "ATTRIBUTE_VALUE_DELETED", "ATTRIBUTE", null, before, null));
        catalogReferenceCacheEvictor.evictAllAfterCommit();
    }

    /**
     * Create a new value under an attribute. The slug is derived from the label
     * (or the optional explicit slug) using the same diacritic-insensitive
     * kebab-case rule as product slugs, so it matches the storefront colour
     * filter keys. Duplicate slugs within the same attribute are rejected.
     */
    @Transactional
    public AttributeValueResponse createValue(String attributeId, CreateAttributeValueRequest request, UUID adminId) {
        AttributeEntity attribute = attributeRepo.findById(attributeId)
                .orElseThrow(() -> new NotFoundException("Attribute not found: " + attributeId));

        String label = request.label().trim();
        String slugSource = request.slug() != null && !request.slug().isBlank() ? request.slug() : label;
        String slug = ProductSlugGenerator.toSlug(slugSource);
        if (slug.isBlank()) {
            throw ValidationException.fromField("label", "INVALID_SLUG",
                    "Tên không tạo được mã hợp lệ. Vui lòng dùng chữ hoặc số.");
        }

        valueRepo.findByAttributeIdAndSlug(attributeId, slug).ifPresent(existing -> {
            throw new ConflictException("Giá trị đã tồn tại trong thuộc tính này: " + slug);
        });

        int nextSortOrder = valueRepo.findAllByAttributeIdOrderBySortOrderAsc(attributeId).stream()
                .mapToInt(AttributeValueEntity::getSortOrder)
                .max()
                .orElse(-1) + 1;

        AttributeValueEntity entity = new AttributeValueEntity();
        entity.setId("attr-value-" + UUID.randomUUID());
        entity.setAttribute(attribute);
        entity.setSlug(slug);
        entity.setLabel(label);
        entity.setLabelEn(normalizeOptional(request.labelEn()));
        entity.setSortOrder(nextSortOrder);
        AttributeValueEntity saved = valueRepo.save(entity);
        auditLogWriter.save(auditLogFactory.build(
                "ADMIN", adminId, "ATTRIBUTE_VALUE_CREATED", "ATTRIBUTE", null, null, attributeValueSnapshot(saved)));
        catalogReferenceCacheEvictor.evictAllAfterCommit();
        return attributeMapper.toResponse(saved);
    }

    /**
     * Rename an existing value. Only the display label changes; the slug stays
     * immutable so existing variant options that reference it keep working.
     */
    @Transactional
    public AttributeValueResponse updateValueLabel(String valueId, UpdateAttributeValueRequest request, UUID adminId) {
        AttributeValueEntity entity = valueRepo.findById(valueId)
                .orElseThrow(() -> new NotFoundException("Attribute value not found: " + valueId));
        String before = attributeValueSnapshot(entity);
        entity.setLabel(request.label().trim());
        // Presence-flag: omit labelEn → unchanged; send blank → clears the English label.
        if (request.labelEn() != null) {
            entity.setLabelEn(normalizeOptional(request.labelEn()));
        }
        AttributeValueEntity saved = valueRepo.save(entity);
        auditLogWriter.save(auditLogFactory.build(
                "ADMIN", adminId, "ATTRIBUTE_VALUE_UPDATED", "ATTRIBUTE", null, before, attributeValueSnapshot(saved)));
        catalogReferenceCacheEvictor.evictAllAfterCommit();
        return attributeMapper.toResponse(saved);
    }

    /** Trim an optional text field; blank/null → null (so a cleared English label stores NULL). */
    private static String normalizeOptional(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static String attributeSnapshot(AttributeEntity a) {
        return "{\"id\":\"" + esc(a.getId()) + "\",\"code\":\"" + esc(a.getCode())
                + "\",\"name\":\"" + esc(a.getName()) + "\",\"nameEn\":\"" + esc(a.getNameEn()) + "\"}";
    }

    private static String attributeValueSnapshot(AttributeValueEntity v) {
        return "{\"id\":\"" + esc(v.getId())
                + "\",\"attributeId\":\"" + esc(v.getAttribute() == null ? null : v.getAttribute().getId())
                + "\",\"slug\":\"" + esc(v.getSlug())
                + "\",\"label\":\"" + esc(v.getLabel())
                + "\",\"labelEn\":\"" + esc(v.getLabelEn()) + "\"}";
    }

    private static String esc(String s) {
        return s == null ? "" : s.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
