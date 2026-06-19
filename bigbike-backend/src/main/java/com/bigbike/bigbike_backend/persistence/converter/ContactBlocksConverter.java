package com.bigbike.bigbike_backend.persistence.converter;

import com.bigbike.bigbike_backend.domain.content.ContactBlock;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import java.util.List;

/**
 * JPA converter that marshals {@code List<ContactBlock>} to/from a JSON string stored in the
 * {@code contact_page_layout.blocks} JSONB column. Mirrors {@link DescriptionBlocksConverter}.
 */
@Converter
public class ContactBlocksConverter implements AttributeConverter<List<ContactBlock>, String> {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final TypeReference<List<ContactBlock>> TYPE_REF = new TypeReference<>() {};

    @Override
    public String convertToDatabaseColumn(List<ContactBlock> blocks) {
        if (blocks == null) return null;
        try {
            return MAPPER.writeValueAsString(blocks);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Cannot serialize contact blocks to JSON", e);
        }
    }

    @Override
    public List<ContactBlock> convertToEntityAttribute(String dbData) {
        if (dbData == null) return null;
        try {
            return MAPPER.readValue(dbData, TYPE_REF);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Cannot deserialize contact blocks from JSON: " + dbData, e);
        }
    }
}
