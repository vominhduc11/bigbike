package com.bigbike.bigbike_backend.service.video;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.bigbike.bigbike_backend.service.security.YouTubeChannelUrlPolicy;
import com.bigbike.bigbike_backend.service.video.YouTubeHomeVideoClient.Availability;
import com.bigbike.bigbike_backend.service.video.YouTubeHomeVideoClient.FetchResult;
import com.bigbike.bigbike_backend.service.video.YouTubeHomeVideoClient.HttpFetcher;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

class YouTubeHomeVideoClientTest {

    private static final String CHANNEL_ID = "UCabcdefghijklmnopqrstuv";
    private static final String OTHER_CHANNEL_ID = "UCzzzzzzzzzzzzzzzzzzzzzz";
    private static final String CHANNEL_URL = "https://www.youtube.com/@bigbike-shop";
    private static final String FEED_URL = "https://www.youtube.com/feeds/videos.xml?channel_id=" + CHANNEL_ID;

    @Test
    void discoversOfficialFeedAndKeepsExactYoutubeTitle() {
        StubFetcher fetcher = new StubFetcher();
        fetcher.put(CHANNEL_URL, 200, """
                <html><head><link rel="alternate" type="application/rss+xml"
                  href="https://www.youtube.com/feeds/videos.xml?channel_id=%s"></head></html>
                """.formatted(CHANNEL_ID));
        fetcher.put(FEED_URL, 200, feedXml(CHANNEL_ID, CHANNEL_ID,
                "AAAAAAAAAAA", "TEST  CHỐNG NƯỚC", "2026-08-27T03:00:00Z",
                "BBBBBBBBBBB", "GẮN ĐỒ CHO KHÁCH NHƯNG ĐẦY DRAMMA", "2026-08-24T03:00:00Z"));

        YouTubeHomeVideoClient client = client(fetcher);
        var feed = client.fetchLatest("https://youtube.com/@bigbike-shop/");

        assertThat(feed.normalizedChannelUrl()).isEqualTo(CHANNEL_URL);
        assertThat(feed.channelId()).isEqualTo(CHANNEL_ID);
        assertThat(feed.videos()).extracting(YouTubeHomeVideoClient.FeedVideo::title)
                .containsExactly("TEST  CHỐNG NƯỚC", "GẮN ĐỒ CHO KHÁCH NHƯNG ĐẦY DRAMMA");
    }

    @Test
    void acceptsYoutubeFeedRootChannelIdWithoutUcPrefix() {
        StubFetcher fetcher = new StubFetcher();
        fetcher.put(FEED_URL, 200, feedXml(CHANNEL_ID.substring(2), CHANNEL_ID,
                "AAAAAAAAAAA", "Video mới nhất", "2026-08-27T03:00:00Z",
                "BBBBBBBBBBB", "Video kế tiếp", "2026-08-24T03:00:00Z"));

        var feed = client(fetcher).fetchLatest(
                "https://www.youtube.com/channel/" + CHANNEL_ID);

        assertThat(feed.channelId()).isEqualTo(CHANNEL_ID);
        assertThat(feed.videos()).extracting(YouTubeHomeVideoClient.FeedVideo::videoId)
                .containsExactly("AAAAAAAAAAA", "BBBBBBBBBBB");
    }

    @Test
    void retriesTransientYoutubeFeedNodesBeforeParsingSuccessfulResponse() {
        AtomicInteger calls = new AtomicInteger();
        String validFeed = feedXml(CHANNEL_ID.substring(2), CHANNEL_ID,
                "AAAAAAAAAAA", "Video mới nhất", "2026-08-27T03:00:00Z",
                "BBBBBBBBBBB", "Video kế tiếp", "2026-08-24T03:00:00Z");
        HttpFetcher fetcher = (url, accept, maxBytes) -> switch (calls.getAndIncrement()) {
            case 0 -> new FetchResult(404, "");
            case 1 -> new FetchResult(500, "");
            default -> new FetchResult(200, validFeed);
        };

        var feed = client(fetcher).fetchLatest(
                "https://www.youtube.com/channel/" + CHANNEL_ID);

        assertThat(calls).hasValue(3);
        assertThat(feed.videos()).extracting(YouTubeHomeVideoClient.FeedVideo::videoId)
                .containsExactly("AAAAAAAAAAA", "BBBBBBBBBBB");
    }

    @Test
    void rejectsFeedFromAnotherChannelWithoutReturningPartialData() {
        StubFetcher fetcher = new StubFetcher();
        fetcher.put(FEED_URL, 200, feedXml(OTHER_CHANNEL_ID, OTHER_CHANNEL_ID,
                "AAAAAAAAAAA", "Video", "2026-08-27T03:00:00Z",
                "BBBBBBBBBBB", "Video 2", "2026-08-24T03:00:00Z"));

        assertThatThrownBy(() -> client(fetcher).fetchLatest(
                "https://www.youtube.com/channel/" + CHANNEL_ID))
                .isInstanceOf(YouTubeHomeVideoClient.YouTubeFetchException.class);
    }

    @Test
    void rejectsAnotherChannelsSuffixEvenWhenEntriesClaimExpectedChannel() {
        StubFetcher fetcher = new StubFetcher();
        fetcher.put(FEED_URL, 200, feedXml(OTHER_CHANNEL_ID.substring(2), CHANNEL_ID,
                "AAAAAAAAAAA", "Video", "2026-08-27T03:00:00Z",
                "BBBBBBBBBBB", "Video 2", "2026-08-24T03:00:00Z"));

        assertThatThrownBy(() -> client(fetcher).fetchLatest(
                "https://www.youtube.com/channel/" + CHANNEL_ID))
                .isInstanceOf(YouTubeHomeVideoClient.YouTubeFetchException.class);
    }

    @Test
    void rejectsFeedWithoutItsOwnChannelId() {
        StubFetcher fetcher = new StubFetcher();
        fetcher.put(FEED_URL, 200, feedXml("", CHANNEL_ID,
                "AAAAAAAAAAA", "Video", "2026-08-27T03:00:00Z",
                "BBBBBBBBBBB", "Video 2", "2026-08-24T03:00:00Z"));

        assertThatThrownBy(() -> client(fetcher).fetchLatest(
                "https://www.youtube.com/channel/" + CHANNEL_ID))
                .isInstanceOf(YouTubeHomeVideoClient.YouTubeFetchException.class);
    }

    @Test
    void availabilityDistinguishesRemovedFromTransientFailure() {
        StubFetcher removed = new StubFetcher();
        removed.defaultResult = new FetchResult(404, "");
        assertThat(client(removed).checkAvailability("AAAAAAAAAAA"))
                .isEqualTo(Availability.UNAVAILABLE);

        StubFetcher available = new StubFetcher();
        available.defaultResult = new FetchResult(200, "{\"title\":\"Video\",\"provider_name\":\"YouTube\"}");
        assertThat(client(available).checkAvailability("AAAAAAAAAAA"))
                .isEqualTo(Availability.AVAILABLE);

        StubFetcher transientFailure = new StubFetcher();
        transientFailure.defaultResult = new FetchResult(503, "");
        assertThatThrownBy(() -> client(transientFailure).checkAvailability("AAAAAAAAAAA"))
                .isInstanceOf(YouTubeHomeVideoClient.YouTubeFetchException.class);
    }

    private static YouTubeHomeVideoClient client(HttpFetcher fetcher) {
        return new YouTubeHomeVideoClient(
                new YouTubeChannelUrlPolicy(),
                new ObjectMapper(),
                fetcher
        );
    }

    private static String feedXml(
            String feedChannelId, String entryChannelId,
            String firstId, String firstTitle, String firstPublished,
            String secondId, String secondTitle, String secondPublished
    ) {
        return """
                <?xml version="1.0" encoding="UTF-8"?>
                <feed xmlns:yt="http://www.youtube.com/xml/schemas/2015">
                  <yt:channelId>%s</yt:channelId>
                  <entry>
                    <yt:videoId>%s</yt:videoId><yt:channelId>%s</yt:channelId>
                    <title>%s</title><published>%s</published>
                    <link rel="alternate" href="https://www.youtube.com/watch?v=%s" />
                  </entry>
                  <entry>
                    <yt:videoId>%s</yt:videoId><yt:channelId>%s</yt:channelId>
                    <title>%s</title><published>%s</published>
                    <link rel="alternate" href="https://www.youtube.com/watch?v=%s" />
                  </entry>
                </feed>
                """.formatted(
                feedChannelId,
                firstId, entryChannelId, firstTitle, firstPublished, firstId,
                secondId, entryChannelId, secondTitle, secondPublished, secondId
        );
    }

    private static final class StubFetcher implements HttpFetcher {
        private final Map<String, FetchResult> responses = new HashMap<>();
        private FetchResult defaultResult;

        private void put(String url, int status, String body) {
            responses.put(url, new FetchResult(status, body));
        }

        @Override
        public FetchResult get(String url, String accept, long maxBytes) {
            FetchResult result = responses.get(url);
            if (result != null) return result;
            if (defaultResult != null) return defaultResult;
            throw new YouTubeHomeVideoClient.YouTubeFetchException("Unexpected URL in test: " + url);
        }
    }
}
