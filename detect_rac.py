# Dry-run: find Spring beans whose hand-written constructor is byte-identical
# to what @RequiredArgsConstructor would generate.
import os, re

ROOT = r"s:\project\bigbike\bigbike-backend\src\main\java"
BEAN = re.compile(r'@(Service|Component|RestController|Controller|Configuration|Repository|RestControllerAdvice|ControllerAdvice)\b')

def strip_comments(s):
    s = re.sub(r'/\*.*?\*/', '', s, flags=re.DOTALL)
    s = re.sub(r'//[^\n]*', '', s)
    return s

def match_paren(text, i):  # i at '(' -> index of matching ')'
    d = 0
    while i < len(text):
        if text[i] == '(': d += 1
        elif text[i] == ')':
            d -= 1
            if d == 0: return i
        i += 1
    return -1

def match_brace(text, i):  # i at '{' -> index of matching '}'
    d = 0
    while i < len(text):
        if text[i] == '{': d += 1
        elif text[i] == '}':
            d -= 1
            if d == 0: return i
        i += 1
    return -1

convertible, skip = [], {}
def addskip(rel, reason):
    skip.setdefault(reason, []).append(rel)

for dirpath, _, files in os.walk(ROOT):
    for fn in files:
        if not fn.endswith(".java"):
            continue
        path = os.path.join(dirpath, fn)
        cls = fn[:-5]
        with open(path, encoding="utf-8", newline="") as f:
            raw = f.read()
        rel = os.path.relpath(path, r"s:\project\bigbike")
        if not BEAN.search(raw):
            continue
        if re.search(r'@RequiredArgsConstructor|@AllArgsConstructor|@NoArgsConstructor|@Builder|@Data', raw):
            addskip(rel, "already uses Lombok ctor annotation"); continue

        nc = strip_comments(raw)
        # find constructor declarations:  [vis] ClassName(
        ctors = [m for m in re.finditer(r'(?:public|protected|private)\s+' + re.escape(cls) + r'\s*\(', nc)]
        if len(ctors) == 0:
            continue  # no DI constructor -> not a candidate
        if len(ctors) > 1:
            addskip(rel, "multiple constructors"); continue

        cm = ctors[0]
        po = nc.index('(', cm.start())
        pc = match_paren(nc, po)
        params_raw = nc[po + 1:pc].strip()
        bo = nc.index('{', pc)
        bc = match_brace(nc, bo)
        body = nc[bo + 1:bc].strip()

        # parse params
        if params_raw == "":
            addskip(rel, "no-arg constructor (has logic?)"); continue
        params = []
        depth = 0; cur = ""
        for ch in params_raw:
            if ch == '<' or ch == '(': depth += 1
            elif ch == '>' or ch == ')': depth -= 1
            if ch == ',' and depth == 0:
                params.append(cur); cur = ""
            else:
                cur += ch
        params.append(cur)
        pnames, ptypes, bad = [], [], False
        for p in params:
            p = p.strip()
            if '@' in p:
                bad = "annotated param"; break
            p = re.sub(r'^final\s+', '', p)
            mm = re.match(r'^(.+?)\s+(\w+)$', p, re.DOTALL)
            if not mm:
                bad = "unparseable param"; break
            ptypes.append(re.sub(r'\s+', '', mm.group(1)))
            pnames.append(mm.group(2))
        if bad:
            addskip(rel, bad); continue

        # parse body: only this.X = X;
        stmts = [s.strip() for s in body.split(';') if s.strip()]
        assigned = []
        for st in stmts:
            am = re.match(r'^this\.(\w+)\s*=\s*(\w+)$', st)
            if not am or am.group(1) != am.group(2):
                bad = "ctor body not pure this.x=x"; break
            assigned.append(am.group(1))
        if bad:
            addskip(rel, bad); continue
        if sorted(assigned) != sorted(pnames):
            addskip(rel, "assigned fields != params"); continue

        # collect instance final fields (Lombok-included candidates)
        final_fields = []  # (name, type)
        annotated_field = False
        for fm in re.finditer(r'^[ \t]*((?:@\w+[^\n]*\n[ \t]*)*)'
                              r'(?:private|protected|public)?\s*final\s+([\w.$<>\[\],?\s]+?)\s+(\w+)\s*;',
                              nc, re.MULTILINE):
            anns, ftype, fname = fm.group(1), fm.group(2), fm.group(3)
            if 'static' in fm.group(0).split(fname)[0]:
                continue
            if anns.strip():
                if fname in pnames:
                    annotated_field = True
            final_fields.append((fname, re.sub(r'\s+', '', ftype)))
        if annotated_field:
            addskip(rel, "injected field is annotated"); continue

        ff_names = [n for n, t in final_fields]
        if ff_names != pnames:
            addskip(rel, "final-field order/set != ctor params"); continue
        # type cross-check
        ftypes = {n: t for n, t in final_fields}
        if any(ftypes[pnames[i]] != ptypes[i] for i in range(len(pnames))):
            addskip(rel, "param type != field type"); continue

        convertible.append(rel)

print(f"Spring beans with a single hand-written constructor analyzed.")
print(f"\n=== CONVERTIBLE ({len(convertible)}) ===")
for c in convertible:
    print("  " + c)
print(f"\n=== SKIPPED by reason ===")
for reason, lst in sorted(skip.items()):
    print(f"  [{reason}] : {len(lst)}")
