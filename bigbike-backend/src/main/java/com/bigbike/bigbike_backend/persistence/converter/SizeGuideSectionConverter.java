package com.bigbike.bigbike_backend.persistence.converter;

import com.bigbike.bigbike_backend.domain.catalog.SizeGuideSection;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/**
 * JPA converter that marshals {@code SizeGuideSection} to/from a JSON string stored in the
 * {@code products.size_guide_section} JSONB column. Mirrors {@link DescriptionBlocksConverter}.
 */
@Converter
public class SizeGuideSectionConverter implements AttributeConverter<SizeGuideSection, String> {

    private static final ObjectMapper MAPPER = new ObjectMapper()
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

    @Override
    public String convertToDatabaseColumn(SizeGuideSection section) {
        if (section == null) return null;
        try {
            return MAPPER.writeValueAsString(section);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Cannot serialize size guide section to JSON", e);
        }
    }

    @Override
    public SizeGuideSection convertToEntityAttribute(String dbData) {
        if (dbData == null) return null;
        try {
            return MAPPER.readValue(dbData, SizeGuideSection.class);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Cannot deserialize size guide section from JSON: " + dbData, e);
        }
    }
}
