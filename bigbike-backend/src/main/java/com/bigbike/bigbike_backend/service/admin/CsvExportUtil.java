package com.bigbike.bigbike_backend.service.admin;

/**
 * Shared CSV export mechanics used by every admin CSV export/import endpoint
 * (reports export, the bulk product import round-trip export). Kept in one place
 * because the formula-injection escaping is security-relevant — duplicating it
 * risks the two copies drifting apart.
 */
final class CsvExportUtil {

    private static final byte[] UTF8_BOM = {(byte) 0xEF, (byte) 0xBB, (byte) 0xBF};

    private CsvExportUtil() {
    }

    /**
     * Prefix dangerous leading characters with a single quote to prevent spreadsheet formula
     * injection. Triggers: {@code = + - @ \t \r} (OWASP CSV injection — prepend apostrophe).
     * LF ({@code \n}) is stripped because it creates a new CSV row in spreadsheet parsers.
     * After stripping leading LFs, a remaining formula trigger is also apostrophe-escaped.
     */
    static String escape(String v) {
        if (v == null || v.isEmpty()) return v;
        int start = 0;
        while (start < v.length() && v.charAt(start) == '\n') {
            start++;
        }
        if (start > 0) {
            String stripped = v.substring(start);
            return escape(stripped);
        }
        if (v.charAt(0) == '\r' && v.length() > 1 && v.charAt(1) == '\n') {
            return escape(v.substring(2));
        }
        char first = v.charAt(0);
        if (first == '=' || first == '+' || first == '-' || first == '@'
                || first == '\t' || first == '\r') {
            return "'" + v;
        }
        return v;
    }

    static byte[] withBom(byte[] csv) {
        byte[] result = new byte[UTF8_BOM.length + csv.length];
        System.arraycopy(UTF8_BOM, 0, result, 0, UTF8_BOM.length);
        System.arraycopy(csv, 0, result, UTF8_BOM.length, csv.length);
        return result;
    }
}
