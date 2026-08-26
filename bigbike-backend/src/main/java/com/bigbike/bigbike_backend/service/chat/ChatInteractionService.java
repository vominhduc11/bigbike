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
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor(onConstructor_ = @org.springframework.beans.factory.annotation.Autowired)
public class ChatInteractionService {

    private final ChatConversationJpaRepository conversationRepo;
    private final ChatMessageJpaRepository messageRepo;
    private final ChatInteractionJpaRepository interactionRepo;
    private final ChatAttributionTokenService attributionTokenService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    /** Compatibility constructor for phase-1 unit tests that do not record product views. */
    public ChatInteractionService(
            ChatConversationJpaRepository conversationRepo,
            ChatMessageJpaRepository messageRepo,
            ChatInteractionJpaRepository interactionRepo
    ) {
        this.conversationRepo = conversationRepo;
        this.messageRepo = messageRepo;
        this.interactionRepo = interactionRepo;
        this.attributionTokenService = null;
    }

    @Transactional
    public ChatInteractionResponse record(ChatInteractionRequest request, UUID customerId) {
        return record(request, customerId, null);
    }

    @Transactional
    public ChatInteractionResponse record(
            ChatInteractionRequest request, UUID customerId, UUID visitorId) {
        ChatConversationEntity conversation = ownedConversation(
                request.conversationId(), customerId, visitorId);
        Optional<ChatInteractionEntity> replay = interactionRepo.findByClientEventId(request.clientEventId());
        if (replay.isPresent()) {
            verifySameEvent(replay.get(), request);
            return responseFor(replay.get(), customerId);
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
        entity.setProductSlug(shape.productSlug());
        try {
            entity = interactionRepo.saveAndFlush(entity);
        } catch (DataIntegrityViolationException exception) {
            entity = interactionRepo.findByClientEventId(request.clientEventId())
                    .or(() -> interactionRepo
                            .findFirstByConversationIdAndAssistantMessageIdAndInteractionTypeAndLeadPromptSequence(
                                    conversation.getId(), message.getId(), request.type(), shape.leadPromptSequence()))
                    .orElseThrow(() -> exception);
        }
        return responseFor(entity, customerId);
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
        // Automatic invitations were retired; customers open the callback form explicitly.
        return 0;
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
                conversationId, verified, productSlug) > 0
                && interactionRepo.findById(verified)
                        .map(item -> item.getCreatedAt() != null
                                && !item.getCreatedAt().isBefore(
                                        Instant.now().minus(ChatAttributionTokenService.WINDOW_HOURS,
                                                ChronoUnit.HOURS)))
                        .orElse(false)
                ? verified : null;
    }

    public ChatAttributionTokenService.Payload verifiedAttributionToken(
            String token, String productSlug, UUID customerId) {
        if (attributionTokenService == null) {
            throw new ConflictException("Ghi nhận từ trợ lý chưa sẵn sàng.");
        }
        ChatAttributionTokenService.Payload payload = attributionTokenService.verify(
                token, productSlug, customerId);
        ChatInteractionEntity interaction = interactionRepo.findById(payload.interactionId())
                .filter(item -> "PRODUCT_VIEWED".equals(item.getInteractionType()))
                .filter(item -> payload.conversationId().equals(item.getConversationId()))
                .filter(item -> payload.productSlug().equals(item.getProductSlug()))
                .orElseThrow(() -> new ConflictException("Lần xem sản phẩm từ trợ lý không hợp lệ."));
        if (interaction.getCreatedAt() == null
                || interaction.getCreatedAt().isBefore(
                        Instant.now().minus(ChatAttributionTokenService.WINDOW_HOURS,
                                ChronoUnit.HOURS))) {
            throw new ConflictException("Liên kết từ trợ lý đã quá thời hạn ghi nhận 7 ngày.");
        }
        return payload;
    }

    @Transactional
    public void recordServerCartAdded(
            ChatAttributionTokenService.Payload payload,
            UUID assistantMessageId,
            UUID cartItemId
    ) {
        if (payload == null || assistantMessageId == null || cartItemId == null) return;
        interactionRepo.insertCartAddedIfAbsent(
                UUID.randomUUID(), payload.conversationId(), assistantMessageId,
                payload.productSlug(), payload.interactionId(), cartItemId);
    }

    @Transactional(readOnly = true)
    public UUID assistantMessageId(UUID interactionId) {
        return interactionId == null ? null : interactionRepo.findById(interactionId)
                .map(ChatInteractionEntity::getAssistantMessageId)
                .orElse(null);
    }

    @Transactional(readOnly = true)
    public Instant interactionAt(UUID interactionId) {
        return interactionId == null ? null : interactionRepo.findById(interactionId)
                .map(ChatInteractionEntity::getCreatedAt)
                .orElse(null);
    }

    @Transactional(readOnly = true)
    public boolean isEligibleAtCheckout(
            UUID interactionId,
            UUID conversationId,
            String productSlug,
            Instant touchAt
    ) {
        Instant cutoff = Instant.now().minus(
                ChatAttributionTokenService.WINDOW_HOURS, ChronoUnit.HOURS);
        if (conversationId == null || productSlug == null || productSlug.isBlank()
                || interactionId == null || touchAt == null || touchAt.isBefore(cutoff)) {
            return false;
        }
        return interactionRepo.findById(interactionId)
                .filter(item -> conversationId.equals(item.getConversationId()))
                .filter(item -> item.getCreatedAt() != null && !item.getCreatedAt().isBefore(cutoff))
                .filter(item -> "PRODUCT_VIEWED".equals(item.getInteractionType())
                        ? productSlug.equals(item.getProductSlug())
                        : "ACTION_CLICKED".equals(item.getInteractionType())
                                && messageRepo.countShownProductFromInteraction(
                                        conversationId, interactionId, productSlug) > 0)
                .isPresent();
    }

    private ChatConversationEntity ownedConversation(UUID id, UUID customerId, UUID visitorId) {
        ChatConversationEntity conversation = conversationRepo.findByIdForUpdate(id)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy hội thoại."));
        UUID owner = conversation.getCustomerId();
        boolean customerOwns = owner != null && owner.equals(customerId);
        boolean visitorOwns = visitorId != null && visitorId.equals(conversation.getVisitorId())
                && (owner == null || customerOwns);
        boolean legacyGuest = owner == null && conversation.getVisitorId() == null;
        if (!customerOwns && !visitorOwns && !legacyGuest) {
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
            return new InteractionShape(sequence, null, null);
        }
        if ("PRODUCT_VIEWED".equals(request.type())) {
            String slug = request.productSlug() == null ? null : request.productSlug().trim();
            if (request.leadPromptSequence() != null || request.actionType() != null
                    || slug == null || slug.isBlank() || !messageContainsProduct(message, slug)) {
                throw new ConflictException("Sản phẩm chưa được hiển thị trong câu trả lời này.");
            }
            return new InteractionShape(null, null, slug);
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
        return new InteractionShape(null, actionType, null);
    }

    private static void verifySameEvent(ChatInteractionEntity stored, ChatInteractionRequest request) {
        if (!stored.getConversationId().equals(request.conversationId())
                || !stored.getAssistantMessageId().equals(request.assistantMessageId())
                || !stored.getInteractionType().equals(request.type())
                || !java.util.Objects.equals(stored.getLeadPromptSequence(), request.leadPromptSequence())
                || !java.util.Objects.equals(stored.getActionType(), request.actionType())
                || !java.util.Objects.equals(stored.getProductSlug(), request.productSlug())) {
            throw new ConflictException("Mã tương tác đã được dùng cho một sự kiện khác.");
        }
    }

    private boolean messageContainsProduct(ChatMessageEntity message, String slug) {
        return jsonContainsProduct(message.getProductsJson(), slug)
                || jsonContainsProduct(message.getCrossSellProductsJson(), slug);
    }

    private boolean jsonContainsProduct(String json, String slug) {
        if (json == null || json.isBlank()) return false;
        try {
            for (JsonNode product : objectMapper.readTree(json)) {
                if (slug.equals(product.path("slug").asText())) return true;
            }
            return false;
        } catch (Exception ignored) {
            return false;
        }
    }

    private ChatInteractionResponse responseFor(ChatInteractionEntity entity, UUID customerId) {
        if (!"PRODUCT_VIEWED".equals(entity.getInteractionType()) || attributionTokenService == null) {
            return new ChatInteractionResponse(true, entity.getId());
        }
        ChatAttributionTokenService.IssuedToken issued = attributionTokenService.issue(
                entity.getId(), entity.getConversationId(), entity.getProductSlug(), customerId,
                entity.getCreatedAt());
        return new ChatInteractionResponse(
                true, entity.getId(), issued.token(), issued.expiresAt());
    }

    private record InteractionShape(Integer leadPromptSequence, String actionType, String productSlug) {}
}
