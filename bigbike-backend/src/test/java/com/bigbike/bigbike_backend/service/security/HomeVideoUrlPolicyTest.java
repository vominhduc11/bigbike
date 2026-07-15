package com.bigbike.bigbike_backend.service.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class HomeVideoUrlPolicyTest {

    private SafeMediaAssetUrlPolicy safeMediaAssetUrlPolicy;
    private HomeVideoUrlPolicy policy;

    @BeforeEach
    void setUp() {
        safeMediaAssetUrlPolicy = mock(SafeMediaAssetUrlPolicy.class);
        policy = new HomeVideoUrlPolicy(safeMediaAssetUrlPolicy);
    }

    @Test
    void allowsApprovedFullUrlForMatchingProvider() {
        assertThat(policy.isAllowedForProvider(
                "youtube", "https://www.youtube.com/watch?v=dQw4w9WgXcQ")).isTrue();
        assertThat(policy.isAllowedForProvider(
                "tiktok", "https://www.tiktok.com/@bigbike/video/7251234567890123456")).isTrue();
        assertThat(policy.isAllowedForProvider(
                "facebook", "https://www.facebook.com/BigBike/videos/1234567890")).isTrue();

        when(safeMediaAssetUrlPolicy.isAllowedVideoMediaUrl("/media/product-review.mp4")).thenReturn(true);
        assertThat(policy.isAllowedForProvider("upload", "/media/product-review.mp4")).isTrue();
    }

    @Test
    void rejectsShortenedTikTokAndFacebookLinks() {
        assertThat(policy.isAllowedForProvider("tiktok", "https://vt.tiktok.com/ZSabcDEF/")).isFalse();
        assertThat(policy.isAllowedForProvider("tiktok", "https://vm.tiktok.com/ZSabcDEF/")).isFalse();
        assertThat(policy.isAllowedForProvider("facebook", "https://fb.watch/abcdEF123/")).isFalse();
    }

    @Test
    void rejectsProviderMismatchVimeoAndExternalUpload() {
        assertThat(policy.isAllowedForProvider(
                "youtube", "https://www.facebook.com/BigBike/videos/1234567890")).isFalse();
        assertThat(policy.isAllowedForProvider("facebook", "https://vimeo.com/123456")).isFalse();
        assertThat(policy.isAllowedForProvider("upload", "https://example.com/video.mp4")).isFalse();
    }
}
