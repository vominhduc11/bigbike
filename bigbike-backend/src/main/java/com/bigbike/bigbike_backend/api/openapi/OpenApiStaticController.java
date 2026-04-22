package com.bigbike.bigbike_backend.api.openapi;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class OpenApiStaticController {

    @GetMapping(value = "/v3/api-docs", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> apiDocs() throws IOException {
        ClassPathResource resource = new ClassPathResource("openapi/bigbike-openapi.json");
        String json = resource.getContentAsString(StandardCharsets.UTF_8);
        return ResponseEntity.ok(json);
    }
}
