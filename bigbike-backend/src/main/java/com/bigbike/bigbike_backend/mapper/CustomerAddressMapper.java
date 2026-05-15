package com.bigbike.bigbike_backend.mapper;

import com.bigbike.bigbike_backend.api.admin.dto.customer.AdminCustomerAddressResponse;
import com.bigbike.bigbike_backend.api.customer.dto.CustomerAddressResponse;
import com.bigbike.bigbike_backend.persistence.entity.customer.CustomerAddressEntity;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.ReportingPolicy;

@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.ERROR)
public interface CustomerAddressMapper {

    @Mapping(target = "isDefault", expression = "java(entity.isDefault())")
    CustomerAddressResponse toCustomerResponse(CustomerAddressEntity entity);

    @Mapping(target = "isDefault", expression = "java(entity.isDefault())")
    AdminCustomerAddressResponse toAdminResponse(CustomerAddressEntity entity);
}
