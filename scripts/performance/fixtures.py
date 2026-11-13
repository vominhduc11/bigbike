"""Deterministic non-personal test media; generated once and shared by both arms."""
import hashlib
import json
from pathlib import Path
import struct
import random
import subprocess
import zlib


def png(path, width, height, alpha, noise=False):
    def chunk(kind, data):
        return struct.pack('!I', len(data)) + kind + data + struct.pack('!I', zlib.crc32(kind + data))
    if noise:
        generator = random.Random(20261113)
        rows = []
        for _ in range(height):
            rgb = generator.randbytes(width * 3)
            rgba = bytearray(width * 4)
            rgba[0::4], rgba[1::4], rgba[2::4] = rgb[0::3], rgb[1::3], rgb[2::3]
            rgba[3::4] = bytes([96 if alpha else 255]) * width
            rows.append(bytes([0]) + rgba)
        pixels = b''.join(rows)
    else:
        row = bytes([0]) + bytes([64, 128, 192, 96 if alpha else 255]) * width
        pixels = row * height
    encoded = (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('!2I5B', width, height, 8, 6, 0, 0, 0))
               + chunk(b'IDAT', zlib.compress(pixels)) + chunk(b'IEND', b''))
    Path(path).write_bytes(encoded)


def generate(directory):
    root = Path(directory)
    root.mkdir(parents=True, exist_ok=True)
    for width, height in ((320, 240), (1600, 1200)):
        for alpha in (False, True):
            png(root / f"{'alpha' if alpha else 'opaque'}-{width}.png", width, height, alpha)
        for extension in ('jpg', 'webp'):
            subprocess.run(['ffmpeg', '-v', 'error', '-f', 'lavfi', '-i', f'testsrc2=size={width}x{height}:rate=1',
                            '-frames:v', '1', '-threads', '1', '-y', str(root / f'photo-{width}.{extension}')], check=True)
    for alpha in (False, True):
        png(root / f"{'alpha' if alpha else 'opaque'}-2400.png", 2400, 1800, alpha, noise=True)
    for label, size in (('a', '1024x768'), ('b', '1200x800')):
        subprocess.run(['ffmpeg', '-v', 'error', '-f', 'lavfi', '-i', f'testsrc2=size={size}:rate=1',
                        '-frames:v', '1', '-threads', '1', '-y', str(root / f'batch-{label}.jpg')], check=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=320x240:rate=24',
                    '-t', '2', '-c:v', 'libx264', '-threads', '1', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
                    '-y', str(root / 'clip.mp4')], check=True)
    manifest = [{'file': p.name, 'bytes': p.stat().st_size, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()}
                for p in sorted(root.iterdir()) if p.is_file() and p.suffix in ('.png', '.jpg', '.webp', '.mp4')]
    (root / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    return manifest
