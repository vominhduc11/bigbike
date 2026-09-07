# Chat image test fixtures

Real WebP files, because Java cannot encode WebP: the backend ships a WebP *reader*
(`com.twelvemonkeys.imageio:imageio-webp`) and no writer, so a test cannot build one at runtime the
way the PNG helpers in `ChatImageStorageServiceTest` do.

They deliberately contain random pixel noise. The reader refuses any image whose decoded size
exceeds its encoded size by more than 2048:1, so a flat-colour fixture — which compresses to a few
dozen bytes — is rejected as a decompression bomb and would test the wrong thing entirely.

Regenerate with (Pillow, seeded so the bytes are reproducible):

```python
from PIL import Image
import random
random.seed(20260907)

def noisy(w, h, mode='RGB'):
    im = Image.new(mode, (w, h)); px = im.load()
    for y in range(h):
        for x in range(w):
            px[x, y] = tuple(random.randrange(256) for _ in range(len(mode)))
    return im

noisy(64, 64).save('customer-photo-lossy.webp', format='WEBP', quality=80)
noisy(64, 64).save('customer-photo-lossless.webp', format='WEBP', lossless=True)
noisy(48, 48, 'RGBA').save('customer-photo-alpha.webp', format='WEBP', lossless=True)
noisy(1700, 8).save('customer-photo-wide.webp', format='WEBP', quality=70)
```

| File | Encoding | Why it exists |
|---|---|---|
| `customer-photo-lossy.webp` | VP8, 64×64 | The common case: a photo saved from a website or a chat app |
| `customer-photo-lossless.webp` | VP8L, 64×64 | Lossless WebP takes a different decoder path from lossy |
| `customer-photo-alpha.webp` | VP8L + alpha, 48×48 | Transparency must survive re-encoding as PNG rather than being flattened |
| `customer-photo-wide.webp` | VP8, 1700×8 | Wider than the 1600px cap, so it must be resized instead of refused |
