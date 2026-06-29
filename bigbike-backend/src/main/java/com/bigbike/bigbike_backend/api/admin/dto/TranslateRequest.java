package com.bigbike.bigbike_backend.api.admin.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.Map;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * VI→EN auto-translation request. {@code texts} is a flat {@code key -> Vietnamese text}
 * map; the response returns the same keys with English values. The admin builds the map
 * from the fields it wants translated (skipping any the user locked by hand).
 */
@Getter
@Setter
@NoArgsConstructor
public class TranslateRequest {

    @NotNull(message = "texts is required.")
    @Size(max = 500, message = "Cannot translate more than 500 fields at once.")
    private Map<String, String> texts;
}
