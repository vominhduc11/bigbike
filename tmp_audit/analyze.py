"""Analyze parsed WP data and emit counts/sample slugs/etc for the audit."""
import json
from collections import Counter
from pathlib import Path

OUT = Path(r"s:\project\bigbike\tmp_audit")

posts = json.load(open(OUT / 'wp_posts.json', encoding='utf-8'))
postmeta = json.load(open(OUT / 'wp_postmeta.json', encoding='utf-8'))
terms = json.load(open(OUT / 'wp_terms.json', encoding='utf-8'))
term_tax = json.load(open(OUT / 'wp_term_taxonomy.json', encoding='utf-8'))
term_rel = json.load(open(OUT / 'wp_term_relationships.json', encoding='utf-8'))

# Coerce postmeta keys to int
postmeta = {int(k): v for k, v in postmeta.items()}
terms = {int(k): v for k, v in terms.items()}
term_tax = {int(k): v for k, v in term_tax.items()}

print("=== Counts by (post_type, post_status) ===")
c = Counter((p['post_type'], p['post_status']) for p in posts)
for k, v in sorted(c.items()):
    print(f"  {k}: {v}")

print("\n=== Taxonomy counts ===")
tax_count = Counter(t['taxonomy'] for t in term_tax.values())
for k, v in sorted(tax_count.items(), key=lambda x: -x[1]):
    print(f"  {k}: {v}")

# Build product_cat term_taxonomy_id -> term info (only product_cat taxonomy)
product_cat_ttids = {ttid for ttid, tt in term_tax.items() if tt['taxonomy'] == 'product_cat'}
category_count = len(product_cat_ttids)
print(f"\nproduct_cat (categories) count: {category_count}")

# Map post -> categories
prod_to_cats = {}
for obj_id, ttid in term_rel:
    if ttid in product_cat_ttids:
        prod_to_cats.setdefault(obj_id, []).append(ttid)

# Products published
prod_published = [p for p in posts if p['post_type'] == 'product' and p['post_status'] == 'publish']
prod_publish_ids = {p['ID'] for p in prod_published}
print(f"\nProducts published: {len(prod_published)}")
print(f"Products with at least 1 category: {sum(1 for pid in prod_publish_ids if pid in prod_to_cats)}")
print(f"Products WITHOUT category: {sum(1 for pid in prod_publish_ids if pid not in prod_to_cats)}")

# Articles published
articles_pub = [p for p in posts if p['post_type'] == 'post' and p['post_status'] == 'publish']
print(f"Articles (post) published: {len(articles_pub)}")
articles_no_excerpt = [p for p in articles_pub if not p.get('post_excerpt')]
print(f"Articles without excerpt: {len(articles_no_excerpt)}")

# Pages
pages_pub = [p for p in posts if p['post_type'] == 'page' and p['post_status'] == 'publish']
print(f"Pages published: {len(pages_pub)}")

# Top-20 by _product_views
def view_score(pid):
    pm = postmeta.get(pid, {})
    for k in ('_product_views', '_views', 'product_views', 'post_views_count'):
        if k in pm:
            try:
                return int(pm[k])
            except Exception:
                pass
    return 0

prod_with_views = sorted(prod_published, key=lambda p: view_score(p['ID']), reverse=True)
print("\n=== Top 20 products by views ===")
for p in prod_with_views[:20]:
    pm = postmeta.get(p['ID'], {})
    price = pm.get('_price') or pm.get('_regular_price') or ''
    thumb = pm.get('_thumbnail_id', '')
    print(f"  ID={p['ID']} views={view_score(p['ID'])} slug={p['post_name']} price={price} thumb={thumb}")

# Sample 50 product slugs (deterministic by ID)
sample_50 = sorted([p['post_name'] for p in prod_published])[:50]
print("\n=== 50 sample product slugs ===")
for s in sample_50:
    print(f"  {s}")

# Top 20 article slugs by view
articles_sorted = sorted(articles_pub, key=lambda p: view_score(p['ID']), reverse=True)
print("\n=== Top 20 article slugs (by view if available, else first 20) ===")
for p in articles_sorted[:20]:
    print(f"  {view_score(p['ID'])}\t{p['post_name']}")

# Save lists for reuse
data_for_pg = {
    'wp_product_count': len(prod_published),
    'wp_category_count': category_count,
    'wp_article_count': len(articles_pub),
    'wp_page_count': len(pages_pub),
    'sample_product_slugs': sample_50,
    'top_view_product_slugs': [p['post_name'] for p in prod_with_views[:20]],
    'top_article_slugs': [p['post_name'] for p in articles_sorted[:20]],
    'top_view_products_full': [
        {
            'ID': p['ID'],
            'slug': p['post_name'],
            'title': p['post_title'],
            'views': view_score(p['ID']),
            'price': postmeta.get(p['ID'], {}).get('_price') or postmeta.get(p['ID'], {}).get('_regular_price'),
            'thumbnail_id': postmeta.get(p['ID'], {}).get('_thumbnail_id'),
        }
        for p in prod_with_views[:20]
    ],
    'products_no_category': [pid for pid in sorted(prod_publish_ids) if pid not in prod_to_cats],
    'articles_no_excerpt_ids': [a['ID'] for a in articles_no_excerpt],
    'wp_product_with_views_count': sum(1 for p in prod_published if view_score(p['ID']) > 0),
}
with open(OUT / 'audit_data.json', 'w', encoding='utf-8') as f:
    json.dump(data_for_pg, f, ensure_ascii=False, indent=2)
print(f"\nSaved {OUT / 'audit_data.json'}")
