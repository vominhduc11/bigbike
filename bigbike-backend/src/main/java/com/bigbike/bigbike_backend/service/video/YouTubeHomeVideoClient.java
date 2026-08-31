package com.bigbike.bigbike_backend.service.video;

import com.bigbike.bigbike_backend.service.security.YouTubeChannelUrlPolicy;
import com.bigbike.bigbike_backend.service.security.YouTubeChannelUrlPolicy.ChannelReference;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.ResponseBody;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.parser.Parser;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** Reads the official YouTube channel feed and public oEmbed availability metadata. */
@Component
public class YouTubeHomeVideoClient {

    static final int MAX_FEED_ITEMS = 15;
    private static final long MAX_CHANNEL_PAGE_BYTES = 5L * 1024 * 1024;
    private static final long MAX_FEED_BYTES = 512L * 1024;
    private static final long MAX_OEMBED_BYTES = 64L * 1024;
    private static final String FEED_BASE = "https://www.youtube.com/feeds/videos.xml?channel_id=";
    private static final String OEMBED_BASE = "https://www.youtube.com/oembed?format=json&url=";

    private final YouTubeChannelUrlPolicy channelUrlPolicy;
    private final ObjectMapper objectMapper;
    private final HttpFetcher httpFetcher;

    @Autowired
    public YouTubeHomeVideoClient(
            YouTubeChannelUrlPolicy channelUrlPolicy,
            ObjectMapper objectMapper
    ) {
        this(channelUrlPolicy, objectMapper, new OkHttpFetcher(defaultHttpClient()));
    }

    YouTubeHomeVideoClient(
            YouTubeChannelUrlPolicy channelUrlPolicy,
            ObjectMapper objectMapper,
            HttpFetcher httpFetcher
    ) {
        this.channelUrlPolicy = channelUrlPolicy;
        this.objectMapper = objectMapper;
        this.httpFetcher = httpFetcher;
    }

    public ChannelFeed fetchLatest(String configuredChannelUrl) {
        ChannelReference reference = channelUrlPolicy.parse(configuredChannelUrl)
                .orElseThrow(() -> new YouTubeFetchException("youtube_url is missing or invalid."));

        FeedReference feedReference = reference.hasChannelId()
                ? new FeedReference(FEED_BASE + reference.channelId(), reference.channelId())
                : discoverFeed(reference.normalizedUrl());

        FetchResult response = httpFetcher.get(
                feedReference.feedUrl(),
                "application/atom+xml,application/xml;q=0.9,text/xml;q=0.8",
                MAX_FEED_BYTES
        );
        if (response.status() != 200 || response.body().isBlank()) {
            throw new YouTubeFetchException("YouTube feed did not return a valid success response.");
        }

        return parseFeed(reference.normalizedUrl(), feedReference.channelId(), response.body());
    }

    public Availability checkAvailability(String videoId) {
        if (!YouTubeUrlParser.isValidVideoId(videoId)) {
            throw new YouTubeFetchException("Invalid YouTube video id.");
        }

        String watchUrl = "https://www.youtube.com/watch?v=" + videoId;
        String url = OEMBED_BASE + java.net.URLEncoder.encode(watchUrl, StandardCharsets.UTF_8);
        FetchResult response = httpFetcher.get(url, "application/json", MAX_OEMBED_BYTES);
        if (response.status() == 401 || response.status() == 404 || response.status() == 410) {
            return Availability.UNAVAILABLE;
        }
        if (response.status() != 200 || response.body().isBlank()) {
            throw new YouTubeFetchException("YouTube availability response is uncertain.");
        }

        try {
            JsonNode root = objectMapper.readTree(response.body());
            String title = root.path("title").asString("").trim();
            String provider = root.path("provider_name").asString("").trim();
            if (title.isBlank() || !"youtube".equals(provider.toLowerCase(Locale.ROOT))) {
                throw new YouTubeFetchException("YouTube availability payload is malformed.");
            }
            return Availability.AVAILABLE;
        } catch (JacksonException exception) {
            throw new YouTubeFetchException("YouTube availability payload is malformed.", exception);
        }
    }

    private FeedReference discoverFeed(String normalizedChannelUrl) {
        FetchResult response = httpFetcher.get(
                normalizedChannelUrl,
                "text/html,application/xhtml+xml;q=0.9",
                MAX_CHANNEL_PAGE_BYTES
        );
        if (response.status() != 200 || response.body().isBlank()) {
            throw new YouTubeFetchException("YouTube channel page did not return a valid success response.");
        }

        Document document = Jsoup.parse(response.body(), normalizedChannelUrl);
        for (Element link : document.select("link[rel=alternate][type=application/rss+xml]")) {
            String href = link.absUrl("href");
            String channelId = channelIdFromFeedUrl(href);
            if (channelId != null) {
                return new FeedReference(FEED_BASE + channelId, channelId);
            }
        }
        throw new YouTubeFetchException("YouTube channel page has no valid RSS feed link.");
    }

    private ChannelFeed parseFeed(String normalizedChannelUrl, String expectedChannelId, String xml) {
        Document document = Jsoup.parse(xml, "", Parser.xmlParser());
        Element feed = document.getElementsByTag("feed").first();
        if (feed == null) {
            throw new YouTubeFetchException("YouTube feed root is missing.");
        }

        String feedChannelId = firstText(feed, "yt:channelId");
        if (!expectedChannelId.equals(feedChannelId)) {
            throw new YouTubeFetchException("YouTube feed channel does not match the configured channel.");
        }

        List<FeedVideo> videos = new ArrayList<>();
        Set<String> seenIds = new HashSet<>();
        for (Element entry : feed.getElementsByTag("entry")) {
            String videoId = firstText(entry, "yt:videoId");
            String channelId = firstText(entry, "yt:channelId");
            String title = firstText(entry, "title");
            String publishedRaw = firstText(entry, "published");
            String videoUrl = alternateLink(entry);

            if (!YouTubeUrlParser.isValidVideoId(videoId)
                    || !expectedChannelId.equals(channelId)
                    || title == null || title.isBlank() || title.trim().length() > 255
                    || !videoId.equals(YouTubeUrlParser.extractId(videoUrl))
                    || !seenIds.add(videoId)) {
                throw new YouTubeFetchException("YouTube feed contains an invalid or duplicate entry.");
            }

            try {
                videos.add(new FeedVideo(
                        videoId,
                        title.trim(),
                        Instant.parse(publishedRaw),
                        "https://www.youtube.com/watch?v=" + videoId
                ));
            } catch (DateTimeParseException | NullPointerException exception) {
                throw new YouTubeFetchException("YouTube feed contains an invalid published date.", exception);
            }
        }

        if (videos.isEmpty()) {
            throw new YouTubeFetchException("YouTube feed is empty.");
        }

        List<FeedVideo> latest = videos.stream()
                .sorted(Comparator.comparing(FeedVideo::publishedAt).reversed())
                .limit(MAX_FEED_ITEMS)
                .toList();
        return new ChannelFeed(normalizedChannelUrl, expectedChannelId, latest);
    }

    private static String alternateLink(Element entry) {
        for (Element link : entry.getElementsByTag("link")) {
            if ("alternate".equals(link.attr("rel"))) {
                return link.attr("href");
            }
        }
        return null;
    }

    private static String firstText(Element parent, String tagName) {
        Element element = parent.getElementsByTag(tagName).first();
        return element == null ? null : element.wholeText().trim();
    }

    private static String channelIdFromFeedUrl(String rawUrl) {
        if (rawUrl == null || rawUrl.isBlank()) {
            return null;
        }
        try {
            URI uri = new URI(rawUrl.trim()).normalize();
            String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase(Locale.ROOT);
            if (!"https".equalsIgnoreCase(uri.getScheme())
                    || !("youtube.com".equals(host) || "www.youtube.com".equals(host))
                    || !"/feeds/videos.xml".equals(uri.getPath())) {
                return null;
            }

            String channelId = null;
            for (String part : (uri.getRawQuery() == null ? "" : uri.getRawQuery()).split("&")) {
                int separator = part.indexOf('=');
                String key = separator < 0 ? part : part.substring(0, separator);
                String value = separator < 0 ? "" : part.substring(separator + 1);
                if (!"channel_id".equals(URLDecoder.decode(key, StandardCharsets.UTF_8))) {
                    return null;
                }
                if (channelId != null) {
                    return null;
                }
                channelId = URLDecoder.decode(value, StandardCharsets.UTF_8);
            }
            return YouTubeChannelUrlPolicy.isValidChannelId(channelId) ? channelId : null;
        } catch (URISyntaxException | IllegalArgumentException exception) {
            return null;
        }
    }

    private static OkHttpClient defaultHttpClient() {
        return new OkHttpClient.Builder()
                .followRedirects(false)
                .followSslRedirects(false)
                .connectTimeout(5, TimeUnit.SECONDS)
                .readTimeout(10, TimeUnit.SECONDS)
                .writeTimeout(5, TimeUnit.SECONDS)
                .callTimeout(15, TimeUnit.SECONDS)
                .build();
    }

    public enum Availability {
        AVAILABLE,
        UNAVAILABLE
    }

    public record FeedVideo(String videoId, String title, Instant publishedAt, String videoUrl) {}

    public record ChannelFeed(String normalizedChannelUrl, String channelId, List<FeedVideo> videos) {
        public ChannelFeed {
            videos = List.copyOf(videos);
        }
    }

    private record FeedReference(String feedUrl, String channelId) {}

    interface HttpFetcher {
        FetchResult get(String url, String accept, long maxBytes);
    }

    record FetchResult(int status, String body) {}

    static final class YouTubeFetchException extends RuntimeException {
        YouTubeFetchException(String message) {
            super(message);
        }

        YouTubeFetchException(String message, Throwable cause) {
            super(message, cause);
        }
    }

    private static final class OkHttpFetcher implements HttpFetcher {
        private final OkHttpClient client;

        private OkHttpFetcher(OkHttpClient client) {
            this.client = client;
        }

        @Override
        public FetchResult get(String url, String accept, long maxBytes) {
            Request request = new Request.Builder()
                    .url(url)
                    .header("Accept", accept)
                    .header("User-Agent", "BigBike-HomeVideoSync/1.0")
                    .get()
                    .build();

            try (Response response = client.newCall(request).execute()) {
                ResponseBody body = response.body();
                if (body == null) {
                    return new FetchResult(response.code(), "");
                }
                if (body.contentLength() > maxBytes) {
                    throw new YouTubeFetchException("YouTube response exceeded the safe size limit.");
                }
                return new FetchResult(response.code(), readLimited(body.byteStream(), maxBytes));
            } catch (IOException exception) {
                throw new YouTubeFetchException("YouTube request failed.", exception);
            }
        }

        private static String readLimited(InputStream input, long maxBytes) throws IOException {
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            byte[] buffer = new byte[8_192];
            long total = 0;
            int read;
            while ((read = input.read(buffer)) != -1) {
                total += read;
                if (total > maxBytes) {
                    throw new YouTubeFetchException("YouTube response exceeded the safe size limit.");
                }
                output.write(buffer, 0, read);
            }
            return output.toString(StandardCharsets.UTF_8);
        }
    }
}
