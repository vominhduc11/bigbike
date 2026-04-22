package com.bigbike.bigbike_backend.migration.wordpress.parser;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Parses a single MySQL INSERT INTO line into a list of {@link WordPressTableRow}s.
 *
 * Handles:
 *   INSERT INTO `table` VALUES (...),(...),...;
 *   INSERT INTO `table` (`col1`,`col2`) VALUES (...),(...),...;
 *
 * MySQL escape sequences inside quoted strings:
 *   \'  → literal '
 *   \\  → literal \
 *   \n  → newline
 *   \r  → carriage return
 *   \t  → tab
 *   \0  → skipped (null byte)
 *
 * NULL (unquoted) → stored as null in the values list.
 *
 * If the line format is unrecognised (e.g., multi-line INSERT fragments),
 * returns an empty list — callers should log a warning.
 */
public class WordPressInsertParser {

    private static final Pattern INSERT_TABLE_PATTERN =
            Pattern.compile("^INSERT\\s+INTO\\s+[`'\"]?(\\w+)[`'\"]?\\s*", Pattern.CASE_INSENSITIVE);

    /**
     * Parse one INSERT line.
     *
     * @param line        raw SQL INSERT line (single line, no trailing newline required)
     * @param columnNames column names from CREATE TABLE (empty list = positional only)
     * @return list of parsed rows; empty if line is not a valid INSERT
     */
    public List<WordPressTableRow> parse(String line, List<String> columnNames) {
        if (line == null || !line.toUpperCase().startsWith("INSERT")) return List.of();

        Matcher m = INSERT_TABLE_PATTERN.matcher(line);
        if (!m.find()) return List.of();

        String tableName = m.group(1);
        int[] pos = {m.end()};

        // Optional explicit column list: (`col1`,`col2`,...)
        // When tryParseColumnList returns non-null it has already consumed the VALUES keyword.
        List<String> cols = new ArrayList<>(columnNames);
        boolean valuesConsumed = false;
        if (pos[0] < line.length() && line.charAt(pos[0]) == '(') {
            List<String> inlineCols = tryParseColumnList(line, pos);
            if (inlineCols != null) {
                cols = inlineCols;
                valuesConsumed = true;
            }
        }

        // Expect VALUES keyword (only if not already consumed by column list parser)
        if (!valuesConsumed) {
            skipWhitespace(line, pos);
            if (!matchKeyword(line, pos, "VALUES")) return List.of();
        }
        skipWhitespace(line, pos);

        // Parse one or more value tuples: (...),(...),...
        List<WordPressTableRow> rows = new ArrayList<>();
        while (pos[0] < line.length() && line.charAt(pos[0]) == '(') {
            List<String> values = parseValueTuple(line, pos);
            rows.add(new WordPressTableRow(tableName, cols, values));
            skipWhitespace(line, pos);
            if (pos[0] < line.length() && line.charAt(pos[0]) == ',') {
                pos[0]++;
                skipWhitespace(line, pos);
            }
        }
        return rows;
    }

    // Try to parse the inline column list `(`col1`,`col2`,...)`.
    // Returns null if it does not look like a column list (e.g., it is actually VALUES).
    private List<String> tryParseColumnList(String line, int[] pos) {
        int savedPos = pos[0];
        pos[0]++; // skip '('
        List<String> cols = new ArrayList<>();
        while (pos[0] < line.length() && line.charAt(pos[0]) != ')') {
            skipWhitespace(line, pos);
            char c = line.charAt(pos[0]);
            String col;
            if (c == '`' || c == '\'' || c == '"') {
                pos[0]++;
                int start = pos[0];
                char closing = c;
                while (pos[0] < line.length() && line.charAt(pos[0]) != closing) pos[0]++;
                col = line.substring(start, pos[0]);
                if (pos[0] < line.length()) pos[0]++;
            } else {
                int start = pos[0];
                while (pos[0] < line.length() && line.charAt(pos[0]) != ',' && line.charAt(pos[0]) != ')') pos[0]++;
                col = line.substring(start, pos[0]).trim();
            }
            if (!col.isEmpty()) cols.add(col);
            skipWhitespace(line, pos);
            if (pos[0] < line.length() && line.charAt(pos[0]) == ',') pos[0]++;
        }
        if (pos[0] < line.length() && line.charAt(pos[0]) == ')') {
            pos[0]++;
            skipWhitespace(line, pos);
            // If the next keyword is VALUES, this was indeed a column list
            if (matchKeyword(line, pos, "VALUES")) {
                return cols;
            }
        }
        // Not a column list — restore position
        pos[0] = savedPos;
        return null;
    }

    private List<String> parseValueTuple(String line, int[] pos) {
        List<String> values = new ArrayList<>();
        pos[0]++; // skip '('
        while (pos[0] < line.length() && line.charAt(pos[0]) != ')') {
            skipWhitespace(line, pos);
            if (pos[0] < line.length() && line.charAt(pos[0]) == ')') break;
            values.add(readValue(line, pos));
            skipWhitespace(line, pos);
            if (pos[0] < line.length() && line.charAt(pos[0]) == ',') pos[0]++;
        }
        if (pos[0] < line.length()) pos[0]++; // skip ')'
        return values;
    }

    private String readValue(String line, int[] pos) {
        if (pos[0] >= line.length()) return null;
        char c = line.charAt(pos[0]);

        if (c == '\'') {
            return readQuotedString(line, pos);
        }

        // NULL
        if (pos[0] + 4 <= line.length() && line.substring(pos[0], pos[0] + 4).equalsIgnoreCase("NULL")) {
            char after = pos[0] + 4 < line.length() ? line.charAt(pos[0] + 4) : ')';
            if (after == ',' || after == ')' || after == ' ' || after == '\t') {
                pos[0] += 4;
                return null;
            }
        }

        // Unquoted value: number, date (some dumps don't quote dates)
        int start = pos[0];
        while (pos[0] < line.length() && line.charAt(pos[0]) != ',' && line.charAt(pos[0]) != ')') {
            pos[0]++;
        }
        return line.substring(start, pos[0]).trim();
    }

    private String readQuotedString(String line, int[] pos) {
        pos[0]++; // skip opening '
        StringBuilder sb = new StringBuilder();
        while (pos[0] < line.length()) {
            char c = line.charAt(pos[0]);
            if (c == '\\' && pos[0] + 1 < line.length()) {
                pos[0]++;
                char esc = line.charAt(pos[0]++);
                switch (esc) {
                    case '\'' -> sb.append('\'');
                    case '\\' -> sb.append('\\');
                    case 'n'  -> sb.append('\n');
                    case 'r'  -> sb.append('\r');
                    case 't'  -> sb.append('\t');
                    case '0'  -> { /* skip null byte */ }
                    default   -> sb.append(esc);
                }
            } else if (c == '\'') {
                pos[0]++;
                // Handle MySQL doubled-quote escape ''
                if (pos[0] < line.length() && line.charAt(pos[0]) == '\'') {
                    sb.append('\'');
                    pos[0]++;
                } else {
                    break; // end of string
                }
            } else {
                sb.append(c);
                pos[0]++;
            }
        }
        return sb.toString();
    }

    private void skipWhitespace(String line, int[] pos) {
        while (pos[0] < line.length() && Character.isWhitespace(line.charAt(pos[0]))) pos[0]++;
    }

    private boolean matchKeyword(String line, int[] pos, String keyword) {
        if (pos[0] + keyword.length() > line.length()) return false;
        if (line.regionMatches(true, pos[0], keyword, 0, keyword.length())) {
            pos[0] += keyword.length();
            return true;
        }
        return false;
    }
}
