package com.bigbike.bigbike_backend.migration.wordpress.live;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class LiveOffsiteBackupManifestValidatorTest {

    private static final String SHA = "b".repeat(64);

    @TempDir
    Path tempDir;

    @Test
    void acceptsFreshCompleteManifestWhoseSourceHashMatches() throws Exception {
        Instant now = Instant.parse("2026-08-03T02:00:00Z");
        Path manifest = tempDir.resolve("offsite.json");
        Files.writeString(manifest, manifest(
                "preflight-final", SHA, now.minusSeconds(60), now.plusSeconds(31L * 86_400),
                "s3://bigbike-backup/migration/"));

        var result = new LiveOffsiteBackupManifestValidator().validate(
                manifest, "preflight-final", SHA, now);

        assertThat(result.present()).isTrue();
        assertThat(result.valid()).isTrue();
        assertThat(result.errors()).isEmpty();
    }

    @Test
    void rejectsLocalOrStaleBackupProof() throws Exception {
        Instant now = Instant.parse("2026-08-03T02:00:00Z");
        Path manifest = tempDir.resolve("local.json");
        Files.writeString(manifest, manifest(
                "preflight-final", SHA, now.minusSeconds(25L * 3_600),
                now.plusSeconds(5L * 86_400), "file:///root/backups/"));

        var result = new LiveOffsiteBackupManifestValidator().validate(
                manifest, "preflight-final", SHA, now);

        assertThat(result.valid()).isFalse();
        assertThat(result.errors()).anyMatch(error -> error.contains("30 days"));
        assertThat(result.errors()).anyMatch(error -> error.contains("last 24 hours"));
        assertThat(result.errors()).anyMatch(error -> error.contains("external URI"));
    }

    @Test
    void windowsBackupScriptEmitsValidatorCompatibleVerificationTimestamps() throws Exception {
        Path script = Path.of(System.getProperty("user.dir"))
                .resolve("../deploy/migration/pull-live-migration-backups.ps1")
                .normalize();

        String source = Files.readString(script);

        assertThat(source)
                .contains("$retentionUntil = $verifiedAt.AddDays(31)")
                .contains("verifiedReadableAt = $verifiedAt.ToString('o')")
                .doesNotContain("generatedAt = $verifiedAt.ToString('o')");
    }

    private String manifest(
            String snapshotId, String sha, Instant verifiedAt, Instant retentionUntil,
            String locationPrefix) {
        StringBuilder artifacts = new StringBuilder();
        int index = 0;
        for (String kind : LiveOffsiteBackupManifestValidator.REQUIRED_KINDS.stream().sorted().toList()) {
            if (index++ > 0) artifacts.append(',');
            artifacts.append("""
                    {"kind":"%s","location":"%s%s.tar.zst","sha256":"%s","bytes":123,"verifiedReadable":true}
                    """.formatted(kind, locationPrefix, kind.toLowerCase(), sha));
        }
        return """
                {
                  "version": 1,
                  "snapshotId": "%s",
                  "sourceDumpSha256": "%s",
                  "verifiedReadableAt": "%s",
                  "retentionUntil": "%s",
                  "artifacts": [%s]
                }
                """.formatted(snapshotId, sha, verifiedAt, retentionUntil, artifacts);
    }
}
