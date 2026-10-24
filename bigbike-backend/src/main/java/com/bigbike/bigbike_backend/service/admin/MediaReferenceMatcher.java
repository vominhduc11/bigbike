package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.persistence.entity.media.MediaEntity;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Request-local, literal substring matcher for media paths (Aho-Corasick).
 * Each reference blob is read once, regardless of the number of candidate media.
 * A path repeated inside the same blob contributes one usage, as String.contains did.
 */
final class MediaReferenceMatcher {

    private static final class Node {
        final Map<Character, Node> children = new HashMap<>();
        List<Integer> targets = List.of();
        Node failure;
        Node output;
    }

    private final Node root = new Node();
    private final List<UUID> ids = new ArrayList<>();
    private final Map<String, List<Integer>> exactIds = new HashMap<>();
    private final int[] counts;
    private final int[] lastBlob;
    private int blobNumber;

    MediaReferenceMatcher(Collection<MediaEntity> candidates) {
        root.failure = root;
        for (MediaEntity media : candidates) {
            String path = media.getFilePath();
            if (path == null || path.isBlank()) continue;
            int target = ids.size();
            ids.add(media.getId());
            exactIds.computeIfAbsent(media.getId().toString(), key -> new ArrayList<>()).add(target);
            Node node = root;
            for (int i = 0; i < path.length(); i++) {
                node = node.children.computeIfAbsent(path.charAt(i), key -> new Node());
            }
            if (node.targets.isEmpty()) node.targets = new ArrayList<>();
            node.targets.add(target);
        }
        counts = new int[ids.size()];
        lastBlob = new int[ids.size()];
        buildFailureLinks();
    }

    boolean isEmpty() {
        return ids.isEmpty();
    }

    void accept(String blob) {
        if (blob == null) return;
        blobNumber++;
        // Stored media ids are an exact-value match, never a substring inside HTML/JSON.
        List<Integer> byId = exactIds.get(blob);
        if (byId != null) record(byId);

        Node state = root;
        for (int i = 0; i < blob.length(); i++) {
            char character = blob.charAt(i);
            Node next = state.children.get(character);
            while (next == null && state != root) {
                state = state.failure;
                next = state.children.get(character);
            }
            state = next == null ? root : next;
            if (!state.targets.isEmpty()) record(state.targets);
            for (Node suffix = state.output; suffix != null; suffix = suffix.output) {
                record(suffix.targets);
            }
        }
    }

    Set<UUID> usedIds() {
        Set<UUID> used = new HashSet<>();
        for (int i = 0; i < ids.size(); i++) {
            if (counts[i] > 0) used.add(ids.get(i));
        }
        return used;
    }

    Map<UUID, Integer> usageCounts() {
        Map<UUID, Integer> result = new HashMap<>();
        for (int i = 0; i < ids.size(); i++) result.put(ids.get(i), counts[i]);
        return result;
    }

    private void record(List<Integer> targets) {
        for (int target : targets) {
            if (lastBlob[target] != blobNumber) {
                counts[target]++;
                lastBlob[target] = blobNumber;
            }
        }
    }

    private void buildFailureLinks() {
        ArrayDeque<Node> queue = new ArrayDeque<>();
        for (Node child : root.children.values()) {
            child.failure = root;
            queue.add(child);
        }
        while (!queue.isEmpty()) {
            Node parent = queue.remove();
            for (var edge : parent.children.entrySet()) {
                char character = edge.getKey();
                Node child = edge.getValue();
                Node fallback = parent.failure;
                while (fallback != root && !fallback.children.containsKey(character)) {
                    fallback = fallback.failure;
                }
                child.failure = fallback.children.getOrDefault(character, root);
                child.output = child.failure.targets.isEmpty() ? child.failure.output : child.failure;
                queue.add(child);
            }
        }
    }
}
