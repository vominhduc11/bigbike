package com.bigbike.bigbike_backend.service.chat;

import com.bigbike.bigbike_backend.persistence.repository.chat.ChatConversationJpaRepository;
import java.time.Instant;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
public class ChatRetentionCleanupService {

    private final ChatConversationJpaRepository conversationRepo;

    @Scheduled(cron = "0 20 3 * * *", zone = "Asia/Ho_Chi_Minh")
    @Transactional
    public void deleteExpiredConversations() {
        long deleted = conversationRepo.deleteByExpiresAtBefore(Instant.now());
        if (deleted > 0) log.info("Deleted {} expired BigBike Assistant conversations", deleted);
    }
}
