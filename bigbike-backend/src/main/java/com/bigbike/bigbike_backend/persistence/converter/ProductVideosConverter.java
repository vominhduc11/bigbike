package com.bigbike.bigbike_backend.persistence.converter;

import com.bigbike.bigbike_backend.domain.catalog.VideoAsset;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import java.util.List;

/** Converts product video rows to/from {@code products.videos} JSONB. */
@Converter
public class ProductVideosConverter implements AttributeConverter<List<VideoAsset>, String> {

    private static final ObjectMapper MAPPER = new ObjectMapper()
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
    private static final TypeReference<List<VideoAsset>> TYPE_REF = new TypeReference<>() {};

    @Override
    public String convertToDatabaseColumn(List<VideoAsset> videos) {
        if (videos == null) return null;
        try {
            return MAPPER.writeValueAsString(videos);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Cannot serialize product videos to JSON", e);
        }
    }

    @Override
    public List<VideoAsset> convertToEntityAttribute(String dbData) {
        if (dbData == null) return null;
        try {
            return MAPPER.readValue(dbData, TYPE_REF);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Cannot deserialize product videos from JSON: " + dbData, e);
        }
    }
}
