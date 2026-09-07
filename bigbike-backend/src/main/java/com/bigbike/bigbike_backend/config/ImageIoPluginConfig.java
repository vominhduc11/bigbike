package com.bigbike.bigbike_backend.config;

import jakarta.annotation.PostConstruct;
import java.util.Iterator;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Configuration;

/**
 * Registers the ImageIO plugins that ship as nested jars inside the Spring Boot fat jar.
 *
 * <p>{@code IIORegistry} scans lazily through the thread context class loader, which is correct
 * for a normal request thread but not guaranteed for the first caller in a scheduled job or a
 * startup task. Scanning once here makes WebP decoding deterministic, and the log line proves at
 * boot whether the reader is present instead of leaving a missing plugin to surface as a silent
 * "this image is not a valid image" much later.
 */
@Configuration
@Slf4j
public class ImageIoPluginConfig {

    @PostConstruct
    void registerPlugins() {
        ImageIO.scanForPlugins();
        log.info("imageio_plugins_registered webpReader={}", hasReader("webp"));
    }

    private static boolean hasReader(String formatName) {
        Iterator<ImageReader> readers = ImageIO.getImageReadersByFormatName(formatName);
        return readers.hasNext();
    }
}
