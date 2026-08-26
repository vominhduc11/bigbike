package com.bigbike.bigbike_backend.persistence.repository.chat;

import com.bigbike.bigbike_backend.persistence.entity.chat.ChatVisitorEntity;
import java.util.Optional;
import java.util.UUID;
import java.time.Instant;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ChatVisitorJpaRepository extends JpaRepository<ChatVisitorEntity, UUID> {
    Optional<ChatVisitorEntity> findByTokenHash(String tokenHash);
    long deleteByRememberedUntilBefore(Instant cutoff);
}
