package com.bigbike.bigbike_backend.persistence.converter;

import com.bigbike.bigbike_backend.domain.catalog.ProductCommitment;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import java.util.List;

/** Converts product commitment rows to/from {@code products.commitments} JSONB. */
@Converter
public class ProductCommitmentsConverter implements AttributeConverter<List<ProductCommitment>, String> {

    private static final ObjectMapper MAPPER = new ObjectMapper()
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
    private static final TypeReference<List<ProductCommitment>> TYPE_REF = new TypeReference<>() {};

    @Override
    public String convertToDatabaseColumn(List<ProductCommitment> commitments) {
        if (commitments == null) return null;
        try {
            return MAPPER.writeValueAsString(commitments);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Cannot serialize product commitments to JSON", e);
        }
    }

    @Override
    public List<ProductCommitment> convertToEntityAttribute(String dbData) {
        if (dbData == null) return null;
        try {
            return MAPPER.readValue(dbData, TYPE_REF);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Cannot deserialize product commitments from JSON: " + dbData, e);
        }
    }
}
