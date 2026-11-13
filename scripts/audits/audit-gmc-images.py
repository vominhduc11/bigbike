#!/usr/bin/env python3
"""Create an image repair review from current public catalog/media snapshots. Never writes product data."""
import argparse
import csv
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from urllib.parse import unquote, urlsplit

THUMBNAIL = re.compile(r'-\d+x\d+(?=[-.])', re.I)


def asset_path(url):
    return unquote(urlsplit(url).path)


def normalized_filename(url):
    return THUMBNAIL.sub('', asset_path(url).rsplit('/', 1)[-1]).casefold()


class HtmlImages(HTMLParser):
    def __init__(self):
        super().__init__()
        self.images = []

    def handle_starttag(self, tag, attrs):
        if tag.casefold() == 'img':
            attrs = dict(attrs)
            if attrs.get('src'):
                self.images.append({'url': attrs['src'], 'width': attrs.get('width'), 'height': attrs.get('height')})


def pointers(value, scope='product'):
    if isinstance(value, dict):
        url = value.get('url')
        if isinstance(url, str) and (str(value.get('mimeType', '')).startswith('image/') or re.search(r'\.(jpe?g|png|webp|gif)(?:\?|$)', url, re.I)):
            yield scope, value
        for key, child in value.items():
            if key != 'variants':
                yield from pointers(child, scope + '.' + key)
    elif isinstance(value, list):
        for index, child in enumerate(value):
            yield from pointers(child, scope + f'[{index}]')
    elif isinstance(value, str) and '<img' in value.lower():
        parser = HtmlImages()
        parser.feed(value)
        for image in parser.images:
            yield scope + '.html', image


def dimension(value):
    try:
        return max(0, int(value or 0))
    except (ValueError, TypeError):
        return 0


def review(products, media):
    registry = {asset_path(row['public_url']): row for row in media if row.get('public_url')}
    filenames = {}
    for row in registry.values():
        filenames.setdefault(normalized_filename(row['public_url']), []).append(row)
    for product in products:
        for entity, scope in [(product, 'product')] + [(variant, 'variant') for variant in product.get('variants') or []]:
            for field, image in pointers(entity, scope):
                url = image['url']
                stored = registry.get(asset_path(url), {})
                width = dimension(image.get('width') or stored.get('width'))
                height = dimension(image.get('height') or stored.get('height'))
                thumb = bool(THUMBNAIL.search(asset_path(url)))
                if not thumb and width and height and min(width, height) >= 800:
                    continue
                reason = 'thumbnail' if thumb else 'under_800' if width and height else 'dimensions_unknown'
                candidates = [row for row in filenames.get(normalized_filename(url), [])
                              if asset_path(row['public_url']) != asset_path(url)
                              and not THUMBNAIL.search(asset_path(row['public_url']))
                              and dimension(row.get('width')) >= 800 and dimension(row.get('height')) >= 800]
                for candidate in candidates or [{}]:
                    yield [entity.get('sku', product.get('sku')), field, url, width or '', height or '', reason,
                           candidate.get('public_url', ''), candidate.get('width', ''), candidate.get('height', ''),
                           'UNVERIFIED: confirm product/color before replacing' if candidate else 'NO_VERIFIED_ORIGINAL: request shop image/source']


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--catalog-json', type=Path, required=True)
    parser.add_argument('--media-json', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    products = json.loads(args.catalog_json.read_text())
    media = json.loads(args.media_json.read_text())
    with args.output.open('w', encoding='utf-8', newline='') as output:
        writer = csv.writer(output)
        writer.writerow(['sku', 'scope', 'current_url', 'width', 'height', 'reason', 'candidate_url', 'candidate_width', 'candidate_height', 'decision'])
        writer.writerows(review(products, media))


if __name__ == '__main__':
    main()
