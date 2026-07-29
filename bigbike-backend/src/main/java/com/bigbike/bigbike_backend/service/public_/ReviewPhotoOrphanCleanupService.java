package com.bigbike.bigbike_backend.service.public_;

import com.bigbike.bigbike_backend.persistence.entity.catalog.ReviewEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ReviewPhotoUploadEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ReviewJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ReviewPhotoUploadJpaRepository;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Service
@Slf4j
@RequiredArgsConstructor
public class ReviewPhotoOrphanCleanupService {

    static final Duration UNCLAIMED_RETENTION = Duration.ofHours(24);

    private final ReviewPhotoUploadJpaRepository uploadRepo;
    private final ReviewJpaRepository reviewRepo;
    private final ReviewPhotoStorageService storageService;

    @Scheduled(cron = "${bigbike.review-photo.cleanup-cron:0 30 3 * * *}")
    @Transactional
    public void cleanupOrphans() {
        Instant cutoff = Instant.now().minus(UNCLAIMED_RETENTION);
        Set<String> referencedKeys = referencedObjectKeys();
        Set<String> urlsToDelete = new LinkedHashSet<>();

        for (ReviewPhotoUploadEntity candidate : uploadRepo.findCleanupCandidates(cutoff)) {
            if (referencedKeys.contains(candidate.getObjectKey())) {
                continue;
            }
            if (uploadRepo.deleteCleanupCandidate(candidate.getObjectKey(), cutoff) == 1) {
                urlsToDelete.add(candidate.getPublicUrl());
            }
        }

        for (ReviewPhotoStorageService.StoredReviewObject object
                : storageService.listObjectsOlderThan(cutoff)) {
            if (!referencedKeys.contains(object.objectKey())
                    && !uploadRepo.existsById(object.objectKey())) {
                urlsToDelete.add(object.publicUrl());
            }
        }

        if (urlsToDelete.isEmpty()) {
            return;
        }
        List<String> cleanupUrls = List.copyOf(urlsToDelete);
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    storageService.deletePhotos(cleanupUrls);
                }
            });
        } else {
            storageService.deletePhotos(cleanupUrls);
        }
        log.info("Scheduled cleanup for {} orphan review photo object(s)", cleanupUrls.size());
    }

    private Set<String> referencedObjectKeys() {
        return reviewRepo.findAllWithPhotos().stream()
                .map(ReviewEntity::getPhotos)
                .filter(photos -> photos != null)
                .flatMap(List::stream)
                .map(ReviewPhotoStorageService::reviewObjectKey)
                .filter(key -> key != null)
                .collect(Collectors.toSet());
    }
}
