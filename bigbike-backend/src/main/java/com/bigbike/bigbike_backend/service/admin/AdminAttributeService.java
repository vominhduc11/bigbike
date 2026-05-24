package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.AttributeSummaryResponse;
import com.bigbike.bigbike_backend.api.admin.dto.AttributeValueResponse;
import com.bigbike.bigbike_backend.api.admin.dto.AttributeValueSwatchRequest;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.persistence.entity.catalog.AttributeValueEntity;
import com.bigbike.bigbike_backend.persistence.entity.media.MediaEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.AttributeJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.AttributeValueJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.media.MediaJpaRepository;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AdminAttributeService {

    private final AttributeJpaRepository attributeRepo;
    private final AttributeValueJpaRepository valueRepo;
    private final MediaJpaRepository mediaRepo;

    @Transactional(readOnly = true)
    public List<AttributeSummaryResponse> listAttributes() {
        return attributeRepo.findAllByOrderByNameAsc().stream()
                .map(a -> new AttributeSummaryResponse(
                        a.getId(),
                        a.getCode(),
                        a.getName(),
                        a.getKind(),
                        a.getValues().size()
                ))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<AttributeValueResponse> listValues(String attributeId) {
        attributeRepo.findById(attributeId)
                .orElseThrow(() -> new NotFoundException("Attribute not found: " + attributeId));
        return valueRepo.findAllByAttributeIdOrderBySortOrderAsc(attributeId).stream()
                .map(v -> toResponse(v, resolveSwatchUrl(v.getSwatchImageId())))
                .toList();
    }

    @Transactional
    public AttributeValueResponse updateSwatch(String valueId, AttributeValueSwatchRequest req) {
        AttributeValueEntity value = valueRepo.findById(valueId)
                .orElseThrow(() -> new NotFoundException("AttributeValue not found: " + valueId));
        if (req.colorHex() != null) {
            value.setColorHex(req.colorHex().isBlank() ? null : req.colorHex().trim());
        }
        if (req.swatchImageUrl() != null) {
            value.setSwatchImageId(req.swatchImageUrl().isBlank() ? null : req.swatchImageUrl().trim());
        }
        valueRepo.save(value);
        return toResponse(value, resolveSwatchUrl(value.getSwatchImageId()));
    }

    private AttributeValueResponse toResponse(AttributeValueEntity v, String swatchImageUrl) {
        return new AttributeValueResponse(
                v.getId(),
                v.getAttribute() != null ? v.getAttribute().getId() : null,
                v.getSlug(),
                v.getLabel(),
                v.getColorHex(),
                swatchImageUrl,
                v.getSortOrder()
        );
    }

    private String resolveSwatchUrl(String swatchImageId) {
        if (swatchImageId == null || swatchImageId.isBlank()) return null;
        final String trimmed = swatchImageId.trim();
        // Try UUID lookup first — new admin uploads store the media entity UUID
        try {
            UUID uuid = UUID.fromString(trimmed);
            return mediaRepo.findById(uuid)
                    .map(MediaEntity::getPublicUrl)
                    .filter(url -> url != null && !url.isBlank())
                    .orElse(null);
        } catch (IllegalArgumentException ignored) {
            // not a UUID — fall through to legacy numeric lookup
        }
        // Fallback: legacy WP attachment numeric ID
        try {
            long legacyId = Long.parseLong(trimmed);
            return mediaRepo.findByLegacyId(legacyId)
                    .map(MediaEntity::getPublicUrl)
                    .filter(url -> url != null && !url.isBlank())
                    .orElse(null);
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
