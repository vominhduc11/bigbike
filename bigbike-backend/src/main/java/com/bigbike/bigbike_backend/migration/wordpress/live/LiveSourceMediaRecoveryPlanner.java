package com.bigbike.bigbike_backend.migration.wordpress.live;

import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationOwnerOverrides.ApprovedRecoveryFile;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationOwnerOverrides.Config;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationPreflightReport.Issue;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationPreflightReport.SourceMediaRecoveryPlan;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationPreflightReport.SourceMediaRecoverySummary;
import com.bigbike.bigbike_backend.migration.wordpress.media.MediaChecksumService;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;

/** Verifies exact recovery candidates and plans, but never copies into live uploads. */
final class LiveSourceMediaRecoveryPlanner {

    private final MediaChecksumService checksumService = new MediaChecksumService();

    Result plan(Config overrides, Path stagingRoot, Path uploadsRoot) {
        Path stagedBase = stagingRoot.toAbsolutePath().normalize();
        Path uploadsBase = uploadsRoot.toAbsolutePath().normalize();
        List<SourceMediaRecoveryPlan> plans = new ArrayList<>();
        List<Issue> issues = new ArrayList<>();
        List<String> blockers = new ArrayList<>();
        int same = 0;
        int pending = 0;
        int conflicts = 0;

        for (ApprovedRecoveryFile approved : overrides.sourceMediaRecovery().approvedFiles()) {
            String relative = LiveMediaPlanner.normalizeRelativePath(approved.relativePath());
            Path staged = relative == null ? stagedBase : stagedBase.resolve(relative).normalize();
            Path destination = relative == null ? uploadsBase : uploadsBase.resolve(relative).normalize();
            List<String> reasons = new ArrayList<>();
            String state;
            String action;

            if (relative == null || !staged.startsWith(stagedBase) || !destination.startsWith(uploadsBase)) {
                state = "INVALID_PATH";
                action = "BLOCKED";
                reasons.add("Recovery path is not a safe relative uploads path");
            } else if (!validStagedFile(staged, approved, reasons)) {
                state = "STAGED_FILE_INVALID";
                action = "BLOCKED";
            } else if (Files.exists(destination)) {
                try {
                    long destinationBytes = Files.size(destination);
                    String destinationSha = checksumService.sha256Hex(destination);
                    if (destinationBytes == approved.bytes() && approved.sha256().equals(destinationSha)) {
                        state = "ALREADY_PRESENT_SAME_HASH";
                        action = "NO_WRITE_REQUIRED";
                        reasons.add("Destination already contains the approved byte-identical file");
                        same++;
                    } else {
                        state = "DESTINATION_DIFFERENT_BYTES";
                        action = "BLOCKED_DO_NOT_OVERWRITE";
                        reasons.add("Destination exists with different bytes; overwrite is forbidden");
                    }
                } catch (Exception e) {
                    state = "DESTINATION_UNREADABLE";
                    action = "BLOCKED_DO_NOT_OVERWRITE";
                    reasons.add("Destination exists but cannot be hash-verified");
                }
            } else {
                state = "DESTINATION_MISSING";
                action = "PENDING_EXPLICIT_COPY_BEFORE_FINAL_SNAPSHOT";
                reasons.add("Approved staged bytes may be copied only after the explicit recovery gate");
                pending++;
            }

            if (action.startsWith("BLOCKED")) {
                conflicts++;
                issues.add(new Issue(
                        "BLOCKER", "SOURCE_MEDIA_RECOVERY", approved.relativePath(),
                        "SOURCE_RECOVERY_FILE_CONFLICT", String.join("; ", reasons)));
            }
            plans.add(new SourceMediaRecoveryPlan(
                    approved.relativePath(), staged.toString(), destination.toString(),
                    approved.sha256(), approved.bytes(), approved.mimeType(),
                    state, action, List.copyOf(reasons)));
        }

        if (pending > 0) blockers.add("SOURCE_RECOVERY_COPY_PENDING");
        if (conflicts > 0) blockers.add("SOURCE_RECOVERY_CONFLICTS_PRESENT");
        SourceMediaRecoverySummary summary = new SourceMediaRecoverySummary(
                plans.size(), same, pending, conflicts,
                overrides.sourceMediaRecovery().unavailableFileFallbacks().size());
        return new Result(
                List.copyOf(plans), summary, List.copyOf(issues),
                List.copyOf(new LinkedHashSet<>(blockers)));
    }

    private boolean validStagedFile(
            Path path, ApprovedRecoveryFile approved, List<String> reasons) {
        try {
            if (!Files.isRegularFile(path) || !Files.isReadable(path)) {
                reasons.add("Approved staged file is missing or unreadable");
                return false;
            }
            if (Files.size(path) != approved.bytes()) {
                reasons.add("Staged byte size does not match the approved manifest");
                return false;
            }
            if (!approved.sha256().equals(checksumService.sha256Hex(path))) {
                reasons.add("Staged SHA-256 does not match the approved manifest");
                return false;
            }
            if (!mimeSignatureMatches(path, approved.mimeType())) {
                reasons.add("Staged MIME signature does not match the approved manifest");
                return false;
            }
            return true;
        } catch (Exception e) {
            reasons.add("Staged file verification failed: " + e.getClass().getSimpleName());
            return false;
        }
    }

    private boolean mimeSignatureMatches(Path path, String mimeType) throws Exception {
        byte[] header = new byte[12];
        int read;
        try (InputStream in = Files.newInputStream(path)) {
            read = in.read(header);
        }
        if ("image/png".equals(mimeType)) {
            byte[] png = {(byte) 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a};
            if (read < png.length) return false;
            for (int i = 0; i < png.length; i++) if (header[i] != png[i]) return false;
            return true;
        }
        if ("image/jpeg".equals(mimeType)) {
            return read >= 3 && header[0] == (byte) 0xff
                    && header[1] == (byte) 0xd8 && header[2] == (byte) 0xff;
        }
        return false;
    }

    record Result(
            List<SourceMediaRecoveryPlan> plans,
            SourceMediaRecoverySummary summary,
            List<Issue> issues,
            List<String> blockers) {}
}
