package com.bigbike.bigbike_backend.service.media;

/**
 * Compression target for {@link ImageCompressionService}. {@code maxWidth}/{@code maxHeight}
 * are only both honored when {@code squareCrop} is true (center-crop to that exact box);
 * otherwise the image is scaled proportionally so its width does not exceed {@code maxWidth}.
 */
public record CompressionProfile(int maxWidth, int maxHeight, float jpegQuality, boolean squareCrop) {
}
