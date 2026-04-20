package com.bigbike.bigbike_backend.service.common;

import com.bigbike.bigbike_backend.api.error.ValidationException;
import java.util.Set;
import org.springframework.stereotype.Service;

@Service
public class SortParser {

    public SortSpec parse(String rawSort, String defaultField, SortDirection defaultDirection, Set<String> allowedFields) {
        if (rawSort == null || rawSort.isBlank()) {
            return new SortSpec(defaultField, defaultDirection);
        }

        String[] parts = rawSort.split(":");
        if (parts.length != 2) {
            throw ValidationException.fromField("sort", "INVALID_SORT_FORMAT", "Sort must use field:direction format.");
        }

        String field = parts[0].trim();
        String directionRaw = parts[1].trim().toUpperCase();

        if (!allowedFields.contains(field)) {
            throw ValidationException.fromField("sort", "UNSUPPORTED_SORT_FIELD", "Unsupported sort field.");
        }

        SortDirection direction;
        try {
            direction = SortDirection.valueOf(directionRaw);
        } catch (IllegalArgumentException ex) {
            throw ValidationException.fromField("sort", "UNSUPPORTED_SORT_DIRECTION", "Sort direction must be asc or desc.");
        }

        return new SortSpec(field, direction);
    }
}

