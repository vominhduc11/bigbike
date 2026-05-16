# @RequiredArgsConstructor converter — strict, byte-identical only.
#   python rac.py         -> dry-run report
#   python rac.py apply   -> apply conversions
import os, re, sys

ROOT = r"s:\project\bigbike\bigbike-backend\src\main\java"
BEAN = re.compile(r'@(Service|Component|RestController|Controller|Configuration|Repository|RestControllerAdvice|ControllerAdvice)\b')
APPLY = len(sys.argv) > 1 and sys.argv[1] == "apply"


def strip_comments(s):
    # string-aware; keeps newline count identical so line indices map 1:1
    out, i, n = [], 0, len(s)
    while i < n:
        c = s[i]
        if c == '"' and s[i:i + 3] == '"""':
            j = s.find('"""', i + 3)
            j = (j + 3) if j >= 0 else n
            out.append(s[i:j]); i = j; continue
        if c == '"' or c == "'":
            j = i + 1
            while j < n and s[j] != c:
                if s[j] == '\\':
                    j += 1
                j += 1
            j += 1
            out.append(s[i:j]); i = j; continue
        if c == '/' and i + 1 < n and s[i + 1] == '/':
            j = s.find('\n', i)
            i = j if j >= 0 else n; continue
        if c == '/' and i + 1 < n and s[i + 1] == '*':
            j = s.find('*/', i + 2)
            j = (j + 2) if j >= 0 else n
            out.append('\n' * s[i:j].count('\n')); i = j; continue
        out.append(c); i += 1
    return ''.join(out)


def match_delim(text, i, op, cl):
    d = 0
    while i < len(text):
        c = text[i]
        if c == '"' and text[i:i + 3] == '"""':
            j = text.find('"""', i + 3)
            if j < 0:
                return -1
            i = j + 3
            continue
        if c == '"' or c == "'":
            i += 1
            while i < len(text) and text[i] != c:
                if text[i] == '\\':
                    i += 1
                i += 1
        elif c == op:
            d += 1
        elif c == cl:
            d -= 1
            if d == 0:
                return i
        i += 1
    return -1


def class_body_span(nc, cls):
    m = re.search(r'\b(class|interface|enum)\s+' + re.escape(cls) + r'\b', nc)
    if not m:
        return None
    bo = nc.index('{', m.end())
    return bo, match_delim(nc, bo, '{', '}')


def parse_fields(nc, bo, bc):
    fields, i, buf = [], bo + 1, bo + 1
    while i < bc:
        c = nc[i]
        if c == '"' and nc[i:i + 3] == '"""':
            j = nc.find('"""', i + 3)
            i = (j + 3) if j >= 0 else bc
            continue
        if c == '"' or c == "'":
            i += 1
            while i < bc and nc[i] != c:
                if nc[i] == '\\':
                    i += 1
                i += 1
            i += 1
            continue
        if c == ';':
            decl = nc[buf:i].strip()
            if decl and '(' not in decl and decl.split('=')[0].strip():
                fd = parse_field_decl(decl)
                if fd:
                    fields.append(fd)
            buf = i + 1
        elif c == '{':
            j = match_delim(nc, i, '{', '}')
            if '=' not in nc[buf:i]:
                buf = j + 1
            i = j
        i += 1
    return fields


def parse_field_decl(decl):
    head = decl.split('=')[0].strip()
    has_init = '=' in decl
    d = 0
    for ch in head:
        if ch in '<(':
            d += 1
        elif ch in '>)':
            d -= 1
        elif ch == ',' and d == 0:
            return None
    annotated = head.lstrip().startswith('@')
    head = re.sub(r'@\w+(?:\([^)]*\))?', '', head).strip()
    m = re.match(r'^(.*\s)(\w+)$', head, re.DOTALL)
    if not m:
        return None
    toks = m.group(1).split()
    return {'name': m.group(2),
            'type': re.sub(r'\s+', '', ' '.join(
                t for t in toks if t not in ('private', 'protected', 'public',
                'static', 'final', 'transient', 'volatile'))),
            'static': 'static' in toks, 'final': 'final' in toks,
            'init': has_init, 'annotated': annotated}


def analyze(path):
    cls = os.path.basename(path)[:-5]
    with open(path, encoding="utf-8", newline="") as f:
        raw = f.read()
    if not BEAN.search(raw):
        return ('not-bean', None)
    if re.search(r'@(RequiredArgsConstructor|AllArgsConstructor|NoArgsConstructor|Builder|Data)\b', raw):
        return ('skip', 'already uses Lombok ctor annotation')
    nc = strip_comments(raw)
    span = class_body_span(nc, cls)
    if not span:
        return ('skip', 'class body not found')
    bo, bc = span
    if bc < 0:
        return ('skip', 'unbalanced braces')
    ctors = [m for m in re.finditer(r'(?:public|protected|private)\s+' + re.escape(cls) + r'\s*\(', nc)
             if bo < m.start() < bc]
    if len(ctors) == 0:
        return ('not-bean', None)
    if len(ctors) > 1:
        return ('skip', 'multiple constructors')
    cm = ctors[0]
    po = nc.index('(', cm.start())
    pc = match_delim(nc, po, '(', ')')
    params_raw = nc[po + 1:pc].strip()
    body_o = nc.index('{', pc)
    body_c = match_delim(nc, body_o, '{', '}')
    body = nc[body_o + 1:body_c].strip()
    if params_raw == '':
        return ('skip', 'no-arg / parameterless constructor')

    parts, d, cur = [], 0, ''
    for ch in params_raw:
        if ch in '<(':
            d += 1
        elif ch in '>)':
            d -= 1
        if ch == ',' and d == 0:
            parts.append(cur); cur = ''
        else:
            cur += ch
    parts.append(cur)
    pnames, ptypes = [], []
    for p in parts:
        p = p.strip()
        if '@' in p:
            return ('skip', 'annotated constructor param')
        p = re.sub(r'^final\s+', '', p)
        mm = re.match(r'^(.+?)\s+(\w+)$', p, re.DOTALL)
        if not mm:
            return ('skip', 'unparseable param')
        ptypes.append(re.sub(r'\s+', '', mm.group(1)))
        pnames.append(mm.group(2))

    stmts = [s.strip() for s in body.split(';') if s.strip()]
    assigned = []
    for st in stmts:
        am = re.match(r'^this\.(\w+)\s*=\s*(\w+)$', st)
        if not am or am.group(1) != am.group(2):
            return ('skip', 'constructor body has logic')
        assigned.append(am.group(1))
    if sorted(assigned) != sorted(pnames):
        return ('skip', 'assigned set != params')

    fields = parse_fields(nc, bo, bc)
    lombok_fields = [f for f in fields if f['final'] and not f['static'] and not f['init']]
    if [f['name'] for f in lombok_fields] != pnames:
        return ('skip', 'final-field set/order != ctor params')
    if any(f['annotated'] for f in lombok_fields):
        return ('skip', 'injected field is annotated')
    ftypes = {f['name']: f['type'] for f in lombok_fields}
    if any(ftypes[pnames[i]] != ptypes[i] for i in range(len(pnames))):
        return ('skip', 'param type != field type')

    # guard: ctor must be preceded only by blank / @Autowired / a prior member end
    ctor_line = nc[:cm.start()].count('\n')
    close_line = nc[:body_c].count('\n')
    nc_lines = nc.splitlines()
    prev = nc_lines[ctor_line - 1].strip() if ctor_line > 0 else ''
    if prev.startswith('@') and prev != '@Autowired':
        return ('skip', 'constructor has annotation')
    if prev.startswith('*') or prev.startswith('/*') or prev.endswith('*/'):
        return ('skip', 'constructor has javadoc')
    return ('convert', {'cls': cls, 'ctor_line': ctor_line, 'close_line': close_line})


def apply_conversion(path, info):
    with open(path, encoding="utf-8", newline="") as f:
        raw = f.read()
    lines = raw.splitlines(keepends=True)
    cl, ce = info['ctor_line'], info['close_line']
    start = cl
    if start > 0 and lines[start - 1].strip() == '@Autowired':
        start -= 1
    end = ce  # inclusive
    # collapse a surrounding blank line
    if start > 0 and lines[start - 1].strip() == '' \
       and end + 1 < len(lines) and lines[end + 1].strip() == '':
        start -= 1
    del lines[start:end + 1]

    eol = '\r\n' if raw.endswith('\r\n') or '\r\n' in raw[:200] else '\n'
    # insert @RequiredArgsConstructor before class declaration
    for i, ln in enumerate(lines):
        if re.match(r'^(?:(?:public|final|abstract|sealed|non-sealed)\s+)*class\s+'
                    + re.escape(info['cls']) + r'\b', ln):
            lines.insert(i, '@RequiredArgsConstructor' + eol)
            break
    # insert import
    if not any(l.strip() == 'import lombok.RequiredArgsConstructor;' for l in lines):
        idx = next((i for i, l in enumerate(lines) if l.startswith('import lombok.')), None)
        if idx is None:
            idx = next((i for i, l in enumerate(lines) if l.startswith('import org.')), None)
        if idx is None:
            idx = next(i for i, l in enumerate(lines) if l.startswith('import '))
        lines.insert(idx, 'import lombok.RequiredArgsConstructor;' + eol)

    with open(path, 'w', encoding='utf-8', newline='') as f:
        f.writelines(lines)


convert, skip = [], {}
for dirpath, _, files in os.walk(ROOT):
    for fn in files:
        if not fn.endswith('.java'):
            continue
        path = os.path.join(dirpath, fn)
        rel = os.path.relpath(path, r"s:\project\bigbike")
        try:
            verdict, info = analyze(path)
        except Exception as e:
            skip.setdefault('parse-error: ' + repr(e), []).append(rel)
            continue
        if verdict == 'convert':
            convert.append((path, info))
        elif verdict == 'skip':
            skip.setdefault(info, []).append(rel)

if APPLY:
    for path, info in convert:
        apply_conversion(path, info)
    print(f"APPLIED to {len(convert)} files.")
else:
    print(f"CONVERTIBLE: {len(convert)}")
    for reason, lst in sorted(skip.items(), key=lambda x: -len(x[1])):
        print(f"  SKIP [{len(lst)}] {reason}")
        if 'parse-error' in reason:
            for x in lst:
                print('       ' + x)
