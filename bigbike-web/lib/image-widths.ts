/**
 * Global Next Image candidates kept deliberately small because every responsive `sizes` prop is
 * serialized into server HTML. The small-width set retains exact DPR 1–4 sources for homepage
 * category frames (64/80/96px); device widths cover the storefront's actual large image slots.
 */
export const BIGBIKE_IMAGE_SIZES = [
  64, 80, 96, 128, 160, 192, 240, 256, 288, 320, 384, 512,
] as const;

export const BIGBIKE_DEVICE_SIZES = [640, 768, 1024, 1280, 1440, 2048, 2560, 3840] as const;
