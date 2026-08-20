package com.bigbike.bigbike_backend.service.chat;

import com.bigbike.bigbike_backend.api.chat.dto.ChatInteractionRequest;
import com.bigbike.bigbike_backend.api.chat.dto.ChatInteractionResponse;
import com.bigbike.bigbike_backend.api.error.ConflictException;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.persistence.entity.chat.ChatConversationEntity;
import com.bigbike.bigbike_backend.persistence.entity.chat.ChatInteractionEntity;
import com.bigbike.bigbike_backend.persistence.entity.chat.ChatMessageEntity;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatConversationJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatInteractionJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatMessageJpaRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ChatInteractionService {

    private final ChatConversationJpaRepository conversationRepo;
    private final ChatMessageJpaRepository messageRepo;
    private final ChatInteractionJpaRepository interactionRepo;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Transactional
    public ChatInteractionResponse record(ChatInteractionRequest request, UUID customerId) {
        ChatConversationEntity conversation = ownedConversation(request.conversationId(), customerId);
        Optional<ChatInteractionEntity> replay = interactionRepo.findByClientEventId(request.clientEventId());
        if (replay.isPresent()) {
            verifySameEvent(replay.get(), request);
            return new ChatInteractionResponse(true, replay.get().getId());
        }
        ChatMessageEntity message = messageRepo.findByIdAndConversationIdAndRole(
                        request.assistantMessageId(), conversation.getId(), "ASSISTANT")
                .orElseThrow(() -> new NotFoundException("Không tìm thấy câu trả lời trợ lý."));

        InteractionShape shape = validateIssuedInteraction(conversation, message, request);
        ChatInteractionEntity entity = new ChatInteractionEntity();
        entity.setClientEventId(request.clientEventId());
        entity.setConversationId(conversation.getId());
        entity.setAssistantMessageId(message.getId());
        entity.setInteractionType(request.type());
        entity.setLeadPromptSequence(shape.leadPromptSequence());
        entity.setActionType(shape.actionType());
        try {
            entity = interactionRepo.saveAndFlush(entity);
        } catch (DataIntegrityViolationException exception) {
            entity = interactionRepo.findByClientEventId(request.clientEventId())
                    .or(() -> interactionRepo
                            .findFirstByConversationIdAndAssistantMessageIdAndInteractionTypeAndLeadPromptSequence(
                                    conversation.getId(), message.getId(), request.type(), shape.leadPromptSequence()))
                    .orElseThrow(() -> exception);
        }
        return new ChatInteractionResponse(true, entity.getId());
    }

    @Transactional(readOnly = true)
    public boolean hasLeadPromptViewed(UUID conversationId, int sequence) {
        return interactionRepo.existsByConversationIdAndInteractionTypeAndLeadPromptSequence(
                conversationId, "LEAD_PROMPT_VIEWED", sequence);
    }

    @Transactional(readOnly = true)
    public UUID verifiedActionOrigin(UUID interactionId, UUID conversationId) {
        if (interactionId == null || conversationId == null) return null;
        return interactionRepo.findById(interactionId)
                .filter(item -> conversationId.equals(item.getConversationId()))
                .filter(item -> "ACTION_CLICKED".equals(item.getInteractionType()))
                .map(ChatInteractionEntity::getId)
                .orElse(null);
    }

    @Transactional(readOnly = true)
    public String actionType(UUID interactionId) {
        if (interactionId == null) return null;
        return interactionRepo.findById(interactionId)
                .filter(item -> "ACTION_CLICKED".equals(item.getInteractionType()))
                .map(ChatInteractionEntity::getActionType)
                .orElse(null);
    }

    @Transactional
    public int offerSecondLeadAfterVerifiedCart(UUID conversationId, UUID customerId) {
        if (conversationId == null) return 0;
        ChatConversationEntity conversation = ownedConversation(conversationId, customerId);
        if (!"OFFERED".equals(conversation.getLeadOfferStatus())
                || conversation.getLeadOfferCount() != 1
                || !hasLeadPromptViewed(conversationId, 1)) {
            return 0;
        }
        conversation.setLeadOfferCount(2);
        conversationRepo.save(conversation);
        return 2;
    }

    @Transactional(readOnly = true)
    public UUID verifiedCartInteraction(
            UUID interactionId,
            UUID conversationId,
            String productSlug
    ) {
        UUID verified = verifiedActionOrigin(interactionId, conversationId);
        if (verified == null || productSlug == null || productSlug.isBlank()) return null;
        return messageRepo.countShownProductFromInteraction(
                conversationId, verified, productSlug) > 0 ? verified : null;
    }

    private ChatConversationEntity ownedConversation(UUID id, UUID customerId) {
        ChatConversationEntity conversation = conversationRepo.findByIdForUpdate(id)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy hội thoại."));
        UUID owner = conversation.getCustomerId();
        if ((owner != null && customerId == null) || (owner != null && !owner.equals(customerId))) {
            throw new NotFoundException("Không tìm thấy hội thoại.");
        }
        return conversation;
    }

    private InteractionShape validateIssuedInteraction(
            ChatConversationEntity conversation,
            ChatMessageEntity message,
            ChatInteractionRequest request) {
        JsonNode metadata;
        try {
            metadata = objectMapper.readTree(message.getActionMetadata());
        } catch (Exception exception) {
            throw new ConflictException("Tương tác không được phát từ câu trả lời này.");
        }
        if ("LEAD_PROMPT_VIEWED".equals(request.type())) {
            int sequence = request.leadPromptSequence() == null ? 0 : request.leadPromptSequence();
            int issued = metadata.path("leadPromptSequence").asInt(
                    metadata.path("leadPrompt").asBoolean(false) ? 1 : 0);
            boolean cartIssuedSecond = sequence == 2 && conversation.getLeadOfferCount() >= 2;
            if (sequence < 1 || (!cartIssuedSecond && sequence != issued) || request.actionType() != null) {
                throw new ConflictException("Lời mời liên hệ không hợp lệ.");
            }
            return new InteractionShape(sequence, null);
        }
        String actionType = request.actionType();
        if (request.leadPromptSequence() != null || !ChatActionCatalog.isAllowed(actionType)) {
            throw new ConflictException("Nút gợi ý không hợp lệ.");
        }
        boolean issued = false;
        for (JsonNode action : metadata.path("actions")) {
            if (actionType.equals(action.path("type").asText())) {
                issued = true;
                break;
            }
        }
        if (!issued) throw new ConflictException("Nút gợi ý không được phát từ câu trả lời này.");
        return new InteractionShape(null, actionType);
    }

    private static void verifySameEvent(ChatInteractionEntity stored, ChatInteractionRequest request) {
        if (!stored.getConversationId().equals(request.conversationId())
                || !stored.getAssistantMessageId().equals(request.assistantMessageId())
                || !stored.getInteractionType().equals(request.type())
                || !java.util.Objects.equals(stored.getLeadPromptSequence(), request.leadPromptSequence())
                || !java.util.Objects.equals(stored.getActionType(), request.actionType())) {
            throw new ConflictException("Mã tương tác đã được dùng cho một sự kiện khác.");
        }
    }

    private record InteractionShape(Integer leadPromptSequence, String actionType) {}
}
