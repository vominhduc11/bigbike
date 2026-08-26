package com.bigbike.bigbike_backend.service.chat;

import com.bigbike.bigbike_backend.persistence.repository.chat.ChatConversationJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatVisitorJpaRepository;
import java.time.Instant;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class ChatRetentionCleanupService {

    private final ChatConversationJpaRepository conversationRepo;
    private final ChatVisitorJpaRepository visitorRepo;
    private final ChatImageService chatImageService;

    @Scheduled(cron = "0 20 3 * * *", zone = "Asia/Ho_Chi_Minh")
    public void deleteExpiredConversations() {
        Instant now = Instant.now();
        long deleted = 0;
        for (var conversation : conversationRepo.findByExpiresAtBeforeOrderByExpiresAtAsc(now)) {
            if (!chatImageService.deleteForConversations(java.util.List.of(conversation.getId()))) {
                log.warn("Skipped expired chat conversation because its private images could not be deleted");
                continue;
            }
            conversationRepo.delete(conversation);
            deleted++;
        }
        chatImageService.deleteExpiredImages(now);
        if (deleted > 0) log.info("Deleted {} expired BigBike Assistant conversations", deleted);
        long expiredVisitors = visitorRepo.deleteByRememberedUntilBefore(Instant.now());
        if (expiredVisitors > 0) {
            log.info("Deleted {} expired BigBike Assistant visitor identities", expiredVisitors);
        }
    }
}
