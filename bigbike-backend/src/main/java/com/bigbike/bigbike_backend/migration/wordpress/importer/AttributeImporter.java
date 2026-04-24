package com.bigbike.bigbike_backend.migration.wordpress.importer;

import com.bigbike.bigbike_backend.migration.wordpress.writeplan.MigrationDomain;
import com.bigbike.bigbike_backend.persistence.entity.catalog.AttributeEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.AttributeValueEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.AttributeJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.AttributeValueJpaRepository;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class AttributeImporter implements DomainImporter {

    public record MappedAttribute(
            long sourceId,
            long termTaxonomyId,
            String code,
            String name,
            String kind,
            boolean variation,
            List<MappedAttributeValue> values,
            List<String> warnings
    ) {
    }

    public record MappedAttributeValue(
            long sourceId,
            String slug,
            String label,
            String colorHex,
            String swatchImageId,
            int sortOrder
    ) {
    }

    private final AttributeJpaRepository attributeRepo;
    private final AttributeValueJpaRepository attributeValueRepo;

    public AttributeImporter(
            AttributeJpaRepository attributeRepo,
            AttributeValueJpaRepository attributeValueRepo) {
        this.attributeRepo = attributeRepo;
        this.attributeValueRepo = attributeValueRepo;
    }

    @Override
    public MigrationDomain domain() {
        return MigrationDomain.PRODUCTS;
    }

    @Override
    public MigrationExecutionReport.DomainResult execute(MigrationExecutionOptions options) {
        throw new UnsupportedOperationException("Use importBatch()");
    }

    @Transactional
    public MigrationExecutionReport.DomainResult importBatch(
            List<MappedAttribute> items, MigrationExecutionOptions options) {

        int inserted = 0, updated = 0, skipped = 0, failed = 0;
        List<String> warnings = new ArrayList<>();
        List<String> errors = new ArrayList<>();

        for (MappedAttribute mapped : items) {
            if (mapped.code() == null || mapped.code().isBlank()) {
                skipped++;
                continue;
            }
            try {
                String attributeId = "wp-attr-" + mapped.termTaxonomyId();
                Optional<AttributeEntity> existing = attributeRepo.findByCode(mapped.code());
                if (existing.isEmpty()) {
                    existing = attributeRepo.findById(attributeId);
                }
                AttributeEntity attribute = existing.orElseGet(AttributeEntity::new);
                boolean isNew = existing.isEmpty();
                if (isNew) {
                    attribute.setId(attributeId);
                }
                attribute.setCode(mapped.code());
                attribute.setName(mapped.name() == null || mapped.name().isBlank() ? mapped.code() : mapped.name());
                attribute.setKind(mapped.kind() == null || mapped.kind().isBlank() ? "select" : mapped.kind());
                attribute.setVariation(mapped.variation());
                attribute.setLegacyTaxonomyId(mapped.termTaxonomyId());

                warnings.addAll(mapped.warnings());

                AttributeEntity persistedAttribute = options.dryRun() ? attribute : attributeRepo.save(attribute);

                if (mapped.values() != null) {
                    for (MappedAttributeValue value : mapped.values()) {
                        if (value.slug() == null || value.slug().isBlank()) {
                            continue;
                        }
                        String valueId = "wp-attr-value-" + value.sourceId();
                        Optional<AttributeValueEntity> existingValue = attributeValueRepo.findById(valueId);
                        AttributeValueEntity entity = existingValue.orElseGet(AttributeValueEntity::new);
                        boolean valueNew = existingValue.isEmpty();
                        if (valueNew) {
                            entity.setId(valueId);
                        }
                        entity.setAttribute(persistedAttribute);
                        entity.setSlug(value.slug());
                        entity.setLabel(value.label() == null || value.label().isBlank() ? value.slug() : value.label());
                        entity.setLegacyTermId(value.sourceId());
                        entity.setColorHex(value.colorHex());
                        entity.setSwatchImageId(value.swatchImageId());
                        entity.setSortOrder(value.sortOrder());

                        if (!options.dryRun()) {
                            attributeValueRepo.save(entity);
                        }
                        if (valueNew) {
                            inserted++;
                        } else {
                            updated++;
                        }
                    }
                }

                if (isNew) inserted++; else updated++;
            } catch (Exception e) {
                failed++;
                errors.add("Attribute code=" + mapped.code() + ": " + e.getMessage());
                if (options.failFast()) {
                    throw new RuntimeException(errors.get(errors.size() - 1), e);
                }
            }
        }

        return new MigrationExecutionReport.DomainResult(
                MigrationDomain.PRODUCTS, inserted, updated, skipped, failed, warnings, errors);
    }
}
