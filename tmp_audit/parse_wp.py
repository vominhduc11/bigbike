"""
Parse WordPress MySQL dump for the data quality audit.
Format: each INSERT has tuples on their own lines.
  INSERT INTO `kd_posts` VALUES
  (col1, col2, ...),
  (col1, col2, ...),
  ...
  (col1, col2, ...);
"""
import json
import re
import sys
from pathlib import Path

DUMP = Path(r"s:\project\bigbike\bigbike_vn__2026_04_17\sqldump.sql")
OUT = Path(r"s:\project\bigbike\tmp_audit")
OUT.mkdir(exist_ok=True)


def parse_values(s: str):
    """Parse tuple body s (no surrounding parens). Returns list of values."""
    out = []
    i, n = 0, len(s)
    while i < n:
        while i < n and s[i] in ' ,\t\n\r':
            i += 1
        if i >= n:
            break
        if s[i] == "'":
            i += 1
            buf = []
            while i < n:
                c = s[i]
                if c == '\\' and i + 1 < n:
                    nxt = s[i + 1]
                    buf.append({'n': '\n', 'r': '\r', 't': '\t', '0': '\x00', 'Z': '\x1a'}.get(nxt, nxt))
                    i += 2
                    continue
                if c == "'":
                    if i + 1 < n and s[i + 1] == "'":
                        buf.append("'")
                        i += 2
                        continue
                    i += 1
                    break
                buf.append(c)
                i += 1
            out.append(''.join(buf))
        else:
            j = i
            while j < n and s[j] != ',':
                j += 1
            tok = s[i:j].strip()
            if tok.upper() == 'NULL':
                out.append(None)
            else:
                try:
                    if '.' in tok:
                        out.append(float(tok))
                    else:
                        out.append(int(tok))
                except ValueError:
                    out.append(tok)
            i = j
    return out


POSTS_COLS = [
    'ID', 'post_author', 'post_date', 'post_date_gmt', 'post_content',
    'post_title', 'post_excerpt', 'post_status', 'comment_status', 'ping_status',
    'post_password', 'post_name', 'to_ping', 'pinged', 'post_modified',
    'post_modified_gmt', 'post_content_filtered', 'post_parent', 'guid',
    'menu_order', 'post_type', 'post_mime_type', 'comment_count',
]
TARGET_TABLES = {'kd_posts', 'kd_postmeta', 'kd_terms', 'kd_term_taxonomy', 'kd_term_relationships'}
TARGET_POST_TYPES = {'product', 'post', 'page'}
SELECTED_META = {
    '_product_views', '_views', 'post_views_count', 'product_views',
    '_price', '_regular_price', '_sale_price',
    '_thumbnail_id', '_stock_status', '_visibility',
}

INSERT_HEAD = re.compile(r"^INSERT INTO `(\w+)` VALUES\s*$")


def stream_inserts(path):
    """Yield (table, tuple_body) for every row across multi-line INSERTs."""
    cur_table = None
    with open(path, 'r', encoding='utf-8', errors='replace') as f:
        for line in f:
            if cur_table is None:
                m = INSERT_HEAD.match(line.rstrip('\n'))
                if m and m.group(1) in TARGET_TABLES:
                    cur_table = m.group(1)
                continue
            # in an INSERT block — line is "(...)" possibly ending with , or ;
            l = line.rstrip('\n').rstrip()
            ends_block = l.endswith(';')
            if ends_block:
                l = l[:-1]
            if l.endswith(','):
                l = l[:-1]
            l = l.strip()
            if l.startswith('(') and l.endswith(')'):
                yield cur_table, l[1:-1]
            if ends_block:
                cur_table = None


def main():
    posts = {}
    postmeta = {}
    terms = {}
    term_tax = {}
    term_rel = []
    counts_by_table = {t: 0 for t in TARGET_TABLES}

    for n, (table, tup) in enumerate(stream_inserts(DUMP), 1):
        counts_by_table[table] += 1
        row = parse_values(tup)
        if table == 'kd_posts':
            if len(row) < len(POSTS_COLS):
                continue
            rec = dict(zip(POSTS_COLS, row))
            if rec['post_type'] in TARGET_POST_TYPES:
                posts[rec['ID']] = {
                    'ID': rec['ID'],
                    'post_status': rec['post_status'],
                    'post_name': rec['post_name'],
                    'post_type': rec['post_type'],
                    'post_title': rec['post_title'],
                    'post_excerpt': rec['post_excerpt'],
                }
        elif table == 'kd_postmeta':
            if len(row) < 4:
                continue
            _, pid, mkey, mval = row[:4]
            if mkey in SELECTED_META:
                postmeta.setdefault(pid, {})[mkey] = mval
        elif table == 'kd_terms':
            if len(row) < 4:
                continue
            tid, name, slug, _ = row[:4]
            terms[tid] = {'name': name, 'slug': slug}
        elif table == 'kd_term_taxonomy':
            if len(row) < 6:
                continue
            ttid, tid, tax, _desc, parent, count = row[:6]
            term_tax[ttid] = {
                'term_id': tid, 'taxonomy': tax,
                'parent': parent, 'count': count,
            }
        elif table == 'kd_term_relationships':
            if len(row) < 2:
                continue
            term_rel.append((row[0], row[1]))
        if n % 100000 == 0:
            print(f"rows={n} posts={len(posts)} pm={len(postmeta)} terms={len(terms)} tt={len(term_tax)} tr={len(term_rel)}", file=sys.stderr)

    print(f"DONE: counts_by_table={counts_by_table}", file=sys.stderr)
    print(f"posts={len(posts)} postmeta_posts={len(postmeta)} terms={len(terms)} term_tax={len(term_tax)} term_rel={len(term_rel)}", file=sys.stderr)

    with open(OUT / 'wp_posts.json', 'w', encoding='utf-8') as f:
        json.dump(list(posts.values()), f, ensure_ascii=False)
    with open(OUT / 'wp_postmeta.json', 'w', encoding='utf-8') as f:
        json.dump(postmeta, f, ensure_ascii=False)
    with open(OUT / 'wp_terms.json', 'w', encoding='utf-8') as f:
        json.dump(terms, f, ensure_ascii=False)
    with open(OUT / 'wp_term_taxonomy.json', 'w', encoding='utf-8') as f:
        json.dump(term_tax, f, ensure_ascii=False)
    with open(OUT / 'wp_term_relationships.json', 'w', encoding='utf-8') as f:
        json.dump(term_rel, f, ensure_ascii=False)


if __name__ == '__main__':
    main()
