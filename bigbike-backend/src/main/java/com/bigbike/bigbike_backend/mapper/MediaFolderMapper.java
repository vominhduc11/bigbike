package com.bigbike.bigbike_backend.mapper;

import com.bigbike.bigbike_backend.api.admin.dto.media.MediaFolderResponse;
import com.bigbike.bigbike_backend.persistence.entity.media.MediaFolderEntity;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.ReportingPolicy;

@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.ERROR)
public interface MediaFolderMapper {

    @Mapping(target = "mediaCount", source = "count")
    @Mapping(target = "parentId", source = "entity.parentId")
    @Mapping(target = "depth", source = "depth")
    @Mapping(target = "systemKey", source = "entity.systemKey")
    @Mapping(target = "sortOrder", source = "entity.sortOrder")
    MediaFolderResponse toResponse(MediaFolderEntity entity, long count, int depth);
}
