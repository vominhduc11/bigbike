package com.bigbike.bigbike_backend.service;

import com.bigbike.bigbike_backend.api.admin.dto.newsletter.AdminNewsletterSubscriberItem;
import com.bigbike.bigbike_backend.persistence.entity.newsletter.NewsletterSubscriberEntity;
import com.bigbike.bigbike_backend.persistence.repository.newsletter.NewsletterSubscriberJpaRepository;
import com.bigbike.bigbike_backend.service.common.PageResult;
import java.time.Instant;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Đăng ký nhận tin qua email (storefront) + đọc danh sách (trang quản trị). */
@Service
@Slf4j
@RequiredArgsConstructor
public class NewsletterService {

    private static final int DEFAULT_SIZE = 20;
    private static final int MAX_SIZE = 100;

    private final NewsletterSubscriberJpaRepository subscriberRepo;

    /** Lưu email đăng ký. Idempotent — email đã tồn tại thì bỏ qua, không báo lỗi. */
    @Transactional
    public void subscribe(String email) {
        String normalized = email.trim();
        if (subscriberRepo.existsByEmailIgnoreCase(normalized)) {
            return;
        }
        NewsletterSubscriberEntity entity = new NewsletterSubscriberEntity();
        entity.setEmail(normalized);
        entity.setCreatedAt(Instant.now());
        subscriberRepo.save(entity);
        log.info("Newsletter subscription saved id={}", entity.getId());
    }

    /** Danh sách email đã đăng ký, mới nhất trước, có phân trang. */
    @Transactional(readOnly = true)
    public PageResult<AdminNewsletterSubscriberItem> listSubscribers(int page, int size) {
        int pg = Math.max(1, page) - 1;
        int sz = (size <= 0) ? DEFAULT_SIZE : Math.min(size, MAX_SIZE);
        PageRequest pageable = PageRequest.of(pg, sz, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<NewsletterSubscriberEntity> result = subscriberRepo.findAll(pageable);

        List<AdminNewsletterSubscriberItem> items = result.getContent().stream()
                .map(e -> new AdminNewsletterSubscriberItem(e.getId(), e.getEmail(), e.getCreatedAt()))
                .toList();

        return new PageResult<>(
                items,
                result.getNumber() + 1,
                result.getSize(),
                result.getTotalElements(),
                result.getTotalPages()
        );
    }
}
