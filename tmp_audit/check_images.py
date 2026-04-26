"""HTTP HEAD/GET check on 30 sample image URLs."""
import json
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

OUT = Path(r"s:\project\bigbike\tmp_audit")

rows = []
with open(OUT / 'sample30_images.tsv', 'r', encoding='utf-8') as f:
    for line in f:
        line = line.rstrip('\n')
        if not line:
            continue
        parts = line.split('\t', 1)
        if len(parts) == 2:
            rows.append(parts)

results = []
for slug, url in rows:
    try:
        req = Request(url, method='GET')
        with urlopen(req, timeout=10) as r:
            status = r.status
            ctype = r.headers.get('Content-Type', '')
            length = r.headers.get('Content-Length', '?')
            ok = status == 200 and ctype.startswith('image/')
            results.append({
                'slug': slug, 'url': url, 'status': status,
                'content_type': ctype, 'length': length, 'ok': ok,
            })
            print(f"{'OK' if ok else 'BAD'}\t{status}\t{ctype}\t{length}\t{slug}")
    except HTTPError as e:
        print(f"HTTP_ERR\t{e.code}\t-\t-\t{slug}")
        results.append({'slug': slug, 'url': url, 'status': e.code, 'content_type': '', 'length': 0, 'ok': False})
    except URLError as e:
        print(f"URL_ERR\t-\t{e.reason}\t-\t{slug}")
        results.append({'slug': slug, 'url': url, 'status': 0, 'content_type': str(e.reason), 'length': 0, 'ok': False})
    except Exception as e:
        print(f"EXC\t-\t{type(e).__name__}: {e}\t-\t{slug}")
        results.append({'slug': slug, 'url': url, 'status': 0, 'content_type': str(e), 'length': 0, 'ok': False})

ok_count = sum(1 for r in results if r['ok'])
print(f"\nTOTAL OK: {ok_count}/{len(results)}")

with open(OUT / 'image_check.json', 'w', encoding='utf-8') as f:
    json.dump(results, f, ensure_ascii=False, indent=2)
