package com.bigbike.bigbike_backend.persistence.repository.newsletter;

import com.bigbike.bigbike_backend.persistence.entity.newsletter.NewsletterSubscriberEntity;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NewsletterSubscriberJpaRepository
        extends JpaRepository<NewsletterSubscriberEntity, UUID> {

    boolean existsByEmailIgnoreCase(String email);
}
