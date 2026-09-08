package com.bigbike.bigbike_backend.service.chat;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import org.apache.tika.Tika;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;
import tools.jackson.databind.ObjectMapper;

/** Decode the entire local file, retain sound, strip metadata; never truncate an overlong upload. */
@Component
@lombok.extern.slf4j.Slf4j
public class ChatVideoNormalizer {
    public static final long MAX_UPLOAD_BYTES = 40L * 1024 * 1024;
    static final int MAX_INLINE_BYTES = 19 * 1024 * 1024;
    private static final Set<String> MIME_TYPES = Set.of("video/mp4", "video/quicktime", "video/webm");
    private final String ffmpeg;
    private final String ffprobe;
    private final ObjectMapper mapper;
    private volatile Boolean available;

    public ChatVideoNormalizer(@Value("${bigbike.chat.video.ffmpeg:ffmpeg}") String ffmpeg,
            @Value("${bigbike.chat.video.ffprobe:ffprobe}") String ffprobe, ObjectMapper mapper) {
        this.ffmpeg = ffmpeg;
        this.ffprobe = ffprobe;
        this.mapper = mapper;
    }

    public boolean isAvailable() {
        if (available != null) return available;
        synchronized (this) {
            if (available == null) available = executable(ffmpeg) && executable(ffprobe);
        }
        return available;
    }

    private static boolean executable(String binary) {
        Process process = null;
        try {
            process = new ProcessBuilder(binary, "-version")
                    .redirectError(ProcessBuilder.Redirect.DISCARD)
                    .redirectOutput(ProcessBuilder.Redirect.DISCARD).start();
            return process.waitFor(2, TimeUnit.SECONDS) && process.exitValue() == 0;
        } catch (Exception failure) {
            if (failure instanceof InterruptedException) Thread.currentThread().interrupt();
            return false;
        } finally {
            if (process != null && process.isAlive()) process.destroyForcibly();
        }
    }

    public Normalized normalize(MultipartFile upload, String lang) {
        if (upload == null || upload.isEmpty()) throw ChatVideoErrors.invalid("CHAT_VIDEO_INVALID", lang);
        if (upload.getSize() > MAX_UPLOAD_BYTES) throw ChatVideoErrors.invalid("CHAT_VIDEO_TOO_LARGE", lang);
        if (!isAvailable()) throw ChatVideoErrors.invalid("CHAT_VIDEO_UNAVAILABLE", lang);
        Path temporary = null;
        try {
            ChatTurnBudget.checkTime();
            temporary = Files.createTempDirectory("bigbike-chat-video-");
            Path source = temporary.resolve("received.upload");
            try (var input = upload.getInputStream(); var output = Files.newOutputStream(source)) {
                byte[] buffer = new byte[64 * 1024];
                long copied = 0;
                for (int read; (read = input.read(buffer)) >= 0;) {
                    ChatTurnBudget.checkTime();
                    copied += read;
                    if (copied > MAX_UPLOAD_BYTES) throw ChatVideoErrors.invalid("CHAT_VIDEO_TOO_LARGE", lang);
                    output.write(buffer, 0, read);
                }
            }
            String detected;
            try (var input = Files.newInputStream(source)) { detected = new Tika().detect(input); }
            if ("application/x-matroska".equals(detected) && webmHeader(source)) detected = "video/webm";
            String declared = upload.getContentType();
            boolean isoContainer = Set.of("video/mp4", "video/quicktime").contains(detected)
                    && Set.of("video/mp4", "video/quicktime").contains(declared == null ? "" : declared);
            if (!MIME_TYPES.contains(detected)
                    || MIME_TYPES.contains(declared == null ? "" : declared) && !detected.equals(declared) && !isoContainer) {
                throw ChatVideoErrors.invalid("CHAT_VIDEO_UNSUPPORTED_TYPE", lang);
            }
            Probe before = probe(source, temporary, lang);
            if (!Double.isFinite(before.duration()) || before.duration() <= 0 || !before.hasVideo()) {
                throw ChatVideoErrors.invalid("CHAT_VIDEO_INVALID", lang);
            }
            if (before.duration() > 15) throw ChatVideoErrors.invalid("CHAT_VIDEO_TOO_LONG", lang);
            Path normalized = temporary.resolve("clean.mp4");
            run(List.of(ffmpeg, "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
                    "-xerror", "-threads", "2", "-protocol_whitelist", "file,pipe", "-i", source.toString(),
                    "-map", "0:v:0", "-map", "0:a:0?", "-map_metadata", "-1", "-map_chapters", "-1",
                    "-vf", "scale=w='min(960,iw)':h='min(960,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2,fps=30",
                    "-c:v", "libx264", "-threads", "2", "-preset", "veryfast", "-crf", "25",
                    "-maxrate", "2500k", "-bufsize", "5000k", "-pix_fmt", "yuv420p",
                    "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart",
                    "-fs", Integer.toString(MAX_INLINE_BYTES), normalized.toString()), temporary, null, lang);
            Probe after = probe(normalized, temporary, lang);
            if (!after.hasVideo() || after.duration() <= 0 || after.duration() > 15
                    || after.duration() + 0.15 < before.duration()
                    || before.hasAudio() != after.hasAudio()
                    || Files.size(normalized) >= MAX_INLINE_BYTES) {
                throw ChatVideoErrors.invalid("CHAT_VIDEO_INVALID", lang);
            }
            ChatTurnBudget.checkTime();
            return new Normalized(Files.readAllBytes(normalized), after.duration(), after.hasAudio());
        } catch (com.bigbike.bigbike_backend.api.error.ValidationException | ChatTurnBudget.Expired failure) {
            throw failure;
        } catch (Exception failure) {
            throw ChatVideoErrors.invalid("CHAT_VIDEO_INVALID", lang);
        } finally {
            deleteTemporary(temporary);
        }
    }

    /** Frames only rank local catalog similarities; the provider always receives the whole video. */
    List<byte[]> comparisonFrames(byte[] video, double duration, String lang) {
        Path temporary = null;
        try {
            temporary = Files.createTempDirectory("bigbike-chat-video-frames-");
            Path source = temporary.resolve("clean.mp4");
            Files.write(source, video);
            List<byte[]> frames = new ArrayList<>();
            for (double fraction : new double[]{0, .33, .66, .98}) {
                Path frame = temporary.resolve("frame.jpg");
                run(List.of(ffmpeg, "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
                        "-threads", "2", "-protocol_whitelist", "file,pipe", "-ss",
                        String.format(java.util.Locale.ROOT, "%.3f", duration * fraction), "-i", source.toString(),
                        "-frames:v", "1", "-vf", "scale=360:-2", "-threads", "2", frame.toString()),
                        temporary, null, lang);
                if (Files.exists(frame) && Files.size(frame) < 1024 * 1024) frames.add(Files.readAllBytes(frame));
                Files.deleteIfExists(frame);
            }
            return List.copyOf(frames);
        } catch (ChatTurnBudget.Expired failure) {
            throw failure;
        } catch (Exception failure) {
            return List.of();
        } finally { deleteTemporary(temporary); }
    }

    private static boolean webmHeader(Path source) throws java.io.IOException {
        try (var input = Files.newInputStream(source)) {
            byte[] header = input.readNBytes(8192);
            if (header.length < 8 || header[0] != 0x1a || header[1] != 0x45
                    || (header[2] & 255) != 0xdf || (header[3] & 255) != 0xa3) return false;
            // EBML DocType is a short ASCII string in the header, not the filename or MIME hint.
            for (int i = 4; i + 6 < header.length; i++) {
                if (header[i] == 0x42 && (header[i + 1] & 255) == 0x82) {
                    return (header[i + 2] & 255) == 0x84 && header[i + 3] == 'w'
                            && header[i + 4] == 'e' && header[i + 5] == 'b' && header[i + 6] == 'm';
                }
            }
            return false;
        }
    }

    public void deleteExpiredTemporary(java.time.Instant cutoff) {
        deleteExpiredTemporary(Path.of(System.getProperty("java.io.tmpdir")), cutoff);
    }
    static void deleteExpiredTemporary(Path root, java.time.Instant cutoff) {
        try (var entries = Files.list(root)) {
            for (Path entry : entries.filter(p -> p.getFileName().toString().startsWith("bigbike-chat-video-"))
                    .filter(p -> Files.isDirectory(p, java.nio.file.LinkOption.NOFOLLOW_LINKS)).toList()) {
                if (Files.getLastModifiedTime(entry).toInstant().isBefore(cutoff)) deleteTemporary(entry);
            }
        } catch (Exception failure) { log.warn("chat_video_temp_scan_failed type={}", failure.getClass().getSimpleName()); }
    }

    private Probe probe(Path source, Path temporary, String lang) throws Exception {
        Path output = temporary.resolve("probe.json");
        run(List.of(ffprobe, "-v", "error", "-protocol_whitelist", "file,pipe",
                "-show_entries", "format=format_name,duration:stream=codec_type,duration,width,height",
                "-of", "json", source.toString()), temporary, output, lang);
        if (Files.size(output) > 64 * 1024) throw ChatVideoErrors.invalid("CHAT_VIDEO_INVALID", lang);
        var json = mapper.readTree(Files.readString(output));
        String format = json.path("format").path("format_name").asText();
        if (!(format.contains("mov") || format.contains("mp4") || format.contains("webm"))) {
            throw ChatVideoErrors.invalid("CHAT_VIDEO_UNSUPPORTED_TYPE", lang);
        }
        double duration = number(json.path("format").path("duration").asText());
        boolean video = false, audio = false;
        for (var stream : json.path("streams")) {
            String type = stream.path("codec_type").asText();
            if ("video".equals(type)) {
                video |= stream.path("width").asInt() > 0 && stream.path("height").asInt() > 0;
            }
            if ("audio".equals(type)) audio = true;
            if ("audio".equals(type) || "video".equals(type)) {
                duration = Math.max(duration, number(stream.path("duration").asText()));
            }
        }
        return new Probe(duration, video, audio);
    }

    private static double number(String value) {
        try { return Double.parseDouble(value); } catch (RuntimeException ignored) { return 0; }
    }

    private static void run(List<String> command, Path temporary, Path output, String lang) throws Exception {
        ChatTurnBudget.checkTime();
        Process process = new ProcessBuilder(command)
                .redirectError(temporary.resolve("decoder.log").toFile())
                .redirectOutput(output == null ? ProcessBuilder.Redirect.DISCARD
                        : ProcessBuilder.Redirect.to(output.toFile())).start();
        try {
            if (!process.waitFor(ChatTurnBudget.remainingMillis(55_000), TimeUnit.MILLISECONDS)) {
                throw new ChatTurnBudget.Expired();
            }
            ChatTurnBudget.checkTime();
            if (process.exitValue() != 0) throw ChatVideoErrors.invalid("CHAT_VIDEO_INVALID", lang);
        } catch (InterruptedException failure) {
            Thread.currentThread().interrupt();
            throw new ChatTurnBudget.Expired();
        } finally {
            if (process.isAlive()) {
                process.destroyForcibly();
                process.waitFor(200, TimeUnit.MILLISECONDS);
            }
        }
    }

    private static void deleteTemporary(Path directory) {
        if (directory == null) return;
        try (var paths = Files.walk(directory)) {
            for (Path path : paths.sorted(Comparator.reverseOrder()).toList()) Files.deleteIfExists(path);
        } catch (Exception failure) {
            log.warn("chat_video_temp_cleanup_pending type={}", failure.getClass().getSimpleName());
        }
    }
    public record Normalized(byte[] bytes, double durationSeconds, boolean hasAudio) {}
    private record Probe(double duration, boolean hasVideo, boolean hasAudio) {}
}
