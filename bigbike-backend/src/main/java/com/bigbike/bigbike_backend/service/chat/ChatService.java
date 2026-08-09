package com.bigbike.bigbike_backend.service.chat;

import com.bigbike.bigbike_backend.api.chat.dto.ChatAvailabilityResponse;
import com.bigbike.bigbike_backend.api.chat.dto.ChatLeadRequest;
import com.bigbike.bigbike_backend.api.chat.dto.ChatLeadResponse;
import com.bigbike.bigbike_backend.api.chat.dto.ChatMessageRequest;
import com.bigbike.bigbike_backend.api.chat.dto.ChatMessageResponse;
import com.bigbike.bigbike_backend.api.chat.dto.ChatProductCardResponse;
import com.bigbike.bigbike_backend.api.error.ConflictException;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.persistence.entity.chat.ChatConversationEntity;
import com.bigbike.bigbike_backend.persistence.entity.chat.ChatLeadEntity;
import com.bigbike.bigbike_backend.persistence.entity.chat.ChatMessageEntity;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatConversationJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatLeadJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatMessageJpaRepository;
import com.bigbike.bigbike_backend.service.chat.ChatToolService.ToolOutcome;
import com.bigbike.bigbike_backend.service.ws.AdminChatWsService;
import com.bigbike.bigbike_backend.service.ws.ChatLeadWsEvent;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ChatService {

    public static final int MAX_TURNS = 12;
    private static final ZoneId VN_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private final ChatConversationJpaRepository conversationRepo;
    private final ChatMessageJpaRepository messageRepo;
    private final ChatLeadJpaRepository leadRepo;
    private final ChatAssistantSettings assistantSettings;
    private final ChatToolService toolService;
    private final AiChatClient aiClient;
    private final AdminChatWsService adminChatWsService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Transactional(readOnly = true)
    public ChatAvailabilityResponse availability(String lang) {
        ChatAssistantSettings.Snapshot settings = assistantSettings.load(lang);
        Availability availability = resolveAvailability(settings);
        return new ChatAvailabilityResponse(
                availability.mode(),
                availability.reason(),
                settings.greeting(),
                settings.quickPrompts(),
                MAX_TURNS,
                settings.contacts());
    }

    @Transactional
    public synchronized ChatMessageResponse send(ChatMessageRequest request, UUID customerId) {
        ChatAssistantSettings.Snapshot settings = assistantSettings.load(request.getLang());
        ChatConversationEntity conversation = loadOrCreate(
                request.getConversationId(), customerId, request.getLang());

        if (conversation.getEndedReason() != null || conversation.getTurnCount() >= MAX_TURNS) {
            conversation.setEndedReason(conversation.getEndedReason() == null
                    ? "TURN_LIMIT" : conversation.getEndedReason());
            conversationRepo.save(conversation);
            return contactResponse(conversation, settings, "TURN_LIMIT", turnLimitText(request.getLang()));
        }

        Availability availability = resolveAvailability(settings);
        if (!"AI".equals(availability.mode())) {
            conversation.setEndedReason(endedReason(availability.reason()));
            saveCustomerMessage(conversation, request.getMessage());
            saveAssistantMessage(conversation, contactFallbackText(request.getLang()),
                    "CONTACT_FALLBACK", false, List.of());
            return contactResponse(
                    conversation, settings, availability.reason(), contactFallbackText(request.getLang()));
        }

        saveCustomerMessage(conversation, request.getMessage());
        ToolOutcome tool = toolService.resolve(
                request.getMessage(), request.getLang(), customerId, settings);

        if (tool.leadDeclined() && "OFFERED".equals(conversation.getLeadOfferStatus())) {
            conversation.setLeadOfferStatus("DECLINED");
        }

        if (!tool.aiRequired()) {
            boolean handoff = applyConversationSignals(conversation, tool.offTopic(), tool.handoffRecommended());
            saveAssistantMessage(conversation, tool.localAnswer(), tool.source(), false, tool.products());
            finishTurnIfNeeded(conversation);
            conversationRepo.save(conversation);
            return aiResponse(
                    conversation,
                    settings,
                    tool.localAnswer(),
                    tool.products(),
                    handoff,
                    false);
        }

        Optional<AiChatClient.Answer> ai = aiClient.answer(
                request.getMessage(), tool.toolJson(), request.getLang());
        conversation.setAiCallCount(conversation.getAiCallCount() + 1);
        if (ai.isEmpty()) {
            conversation.setEndedReason("AI_UNAVAILABLE");
            String fallback = contactFallbackText(request.getLang());
            saveAssistantMessage(conversation, fallback, "CONTACT_FALLBACK", true, List.of());
            conversationRepo.save(conversation);
            return contactResponse(conversation, settings, "AI_UNAVAILABLE", fallback);
        }

        AiChatClient.Answer answer = ai.get();
        boolean handoff = applyConversationSignals(
                conversation, answer.offTopic(), answer.handoffRecommended());
        boolean leadPrompt = answer.leadPrompt()
                && !handoff
                && "NONE".equals(conversation.getLeadOfferStatus());
        if (leadPrompt) conversation.setLeadOfferStatus("OFFERED");

        saveAssistantMessage(conversation, answer.answer(), "AI", true, tool.products());
        finishTurnIfNeeded(conversation);
        conversationRepo.save(conversation);
        return aiResponse(
                conversation,
                settings,
                answer.answer(),
                tool.products(),
                handoff || conversation.getEndedReason() != null,
                leadPrompt);
    }

    @Transactional
    public ChatLeadResponse captureLead(ChatLeadRequest request, UUID customerId) {
        ChatConversationEntity conversation = loadExistingForCaller(
                request.getConversationId(), customerId);
        if (leadRepo.existsByConversationId(conversation.getId())) {
            throw new ConflictException("Hội thoại này đã ghi nhận thông tin liên hệ.");
        }

        ChatLeadEntity lead = new ChatLeadEntity();
        lead.setConversationId(conversation.getId());
        lead.setName(trimToNull(request.getName()));
        lead.setPhone(request.getPhone().replaceAll("\\s+", " ").trim());
        lead.setNote(trimToNull(request.getNote()));
        lead.setConsentedAt(Instant.now());
        leadRepo.save(lead);

        conversation.setLeadOfferStatus("ACCEPTED");
        conversationRepo.save(conversation);
        adminChatWsService.pushLead(new ChatLeadWsEvent(
                "CHAT_LEAD",
                conversation.getId(),
                lead.getName(),
                lead.getPhone(),
                lead.getNote(),
                Instant.now()));
        return new ChatLeadResponse(true);
    }

    private ChatConversationEntity loadOrCreate(UUID id, UUID customerId, String lang) {
        if (id != null) {
            ChatConversationEntity existing = loadExistingForCaller(id, customerId);
            if (existing.getCustomerId() == null && customerId != null) {
                existing.setCustomerId(customerId);
            }
            return existing;
        }
        ChatConversationEntity conversation = new ChatConversationEntity();
        conversation.setCustomerId(customerId);
        conversation.setLocale(lang);
        return conversationRepo.save(conversation);
    }

    private ChatConversationEntity loadExistingForCaller(UUID id, UUID customerId) {
        ChatConversationEntity conversation = conversationRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy hội thoại."));
        UUID owner = conversation.getCustomerId();
        if ((owner != null && customerId == null)
                || (owner != null && !owner.equals(customerId))) {
            throw new NotFoundException("Không tìm thấy hội thoại.");
        }
        return conversation;
    }

    private void saveCustomerMessage(ChatConversationEntity conversation, String content) {
        conversation.setTurnCount(conversation.getTurnCount() + 1);
        conversation.setLastMessageAt(Instant.now());
        ChatMessageEntity message = new ChatMessageEntity();
        message.setConversationId(conversation.getId());
        message.setRole("CUSTOMER");
        message.setContent(content.trim());
        message.setSource("TOOL");
        messageRepo.save(message);
    }

    private void saveAssistantMessage(
            ChatConversationEntity conversation,
            String content,
            String source,
            boolean aiCalled,
            List<ChatProductCardResponse> products
    ) {
        ChatMessageEntity message = new ChatMessageEntity();
        message.setConversationId(conversation.getId());
        message.setRole("ASSISTANT");
        message.setContent(content);
        message.setSource(source);
        message.setAiCalled(aiCalled);
        message.setProductsJson(products.isEmpty() ? null : writeJson(products));
        messageRepo.save(message);
    }

    private boolean applyConversationSignals(
            ChatConversationEntity conversation, boolean offTopic, boolean handoffRecommended) {
        if (offTopic) {
            conversation.setConsecutiveOffTopic(conversation.getConsecutiveOffTopic() + 1);
            if (conversation.getConsecutiveOffTopic() >= 2) {
                conversation.setEndedReason("OFF_TOPIC");
                return true;
            }
        } else {
            conversation.setConsecutiveOffTopic(0);
        }
        if (handoffRecommended) {
            conversation.setEndedReason("HANDOFF");
            return true;
        }
        return false;
    }

    private void finishTurnIfNeeded(ChatConversationEntity conversation) {
        if (conversation.getTurnCount() >= MAX_TURNS && conversation.getEndedReason() == null) {
            conversation.setEndedReason("TURN_LIMIT");
        }
    }

    private Availability resolveAvailability(ChatAssistantSettings.Snapshot settings) {
        if (!settings.enabled()) return new Availability("CONTACT", "DISABLED");
        if (!aiClient.isConfigured()) return new Availability("CONTACT", "NOT_CONFIGURED");
        if (settings.dailyLimit() <= 0 || aiCallsToday() >= settings.dailyLimit()) {
            return new Availability("CONTACT", "DAILY_LIMIT_REACHED");
        }
        return new Availability("AI", "AVAILABLE");
    }

    private long aiCallsToday() {
        Instant from = LocalDate.now(VN_ZONE).atStartOfDay(VN_ZONE).toInstant();
        Instant to = LocalDate.now(VN_ZONE).plusDays(1).atStartOfDay(VN_ZONE).toInstant();
        return messageRepo.countByAiCalledTrueAndCreatedAtGreaterThanEqualAndCreatedAtLessThan(from, to);
    }

    private static ChatMessageResponse aiResponse(
            ChatConversationEntity conversation,
            ChatAssistantSettings.Snapshot settings,
            String answer,
            List<ChatProductCardResponse> products,
            boolean handoff,
            boolean leadPrompt
    ) {
        return new ChatMessageResponse(
                conversation.getId(),
                "AI",
                conversation.getEndedReason() == null ? "AVAILABLE" : conversation.getEndedReason(),
                answer,
                conversation.getTurnCount(),
                MAX_TURNS,
                Math.max(0, MAX_TURNS - conversation.getTurnCount()),
                List.copyOf(products),
                handoff,
                leadPrompt,
                settings.contacts());
    }

    private static ChatMessageResponse contactResponse(
            ChatConversationEntity conversation,
            ChatAssistantSettings.Snapshot settings,
            String reason,
            String answer
    ) {
        return new ChatMessageResponse(
                conversation.getId(),
                "CONTACT",
                reason,
                answer,
                conversation.getTurnCount(),
                MAX_TURNS,
                Math.max(0, MAX_TURNS - conversation.getTurnCount()),
                List.of(),
                true,
                false,
                settings.contacts());
    }

    private String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            return null;
        }
    }

    private static String endedReason(String reason) {
        return switch (reason) {
            case "DISABLED" -> "DISABLED";
            case "DAILY_LIMIT_REACHED" -> "DAILY_LIMIT_REACHED";
            default -> "AI_UNAVAILABLE";
        };
    }

    private static String contactFallbackText(String lang) {
        return "en".equals(lang)
                ? "Bi is unavailable right now. Your Hotline, Zalo and Messenger options are still available below. Please choose Talk to staff for help."
                : "Hiện Bi chưa thể trả lời. Các kênh Hotline, Zalo và Messenger vẫn luôn có sẵn bên dưới. Anh/chị bấm Gặp nhân viên để được hỗ trợ nhé.";
    }

    private static String turnLimitText(String lang) {
        return "en".equals(lang)
                ? "This conversation has reached its 12-question limit. Please choose Talk to staff to continue with BigBike. Your contact options remain available."
                : "Hội thoại đã đủ 12 lượt hỏi. Anh/chị bấm Gặp nhân viên để BigBike hỗ trợ tiếp nhé. Các kênh liên hệ vẫn luôn có sẵn.";
    }

    private static String trimToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private record Availability(String mode, String reason) {}
}
