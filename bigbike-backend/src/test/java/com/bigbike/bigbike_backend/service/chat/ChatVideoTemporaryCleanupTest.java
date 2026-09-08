package com.bigbike.bigbike_backend.service.chat;

import static org.assertj.core.api.Assertions.*;
import java.nio.file.*;
import java.nio.file.attribute.FileTime;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class ChatVideoTemporaryCleanupTest {
    @TempDir Path temporary;
    @Test void deletesOnlyExpiredDirectoriesCreatedForChatVideo() throws Exception {
        var old = Files.createDirectory(temporary.resolve("bigbike-chat-video-old"));
        var current = Files.createDirectory(temporary.resolve("bigbike-chat-video-current"));
        var other = Files.createDirectory(temporary.resolve("another-feature"));
        Files.writeString(old.resolve("received.upload"), "private fixture");
        Files.setLastModifiedTime(old, FileTime.from(Instant.now().minusSeconds(8 * 86400)));
        Files.setLastModifiedTime(other, FileTime.from(Instant.now().minusSeconds(8 * 86400)));
        ChatVideoNormalizer.deleteExpiredTemporary(temporary, Instant.now().minusSeconds(7 * 86400));
        assertThat(old).doesNotExist(); assertThat(current).exists(); assertThat(other).exists();
    }
}
