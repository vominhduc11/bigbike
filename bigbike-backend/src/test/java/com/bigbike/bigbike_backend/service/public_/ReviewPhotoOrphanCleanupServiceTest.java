package com.bigbike.bigbike_backend.service.public_;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.persistence.entity.catalog.ReviewEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ReviewPhotoUploadEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ReviewJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ReviewPhotoUploadJpaRepository;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class ReviewPhotoOrphanCleanupServiceTest {

    @Test
    void cleanupOrphans_removesOldUnclaimedCascadeTombstoneAndCrashWindowObject() {
        ReviewPhotoUploadJpaRepository uploadRepo = mock(ReviewPhotoUploadJpaRepository.class);
        ReviewJpaRepository reviewRepo = mock(ReviewJpaRepository.class);
        ReviewPhotoStorageService storageService = mock(ReviewPhotoStorageService.class);
        ReviewPhotoOrphanCleanupService service =
                new ReviewPhotoOrphanCleanupService(uploadRepo, reviewRepo, storageService);

        ReviewPhotoUploadEntity unclaimed = upload(
                "reviews/unclaimed/photo.jpg", "/media/reviews/unclaimed/photo.jpg", null);
        ReviewPhotoUploadEntity cascadeTombstone = upload(
                "reviews/cascade/photo.jpg",
                "/media/reviews/cascade/photo.jpg",
                Instant.now().minusSeconds(3600));
        ReviewPhotoUploadEntity stillReferenced = upload(
                "reviews/referenced/photo.jpg",
                "/media/reviews/referenced/photo.jpg",
                Instant.now().minusSeconds(3600));
        when(uploadRepo.findCleanupCandidates(any(Instant.class)))
                .thenReturn(List.of(unclaimed, cascadeTombstone, stillReferenced));
        when(uploadRepo.deleteCleanupCandidate(eq(unclaimed.getObjectKey()), any(Instant.class)))
                .thenReturn(1);
        when(uploadRepo.deleteCleanupCandidate(
                eq(cascadeTombstone.getObjectKey()), any(Instant.class))).thenReturn(1);

        ReviewEntity referencedReview = new ReviewEntity();
        referencedReview.setPhotos(List.of(stillReferenced.getPublicUrl()));
        when(reviewRepo.findAllWithPhotos()).thenReturn(List.of(referencedReview));

        String crashKey = "reviews/crash/photo.jpg";
        String crashUrl = "/media/" + crashKey;
        when(storageService.listObjectsOlderThan(any(Instant.class)))
                .thenReturn(List.of(new ReviewPhotoStorageService.StoredReviewObject(
                        crashKey, crashUrl, Instant.now().minusSeconds(25 * 3600))));
        when(uploadRepo.existsById(crashKey)).thenReturn(false);

        service.cleanupOrphans();

        ArgumentCaptor<Instant> cutoff = ArgumentCaptor.forClass(Instant.class);
        verify(uploadRepo).findCleanupCandidates(cutoff.capture());
        assertThat(cutoff.getValue())
                .isBetween(
                        Instant.now().minusSeconds(24 * 3600 + 5),
                        Instant.now().minusSeconds(24 * 3600 - 5));
        verify(uploadRepo, never()).deleteCleanupCandidate(
                eq(stillReferenced.getObjectKey()), any(Instant.class));
        verify(storageService).deletePhotos(org.mockito.ArgumentMatchers.argThat(urls ->
                urls.size() == 3
                        && urls.contains(unclaimed.getPublicUrl())
                        && urls.contains(cascadeTombstone.getPublicUrl())
                        && urls.contains(crashUrl)
                        && !urls.contains(stillReferenced.getPublicUrl())));
    }

    private ReviewPhotoUploadEntity upload(
            String key,
            String url,
            Instant claimedAt
    ) {
        ReviewPhotoUploadEntity upload = new ReviewPhotoUploadEntity();
        upload.setObjectKey(key);
        upload.setPublicUrl(url);
        upload.setProductId("product-1");
        upload.setUploadedAt(Instant.now().minusSeconds(25 * 3600));
        upload.setClaimedAt(claimedAt);
        upload.setReviewId(null);
        return upload;
    }
}
