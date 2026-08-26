package com.bigbike.bigbike_backend.mapper;

import com.bigbike.bigbike_backend.api.admin.dto.AttributeValueResponse;
import com.bigbike.bigbike_backend.persistence.entity.catalog.AttributeValueEntity;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.ReportingPolicy;

@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.ERROR)
public interface AttributeMapper {

    @Mapping(target = "attributeId", source = "attribute.id")
    @Mapping(target = "usageCount", ignore = true)
    AttributeValueResponse toResponse(AttributeValueEntity entity);
}
