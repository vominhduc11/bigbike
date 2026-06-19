package com.bigbike.bigbike_backend.persistence.converter;

import com.bigbike.bigbike_backend.domain.catalog.ProductTab;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import java.util.List;

/**
 * JPA converter marshaling {@code List<ProductTab>} to/from the JSON string stored in the
 * {@code products.product_tabs} JSONB column (V231). In storage, each tab's {@code label}/{@code blocks}
 * hold the Vietnamese (canonical) content and {@code labelEn}/{@code blocksEn} hold the English values.
 */
@Converter
public class ProductTabsConverter implements AttributeConverter<List<ProductTab>, String> {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final TypeReference<List<ProductTab>> TYPE_REF = new TypeReference<>() {};

    @Override
    public String convertToDatabaseColumn(List<ProductTab> tabs) {
        if (tabs == null) return null;
        try {
            return MAPPER.writeValueAsString(tabs);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Cannot serialize product tabs to JSON", e);
        }
    }

    @Override
    public List<ProductTab> convertToEntityAttribute(String dbData) {
        if (dbData == null) return null;
        try {
            return MAPPER.readValue(dbData, TYPE_REF);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Cannot deserialize product tabs from JSON: " + dbData, e);
        }
    }
}
