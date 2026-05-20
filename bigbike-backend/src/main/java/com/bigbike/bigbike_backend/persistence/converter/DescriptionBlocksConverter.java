package com.bigbike.bigbike_backend.persistence.converter;

import com.bigbike.bigbike_backend.domain.catalog.DescriptionBlock;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import java.util.List;

/**
 * JPA converter that marshals {@code List<DescriptionBlock>} to/from a JSON string
 * stored in the {@code products.description_blocks} JSONB column.
 * Uses a module-level ObjectMapper configured by Jackson's annotation-based polymorphism
 * on {@link DescriptionBlock}.
 */
@Converter
public class DescriptionBlocksConverter implements AttributeConverter<List<DescriptionBlock>, String> {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final TypeReference<List<DescriptionBlock>> TYPE_REF = new TypeReference<>() {};

    @Override
    public String convertToDatabaseColumn(List<DescriptionBlock> blocks) {
        if (blocks == null) return null;
        try {
            return MAPPER.writeValueAsString(blocks);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Cannot serialize description blocks to JSON", e);
        }
    }

    @Override
    public List<DescriptionBlock> convertToEntityAttribute(String dbData) {
        if (dbData == null) return null;
        try {
            return MAPPER.readValue(dbData, TYPE_REF);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Cannot deserialize description blocks from JSON: " + dbData, e);
        }
    }
}
