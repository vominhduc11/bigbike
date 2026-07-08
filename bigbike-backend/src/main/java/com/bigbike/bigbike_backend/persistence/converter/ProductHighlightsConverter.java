package com.bigbike.bigbike_backend.persistence.converter;

import com.bigbike.bigbike_backend.domain.catalog.ProductHighlights;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/** Converts product highlights to/from {@code products.highlights} JSONB. */
@Converter
public class ProductHighlightsConverter implements AttributeConverter<ProductHighlights, String> {

    private static final ObjectMapper MAPPER = new ObjectMapper()
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

    @Override
    public String convertToDatabaseColumn(ProductHighlights highlights) {
        if (highlights == null) return null;
        try {
            return MAPPER.writeValueAsString(highlights);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Cannot serialize product highlights to JSON", e);
        }
    }

    @Override
    public ProductHighlights convertToEntityAttribute(String dbData) {
        if (dbData == null) return null;
        try {
            return MAPPER.readValue(dbData, ProductHighlights.class);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Cannot deserialize product highlights from JSON: " + dbData, e);
        }
    }
}
