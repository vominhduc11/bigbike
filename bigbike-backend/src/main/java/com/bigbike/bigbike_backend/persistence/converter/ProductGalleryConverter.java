package com.bigbike.bigbike_backend.persistence.converter;

import com.bigbike.bigbike_backend.domain.catalog.GalleryMedia;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import java.util.List;

/** Converts product gallery rows to/from {@code products.gallery} JSONB. */
@Converter
public class ProductGalleryConverter implements AttributeConverter<List<GalleryMedia>, String> {

    private static final ObjectMapper MAPPER = new ObjectMapper()
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
    private static final TypeReference<List<GalleryMedia>> TYPE_REF = new TypeReference<>() {};

    @Override
    public String convertToDatabaseColumn(List<GalleryMedia> gallery) {
        if (gallery == null) return null;
        try {
            return MAPPER.writeValueAsString(gallery);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Cannot serialize product gallery to JSON", e);
        }
    }

    @Override
    public List<GalleryMedia> convertToEntityAttribute(String dbData) {
        if (dbData == null) return null;
        try {
            return MAPPER.readValue(dbData, TYPE_REF);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Cannot deserialize product gallery from JSON: " + dbData, e);
        }
    }
}
