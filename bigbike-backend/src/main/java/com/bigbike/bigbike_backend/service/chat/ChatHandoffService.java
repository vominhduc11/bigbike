package com.bigbike.bigbike_backend.service.chat;

import com.bigbike.bigbike_backend.api.admin.dto.chat.AdminChatHandoffResponse;
import com.bigbike.bigbike_backend.api.admin.dto.chat.AdminChatHandoffSummaryResponse;
import com.bigbike.bigbike_backend.api.chat.dto.ChatHandoffRequest;
import com.bigbike.bigbike_backend.api.chat.dto.ChatHandoffResponse;
import com.bigbike.bigbike_backend.api.chat.dto.ChatHandoffStatusResponse;
import com.bigbike.bigbike_backend.api.chat.dto.ChatProductCardResponse;
import com.bigbike.bigbike_backend.api.error.ConflictException;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.persistence.entity.chat.ChatConversationEntity;
import com.bigbike.bigbike_backend.persistence.entity.chat.ChatHandoffEntity;
import com.bigbike.bigbike_backend.persistence.entity.chat.ChatMessageEntity;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatConversationJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatHandoffJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatLeadJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatMessageJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.auth.AdminUserJpaRepository;
import com.bigbike.bigbike_backend.service.ws.AdminChatWsService;
import com.bigbike.bigbike_backend.service.ws.CustomerChatWsService;
import com.bigbike.bigbike_backend.service.ws.ChatHandoffWsEvent;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Service
// Two public constructors (Lombok's + the Phase-2 test-compat one below) leave Spring
// with no injection target unless the generated one is marked — same pattern as ChatService.
@RequiredArgsConstructor(onConstructor_ = @org.springframework.beans.factory.annotation.Autowired)
public class ChatHandoffService {

    private static final ObjectMapper PRODUCT_MAPPER = new ObjectMapper();
    private static final Pattern EMAIL = Pattern.compile(
            "(?i)(?<![\\p{L}\\p{N}._%+-])[\\p{L}\\p{N}._%+-]+@[\\p{L}\\p{N}.-]+\\.[a-z]{2,}(?![\\p{L}\\p{N}])");
    private static final Pattern PHONE = Pattern.compile(
            "(?<!\\d)(?:\\+?84|0)(?:[ .-]?\\d){8,10}(?!\\d)");
    private static final String REDACTED_CONTACT = "[đã ẩn liên hệ]";

    private final ChatHandoffJpaRepository handoffRepo;
    private final ChatConversationJpaRepository conversationRepo;
    private final ChatMessageJpaRepository messageRepo;
    private final ChatLeadJpaRepository leadRepo;
    private final AdminUserJpaRepository adminUserRepo;
    private final AdminChatWsService adminChatWsService;
    private final CustomerChatWsService customerChatWsService;
    private final ChatHandoffEmailService emailService;
    private final ChatPhase3Settings phase3Settings;

    /** Compatibility constructor for focused Phase-2 unit tests. */
    public ChatHandoffService(
            ChatHandoffJpaRepository handoffRepo,
            ChatConversationJpaRepository conversationRepo,
            ChatMessageJpaRepository messageRepo,
            ChatLeadJpaRepository leadRepo,
            AdminChatWsService adminChatWsService,
            ChatHandoffEmailService emailService
    ) {
        this.handoffRepo = handoffRepo;
        this.conversationRepo = conversationRepo;
        this.messageRepo = messageRepo;
        this.leadRepo = leadRepo;
        this.adminUserRepo = null;
        this.adminChatWsService = adminChatWsService;
        this.customerChatWsService = null;
        this.emailService = emailService;
        this.phase3Settings = null;
    }

    @Transactional
    public ChatHandoffResponse request(ChatHandoffRequest request, UUID customerId) {
        return request(request, customerId, null);
    }

    @Transactional
    public ChatHandoffResponse request(ChatHandoffRequest request, UUID customerId, UUID visitorId) {
        Optional<ChatHandoffEntity> replay = handoffRepo.findByRequestId(request.requestId());
        if (replay.isPresent()) {
            verifyCaller(replay.get().getConversationId(), customerId, visitorId);
            return toPublic(replay.get(), request.locale());
        }
        ChatConversationEntity conversation = request.conversationId() == null
                ? createConversation(customerId, visitorId, request.locale())
                : verifyCaller(request.conversationId(), customerId, visitorId);
        ChatHandoffEntity handoff = createWaiting(
                request.requestId(), conversation, request.trigger(), null, null);
        return toPublic(handoff, request.locale());
    }

    @Transactional
    public ChatHandoffStatusResponse requestFromMessage(
            ChatConversationEntity conversation,
            String question,
            List<ChatProductCardResponse> products
    ) {
        ChatHandoffEntity handoff = createWaiting(
                UUID.randomUUID(), conversation, "MESSAGE", question, products);
        return toStatus(handoff, conversation.getLocale());
    }

    @Transactional(readOnly = true)
    public ChatHandoffStatusResponse waitingForConversation(UUID conversationId) {
        return handoffRepo.findFirstByConversationIdAndStatus(conversationId, "WAITING")
                .map(item -> toStatus(item, conversationLocale(conversationId)))
                .orElse(null);
    }

    @Transactional(readOnly = true)
    public AdminChatHandoffSummaryResponse listWaiting() {
        Instant now = Instant.now();
        List<ChatHandoffEntity> live = new java.util.ArrayList<>(
                handoffRepo.findByStatusOrderByRequestedAtAsc("WAITING"));
        live.addAll(handoffRepo.findByStatusOrderByRequestedAtAsc("ACTIVE"));
        live.sort(java.util.Comparator.comparing(ChatHandoffEntity::getRequestedAt));
        List<AdminChatHandoffResponse> items = live.stream().map(item -> toAdmin(item, now)).toList();
        return new AdminChatHandoffSummaryResponse(
                handoffRepo.countByStatus("WAITING"), items);
    }

    @Transactional
    public AdminChatHandoffResponse acknowledge(UUID id, UUID adminId) {
        return claim(id, adminId);
    }

    @Transactional
    public AdminChatHandoffResponse claim(UUID id, UUID adminId) {
        ChatHandoffEntity handoff = handoffRepo.findByIdForUpdate(id)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy yêu cầu gặp nhân viên."));
        if ("ACTIVE".equals(handoff.getStatus())) {
            if (adminId.equals(handoff.getAssignedAdminId())) return toAdmin(handoff, Instant.now());
            throw new ConflictException("Hội thoại đã được "
                    + safeStaffName(handoff.getAssignedDisplayName()) + " tiếp nhận.");
        }
        if (!"WAITING".equals(handoff.getStatus())) {
            throw new ConflictException("Yêu cầu này không còn trong hàng chờ.");
        }
        String displayName = adminUserRepo == null ? "Nhân viên BigBike" : adminUserRepo.findById(adminId)
                .map(item -> safeStaffName(item.getDisplayName()))
                .orElse("Nhân viên BigBike");
        Instant now = Instant.now();
        handoff.setStatus("ACTIVE");
        handoff.setAssignedAt(now);
        handoff.setAssignedAdminId(adminId);
        handoff.setAssignedDisplayName(displayName);
        handoff.setAcknowledgedAt(now);
        handoff.setAcknowledgedBy(adminId);
        handoffRepo.saveAndFlush(handoff);
        ChatMessageEntity notice = systemMessage(
                handoff.getConversationId(),
                "Nhân viên " + displayName + " của BigBike đã tiếp nhận hội thoại.");
        adminChatWsService.pushHandoffUpdate(toEvent(
                "CHAT_HANDOFF_ACTIVE", handoff, handoffRepo.countByStatus("WAITING")));
        pushCustomer(handoff.getConversationId(), "HANDOFF_ACTIVE", notice.getSequenceNo(), "STAFF_ACTIVE");
        return toAdmin(handoff, Instant.now());
    }

    @Transactional
    public ChatMessageEntity sendStaffMessage(
            UUID conversationId, UUID adminId, UUID requestId, String content) {
        ChatHandoffEntity handoff = activeForUpdate(conversationId, adminId);
        if (requestId != null) {
            Optional<ChatMessageEntity> replay = messageRepo.findFirstByRequestIdAndRole(requestId, "STAFF");
            if (replay.isPresent()) return replay.get();
        }
        String clean = normalizeStaffMessage(content);
        ChatMessageEntity message = new ChatMessageEntity();
        message.setConversationId(conversationId);
        message.setSequenceNo(messageRepo.nextSequence());
        message.setRole("STAFF");
        message.setStaffUserId(adminId);
        message.setStaffDisplayName(safeStaffName(handoff.getAssignedDisplayName()));
        message.setContent(clean);
        message.setSource("TOOL");
        message.setRequestId(requestId);
        message.setAnswerFormat("PLAIN_TEXT");
        message.setResultKind("ANSWER");
        ChatMessageEntity saved = messageRepo.saveAndFlush(message);
        if (saved != null) message = saved;
        pushCustomer(conversationId, "STAFF_MESSAGE", message.getSequenceNo(), "STAFF_ACTIVE");
        return message;
    }

    @Transactional
    public AdminChatHandoffResponse returnToAi(UUID id, UUID adminId, String lang) {
        ChatHandoffEntity handoff = resolve(id, adminId, "RETURNED_TO_AI");
        String text = "en".equals(lang)
                ? "The BigBike staff member has left the chat. BigBike Assistant will continue from here."
                : "Nhân viên BigBike đã bàn giao. Trợ lý BigBike sẽ tiếp tục hỗ trợ anh/chị từ đây.";
        ChatMessageEntity notice = systemMessage(handoff.getConversationId(), text);
        pushCustomer(
                handoff.getConversationId(), "RETURNED_TO_AI", notice.getSequenceNo(), "AI_RESUMED");
        return toAdmin(handoff, Instant.now());
    }

    @Transactional
    public AdminChatHandoffResponse close(UUID id, UUID adminId, String lang) {
        ChatHandoffEntity handoff = resolve(id, adminId, "CLOSED");
        String text = "en".equals(lang)
                ? "BigBike staff has finished this chat. You can start a linked chat whenever you need more help."
                : "Nhân viên BigBike đã kết thúc hỗ trợ. Khi cần thêm, anh/chị có thể mở hội thoại nối tiếp mà không phải kể lại từ đầu.";
        ChatMessageEntity notice = systemMessage(handoff.getConversationId(), text);
        pushCustomer(
                handoff.getConversationId(), "HANDOFF_CLOSED", notice.getSequenceNo(), "CLOSED");
        return toAdmin(handoff, Instant.now());
    }

    @Transactional(readOnly = true)
    public ChatHandoffStatusResponse liveForConversation(UUID conversationId) {
        return handoffRepo.findLiveForConversation(conversationId).stream()
                .findFirst().map(item -> toStatus(item, conversationLocale(conversationId))).orElse(null);
    }

    @Transactional(readOnly = true)
    public ChatHandoffStatusResponse latestStatusForConversation(UUID conversationId) {
        return handoffRepo.findFirstByConversationIdOrderByRequestedAtDesc(conversationId)
                .filter(item -> !resolvedHandoffWasFollowedByAssistant(item))
                .map(item -> toStatus(item, conversationLocale(conversationId)))
                .orElse(null);
    }

    private boolean resolvedHandoffWasFollowedByAssistant(ChatHandoffEntity handoff) {
        if (!("RETURNED_TO_AI".equals(handoff.getStatus()) || "CLOSED".equals(handoff.getStatus()))
                || handoff.getResolvedAt() == null) return false;
        return messageRepo.findFirstByConversationIdAndRoleOrderByCreatedAtDesc(
                        handoff.getConversationId(), "ASSISTANT")
                .map(ChatMessageEntity::getCreatedAt)
                .filter(java.util.Objects::nonNull)
                .map(createdAt -> createdAt.isAfter(handoff.getResolvedAt()))
                .orElse(false);
    }

    public void customerMessageAdded(UUID conversationId) {
        handoffRepo.findLiveForConversation(conversationId).stream().findFirst().ifPresent(handoff ->
                adminChatWsService.pushHandoffUpdate(toEvent(
                        "CHAT_CUSTOMER_MESSAGE", handoff, handoffRepo.countByStatus("WAITING"))));
    }

    private ChatHandoffEntity createWaiting(
            UUID requestId,
            ChatConversationEntity conversation,
            String triggerSource,
            String explicitQuestion,
            List<ChatProductCardResponse> explicitProducts
    ) {
        Optional<ChatHandoffEntity> existing = handoffRepo.findLiveForConversation(
                conversation.getId()).stream().findFirst();
        if (existing.isPresent()) return existing.get();

        ChatMessageEntity latestCustomer = messageRepo
                .findFirstByConversationIdAndRoleOrderByCreatedAtDesc(conversation.getId(), "CUSTOMER")
                .orElse(null);
        String question = explicitQuestion != null ? explicitQuestion
                : latestCustomer == null ? null : latestCustomer.getContent();
        List<ChatProductCardResponse> products = explicitProducts != null && !explicitProducts.isEmpty()
                ? explicitProducts.stream().limit(8).toList()
                : readConversationProducts(conversation.getId());

        ChatHandoffEntity handoff = new ChatHandoffEntity();
        handoff.setRequestId(requestId);
        handoff.setConversationId(conversation.getId());
        handoff.setStatus("WAITING");
        handoff.setTriggerSource(triggerSource);
        handoff.setCustomerKind(conversation.getCustomerId() == null ? "GUEST" : "SIGNED_IN");
        handoff.setQuestionSummary(summarize(question));
        handoff.setProductsJson(ChatHandoffProductJson.write(products));
        handoff.setContactPresent(hasContact(conversation));
        handoff.setRequestedAt(Instant.now());
        ChatPhase3Settings.BusinessHoursStatus hours = businessHours(
                handoff.getRequestedAt(), conversation.getLocale());
        handoff.setWithinBusinessHours(hours.withinHours());
        handoff.setNextOpenAt(hours.nextOpenAt());
        try {
            handoff = handoffRepo.saveAndFlush(handoff);
        } catch (DataIntegrityViolationException exception) {
            handoff = handoffRepo.findByRequestId(requestId)
                    .or(() -> handoffRepo.findLiveForConversation(
                            conversation.getId()).stream().findFirst())
                    .orElseThrow(() -> exception);
        }

        long waitingCount = handoffRepo.countByStatus("WAITING");
        adminChatWsService.pushHandoff(toEvent("CHAT_HANDOFF_WAITING", handoff, waitingCount));
        sendEmailAfterCommit(handoff.getId());
        return handoff;
    }

    private ChatConversationEntity createConversation(UUID customerId, UUID visitorId, String locale) {
        ChatConversationEntity conversation = new ChatConversationEntity();
        conversation.setCustomerId(customerId);
        conversation.setVisitorId(visitorId);
        conversation.setLocale("en".equals(locale) ? "en" : "vi");
        return conversationRepo.save(conversation);
    }

    private ChatHandoffEntity activeForUpdate(UUID conversationId, UUID adminId) {
        ChatHandoffEntity handoff = handoffRepo.findLiveForConversation(conversationId).stream()
                .filter(item -> "ACTIVE".equals(item.getStatus()))
                .findFirst()
                .flatMap(item -> handoffRepo.findByIdForUpdate(item.getId()))
                .orElseThrow(() -> new ConflictException("Hội thoại chưa được nhân viên tiếp nhận."));
        if (!adminId.equals(handoff.getAssignedAdminId())) {
            throw new ConflictException("Hội thoại đang do "
                    + safeStaffName(handoff.getAssignedDisplayName()) + " phụ trách.");
        }
        return handoff;
    }

    private ChatHandoffEntity resolve(UUID id, UUID adminId, String resolution) {
        ChatHandoffEntity handoff = handoffRepo.findByIdForUpdate(id)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy yêu cầu gặp nhân viên."));
        if (!"ACTIVE".equals(handoff.getStatus())) {
            if (resolution.equals(handoff.getStatus())) return handoff;
            throw new ConflictException("Hội thoại không còn ở trạng thái nhân viên đang trả lời.");
        }
        if (!adminId.equals(handoff.getAssignedAdminId())) {
            throw new ConflictException("Hội thoại đang do "
                    + safeStaffName(handoff.getAssignedDisplayName()) + " phụ trách.");
        }
        handoff.setStatus(resolution);
        handoff.setResolution(resolution);
        handoff.setResolvedAt(Instant.now());
        handoffRepo.saveAndFlush(handoff);
        adminChatWsService.pushHandoffUpdate(toEvent(
                "RETURNED_TO_AI".equals(resolution)
                        ? "CHAT_HANDOFF_RETURNED_TO_AI" : "CHAT_HANDOFF_CLOSED",
                handoff, handoffRepo.countByStatus("WAITING")));
        return handoff;
    }

    private ChatMessageEntity systemMessage(UUID conversationId, String content) {
        ChatMessageEntity message = new ChatMessageEntity();
        message.setConversationId(conversationId);
        message.setSequenceNo(messageRepo.nextSequence());
        message.setRole("SYSTEM");
        message.setContent(content);
        message.setSource("TOOL");
        message.setAnswerFormat("PLAIN_TEXT");
        message.setResultKind("CONTACT");
        ChatMessageEntity saved = messageRepo.saveAndFlush(message);
        return saved == null ? message : saved;
    }

    private static String normalizeStaffMessage(String value) {
        if (value == null || value.isBlank()) {
            throw new ConflictException("Tin nhắn không được để trống.");
        }
        String clean = value.replaceAll("[\\p{Cntrl}&&[^\\r\\n\\t]]", " ").trim();
        if (clean.length() > 2_000) {
            throw new ConflictException("Tin nhắn không được dài quá 2.000 ký tự.");
        }
        return clean;
    }

    private static String safeStaffName(String value) {
        if (value == null || value.isBlank()) return "Nhân viên BigBike";
        String clean = value.replaceAll("[\\p{Cntrl}]", " ").replaceAll("\\s+", " ").trim();
        return clean.length() <= 120 ? clean : clean.substring(0, 120);
    }

    private void pushCustomer(UUID conversationId, String type, long sequence, String state) {
        if (customerChatWsService != null) {
            customerChatWsService.push(conversationId, type, sequence, state);
        }
    }

    private ChatPhase3Settings.BusinessHoursStatus businessHours(Instant at, String lang) {
        if (phase3Settings != null) return phase3Settings.businessHours(at, lang);
        return new ChatPhase3Settings.BusinessHoursStatus(
                true, null, "en".equals(lang)
                ? "Mon–Fri 09:00–21:00; Sat–Sun 09:00–18:00 (Vietnam time)"
                : "Thứ Hai–Thứ Sáu 09:00–21:00; Thứ Bảy–Chủ Nhật 09:00–18:00");
    }

    private ChatConversationEntity verifyCaller(
            UUID conversationId, UUID customerId, UUID visitorId) {
        ChatConversationEntity conversation = conversationRepo.findByIdForUpdate(conversationId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy hội thoại."));
        UUID owner = conversation.getCustomerId();
        boolean customerOwns = owner != null && owner.equals(customerId);
        boolean visitorOwns = visitorId != null && visitorId.equals(conversation.getVisitorId())
                && (owner == null || customerOwns);
        if (!customerOwns && !visitorOwns) {
            throw new NotFoundException("Không tìm thấy hội thoại.");
        }
        if (owner == null && customerId != null && visitorOwns) {
            conversation.setCustomerId(customerId);
            conversationRepo.save(conversation);
        }
        return conversation;
    }

    private boolean hasContact(ChatConversationEntity conversation) {
        // A signed-in account is useful context, but it is not consent to disclose the
        // account phone in a handoff alert. Only a contact explicitly submitted in this
        // conversation counts as "contact present".
        return leadRepo.existsByConversationId(conversation.getId());
    }

    private List<ChatProductCardResponse> readConversationProducts(UUID conversationId) {
        List<ChatMessageEntity> history = messageRepo.findByConversationIdOrderByCreatedAtAsc(conversationId);
        Map<String, ChatProductCardResponse> recent = new LinkedHashMap<>();
        for (int index = history.size() - 1; index >= 0 && recent.size() < 8; index--) {
            ChatMessageEntity message = history.get(index);
            if (!"ASSISTANT".equals(message.getRole())) continue;
            addProducts(recent, readProducts(message.getProductsJson()));
            addProducts(recent, readProducts(message.getCrossSellProductsJson()));
        }
        return recent.values().stream().limit(8).toList();
    }

    private static void addProducts(
            Map<String, ChatProductCardResponse> target,
            List<ChatProductCardResponse> products
    ) {
        for (ChatProductCardResponse product : products) {
            if (product == null || product.slug() == null || product.slug().isBlank()) continue;
            target.putIfAbsent(product.slug(), product);
            if (target.size() >= 8) return;
        }
    }

    private List<ChatProductCardResponse> readProducts(String raw) {
        if (raw == null || raw.isBlank()) return List.of();
        try {
            List<ChatProductCardResponse> values = PRODUCT_MAPPER.readValue(
                    raw, new TypeReference<>() {});
            return values == null ? List.of() : values.stream().limit(8).toList();
        } catch (Exception ignored) {
            return List.of();
        }
    }

    private static String summarize(String value) {
        if (value == null || value.isBlank()) return null;
        String redacted = EMAIL.matcher(value).replaceAll(REDACTED_CONTACT);
        redacted = PHONE.matcher(redacted).replaceAll(REDACTED_CONTACT);
        String clean = redacted.replaceAll("[\\p{Cntrl}&&[^\\r\\n\\t]]", " ")
                .replaceAll("\\s+", " ").trim();
        return clean.length() <= 500 ? clean : clean.substring(0, 497) + "…";
    }

    private void sendEmailAfterCommit(UUID id) {
        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    emailService.send(id);
                }
            });
        } else {
            emailService.send(id);
        }
    }

    private ChatHandoffResponse toPublic(ChatHandoffEntity entity, String lang) {
        ChatPhase3Settings.BusinessHoursStatus hours = businessHours(
                entity.getRequestedAt(), lang);
        return new ChatHandoffResponse(
                entity.getId(), entity.getConversationId(), entity.getStatus(), entity.getRequestedAt(),
                channelState(entity.getStatus()), entity.isWithinBusinessHours(), entity.getNextOpenAt(),
                hours.scheduleText());
    }

    private ChatHandoffStatusResponse toStatus(ChatHandoffEntity entity, String lang) {
        ChatPhase3Settings.BusinessHoursStatus hours = businessHours(entity.getRequestedAt(), lang);
        return new ChatHandoffStatusResponse(
                entity.getId(), entity.getStatus(), entity.getRequestedAt(),
                channelState(entity.getStatus()), entity.getAssignedDisplayName(),
                entity.isWithinBusinessHours(), entity.getNextOpenAt(), hours.scheduleText());
    }

    private String conversationLocale(UUID conversationId) {
        return conversationRepo.findById(conversationId)
                .map(ChatConversationEntity::getLocale)
                .filter(value -> value != null && !value.isBlank())
                .orElse("vi");
    }

    private static String channelState(String status) {
        return switch (status) {
            case "WAITING" -> "WAITING_FOR_STAFF";
            case "ACTIVE" -> "STAFF_ACTIVE";
            case "RETURNED_TO_AI" -> "AI_RESUMED";
            case "CLOSED" -> "CLOSED";
            default -> "AI_ACTIVE";
        };
    }

    private static ChatHandoffWsEvent toEvent(
            String type, ChatHandoffEntity entity, long waitingCount) {
        return new ChatHandoffWsEvent(
                type, entity.getId(), entity.getConversationId(), entity.getQuestionSummary(),
                ChatHandoffProductJson.readWs(entity.getProductsJson()), entity.isContactPresent(),
                entity.getCustomerKind(), entity.getRequestedAt(), waitingCount);
    }

    private static AdminChatHandoffResponse toAdmin(ChatHandoffEntity entity, Instant now) {
        List<AdminChatHandoffResponse.ProductReference> products = ChatHandoffProductJson
                .read(entity.getProductsJson()).stream()
                .map(item -> new AdminChatHandoffResponse.ProductReference(item.slug(), item.name()))
                .toList();
        long waitingSeconds = "WAITING".equals(entity.getStatus())
                ? Math.max(0, Duration.between(entity.getRequestedAt(), now).getSeconds()) : 0;
        return new AdminChatHandoffResponse(
                entity.getId(), entity.getConversationId(), entity.getStatus(),
                entity.getTriggerSource(), entity.getCustomerKind(), entity.getQuestionSummary(),
                products, entity.isContactPresent(), entity.getRequestedAt(), waitingSeconds,
                entity.getAcknowledgedAt(), entity.getAcknowledgedBy(),
                entity.getAssignedAt(), entity.getAssignedAdminId(), entity.getAssignedDisplayName(),
                entity.getResolvedAt(), entity.getResolution(), entity.isWithinBusinessHours(),
                entity.getNextOpenAt());
    }
}
