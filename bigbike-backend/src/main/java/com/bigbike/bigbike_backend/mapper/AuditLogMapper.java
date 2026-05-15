package com.bigbike.bigbike_backend.mapper;

import com.bigbike.bigbike_backend.api.admin.dto.audit.AdminAuditLogListItemResponse;
import com.bigbike.bigbike_backend.persistence.entity.audit.AuditLogEntity;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.ReportingPolicy;

@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.ERROR)
public interface AuditLogMapper {

    @Mapping(target = "actorDisplayName", source = "actorDisplayName")
    @Mapping(target = "actorEmail", source = "actorEmail")
    @Mapping(target = "resourceDisplayName", source = "resourceDisplayName")
    @Mapping(target = "resourceCode", source = "resourceCode")
    AdminAuditLogListItemResponse toListItemResponse(
            AuditLogEntity entity,
            String actorDisplayName,
            String actorEmail,
            String resourceDisplayName,
            String resourceCode
    );
}
