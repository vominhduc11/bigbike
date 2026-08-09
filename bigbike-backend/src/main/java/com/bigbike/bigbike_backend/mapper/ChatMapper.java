package com.bigbike.bigbike_backend.mapper;

import com.bigbike.bigbike_backend.api.admin.dto.chat.AdminChatConversationDetailResponse;
import com.bigbike.bigbike_backend.api.admin.dto.chat.AdminChatConversationResponse;
import com.bigbike.bigbike_backend.api.admin.dto.chat.AdminChatLeadResponse;
import com.bigbike.bigbike_backend.api.admin.dto.chat.AdminChatMessageResponse;
import com.bigbike.bigbike_backend.persistence.entity.chat.ChatConversationEntity;
import com.bigbike.bigbike_backend.persistence.entity.chat.ChatLeadEntity;
import com.bigbike.bigbike_backend.persistence.entity.chat.ChatMessageEntity;
import java.util.List;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.ReportingPolicy;

@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.ERROR)
public interface ChatMapper {

    @Mapping(target = "customerDisplayName", source = "customerDisplayName")
    @Mapping(target = "hasLead", source = "hasLead")
    AdminChatConversationResponse toListItem(
            ChatConversationEntity entity,
            String customerDisplayName,
            boolean hasLead);

    AdminChatMessageResponse toMessage(ChatMessageEntity entity);

    AdminChatLeadResponse toLead(ChatLeadEntity entity);

    @Mapping(target = "messages", source = "messages")
    @Mapping(target = "lead", source = "lead")
    @Mapping(target = "id", source = "entity.id")
    AdminChatConversationDetailResponse toDetail(
            ChatConversationEntity entity,
            List<AdminChatMessageResponse> messages,
            AdminChatLeadResponse lead);
}
