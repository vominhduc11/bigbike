package com.bigbike.bigbike_backend.mapper;

import com.bigbike.bigbike_backend.api.admin.dto.warranty.WarrantyRecordResponse;
import com.bigbike.bigbike_backend.persistence.entity.commerce.warranty.WarrantyRecordEntity;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.ReportingPolicy;

@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.ERROR)
public interface WarrantyMapper {

    @Mapping(target = "serialNumber", ignore = true)
    @Mapping(target = "orderNumber", ignore = true)
    @Mapping(target = "productName", ignore = true)
    @Mapping(target = "variantName", ignore = true)
    WarrantyRecordResponse toResponse(WarrantyRecordEntity entity);
}
