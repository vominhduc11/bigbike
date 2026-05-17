package com.bigbike.bigbike_backend.mapper;

import com.bigbike.bigbike_backend.api.admin.dto.contact.AdminContactMessageDetail;
import com.bigbike.bigbike_backend.api.admin.dto.contact.AdminContactMessageListItem;
import com.bigbike.bigbike_backend.persistence.entity.contact.ContactMessageEntity;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.ReportingPolicy;

@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.ERROR)
public interface ContactMessageMapper {

    int PREVIEW_LENGTH = 140;

    @Mapping(target = "contentPreview", expression = "java(toContentPreview(entity.getContent()))")
    AdminContactMessageListItem toListItem(ContactMessageEntity entity);

    @Mapping(target = "assignedAdminName", source = "assignedAdminName")
    AdminContactMessageDetail toDetail(ContactMessageEntity entity, String assignedAdminName);

    default String toContentPreview(String content) {
        if (content == null) {
            return null;
        }
        String compact = content.replaceAll("\\s+", " ").trim();
        if (compact.length() <= PREVIEW_LENGTH) {
            return compact;
        }
        return compact.substring(0, PREVIEW_LENGTH) + "…";
    }
}
