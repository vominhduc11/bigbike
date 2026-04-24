package com.bigbike.bigbike_backend.migration.wordpress.parser;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.BiConsumer;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;

/**
 * Streams a MySQL dump file and dispatches rows from selected tables to a handler.
 *
 * Reads line by line — never loads the full dump into memory.
 * Captures column names from CREATE TABLE statements, then uses them when parsing
 * INSERT statements for the requested tables.
 *
 * Supports both mysqldump formats:
 *   - Single-line: INSERT INTO `table` VALUES (...),(...),...;
 *   - Multi-line:  INSERT INTO `table` VALUES\n(row1)\n(row2)\n...(rowN); (one row per line)
 *
 * Uses UTF-8 with REPLACE on malformed bytes so the parser preserves correct
 * Vietnamese text from the dump while surviving any stray invalid sequences.
 * ASCII content (SQL structure, numbers) is unaffected.
 */
@Component
public class WordPressSqlDumpRowReader {

    private static final Pattern CREATE_TABLE_PATTERN =
            Pattern.compile("^CREATE TABLE\\s+(?:IF NOT EXISTS\\s+)?[`'\"]?(\\w+)[`'\"]?\\s*\\(",
                    Pattern.CASE_INSENSITIVE);

    private static final Pattern COLUMN_PATTERN =
            Pattern.compile("^\\s+[`'\"]([^`'\"]+)[`'\"]\\s+\\w");

    private static final Pattern INSERT_TABLE_PATTERN =
            Pattern.compile("^INSERT\\s+INTO\\s+[`'\"]?(\\w+)[`'\"]?",
                    Pattern.CASE_INSENSITIVE);

    private final WordPressInsertParser insertParser = new WordPressInsertParser();

    /**
     * Stream through the dump, dispatching rows for tables in {@code targetTables}.
     *
     * @param dumpPath     path to the .sql dump file
     * @param targetTables full table names to capture (e.g. "kd_posts", "kd_postmeta")
     * @param handler      callback invoked for each parsed row: (tableName, row)
     * @return list of warnings accumulated during streaming
     */
    public List<String> stream(Path dumpPath, Set<String> targetTables,
            BiConsumer<String, WordPressTableRow> handler) throws IOException {

        List<String> warnings = new ArrayList<>();
        Map<String, List<String>> columnsByTable = new HashMap<>();

        boolean inCreateTable = false;
        String currentTable = null;
        List<String> currentColumns = new ArrayList<>();

        // Multi-row INSERT state — active while consuming continuation rows
        // (INSERT INTO table VALUES on one line, each data row on its own subsequent line)
        String multiRowTable = null;
        String multiRowHeader = null;

        // UTF-8 with REPLACE on malformed bytes — preserves correct Vietnamese text from
        // standard MySQL dumps while surviving any stray non-UTF-8 byte sequences.
        var decoder = StandardCharsets.UTF_8.newDecoder()
                .onMalformedInput(CodingErrorAction.REPLACE)
                .onUnmappableCharacter(CodingErrorAction.REPLACE);
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(Files.newInputStream(dumpPath), decoder))) {
            String line;
            while ((line = reader.readLine()) != null) {

                // ── Multi-row INSERT continuation ─────────────────────────────────
                // Real mysqldump format: INSERT INTO table VALUES\n(row1)\n(row2)\n...;
                // Stay in this mode until a non-data line is encountered.
                if (multiRowTable != null) {
                    String trimmed = line.trim();
                    if (trimmed.isEmpty() || trimmed.startsWith("--")) continue;
                    if (trimmed.startsWith("(")) {
                        dispatchInsert(multiRowHeader + trimmed, multiRowTable,
                                columnsByTable.getOrDefault(multiRowTable, List.of()),
                                handler, warnings);
                        continue; // stay in multi-row mode for the next row
                    } else {
                        // Non-data line ends this INSERT block
                        multiRowTable = null;
                        multiRowHeader = null;
                        // Fall through to process this line normally
                    }
                }

                // ── CREATE TABLE detection ───────────────────────────────────────
                Matcher createMatcher = CREATE_TABLE_PATTERN.matcher(line);
                if (createMatcher.find()) {
                    inCreateTable = true;
                    currentTable = createMatcher.group(1);
                    currentColumns = new ArrayList<>();
                    continue;
                }

                if (inCreateTable) {
                    String trimmed = line.trim();
                    if (trimmed.startsWith(")")) {
                        columnsByTable.put(currentTable, new ArrayList<>(currentColumns));
                        inCreateTable = false;
                        currentTable = null;
                        currentColumns = new ArrayList<>();
                        continue;
                    }
                    if (isIndexOrConstraintLine(trimmed)) continue;
                    Matcher colMatcher = COLUMN_PATTERN.matcher(line);
                    if (colMatcher.find()) {
                        currentColumns.add(colMatcher.group(1));
                    }
                    continue;
                }

                // ── INSERT detection ─────────────────────────────────────────────
                if (!line.startsWith("INSERT")) continue;

                Matcher insertMatcher = INSERT_TABLE_PATTERN.matcher(line);
                if (!insertMatcher.find()) continue;

                String tableName = insertMatcher.group(1);
                if (!targetTables.contains(tableName)) continue;

                String stripped = line.trim();
                if (isIncompleteInsert(stripped)) {
                    // Multi-line format: VALUES keyword on this line, rows on subsequent lines.
                    // Build the INSERT header and activate multi-row mode.
                    StringBuilder hdr = new StringBuilder(stripped);
                    while (hdr.length() > 0) {
                        char last = hdr.charAt(hdr.length() - 1);
                        if (last == ';' || last == ' ' || last == '\t') {
                            hdr.deleteCharAt(hdr.length() - 1);
                        } else break;
                    }
                    hdr.append(" ");
                    multiRowTable = tableName;
                    multiRowHeader = hdr.toString();
                    continue;
                }

                dispatchInsert(line, tableName,
                        columnsByTable.getOrDefault(tableName, List.of()),
                        handler, warnings);
            }
        }

        return warnings;
    }

    /**
     * True when an INSERT line ends with "VALUES" (or "VALUES ") with no actual row data.
     * e.g.: INSERT INTO `kd_posts` VALUES
     */
    private boolean isIncompleteInsert(String line) {
        String upper = line.toUpperCase();
        // Find last occurrence of VALUES
        int idx = upper.lastIndexOf("VALUES");
        if (idx < 0) return false;
        // Check if there is anything meaningful after VALUES
        String after = line.substring(idx + 6).trim();
        return after.isEmpty() || after.equals(";");
    }

    private void dispatchInsert(String line, String tableName, List<String> cols,
            BiConsumer<String, WordPressTableRow> handler, List<String> warnings) {
        List<WordPressTableRow> rows;
        try {
            rows = insertParser.parse(line, cols);
        } catch (Exception e) {
            warnings.add("Failed to parse INSERT for " + tableName + ": " + e.getMessage());
            return;
        }
        if (rows.isEmpty()) {
            warnings.add("Empty result parsing INSERT for " + tableName + " (format unsupported?)");
            return;
        }
        for (WordPressTableRow row : rows) {
            handler.accept(tableName, row);
        }
    }

    private boolean isIndexOrConstraintLine(String trimmed) {
        String upper = trimmed.toUpperCase();
        return upper.startsWith("PRIMARY KEY")
                || upper.startsWith("KEY ")
                || upper.startsWith("UNIQUE KEY")
                || upper.startsWith("UNIQUE ")
                || upper.startsWith("INDEX ")
                || upper.startsWith("FULLTEXT")
                || upper.startsWith("CONSTRAINT")
                || upper.startsWith("FOREIGN KEY");
    }
}
