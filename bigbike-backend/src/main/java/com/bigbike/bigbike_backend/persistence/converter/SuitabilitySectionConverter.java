package com.bigbike.bigbike_backend.persistence.converter;

import com.bigbike.bigbike_backend.domain.catalog.SuitabilitySection;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/**
 * JPA converter that marshals {@code SuitabilitySection} to/from a JSON string stored in the
 * {@code products.suitability_section} JSONB column. Mirrors {@link DescriptionBlocksConverter}.
 */
@Converter
public class SuitabilitySectionConverter implements AttributeConverter<SuitabilitySection, String> {

    private static final ObjectMapper MAPPER = new ObjectMapper()
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

    @Override
    public String convertToDatabaseColumn(SuitabilitySection section) {
        if (section == null) return null;
        try {
            return MAPPER.writeValueAsString(section);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Cannot serialize suitability section to JSON", e);
        }
    }

    @Override
    public SuitabilitySection convertToEntityAttribute(String dbData) {
        if (dbData == null) return null;
        try {
            return MAPPER.readValue(dbData, SuitabilitySection.class);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Cannot deserialize suitability section from JSON: " + dbData, e);
        }
    }
}
