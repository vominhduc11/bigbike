package com.bigbike.bigbike_backend.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bigbike.bigbike_backend.domain.catalog.ImageAsset;
import com.bigbike.bigbike_backend.persistence.entity.video.HomeVideoEntity;
import com.bigbike.bigbike_backend.persistence.repository.video.HomeVideoJpaRepository;
import java.time.Instant;
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
