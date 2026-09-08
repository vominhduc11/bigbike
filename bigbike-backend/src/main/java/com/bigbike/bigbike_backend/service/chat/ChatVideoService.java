package com.bigbike.bigbike_backend.service.chat;

import com.bigbike.bigbike_backend.api.chat.dto.*;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.persistence.entity.chat.ChatConversationEntity;
import com.bigbike.bigbike_backend.persistence.entity.chat.ChatVideoEntity;
import com.bigbike.bigbike_backend.persistence.repository.chat.*;
import com.bigbike.bigbike_backend.service.catalog.CatalogReadService;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

@Service
@RequiredArgsConstructor
@Slf4j
public class ChatVideoService {
    public static final int DAILY_LIMIT = 10;
    public static final int CONVERSATION_LIMIT = 2;
    private static final Set<String> BLOCKED_CONTENT = Set.of("REJECTED_UNSAFE", "DELETING", "DELETED");
    private final ChatVideoJpaRepository videoRepo;
    private final ChatImageJpaRepository imageRepo;
    private final ChatMessageJpaRepository messageRepo;
    private final ChatConversationJpaRepository conversationRepo;
    private final ChatVideoNormalizer normalizer;
    private final ChatVideoStorageService storage;
    private final ChatVideoDailyQuotaService quota;
    private final ChatVideoAnalysisClient analysisClient;
    private final CatalogReadService catalog;
    private final ChatImageService imageService;
    private final ChatProductImageFingerprintService fingerprints;

    public ChatVideoAvailabilityResponse availability() {
        return new ChatVideoAvailabilityResponse(analysisClient.isConfigured() && normalizer.isAvailable(),
                ChatVideoNormalizer.MAX_UPLOAD_BYTES, 15, 1, CONVERSATION_LIMIT, DAILY_LIMIT);
    }

    @Transactional
    public ChatVideoUploadResponse upload(UUID requestId, UUID conversationId, String lang,
            MultipartFile file, UUID customerId, UUID visitorId, Instant receivedAt) {
        if (requestId == null) throw ChatVideoErrors.invalid("CHAT_VIDEO_INVALID", lang);
        var replay = videoRepo.findByRequestId(requestId);
        if (replay.isPresent()) {
            requireOwner(replay.get().getConversationId(), customerId, visitorId, false);
            return uploadResponse(replay.get());
        }
        if (imageRepo.findByRequestId(requestId).isPresent()) throw ChatVideoErrors.invalid("CHAT_MEDIA_EXCLUSIVE", lang);
        if (!availability().enabled()) throw ChatVideoErrors.invalid("CHAT_VIDEO_UNAVAILABLE", lang);
        Instant deadline = receivedAt.plusSeconds(60);
        try (var budget = ChatTurnBudget.open(deadline)) {
            ChatConversationEntity conversation;
            if (conversationId == null) {
                if (customerId == null && visitorId == null) throw new NotFoundException("Conversation not found");
                conversation = new ChatConversationEntity();
                conversation.setCustomerId(customerId);
                conversation.setVisitorId(visitorId);
                conversation.setLocale("en".equals(lang) ? "en" : "vi");
                conversation = conversationRepo.saveAndFlush(conversation);
            } else conversation = requireOwner(conversationId, customerId, visitorId, true);
            // Count all accepted uploads, including expired/deleted placeholders; deletion cannot reset the limit.
            if (videoRepo.findByConversationIdOrderByCreatedAtAsc(conversation.getId()).size() >= CONVERSATION_LIMIT) {
                throw ChatVideoErrors.invalid("CHAT_VIDEO_CONVERSATION_LIMIT", lang);
            }
            var normalized = normalizer.normalize(file, lang);
            var stored = storage.store(conversation.getId(), requestId, normalized.bytes(), lang);
            if (TransactionSynchronizationManager.isSynchronizationActive()) {
                TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                    @Override public void afterCompletion(int status) {
                        if (status == STATUS_COMMITTED) return;
                        try { storage.delete(stored.bucket(), stored.objectKey()); }
                        catch (RuntimeException failure) { log.warn("chat_video_rollback_cleanup_failed type={}", failure.getClass().getSimpleName()); }
                    }
                });
            }
            ChatVideoEntity video = new ChatVideoEntity();
            video.setRequestId(requestId);
            video.setConversationId(conversation.getId());
            video.setStatus("PENDING");
            video.setReceivedAt(receivedAt);
            video.setDeadlineAt(deadline);
            video.setExpiresAt(receivedAt.plus(7, ChronoUnit.DAYS));
            video.setStorageBucket(stored.bucket());
            video.setStorageObjectKey(stored.objectKey());
            video.setMimeType("video/mp4");
            video.setSizeBytes(stored.sizeBytes());
            video.setSha256(stored.sha256());
            video.setDurationSeconds(normalized.durationSeconds());
            video.setHasAudio(normalized.hasAudio());
            ChatTurnBudget.checkTime();
            video = videoRepo.saveAndFlush(video);
            return uploadResponse(video);
        } catch (ChatTurnBudget.Expired failure) {
            throw ChatVideoErrors.invalid("CHAT_VIDEO_TIMEOUT", lang);
        }
    }

    public Instant deadline(List<UUID> ids, UUID conversationId, UUID customerId, UUID visitorId, UUID requestId, String lang) {
        ChatVideoEntity video = turnVideo(ids, conversationId, requestId, lang);
        requireOwner(video.getConversationId(), customerId, visitorId, false);
        if (video.getCustomerMessageId() != null && !messageRepo.findById(video.getCustomerMessageId())
                .map(m -> Objects.equals(m.getRequestId(), requestId)).orElse(false)) throw new NotFoundException("Video not found");
        return video.getDeadlineAt();
    }

    private ChatVideoUploadResponse uploadResponse(ChatVideoEntity video) {
        long remaining = Math.max(0, Math.min(60_000,
                java.time.Duration.between(Instant.now(), video.getDeadlineAt()).toMillis()));
        return new ChatVideoUploadResponse(video.getConversationId(), response(video), remaining);
    }

    private ChatVideoEntity turnVideo(List<UUID> ids, UUID conversationId, UUID requestId, String lang) {
        if (ids == null || ids.size() != 1 || ids.get(0) == null) throw ChatVideoErrors.invalid("CHAT_VIDEO_TURN_LIMIT", lang);
        return videoRepo.findById(ids.get(0)).filter(v -> v.getConversationId().equals(conversationId))
                .filter(v -> readable(v, Instant.now()))
                .orElseThrow(() -> new NotFoundException("Video not found"));
    }

    public VideoTurnResult processTurn(ChatConversationEntity conversation, UUID messageId, List<UUID> ids,
            UUID requestId, String caption, String lang) {
        ChatTurnBudget.checkTime();
        ChatVideoEntity video = turnVideo(ids, conversation.getId(), requestId, lang);
        if (video.getCustomerMessageId() != null && !messageId.equals(video.getCustomerMessageId())) {
            throw new NotFoundException("Video not found");
        }
        video.setCustomerMessageId(messageId);
        if (!"PENDING".equals(video.getStatus()) && !"ATTACHED".equals(video.getStatus())) {
            // An interrupted request cannot spend the same daily slot a second time.
            return new VideoTurnResult(fallback(lang, "CHAT_VIDEO_UNAVAILABLE", false), "");
        }
        video.setStatus("ATTACHED");
        videoRepo.saveAndFlush(video);
        if (!quota.tryReserve(DAILY_LIMIT)) {
            video.setStatus("LIMIT_SKIPPED");
            videoRepo.save(video);
            return new VideoTurnResult(fallback(lang, "CHAT_VIDEO_DAILY_LIMIT", false), "");
        }
        video.setStatus("PROCESSING");
        videoRepo.saveAndFlush(video);
        var content = storage.read(video.getStorageBucket(), video.getStorageObjectKey());
        var context = imageService.catalogContext(catalog.listAssistantDecisionProducts(lang));
        var result = analysisClient.analyze(content.bytes(), caption, context.groups());
        if (result.isEmpty()) {
            video.setStatus("UNRECOGNIZED");
            video.setIntentCode("UNKNOWN");
            videoRepo.save(video);
            return new VideoTurnResult(fallback(lang, "CHAT_VIDEO_UNAVAILABLE", true), "");
        }
        var analysis = result.get();
        if (analysis.unsafe()) {
            video.setStatus("REJECTED_UNSAFE");
            video.setSafetyCode("PROVIDER_SAFETY");
            video.setIntentCode("UNKNOWN");
            videoRepo.saveAndFlush(video);
            try {
                storage.delete(video.getStorageBucket(), video.getStorageObjectKey());
                video.setDeletedAt(Instant.now());
                videoRepo.save(video);
            } catch (RuntimeException failure) { log.warn("chat_video_unsafe_delete_pending id={}", video.getId()); }
            return new VideoTurnResult(new ChatImageService.ImageTurnResult("en".equals(lang)
                    ? "I cannot process this video. I can help with BigBike products, protective gear and published shop policies."
                    : "Em không thể xử lý video này. Em có thể hỗ trợ về sản phẩm, đồ bảo hộ và chính sách đã công bố của BigBike.",
                    ChatMessageSource.CONTENT_REFUSAL, "REFUSAL", List.of(), true, false), "");
        }
        String question = caption == null || caption.isBlank() ? analysis.spokenQuestion() : caption;
        String intent = ChatImageService.resolveIntent(analysis.intent(), question, false);
        video.setIntentCode(intent);
        video.setStatus("UNKNOWN".equals(intent) ? "UNRECOGNIZED" : "READY");
        videoRepo.save(video);
        if ("PRODUCT_OPERATION".equals(intent)) {
            String normalizedQuestion = ChatToolService.normalize(question == null ? "" : question);
            boolean namedModel = context.products().stream().flatMap(product -> Arrays.stream(
                    ChatToolService.normalize(product.name()).split("\\s+")))
                    .filter(token -> token.matches("(?=.*[a-z])(?=.*[0-9])[a-z0-9-]{2,30}"))
                    .anyMatch(token -> Arrays.asList(normalizedQuestion.split("\\s+")).contains(token));
            var observation = operation(analysis, question, lang, namedModel);
            String speech = analysis.spokenQuestion();
            // The speech question may say only "put it back". Carry the observed subject with it.
            if (speech != null && !speech.isBlank()) speech = operationSubject(analysis, lang) + ": " + speech;
            return new VideoTurnResult(observation, speech);
        }
        var vision = new ChatImageAnalysisClient.ImageAnalysis(intent, analysis.group(), analysis.confidence(), List.of(), false);
        List<String> ranked = new ArrayList<>();
        Map<String, ChatProductImageFingerprintService.VisualMatch> matches = new LinkedHashMap<>();
        Map<String, Integer> votes = new HashMap<>();
        if ("PRODUCT_SEARCH".equals(intent)) {
            for (byte[] frame : normalizer.comparisonFrames(content.bytes(), video.getDurationSeconds(), lang)) {
                ChatTurnBudget.checkTime();
                ChatProductImageFingerprintService.VisualComparison comparison;
                try { comparison = fingerprints.compare(frame, "", context.products()); }
                catch (RuntimeException failure) {
                    log.warn("chat_video_comparison_unavailable type={}", failure.getClass().getSimpleName());
                    continue;
                }
                ranked.addAll(comparison.rankedSlugs());
                comparison.strictMatch().ifPresent(match -> {
                    matches.put(match.slug(), match);
                    votes.merge(match.slug(), 1, Integer::sum);
                });
            }
            Optional<ChatProductImageFingerprintService.VisualMatch> match = matches.size() == 1
                    && votes.values().stream().anyMatch(count -> count >= 2)
                    ? matches.values().stream().findFirst() : Optional.empty();
            vision = ChatImageService.evidenceBoundAnalysis(vision, match, context);
        }
        ChatTurnBudget.checkTime();
        return new VideoTurnResult(imageService.videoResult(intent, vision, context,
                ranked.stream().distinct().toList(), lang), analysis.spokenQuestion());
    }

    private static String operationSubject(ChatVideoAnalysisClient.Analysis analysis, String lang) {
        String action = "NONE".equals(analysis.observedAction()) ? analysis.spokenAction() : analysis.observedAction();
        boolean en = "en".equals(lang);
        return switch (action) {
            case "INTERCOM_ATTACH_DETACH", "INTERCOM_CONNECTION" -> en ? "Motorcycle helmet intercom operation" : "Thao tác với tai nghe gắn mũ bảo hiểm";
            case "JACKET_ZIP" -> en ? "Motorcycle jacket zip operation" : "Thao tác với khóa áo giáp";
            default -> en ? "Helmet operation" : "Thao tác với mũ bảo hiểm";
        };
    }

    private static ChatImageService.ImageTurnResult operation(ChatVideoAnalysisClient.Analysis analysis, String question, String lang, boolean namedModel) {
        boolean en = "en".equals(lang);
        boolean visible = !"NONE".equals(analysis.observedAction());
        String action = visible ? analysis.observedAction() : analysis.spokenAction();
        String description = switch (action) {
            case "VISOR_OPEN_CLOSE" -> en ? "opening or closing a helmet visor" : "đóng hoặc mở kính mũ";
            case "JACKET_ZIP" -> en ? "fastening or unfastening a jacket zip" : "đóng hoặc mở khóa áo";
            case "INTERCOM_ATTACH_DETACH" -> en ? "attaching or removing an intercom" : "lắp hoặc tháo tai nghe khỏi mũ";
            case "INTERCOM_CONNECTION" -> en ? "connecting intercoms" : "kết nối tai nghe";
            case "HELMET_ADJUSTMENT" -> en ? "adjusting a helmet" : "điều chỉnh mũ";
            default -> en ? "handling the product" : "thao tác với sản phẩm";
        };
        String answer = en
                ? (visible ? "I can see the action of " : "The audio discusses ") + description + "."
                : (visible ? "Em thấy thao tác " : "Phần tiếng trong video đề cập đến việc ") + description + ".";
        String normalized = ChatToolService.normalize(question == null ? "" : question);
        boolean needsInstructions = !normalized.isBlank() && java.util.stream.Stream.of(
                "gan lai", "lap lai", "thao ra", "cach ", "lam sao", "the nao", "how ", "attach", "detach", "remove", "fasten", "unfasten")
                .anyMatch(normalized::contains);
        if (needsInstructions && !namedModel) {
            answer += en ? " Which product model are you using? Please share its model name so I can check the available instructions for this operation."
                    : " Anh/chị đang dùng mẫu nào? Anh/chị vui lòng cho biết tên mẫu để em đối chiếu hướng dẫn hiện có cho thao tác này.";
            return new ChatImageService.ImageTurnResult(answer, ChatMessageSource.TOOL, "CLARIFICATION", List.of(), true, false);
        }
        if (question == null || question.isBlank()) answer += en
                ? " Would you like to find a similar product, or ask about this operation?"
                : " Anh/chị muốn tìm sản phẩm tương tự hay cần hỗ trợ về thao tác này?";
        return new ChatImageService.ImageTurnResult(answer, ChatMessageSource.TOOL, "CLARIFICATION", List.of(), true, true);
    }

    static ChatImageService.ImageTurnResult fallback(String lang, String code, boolean analyzed) {
        return new ChatImageService.ImageTurnResult(ChatVideoErrors.message(code, lang), ChatMessageSource.TOOL,
                "CLARIFICATION", List.of(), analyzed, !"CHAT_VIDEO_TIMEOUT".equals(code));
    }

    @Transactional
    public void moveToContinuation(List<UUID> ids, UUID previous, UUID next) {
        for (var video : videoRepo.findByIdIn(ids)) {
            if (!video.getConversationId().equals(previous) || video.getCustomerMessageId() != null) {
                throw new NotFoundException("Video not found");
            }
            video.setConversationId(next);
            videoRepo.save(video);
        }
    }

    public void markTimeout(List<UUID> ids, UUID messageId) {
        for (var video : videoRepo.findByIdIn(ids)) {
            if (BLOCKED_CONTENT.contains(video.getStatus())) continue;
            video.setCustomerMessageId(messageId);
            video.setStatus("TIMED_OUT");
            videoRepo.save(video);
        }
    }

    @Transactional(readOnly = true)
    public ChatImageStorageService.StoredContent customerContent(UUID id, UUID customerId, UUID visitorId) {
        var video = requireReadable(id);
        requireOwner(video.getConversationId(), customerId, visitorId, false);
        return storage.read(video.getStorageBucket(), video.getStorageObjectKey());
    }
    @Transactional(readOnly = true)
    public ChatImageStorageService.StoredContent adminContent(UUID id) {
        var video = requireReadable(id);
        return storage.read(video.getStorageBucket(), video.getStorageObjectKey());
    }
    private ChatVideoEntity requireReadable(UUID id) {
        return videoRepo.findById(id).filter(v -> readable(v, Instant.now()))
                .orElseThrow(() -> new NotFoundException("Video not found"));
    }
    private static boolean readable(ChatVideoEntity video, Instant now) {
        return video.getDeletedAt() == null && !BLOCKED_CONTENT.contains(video.getStatus()) && video.getExpiresAt().isAfter(now);
    }
    private ChatConversationEntity requireOwner(UUID id, UUID customerId, UUID visitorId, boolean lock) {
        var conversation = (lock ? conversationRepo.findByIdForUpdate(id) : conversationRepo.findById(id))
                .orElseThrow(() -> new NotFoundException("Conversation not found"));
        if (!(conversation.getCustomerId() != null && conversation.getCustomerId().equals(customerId))
                && !(conversation.getCustomerId() == null && visitorId != null && visitorId.equals(conversation.getVisitorId()))) {
            throw new NotFoundException("Conversation not found");
        }
        return conversation;
    }
    @Transactional(readOnly = true)
    public Map<UUID, List<ChatVideoResponse>> referencesByMessageIds(Collection<UUID> ids) {
        if (ids == null || ids.isEmpty()) return Map.of();
        return videoRepo.findByCustomerMessageIdInOrderByCreatedAtAsc(ids).stream()
                .collect(Collectors.groupingBy(ChatVideoEntity::getCustomerMessageId, LinkedHashMap::new,
                        Collectors.mapping(this::response, Collectors.toList())));
    }
    private ChatVideoResponse response(ChatVideoEntity video) {
        boolean readable = readable(video, Instant.now());
        String status = video.getExpiresAt().isAfter(Instant.now()) ? video.getStatus() : "DELETED";
        return new ChatVideoResponse(video.getId(), status, video.getMimeType(), video.getSizeBytes(),
                video.getDurationSeconds(), video.isHasAudio(), readable ? "/api/v1/chat/videos/" + video.getId() + "/content" : null,
                video.getCreatedAt(), video.getExpiresAt());
    }
    public boolean deleteForConversations(Collection<UUID> ids) {
        if (ids == null || ids.isEmpty()) return true;
        List<ChatVideoEntity> videos = videoRepo.findByConversationIds(ids);
        for (var video : videos) if (!deleteOne(video)) return false;
        videoRepo.deleteAll(videos);
        return true;
    }
    public int deleteExpiredVideos(Instant now) {
        Map<UUID, ChatVideoEntity> pending = new LinkedHashMap<>();
        videoRepo.findByExpiresAtBeforeOrderByExpiresAtAsc(now).forEach(v -> pending.put(v.getId(), v));
        videoRepo.findByStatusInAndDeletedAtIsNullOrderByCreatedAtAsc(List.of("REJECTED_UNSAFE", "DELETING"))
                .forEach(v -> pending.put(v.getId(), v));
        int deleted = 0;
        for (var video : pending.values()) if (video.getDeletedAt() == null && deleteOne(video)) deleted++;
        normalizer.deleteExpiredTemporary(now.minus(7, ChronoUnit.DAYS));
        try { storage.deleteOrphansOlderThan(now.minus(7, ChronoUnit.DAYS)); }
        catch (RuntimeException failure) { log.warn("chat_video_orphan_cleanup_pending type={}", failure.getClass().getSimpleName()); }
        return deleted;
    }
    private boolean deleteOne(ChatVideoEntity video) {
        if (video.getDeletedAt() != null) return true;
        video.setStatus("DELETING");
        videoRepo.save(video);
        try {
            storage.delete(video.getStorageBucket(), video.getStorageObjectKey());
            video.setStatus("DELETED");
            video.setDeletedAt(Instant.now());
            videoRepo.save(video);
            return true;
        } catch (RuntimeException failure) { log.warn("chat_video_delete_pending id={}", video.getId()); return false; }
    }
    public record VideoTurnResult(ChatImageService.ImageTurnResult result, String spokenQuestion) {}
}
