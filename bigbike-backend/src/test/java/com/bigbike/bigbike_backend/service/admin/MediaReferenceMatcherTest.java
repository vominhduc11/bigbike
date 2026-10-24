package com.bigbike.bigbike_backend.service.admin;

import static org.assertj.core.api.Assertions.assertThat;

import com.bigbike.bigbike_backend.persistence.entity.media.MediaEntity;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class MediaReferenceMatcherTest {

    @Test
    void matchesRelativeAndAbsoluteUrlsHtmlJsonAndExactMediaIds() {
        MediaEntity image = media("uploads/shared/ao-phuot.jpg");
        List<String> blobs = List.of(
                "/media/" + image.getFilePath(),
                "https://media.bigbike.vn/bigbike-media/" + image.getFilePath(),
                "<img src=\"/media/" + image.getFilePath() + "\">",
                "[{\"image\":{\"url\":\"/media/" + image.getFilePath() + "\"}}]",
                image.getId().toString(),
                "<p>" + image.getId() + "</p>");

        MediaReferenceMatcher matcher = match(List.of(image), blobs);

        assertThat(matcher.usageCounts()).containsEntry(image.getId(), 5);
        assertThat(matcher.usedIds()).containsExactly(image.getId());
    }

    @Test
    void countsEachBlobOnceButKeepsSeparateFieldsAndDuplicatePaths() {
        MediaEntity first = media("uploads/shared/photo.jpg");
        MediaEntity second = media(first.getFilePath());
        MediaEntity missing = media("uploads/shared/missing.jpg");
        MediaReferenceMatcher matcher = match(List.of(first, second, missing), List.of(
                first.getFilePath() + " " + first.getFilePath(),
                first.getFilePath()));

        assertThat(matcher.usageCounts()).containsEntry(first.getId(), 2)
                .containsEntry(second.getId(), 2).containsEntry(missing.getId(), 0);
        assertThat(matcher.usedIds()).containsExactlyInAnyOrder(first.getId(), second.getId());
    }

    @Test
    void handlesOverlappingPrefixesAndSuffixesWithoutSkippingMatches() {
        List<MediaEntity> candidates = List.of(
                media("uploads/aa/photo.jpg"), media("aa/photo.jpg"), media("photo.jpg"),
                media("photo.jpg.webp"), media("aaaa"), media("aaa"));
        assertSameAsLiteralSearch(candidates, List.of(
                "uploads/aa/photo.jpg.webp", "aaaaa", "aa/photo.jpg uploads/aa/photo.jpg"));
    }

    @Test
    void treatsUnicodeAndSqlOrRegexMetacharactersAsLiteralCharacters() {
        MediaEntity image = media("uploads/x/áo_[50%]+(1).jpg");
        MediaReferenceMatcher matcher = match(List.of(image), List.of(
                "<img src='/media/" + image.getFilePath() + "'>",
                "uploads/x/áo_A50anything+(1).jpg",
                "uploads/x/ao_[50%]+(1).jpg"));
        assertThat(matcher.usageCounts()).containsEntry(image.getId(), 1);
    }

    @Test
    void doesNotDoubleCountWhenAPathAlsoEqualsItsMediaId() {
        MediaEntity image = media("unused");
        image.setFilePath(image.getId().toString());
        assertThat(match(List.of(image), List.of(image.getFilePath())).usageCounts())
                .containsEntry(image.getId(), 1);
    }

    @Test
    void skipsBlankPathsNullBlobsAndEmptyInputs() {
        MediaEntity valid = media("uploads/valid.jpg");
        List<MediaEntity> candidates = List.of(media(null), media(""), media(" \t"), valid);
        MediaReferenceMatcher matcher = match(candidates, Arrays.asList(null, "", valid.getFilePath()));
        assertThat(matcher.usageCounts()).containsOnlyKeys(valid.getId());
        assertThat(matcher.usedIds()).containsExactly(valid.getId());
        assertThat(new MediaReferenceMatcher(List.of()).isEmpty()).isTrue();
        assertThat(new MediaReferenceMatcher(candidates.subList(0, 3)).isEmpty()).isTrue();
    }

    @Test
    void matchesThePreviousLiteralSearchAcrossManySharedPrefixPaths() {
        Random random = new Random(20261013);
        List<MediaEntity> candidates = new ArrayList<>();
        for (int i = 0; i < 300; i++) candidates.add(media("uploads/folder-" + i % 7 + "/ảnh_" + i + ".jpg"));
        List<String> blobs = new ArrayList<>();
        for (int i = 0; i < 200; i++) {
            StringBuilder blob = new StringBuilder("<p>Ảnh sản phẩm</p>");
            for (int j = 0; j < 6; j++) {
                blob.append(" /media/").append(candidates.get(random.nextInt(candidates.size())).getFilePath());
            }
            blobs.add(blob.toString());
        }
        blobs.add(candidates.get(0).getId().toString());
        assertSameAsLiteralSearch(candidates, blobs);
    }

    private static void assertSameAsLiteralSearch(List<MediaEntity> candidates, List<String> blobs) {
        Map<UUID, Integer> expected = new HashMap<>();
        for (MediaEntity candidate : candidates) {
            int count = 0;
            for (String blob : blobs) {
                if (blob.contains(candidate.getFilePath()) || blob.equals(candidate.getId().toString())) count++;
            }
            expected.put(candidate.getId(), count);
        }
        MediaReferenceMatcher matcher = match(candidates, blobs);
        assertThat(matcher.usageCounts()).isEqualTo(expected);
        assertThat(matcher.usedIds()).containsExactlyInAnyOrderElementsOf(
                expected.entrySet().stream().filter(entry -> entry.getValue() > 0).map(Map.Entry::getKey).toList());
    }

    private static MediaReferenceMatcher match(List<MediaEntity> candidates, List<String> blobs) {
        MediaReferenceMatcher matcher = new MediaReferenceMatcher(candidates);
        blobs.forEach(matcher::accept);
        return matcher;
    }

    private static MediaEntity media(String path) {
        MediaEntity media = new MediaEntity();
        media.setId(UUID.randomUUID());
        media.setFilePath(path);
        return media;
    }
}
