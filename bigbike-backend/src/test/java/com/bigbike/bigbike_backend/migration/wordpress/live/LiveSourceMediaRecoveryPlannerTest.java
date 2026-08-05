package com.bigbike.bigbike_backend.migration.wordpress.live;

import static org.assertj.core.api.Assertions.assertThat;

import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationOwnerOverrides.ApprovedRecoveryFile;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationOwnerOverrides.Config;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationOwnerOverrides.SourceMediaRecovery;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class LiveSourceMediaRecoveryPlannerTest {

    @TempDir
    Path tempDir;

    @Test
    void plansAnExactCopyThenRecognizesAByteIdenticalDestination() throws Exception {
        Path staging = tempDir.resolve("staging");
        Path uploads = tempDir.resolve("uploads");
        String relative = "2024/01/recovered.png";
        byte[] bytes = new byte[] {
                (byte) 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
                0, 0, 0, 0
        };
        Files.createDirectories(staging.resolve("2024/01"));
        Files.createDirectories(uploads.resolve("2024/01"));
        Files.write(staging.resolve(relative), bytes);
        Config config = config(relative, bytes);

        var pending = new LiveSourceMediaRecoveryPlanner().plan(config, staging, uploads);
        Files.write(uploads.resolve(relative), bytes);
        var present = new LiveSourceMediaRecoveryPlanner().plan(config, staging, uploads);

        assertThat(pending.summary().pendingExplicitCopy()).isEqualTo(1);
        assertThat(pending.plans()).singleElement().satisfies(plan ->
                assertThat(plan.action()).isEqualTo("PENDING_EXPLICIT_COPY_BEFORE_FINAL_SNAPSHOT"));
        assertThat(present.summary().alreadyPresentSameHash()).isEqualTo(1);
        assertThat(present.blockers()).isEmpty();
    }

    @Test
    void refusesToOverwriteAnExistingDifferentDestination() throws Exception {
        Path staging = tempDir.resolve("staging-conflict");
        Path uploads = tempDir.resolve("uploads-conflict");
        String relative = "2024/01/recovered.png";
        byte[] approved = new byte[] {
                (byte) 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
                1, 2, 3, 4
        };
        byte[] existing = new byte[] {
                (byte) 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
                9, 9, 9, 9
        };
        Files.createDirectories(staging.resolve("2024/01"));
        Files.createDirectories(uploads.resolve("2024/01"));
        Files.write(staging.resolve(relative), approved);
        Files.write(uploads.resolve(relative), existing);

        var result = new LiveSourceMediaRecoveryPlanner().plan(
                config(relative, approved), staging, uploads);

        assertThat(result.summary().conflicts()).isEqualTo(1);
        assertThat(result.blockers()).contains("SOURCE_RECOVERY_CONFLICTS_PRESENT");
        assertThat(result.plans()).singleElement().satisfies(plan -> {
            assertThat(plan.destinationState()).isEqualTo("DESTINATION_DIFFERENT_BYTES");
            assertThat(plan.action()).isEqualTo("BLOCKED_DO_NOT_OVERWRITE");
        });
        assertThat(Files.readAllBytes(uploads.resolve(relative))).isEqualTo(existing);
    }

    private Config config(String relative, byte[] bytes) throws Exception {
        String sha = HexFormat.of().formatHex(
                MessageDigest.getInstance("SHA-256").digest(bytes));
        var recovery = new SourceMediaRecovery(
                1, List.of(new ApprovedRecoveryFile(
                        relative, sha, bytes.length, "image/png")), List.of());
        return new Config(1, "2026-08-03", null, null, recovery, null, null, null);
    }
}
