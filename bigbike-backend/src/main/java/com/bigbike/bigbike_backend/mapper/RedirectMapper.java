package com.bigbike.bigbike_backend.mapper;

import com.bigbike.bigbike_backend.api.admin.dto.redirect.AdminRedirectResponse;
import com.bigbike.bigbike_backend.api.admin.dto.redirect.RedirectChain;
import com.bigbike.bigbike_backend.persistence.entity.redirect.RedirectEntity;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.ReportingPolicy;

@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.ERROR)
public interface RedirectMapper {

    /**
     * chainHops/finalTarget are not entity columns — they are computed by walking the redirect
     * chain in {@code AdminRedirectService}, so they arrive as a second source parameter.
     */
    @Mapping(target = "chainHops", source = "chain.hops")
    @Mapping(target = "finalTarget", source = "chain.finalTarget")
    AdminRedirectResponse toResponse(RedirectEntity entity, RedirectChain chain);
}
