package com.bigbike.bigbike_backend.service.video;

import com.bigbike.bigbike_backend.persistence.entity.settings.SiteSettingEntity;
import com.bigbike.bigbike_backend.persistence.entity.video.HomeVideoEntity;
import com.bigbike.bigbike_backend.persistence.repository.settings.SiteSettingJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.video.HomeVideoJpaRepository;
import com.bigbike.bigbike_backend.service.security.YouTubeChannelUrlPolicy;
import com.bigbike.bigbike_backend.service.video.YouTubeHomeVideoClient.FeedVideo;
import com.bigbike.bigbike_backend.service.video.YouTubeHomeVideoSyncService.SyncPlan;
import com.bigbike.bigbike_backend.service.video.YouTubeHomeVideoSyncService.SyncResult;
import com.bigbike.bigbike_backend.service.web.WebRevalidationService;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Applies a validated sync plan without overwriting any existing owner-managed fields. */
@Service
@RequiredArgsConstructor
public class YouTubeHomeVideoSyncWriter {

    private final SiteSettingJpaRepository settingRepository;
    private final HomeVideoJpaRepository homeVideoRepository;
    private final YouTubeChannelUrlPolicy channelUrlPolicy;
    private final WebRevalidationService webRevalidationService;

    @Transactional
    public SyncResult apply(SyncPlan plan) {
        String currentSetting = settingRepository
                .findBySettingKey(YouTubeHomeVideoSyncService.CHANNEL_SETTING_KEY)
                .map(SiteSettingEntity::getSettingValue)
                .orElse("");
        String currentNormalized = channelUrlPolicy.parse(currentSetting)
                .map(YouTubeChannelUrlPolicy.ChannelReference::normalizedUrl)
                .orElse(null);
        if (!plan.feed().normalizedChannelUrl().equals(currentNormalized)) {
            return SyncResult.noop("channel_changed_during_sync");
        }

        List<HomeVideoEntity> existing = homeVideoRepository.findAllByOrderBySortOrderAsc();
        Set<String> knownIds = new HashSet<>();
        Set<String> existingRecordIds = new HashSet<>();
        existing.forEach(entity -> existingRecordIds.add(entity.getId()));
        existing.stream()
                .flatMap(entity -> YouTubeHomeVideoSyncService.youtubeIdsOf(entity).stream())
                .forEach(knownIds::add);

        List<FeedVideo> newVideos = new ArrayList<>();
        int duplicateOrExisting = 0;
        for (FeedVideo video : plan.feed().videos()) {
            if (!knownIds.add(video.videoId()) || existingRecordIds.contains("hv_yt_" + video.videoId())) {
                duplicateOrExisting++;
                continue;
            }
            newVideos.add(video);
        }

        Instant now = Instant.now();
        int disabled = 0;
        for (HomeVideoEntity entity : existing) {
            String youtubeId = YouTubeHomeVideoSyncService.youtubeIdOf(entity);
            if (entity.isActive() && youtubeId != null && plan.unavailableIds().contains(youtubeId)) {
                entity.setActive(false);
                entity.setUpdatedAt(now);
                disabled++;
            }
        }

        if (!newVideos.isEmpty()) {
            // Two passes avoid the unique sort_order constraint while preserving old relative order.
            for (int index = 0; index < existing.size(); index++) {
                existing.get(index).setSortOrder(-(index + 1));
                existing.get(index).setUpdatedAt(now);
            }
            homeVideoRepository.flush();

            List<HomeVideoEntity> additions = new ArrayList<>();
            for (int index = 0; index < newVideos.size(); index++) {
                FeedVideo video = newVideos.get(index);
                HomeVideoEntity entity = new HomeVideoEntity();
                entity.setId("hv_yt_" + video.videoId());
                entity.setSortOrder(index);
                entity.setTitle(video.title());
                entity.setTitleEn(null);
                entity.setVideoUrl(video.videoUrl());
                entity.setYoutubeId(video.videoId());
                entity.setActive(true);
                entity.setCreatedAt(now);
                entity.setUpdatedAt(now);
                additions.add(entity);
            }

            for (int index = 0; index < existing.size(); index++) {
                existing.get(index).setSortOrder(newVideos.size() + index);
            }
            homeVideoRepository.saveAll(additions);
        }

        if (!newVideos.isEmpty() || disabled > 0) {
            homeVideoRepository.flush();
            webRevalidationService.revalidate("home-videos");
            return new SyncResult(newVideos.size(), disabled, duplicateOrExisting, "updated");
        }
        return new SyncResult(0, 0, duplicateOrExisting, "no_changes");
    }
}
