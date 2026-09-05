package com.bigbike.bigbike_backend.service.chat;

import com.bigbike.bigbike_backend.api.chat.dto.ChatDeleteHistoryResponse;
import com.bigbike.bigbike_backend.api.chat.dto.ChatHistoryMessageResponse;
import com.bigbike.bigbike_backend.api.chat.dto.ChatHistoryResponse;
import com.bigbike.bigbike_backend.api.chat.dto.ChatSessionRequest;
import com.bigbike.bigbike_backend.api.chat.dto.ChatSessionResponse;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.persistence.entity.chat.ChatConversationEntity;
import com.bigbike.bigbike_backend.persistence.entity.chat.ChatVisitorEntity;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatConversationJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatMessageJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatVisitorJpaRepository;
import com.bigbike.bigbike_backend.service.auth.JwtService;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ChatVisitorService {

    private final ChatVisitorJpaRepository visitorRepo;
    private final ChatConversationJpaRepository conversationRepo;
    private final ChatMessageJpaRepository messageRepo;
    private final JwtService jwtService;
    private final ChatImageService chatImageService;

    @Autowired
    public ChatVisitorService(
            ChatVisitorJpaRepository visitorRepo,
            ChatConversationJpaRepository conversationRepo,
            ChatMessageJpaRepository messageRepo,
            JwtService jwtService,
            ChatImageService chatImageService
    ) {
        this.visitorRepo = visitorRepo;
        this.conversationRepo = conversationRepo;
        this.messageRepo = messageRepo;
        this.jwtService = jwtService;
        this.chatImageService = chatImageService;
    }

    /** Compatibility constructor for focused tests that do not exercise customer images. */
    public ChatVisitorService(
            ChatVisitorJpaRepository visitorRepo,
            ChatConversationJpaRepository conversationRepo,
            ChatMessageJpaRepository messageRepo,
            JwtService jwtService
    ) {
        this(visitorRepo, conversationRepo, messageRepo, jwtService, null);
    }

    /**
     * CHAT_RULE_049 (owner decision 2026-09-05): a visitor row is created only when the customer
     * actually opens the chat panel, and it lives for the current browser session. The identifier
     * stays because it is the ownership key for a guest's conversation and images; what is gone is
     * the 30-day window, the memory switch and reconnecting to an earlier session's conversation.
     */
    @Transactional
    public ChatSessionResponse open(ChatSessionRequest request, UUID customerId) {
        ChatVisitorEntity visitor = visitorRepo.findById(request.visitorId()).orElse(null);
        String rawToken = request.visitorToken();
        if (visitor == null) {
            rawToken = jwtService.generateRawRefreshToken();
            visitor = new ChatVisitorEntity();
            visitor.setId(request.visitorId());
            visitor.setTokenHash(jwtService.hashToken(rawToken));
        } else {
            requireToken(visitor, rawToken);
        }
        touch(visitor);
        visitorRepo.save(visitor);

        if (customerId != null) {
            conversationRepo.attachVisitorConversations(visitor.getId(), customerId);
        }
        // A shared device may retain its visible visitor token across account changes.
        // Select inside the caller's ownership scope instead of finding globally and filtering
        // afterward, otherwise another account's newer row could shadow the caller's own chat.
        ChatConversationEntity latest = customerId == null
                ? conversationRepo
                    .findFirstByVisitorIdAndCustomerIdIsNullOrderByLastMessageAtDesc(visitor.getId())
                    .orElse(null)
                : conversationRepo
                    .findFirstByVisitorIdAndCustomerIdOrderByLastMessageAtDesc(
                            visitor.getId(), customerId)
                    .orElse(null);
        return new ChatSessionResponse(rawToken, latest == null ? null : latest.getId());
    }

    @Transactional
    public UUID resolveVisitorId(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) return null;
        ChatVisitorEntity visitor = visitorRepo.findByTokenHash(jwtService.hashToken(rawToken))
                .orElseThrow(() -> new NotFoundException("Không tìm thấy phiên ghi nhớ hội thoại."));
        if (visitor.getRememberedUntil().isBefore(Instant.now())) {
            throw new NotFoundException("Phiên hội thoại đã hết hạn.");
        }
        touch(visitor);
        visitorRepo.save(visitor);
        return visitor.getId();
    }

    @Transactional(readOnly = true)
    public ChatHistoryResponse history(
            UUID conversationId, long afterSequence, UUID customerId, String rawToken) {
        UUID visitorId = resolveVisitorIdReadOnly(rawToken);
        ChatConversationEntity conversation = requireOwner(conversationId, customerId, visitorId);
        var messages = messageRepo
                .findByConversationIdAndSequenceNoGreaterThanOrderBySequenceNoAsc(
                        conversationId, Math.max(0, afterSequence));
        var imagesByMessage = chatImageService == null ? java.util.Map.<UUID, List<com.bigbike.bigbike_backend.api.chat.dto.ChatImageResponse>>of()
                : chatImageService.referencesByMessageIds(
                        messages.stream().map(message -> message.getId()).toList());
        List<ChatHistoryMessageResponse> result = messages.stream().map(message ->
                new ChatHistoryMessageResponse(
                        message.getId(), message.getSequenceNo(), message.getRole(), message.getContent(),
                        message.getSource(), message.getAnswerFormat(), message.getResultKind(),
                        message.getCreatedAt(),
                        imagesByMessage.getOrDefault(message.getId(), List.of()))).toList();
        long latest = messages.isEmpty() ? messageRepo.findMaxSequence(conversationId)
                : messages.get(messages.size() - 1).getSequenceNo();
        return new ChatHistoryResponse(
                conversationId, conversation.getThreadId(), latest, result);
    }

    @Transactional
    public ChatDeleteHistoryResponse deleteHistory(UUID customerId, String rawToken) {
        if (customerId != null) {
            List<UUID> conversationIds = conversationRepo.findByCustomerIdOrderByLastMessageAtAsc(customerId)
                    .stream().map(ChatConversationEntity::getId).toList();
            if (chatImageService != null && !chatImageService.deleteForConversations(conversationIds)) {
                throw new IllegalStateException("Không xoá được ảnh trong lịch sử hội thoại.");
            }
            conversationRepo.deleteByCustomerId(customerId);
            return new ChatDeleteHistoryResponse(true);
        }
        UUID visitorId = resolveVisitorId(rawToken);
        if (visitorId == null) throw new NotFoundException("Không tìm thấy lịch sử hội thoại.");
        List<UUID> conversationIds = conversationRepo.findByVisitorIdOrderByLastMessageAtAsc(visitorId)
                .stream().map(ChatConversationEntity::getId).toList();
        if (chatImageService != null && !chatImageService.deleteForConversations(conversationIds)) {
            throw new IllegalStateException("Không xoá được ảnh trong lịch sử hội thoại.");
        }
        conversationRepo.deleteByVisitorId(visitorId);
        visitorRepo.deleteById(visitorId);
        return new ChatDeleteHistoryResponse(true);
    }

    @Transactional(readOnly = true)
    public ChatConversationEntity requireOwner(
            UUID conversationId, UUID customerId, UUID visitorId) {
        ChatConversationEntity conversation = conversationRepo.findById(conversationId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy hội thoại."));
        boolean customerOwns = customerId != null && customerId.equals(conversation.getCustomerId());
        boolean visitorOwns = visitorId != null && visitorId.equals(conversation.getVisitorId())
                && (conversation.getCustomerId() == null || customerOwns);
        if (!customerOwns && !visitorOwns) throw new NotFoundException("Không tìm thấy hội thoại.");
        return conversation;
    }

    private UUID resolveVisitorIdReadOnly(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) return null;
        return visitorRepo.findByTokenHash(jwtService.hashToken(rawToken))
                .filter(value -> value.getRememberedUntil().isAfter(Instant.now()))
                .map(ChatVisitorEntity::getId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy phiên ghi nhớ hội thoại."));
    }

    private void requireToken(ChatVisitorEntity visitor, String rawToken) {
        if (rawToken == null || rawToken.isBlank()
                || !visitor.getTokenHash().equals(jwtService.hashToken(rawToken))) {
            throw new NotFoundException("Không tìm thấy phiên ghi nhớ hội thoại.");
        }
    }

    private void touch(ChatVisitorEntity visitor) {
        visitor.touch();
        visitor.setRememberedUntil(Instant.now().plus(
                ChatVisitorEntity.SESSION_HOURS, java.time.temporal.ChronoUnit.HOURS));
    }
}
