package com.bigbike.bigbike_backend.service.video;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.persistence.entity.settings.SiteSettingEntity;
import com.bigbike.bigbike_backend.persistence.entity.video.HomeVideoEntity;
import com.bigbike.bigbike_backend.persistence.repository.settings.SiteSettingJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.video.HomeVideoJpaRepository;
import com.bigbike.bigbike_backend.service.video.YouTubeHomeVideoClient.Availability;
import com.bigbike.bigbike_backend.service.video.YouTubeHomeVideoClient.ChannelFeed;
import com.bigbike.bigbike_backend.service.video.YouTubeHomeVideoClient.FeedVideo;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class YouTubeHomeVideoSyncServiceTest {

    private static final String CHANNEL_URL = "https://www.youtube.com/@bigbike-shop";
    private static final String CHANNEL_ID = "UCabcdefghijklmnopqrstuv";

    private SiteSettingJpaRepository settingRepository;
    private HomeVideoJpaRepository homeVideoRepository;
    private YouTubeHomeVideoClient client;
    private YouTubeHomeVideoSyncWriter writer;
    private YouTubeHomeVideoSyncService service;

    @BeforeEach
    void setUp() {
        settingRepository = mock(SiteSettingJpaRepository.class);
        homeVideoRepository = mock(HomeVideoJpaRepository.class);
        client = mock(YouTubeHomeVideoClient.class);
        writer = mock(YouTubeHomeVideoSyncWriter.class);
        service = new YouTubeHomeVideoSyncService(settingRepository, homeVideoRepository, client, writer);

        SiteSettingEntity setting = new SiteSettingEntity();
        setting.setSettingValue(CHANNEL_URL);
        when(settingRepository.findBySettingKey("youtube_url")).thenReturn(Optional.of(setting));
    }

    @Test
    void youtubeFailureKeepsExistingListAndNeverCallsWriter() {
        HomeVideoEntity existing = video("AAAAAAAAAAA", true);
        when(client.fetchLatest(CHANNEL_URL))
                .thenThrow(new YouTubeHomeVideoClient.YouTubeFetchException("timeout"));

        var result = service.sync();

        assertThat(result.changed()).isFalse();
        assertThat(existing.isActive()).isTrue();
        verify(homeVideoRepository, never()).findAllByOrderBySortOrderAsc();
        verify(writer, never()).apply(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void removedHomepageCandidateIsPassedToAtomicWriter() {
        HomeVideoEntity existing = video("AAAAAAAAAAA", true);
        FeedVideo latest = feedVideo("BBBBBBBBBBB");
        when(client.fetchLatest(CHANNEL_URL))
                .thenReturn(new ChannelFeed(CHANNEL_URL, CHANNEL_ID, List.of(latest)));
        when(homeVideoRepository.findAllByOrderBySortOrderAsc()).thenReturn(List.of(existing));
        when(client.checkAvailability("AAAAAAAAAAA")).thenReturn(Availability.UNAVAILABLE);
        when(writer.apply(org.mockito.ArgumentMatchers.any()))
                .thenReturn(YouTubeHomeVideoSyncService.SyncResult.noop("captured"));

        service.sync();

        ArgumentCaptor<YouTubeHomeVideoSyncService.SyncPlan> plan =
                ArgumentCaptor.forClass(YouTubeHomeVideoSyncService.SyncPlan.class);
        verify(writer).apply(plan.capture());
        assertThat(plan.getValue().unavailableIds()).isEqualTo(Set.of("AAAAAAAAAAA"));
    }

    @Test
    void uncertainAvailabilityAbortsNewImportsAsWell() {
        HomeVideoEntity existing = video("AAAAAAAAAAA", true);
        FeedVideo latest = feedVideo("BBBBBBBBBBB");
        when(client.fetchLatest(CHANNEL_URL))
                .thenReturn(new ChannelFeed(CHANNEL_URL, CHANNEL_ID, List.of(latest)));
        when(homeVideoRepository.findAllByOrderBySortOrderAsc()).thenReturn(List.of(existing));
        when(client.checkAvailability("AAAAAAAAAAA"))
                .thenThrow(new YouTubeHomeVideoClient.YouTubeFetchException("503"));

        var result = service.sync();

        assertThat(result.changed()).isFalse();
        verify(writer, never()).apply(org.mockito.ArgumentMatchers.any());
    }

    private static FeedVideo feedVideo(String id) {
        return new FeedVideo(id, "Video " + id, Instant.parse("2026-08-27T03:00:00Z"),
                "https://www.youtube.com/watch?v=" + id);
    }

    private static HomeVideoEntity video(String youtubeId, boolean active) {
        HomeVideoEntity entity = new HomeVideoEntity();
        entity.setId("hv_" + youtubeId);
        entity.setYoutubeId(youtubeId);
        entity.setVideoUrl("https://www.youtube.com/watch?v=" + youtubeId);
        entity.setTitle("Existing");
        entity.setSortOrder(0);
        entity.setActive(active);
        entity.setCreatedAt(Instant.now());
        entity.setUpdatedAt(Instant.now());
        return entity;
    }
}
