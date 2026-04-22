package com.bigbike.bigbike_backend.migration.wordpress.parser;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.Reader;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;

/**
 * Reads docs/legacy/SEO_REDIRECT_MAP.csv.
 * Expected header: sourcePattern,targetPattern,redirectType,status,notes
 */
@Service
public class WordPressCsvRedirectReader {

    public static final String EXPECTED_HEADER = "sourcePattern,targetPattern,redirectType,status,notes";

    public record RedirectCsvRow(
            String sourcePattern,
            String targetPattern,
            String redirectType,
            String status,
            String notes
    ) {}

    public record ParseResult(
            boolean headerValid,
            String headerWarning,
            List<RedirectCsvRow> rows,
            List<String> warnings
    ) {}

    /**
     * Parse a CSV redirect file from any Reader (file, classpath resource, etc).
     * Never buffers entire file at once — reads line by line.
     */
    public ParseResult parse(Reader source) throws IOException {
        List<RedirectCsvRow> rows = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        boolean headerValid = false;
        String headerWarning = null;

        try (BufferedReader reader = new BufferedReader(source)) {
            String header = reader.readLine();
            if (header == null) {
                return new ParseResult(false, "CSV file is empty", rows, warnings);
            }

            String normalizedHeader = header.trim().replace("\uFEFF", ""); // strip BOM
            if (!EXPECTED_HEADER.equalsIgnoreCase(normalizedHeader)) {
                headerWarning = "Unexpected CSV header. Expected: [" + EXPECTED_HEADER
                        + "] but got: [" + normalizedHeader + "]";
                headerValid = false;
            } else {
                headerValid = true;
            }

            String line;
            int lineNum = 1;
            while ((line = reader.readLine()) != null) {
                lineNum++;
                if (line.isBlank()) continue;
                String[] cols = line.split(",", -1);
                if (cols.length < 4) {
                    warnings.add("Line " + lineNum + ": too few columns, skipping");
                    continue;
                }
                rows.add(new RedirectCsvRow(
                        cols[0].trim(),
                        cols[1].trim(),
                        cols[2].trim(),
                        cols[3].trim(),
                        cols.length > 4 ? cols[4].trim() : ""
                ));
            }
        }

        return new ParseResult(headerValid, headerWarning, rows, warnings);
    }
}
