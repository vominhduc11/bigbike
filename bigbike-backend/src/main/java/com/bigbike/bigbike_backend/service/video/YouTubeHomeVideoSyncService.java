package com.bigbike.bigbike_backend.service.video;

import com.bigbike.bigbike_backend.persistence.entity.settings.SiteSettingEntity;
import com.bigbike.bigbike_backend.persistence.entity.video.HomeVideoEntity;
import com.bigbike.bigbike_backend.persistence.repository.settings.SiteSettingJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.video.HomeVideoJpaRepository;
import com.bigbike.bigbike_backend.service.video.YouTubeHomeVideoClient.Availability;
import com.bigbike.bigbike_backend.service.video.YouTubeHomeVideoClient.ChannelFeed;
import com.bigbike.bigbike_backend.service.video.YouTubeHomeVideoClient.FeedVideo;
import com.bigbike.bigbike_backend.service.video.YouTubeHomeVideoClient.YouTubeFetchException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/** Coordinates network validation before delegating one atomic database write. */
@Service
@RequiredArgsConstructor
@Slf4j
public class YouTubeHomeVideoSyncService {

    static final String CHANNEL_SETTING_KEY = "youtube_url";
    static final int PUBLIC_VIDEO_LIMIT = 10;

    private final SiteSettingJpaRepository settingRepository;
    private final HomeVideoJpaRepository homeVideoRepository;
    private final YouTubeHomeVideoClient youTubeClient;
    private final YouTubeHomeVideoSyncWriter syncWriter;

    public SyncResult sync() {
        String configuredChannelUrl = settingRepository.findBySettingKey(CHANNEL_SETTING_KEY)
                .map(SiteSettingEntity::getSettingValue)
                .map(String::trim)
                .orElse("");
        if (configuredChannelUrl.isBlank()) {
            return SyncResult.noop("channel_not_configured");
        }

        try {
            ChannelFeed feed = youTubeClient.fetchLatest(configuredChannelUrl);
            List<HomeVideoEntity> current = homeVideoRepository.findAllByOrderBySortOrderAsc();
            Set<String> knownIds = current.stream()
                    .flatMap(entity -> youtubeIdsOf(entity).stream())
                    .collect(java.util.stream.Collectors.toCollection(HashSet::new));

            List<FeedVideo> newVideos = feed.videos().stream()
                    .filter(video -> !knownIds.contains(video.videoId()))
                    .toList();
            Set<String> feedIds = feed.videos().stream()
                    .map(FeedVideo::videoId)
                    .collect(java.util.stream.Collectors.toSet());

            Set<String> unavailableIds = resolveUnavailableCandidates(newVideos, current, feedIds);
            return syncWriter.apply(new SyncPlan(feed, unavailableIds));
        } catch (YouTubeFetchException exception) {
            log.warn("Homepage YouTube sync kept existing data: {}", exception.getMessage());
            return SyncResult.noop("youtube_unavailable_or_invalid");
        } catch (RuntimeException exception) {
            log.error("Homepage YouTube sync rolled back and kept existing data.", exception);
            return SyncResult.noop("write_failed_and_rolled_back");
        }
    }

    private Set<String> resolveUnavailableCandidates(
            List<FeedVideo> newVideos,
            List<HomeVideoEntity> current,
            Set<String> feedIds
    ) {
        List<Candidate> candidates = new ArrayList<>();
        newVideos.forEach(video -> candidates.add(Candidate.newFeedVideo(video.videoId())));
        current.forEach(entity -> candidates.add(Candidate.existing(entity)));

        int visibleCount = 0;
        Map<String, Availability> checkedAvailability = new HashMap<>();
        Set<String> unavailableIds = new LinkedHashSet<>();

        for (Candidate candidate : candidates) {
            if (visibleCount >= PUBLIC_VIDEO_LIMIT) {
                break;
            }
            if (!candidate.active()) {
                continue;
            }
            if (candidate.feedConfirmed()) {
                visibleCount++;
                continue;
            }

            String youtubeId = candidate.youtubeId();
            if (youtubeId == null) {
                // Manual TikTok/Facebook/internal media entries remain outside YouTube automation.
                visibleCount++;
                continue;
            }
            if (feedIds.contains(youtubeId)) {
                visibleCount++;
                continue;
            }

            Availability availability = checkedAvailability.computeIfAbsent(
                    youtubeId,
                    youTubeClient::checkAvailability
            );
            if (availability == Availability.UNAVAILABLE) {
                unavailableIds.add(youtubeId);
                continue;
            }
            visibleCount++;
        }
        return unavailableIds;
    }

    static String youtubeIdOf(HomeVideoEntity entity) {
        if (YouTubeUrlParser.isValidVideoId(entity.getYoutubeId())) {
            return entity.getYoutubeId();
        }
        return YouTubeUrlParser.extractId(entity.getVideoUrl());
    }

    static Set<String> youtubeIdsOf(HomeVideoEntity entity) {
        Set<String> ids = new LinkedHashSet<>();
        if (YouTubeUrlParser.isValidVideoId(entity.getYoutubeId())) {
            ids.add(entity.getYoutubeId());
        }
        String urlId = YouTubeUrlParser.extractId(entity.getVideoUrl());
        if (urlId != null) {
            ids.add(urlId);
        }
        return ids;
    }

    public record SyncPlan(ChannelFeed feed, Set<String> unavailableIds) {
        public SyncPlan {
            unavailableIds = Set.copyOf(unavailableIds);
        }
    }

    public record SyncResult(int added, int disabled, int duplicateOrExisting, String outcome) {
        public static SyncResult noop(String outcome) {
            return new SyncResult(0, 0, 0, outcome);
        }

        public boolean changed() {
            return added > 0 || disabled > 0;
        }
    }

    private record Candidate(String youtubeId, boolean active, boolean feedConfirmed) {
        private static Candidate newFeedVideo(String youtubeId) {
            return new Candidate(youtubeId, true, true);
        }

        private static Candidate existing(HomeVideoEntity entity) {
            return new Candidate(youtubeIdOf(entity), entity.isActive(), false);
        }
    }
}
