package com.bigbike.bigbike_backend.mapper;

import com.bigbike.bigbike_backend.api.admin.dto.media.MediaFolderResponse;
import com.bigbike.bigbike_backend.persistence.entity.media.MediaFolderEntity;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.ReportingPolicy;

@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.ERROR)
public interface MediaFolderMapper {

    @Mapping(target = "mediaCount", source = "count")
    MediaFolderResponse toResponse(MediaFolderEntity entity, long count);
}
