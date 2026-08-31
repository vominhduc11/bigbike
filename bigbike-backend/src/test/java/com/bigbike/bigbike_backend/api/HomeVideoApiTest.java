package com.bigbike.bigbike_backend.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bigbike.bigbike_backend.domain.catalog.ImageAsset;
import com.bigbike.bigbike_backend.persistence.entity.settings.SiteSettingEntity;
import com.bigbike.bigbike_backend.persistence.entity.video.HomeVideoEntity;
import com.bigbike.bigbike_backend.persistence.repository.settings.SiteSettingJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.video.HomeVideoJpaRepository;
import com.bigbike.bigbike_backend.service.video.YouTubeHomeVideoClient.ChannelFeed;
import com.bigbike.bigbike_backend.service.video.YouTubeHomeVideoClient.FeedVideo;
import com.bigbike.bigbike_backend.service.video.YouTubeHomeVideoSyncService.SyncPlan;
import com.bigbike.bigbike_backend.service.video.YouTubeHomeVideoSyncWriter;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
class HomeVideoApiTest {

    @Autowired
    private WebApplicationContext webApplicationContext;

    @Autowired
    private HomeVideoJpaRepository homeVideoJpaRepository;

    @Autowired
    private SiteSettingJpaRepository siteSettingJpaRepository;

    @Autowired
    private YouTubeHomeVideoSyncWriter syncWriter;

    private MockMvc mockMvc;

    @BeforeEach
    void setup() {
        homeVideoJpaRepository.deleteAll();
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
                .build();
    }

    @Test
    void createHomeVideo_acceptsSafeYoutubeUrl() throws Exception {
        mockMvc.perform(post("/api/v1/admin/home-videos")
                        .header("X-Admin-Permissions", "home_videos.write")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "title": "Demo video",
                                  "videoUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                                  "sortOrder": 0,
                                  "isActive": true
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.youtubeId").value("dQw4w9WgXcQ"));
    }

    @Test
    void createHomeVideo_acceptsInternalMediaUpload() throws Exception {
        mockMvc.perform(post("/api/v1/admin/home-videos")
                        .header("X-Admin-Permissions", "home_videos.write")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "title": "Uploaded video",
                                  "videoUrl": "/media-proxy/uploads/demo.mp4",
                                  "sortOrder": 1,
                                  "isActive": true
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.videoUrl").value("/media-proxy/uploads/demo.mp4"));
    }

    @Test
    void createHomeVideo_acceptsFullTikTokAndFacebookUrls() throws Exception {
        String[] videoUrls = {
                "https://www.tiktok.com/@bigbike/video/7251234567890123456",
                "https://www.facebook.com/BigBike/videos/1234567890"
        };
        for (int index = 0; index < videoUrls.length; index++) {
            String videoUrl = videoUrls[index];
            mockMvc.perform(post("/api/v1/admin/home-videos")
                            .header("X-Admin-Permissions", "home_videos.write")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {
                                      "title": "Legacy source",
                                      "videoUrl": "%s",
                                      "sortOrder": %d,
                                      "isActive": true
                                    }
                                    """.formatted(videoUrl, 2 + index)))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.data.videoUrl").value(videoUrl));
        }
    }

    @Test
    void createHomeVideo_rejectsUnsafeExternalUrl() throws Exception {
        mockMvc.perform(post("/api/v1/admin/home-videos")
                        .header("X-Admin-Permissions", "home_videos.write")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "title": "Unsafe video",
                                  "videoUrl": "https://evil.com/video.mp4",
                                  "sortOrder": 1,
                                  "isActive": true
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.details[0].field").value("videoUrl"));
    }

    @Test
    void createHomeVideo_rejectsDuplicateSortOrder() throws Exception {
        homeVideoJpaRepository.save(homeVideo("hv_dup_seed", 3, true));

        mockMvc.perform(post("/api/v1/admin/home-videos")
                        .header("X-Admin-Permissions", "home_videos.write")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "title": "Duplicate sort",
                                  "videoUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                                  "sortOrder": 3,
                                  "isActive": true
                                }
                                """))
                .andExpect(status().isConflict());
    }

    @Test
    void patchHomeVideo_rejectsDuplicateSortOrder() throws Exception {
        HomeVideoEntity first = homeVideo("hv_patch_first", 7, true);
        HomeVideoEntity second = homeVideo("hv_patch_second", 8, true);
        homeVideoJpaRepository.save(first);
        homeVideoJpaRepository.save(second);

        mockMvc.perform(patch("/api/v1/admin/home-videos/" + second.getId())
                        .header("X-Admin-Permissions", "home_videos.write")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"sortOrder\":7}"))
                .andExpect(status().isConflict());
    }

    @Test
    void publicHomeVideos_returnsOnlyActiveAndBuildsDerivedFields() throws Exception {
        HomeVideoEntity active = homeVideo("hv_public_active", 20, true);
        active.setYoutubeId("dQw4w9WgXcQ");
        active.setVideoUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
        HomeVideoEntity hidden = homeVideo("hv_public_hidden", 21, false);
        homeVideoJpaRepository.save(active);
        homeVideoJpaRepository.save(hidden);

        mockMvc.perform(get("/api/v1/home-videos"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].id").value("hv_public_active"))
                .andExpect(jsonPath("$.data[0].embedUrl")
                        .value("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0"))
                .andExpect(jsonPath("$.data[0].autoThumbnailUrl")
                        .value("https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg"));
    }

    @Test
    void publicHomeVideos_returnsOnlyTheFirstTenActiveRows() throws Exception {
        for (int index = 0; index < 12; index++) {
            homeVideoJpaRepository.save(homeVideo("hv_public_" + index, index, true));
        }

        mockMvc.perform(get("/api/v1/home-videos"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(10))
                .andExpect(jsonPath("$.data[0].id").value("hv_public_0"))
                .andExpect(jsonPath("$.data[9].id").value("hv_public_9"));
    }

    @Test
    void automaticSync_insertsNewVideoFirstWithoutBreakingUniqueSortOrder() {
        var setting = siteSettingJpaRepository.findBySettingKey("youtube_url").orElseGet(() -> {
            var created = new SiteSettingEntity();
            created.setSettingKey("youtube_url");
            created.setSettingGroup("contact");
            created.setPublic(true);
            created.setDescription("Official YouTube channel");
            return created;
        });
        setting.setSettingValue("https://www.youtube.com/@bigbike-shop");
        siteSettingJpaRepository.saveAndFlush(setting);

        HomeVideoEntity old = homeVideo("hv_existing", 0, true);
        homeVideoJpaRepository.saveAndFlush(old);
        FeedVideo latest = new FeedVideo(
                "AAAAAAAAAAA",
                "TEST CHỐNG NƯỚC",
                Instant.parse("2026-08-27T03:00:00Z"),
                "https://www.youtube.com/watch?v=AAAAAAAAAAA"
        );

        syncWriter.apply(new SyncPlan(
                new ChannelFeed(
                        "https://www.youtube.com/@bigbike-shop",
                        "UCabcdefghijklmnopqrstuv",
                        List.of(latest)
                ),
                Set.of()
        ));

        List<HomeVideoEntity> rows = homeVideoJpaRepository.findAllByOrderBySortOrderAsc();
        assertThat(rows).extracting(HomeVideoEntity::getId)
                .containsExactly("hv_yt_AAAAAAAAAAA", "hv_existing");
        assertThat(rows).extracting(HomeVideoEntity::getSortOrder).containsExactly(0, 1);
        assertThat(rows.get(0).getTitle()).isEqualTo("TEST CHỐNG NƯỚC");
        assertThat(rows.get(0).getTitleEn()).isNull();
        assertThat(rows.get(0).getThumbnail()).isNull();
    }

    @Test
    void tiktokHomeVideo_canBeReadAndPatchedWithFullVideoUrl() throws Exception {
        HomeVideoEntity legacy = homeVideo("hv_legacy_tiktok", 22, true);
        legacy.setVideoUrl("https://www.tiktok.com/@bigbike/video/7251234567890123456");
        legacy.setYoutubeId(null);
        homeVideoJpaRepository.save(legacy);

        mockMvc.perform(get("/api/v1/home-videos"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].videoUrl").value(legacy.getVideoUrl()))
                .andExpect(jsonPath("$.data[0].embedUrl").isNotEmpty());

        mockMvc.perform(patch("/api/v1/admin/home-videos/" + legacy.getId())
                        .header("X-Admin-Permissions", "home_videos.write")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"isActive\":false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.videoUrl").value(legacy.getVideoUrl()))
                .andExpect(jsonPath("$.data.isActive").value(false));

        mockMvc.perform(patch("/api/v1/admin/home-videos/" + legacy.getId())
                        .header("X-Admin-Permissions", "home_videos.write")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"videoUrl\":\"" + legacy.getVideoUrl() + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.videoUrl").value(legacy.getVideoUrl()));
    }

    @Test
    void reorderHomeVideos_rejectsDuplicateSortOrderInRequest() throws Exception {
        HomeVideoEntity first = homeVideo("hv_reorder_first", 30, true);
        HomeVideoEntity second = homeVideo("hv_reorder_second", 31, true);
        homeVideoJpaRepository.save(first);
        homeVideoJpaRepository.save(second);

        mockMvc.perform(post("/api/v1/admin/home-videos/reorder")
                        .header("X-Admin-Permissions", "home_videos.write")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "items": [
                                    { "id": "hv_reorder_first", "sortOrder": 0 },
                                    { "id": "hv_reorder_second", "sortOrder": 0 }
                                  ]
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.details[0].field").value("sortOrder"));
    }

    @Test
    void createHomeVideo_withoutWritePermission_returnsForbidden() throws Exception {
        mockMvc.perform(post("/api/v1/admin/home-videos")
                        .header("X-Admin-Permissions", "home_videos.read")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "title": "No permission",
                                  "videoUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                                  "sortOrder": 40,
                                  "isActive": true
                                }
                                """))
                .andExpect(status().isForbidden());
    }

    private static HomeVideoEntity homeVideo(String id, int sortOrder, boolean isActive) {
        HomeVideoEntity entity = new HomeVideoEntity();
        entity.setId(id);
        entity.setSortOrder(sortOrder);
        entity.setTitle("Video " + id);
        entity.setVideoUrl("/media-proxy/uploads/" + UUID.randomUUID() + ".mp4");
        entity.setYoutubeId(null);
        entity.setThumbnail(new ImageAsset(null, "/media/thumb-" + id + ".jpg", "Thumb", 1280, 720, "image/jpeg"));
        entity.setActive(isActive);
        entity.setCreatedAt(Instant.now());
        entity.setUpdatedAt(Instant.now());
        return entity;
    }
}
