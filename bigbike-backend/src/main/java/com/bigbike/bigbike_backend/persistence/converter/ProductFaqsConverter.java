package com.bigbike.bigbike_backend.persistence.converter;

import com.bigbike.bigbike_backend.domain.catalog.ProductFaq;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import java.util.List;

/** Converts product FAQ rows to/from {@code products.faqs} JSONB. */
@Converter
public class ProductFaqsConverter implements AttributeConverter<List<ProductFaq>, String> {

    private static final ObjectMapper MAPPER = new ObjectMapper()
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
    private static final TypeReference<List<ProductFaq>> TYPE_REF = new TypeReference<>() {};

    @Override
    public String convertToDatabaseColumn(List<ProductFaq> faqs) {
        if (faqs == null) return null;
        try {
            return MAPPER.writeValueAsString(faqs);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Cannot serialize product FAQs to JSON", e);
        }
    }

    @Override
    public List<ProductFaq> convertToEntityAttribute(String dbData) {
        if (dbData == null) return null;
        try {
            return MAPPER.readValue(dbData, TYPE_REF);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Cannot deserialize product FAQs from JSON: " + dbData, e);
        }
    }
}
