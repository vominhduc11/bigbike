package com.bigbike.bigbike_backend.mapper;

import com.bigbike.bigbike_backend.api.admin.dto.redirect.AdminRedirectResponse;
import com.bigbike.bigbike_backend.persistence.entity.redirect.RedirectEntity;
import org.mapstruct.Mapper;
import org.mapstruct.ReportingPolicy;

@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.ERROR)
public interface RedirectMapper {

    AdminRedirectResponse toResponse(RedirectEntity entity);
}
