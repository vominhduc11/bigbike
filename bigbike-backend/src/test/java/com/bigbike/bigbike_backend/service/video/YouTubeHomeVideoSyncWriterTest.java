package com.bigbike.bigbike_backend.service.video;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.persistence.entity.settings.SiteSettingEntity;
import com.bigbike.bigbike_backend.persistence.entity.video.HomeVideoEntity;
import com.bigbike.bigbike_backend.persistence.repository.settings.SiteSettingJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.video.HomeVideoJpaRepository;
import com.bigbike.bigbike_backend.service.security.YouTubeChannelUrlPolicy;
import com.bigbike.bigbike_backend.service.video.YouTubeHomeVideoClient.ChannelFeed;
import com.bigbike.bigbike_backend.service.video.YouTubeHomeVideoClient.FeedVideo;
import com.bigbike.bigbike_backend.service.video.YouTubeHomeVideoSyncService.SyncPlan;
import com.bigbike.bigbike_backend.service.web.WebRevalidationService;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class YouTubeHomeVideoSyncWriterTest {

    private static final String CHANNEL_URL = "https://www.youtube.com/@bigbike-shop";
    private static final String CHANNEL_ID = "UCabcdefghijklmnopqrstuv";

    private SiteSettingJpaRepository settingRepository;
    private HomeVideoJpaRepository homeVideoRepository;
    private WebRevalidationService revalidationService;
    private YouTubeHomeVideoSyncWriter writer;

    @BeforeEach
    void setUp() {
        settingRepository = mock(SiteSettingJpaRepository.class);
        homeVideoRepository = mock(HomeVideoJpaRepository.class);
        revalidationService = mock(WebRevalidationService.class);
        writer = new YouTubeHomeVideoSyncWriter(
                settingRepository,
                homeVideoRepository,
                new YouTubeChannelUrlPolicy(),
                revalidationService
        );
        SiteSettingEntity setting = new SiteSettingEntity();
        setting.setSettingValue(CHANNEL_URL);
        when(settingRepository.findBySettingKey("youtube_url")).thenReturn(Optional.of(setting));
    }

    @Test
    @SuppressWarnings("unchecked")
    void newVideoIsInsertedFirstWithYoutubeTitleAndNoEnglishOrThumbnail() {
        HomeVideoEntity old = video("hv_old", "BBBBBBBBBBB", 0, true);
        when(homeVideoRepository.findAllByOrderBySortOrderAsc()).thenReturn(List.of(old));

        var result = writer.apply(plan(List.of(feedVideo("AAAAAAAAAAA", "TEST CHỐNG NƯỚC")), Set.of()));

        ArgumentCaptor<List<HomeVideoEntity>> additions = ArgumentCaptor.forClass(List.class);
        verify(homeVideoRepository).saveAll(additions.capture());
        HomeVideoEntity inserted = additions.getValue().get(0);
        assertThat(inserted.getId()).isEqualTo("hv_yt_AAAAAAAAAAA");
        assertThat(inserted.getSortOrder()).isZero();
        assertThat(inserted.getTitle()).isEqualTo("TEST CHỐNG NƯỚC");
        assertThat(inserted.getTitleEn()).isNull();
        assertThat(inserted.getThumbnail()).isNull();
        assertThat(inserted.isActive()).isTrue();
        assertThat(old.getSortOrder()).isEqualTo(1);
        assertThat(result.added()).isEqualTo(1);
        verify(revalidationService).revalidate("home-videos");
    }

    @Test
    void existingActiveVideoIsNotDuplicated() {
        HomeVideoEntity existing = video("hv_existing", "AAAAAAAAAAA", 0, true);
        existing.setYoutubeId(null);
        when(homeVideoRepository.findAllByOrderBySortOrderAsc()).thenReturn(List.of(existing));

        var result = writer.apply(plan(List.of(feedVideo("AAAAAAAAAAA", "YouTube title")), Set.of()));

        assertThat(existing.isActive()).isTrue();
        assertThat(result.added()).isZero();
        assertThat(result.duplicateOrExisting()).isEqualTo(1);
        verify(homeVideoRepository, never()).saveAll(anyList());
        verify(revalidationService, never()).revalidate("home-videos");
    }

    @Test
    void existingDisabledVideoIsNeitherDuplicatedNorReactivated() {
        HomeVideoEntity disabled = video("hv_disabled", "AAAAAAAAAAA", 0, false);
        when(homeVideoRepository.findAllByOrderBySortOrderAsc()).thenReturn(List.of(disabled));

        var result = writer.apply(plan(List.of(feedVideo("AAAAAAAAAAA", "YouTube title")), Set.of()));

        assertThat(disabled.isActive()).isFalse();
        assertThat(result.added()).isZero();
        assertThat(result.duplicateOrExisting()).isEqualTo(1);
        verify(homeVideoRepository, never()).saveAll(anyList());
        verify(revalidationService, never()).revalidate("home-videos");
    }

    @Test
    void definitivelyRemovedVideoIsDisabledButNeverDeleted() {
        HomeVideoEntity removed = video("hv_removed", "AAAAAAAAAAA", 0, true);
        when(homeVideoRepository.findAllByOrderBySortOrderAsc()).thenReturn(List.of(removed));

        var result = writer.apply(plan(List.of(feedVideo("BBBBBBBBBBB", "Another")), Set.of("AAAAAAAAAAA")));

        assertThat(removed.isActive()).isFalse();
        assertThat(result.disabled()).isEqualTo(1);
        verify(homeVideoRepository, never()).delete(removed);
        verify(revalidationService).revalidate("home-videos");
    }

    private static SyncPlan plan(List<FeedVideo> videos, Set<String> unavailable) {
        return new SyncPlan(new ChannelFeed(CHANNEL_URL, CHANNEL_ID, videos), unavailable);
    }

    private static FeedVideo feedVideo(String id, String title) {
        return new FeedVideo(id, title, Instant.parse("2026-08-27T03:00:00Z"),
                "https://www.youtube.com/watch?v=" + id);
    }

    private static HomeVideoEntity video(String id, String youtubeId, int sortOrder, boolean active) {
        HomeVideoEntity entity = new HomeVideoEntity();
        entity.setId(id);
        entity.setYoutubeId(youtubeId);
        entity.setVideoUrl("https://www.youtube.com/watch?v=" + youtubeId);
        entity.setTitle("Existing title");
        entity.setSortOrder(sortOrder);
        entity.setActive(active);
        entity.setCreatedAt(Instant.now());
        entity.setUpdatedAt(Instant.now());
        return entity;
    }
}
