package com.bigbike.bigbike_backend.persistence.converter;

import com.bigbike.bigbike_backend.domain.content.GuideEntry;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import java.util.List;

/**
 * JPA converter that marshals {@code List<GuideEntry>} to/from a JSON string stored in the
 * {@code guide_page_layout.entries} JSONB column.
 */
@Converter
public class GuideEntriesConverter implements AttributeConverter<List<GuideEntry>, String> {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final TypeReference<List<GuideEntry>> TYPE_REF = new TypeReference<>() {};

    @Override
    public String convertToDatabaseColumn(List<GuideEntry> entries) {
        if (entries == null) return null;
        try {
            return MAPPER.writeValueAsString(entries);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Cannot serialize guide entries to JSON", e);
        }
    }

    @Override
    public List<GuideEntry> convertToEntityAttribute(String dbData) {
        if (dbData == null) return null;
        try {
            return MAPPER.readValue(dbData, TYPE_REF);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Cannot deserialize guide entries from JSON: " + dbData, e);
        }
    }
}
