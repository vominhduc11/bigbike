package com.bigbike.bigbike_backend.migration.wordpress.parser;

import java.util.List;

/**
 * One parsed row from a MySQL INSERT statement.
 * columnNames comes from the preceding CREATE TABLE statement captured by the dump reader.
 * values are the SQL-unescaped string values in positional order.
 */
public record WordPressTableRow(String tableName, List<String> columnNames, List<String> values) {

    /** Get a column value by name, null if not found. */
    public String get(String column) {
        for (int i = 0; i < columnNames.size(); i++) {
            if (columnNames.get(i).equals(column)) {
                return i < values.size() ? values.get(i) : null;
            }
        }
        return null;
    }

    /** Get a column value by zero-based index, null if out of range. */
    public String get(int index) {
        return index < values.size() ? values.get(index) : null;
    }

    public long getLong(String column, long defaultVal) {
        String v = get(column);
        if (v == null || v.isBlank()) return defaultVal;
        try { return Long.parseLong(v.trim()); }
        catch (NumberFormatException e) { return defaultVal; }
    }

    public int getInt(String column, int defaultVal) {
        String v = get(column);
        if (v == null || v.isBlank()) return defaultVal;
        try { return Integer.parseInt(v.trim()); }
        catch (NumberFormatException e) { return defaultVal; }
    }
}
