package com.bigbike.bigbike_backend.persistence.repository.chat;

import com.bigbike.bigbike_backend.persistence.entity.chat.ChatProductImageFingerprintEntity;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ChatProductImageFingerprintJpaRepository
        extends JpaRepository<ChatProductImageFingerprintEntity, UUID> {

    List<ChatProductImageFingerprintEntity> findByProductIdInAndFingerprintVersion(
            Collection<String> productIds,
            String fingerprintVersion
    );
}
