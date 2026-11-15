#!/usr/bin/env python3
"""Reject build-host CSS data anchors and verify the native standalone closure."""
import argparse
import json
from pathlib import Path
import re
import subprocess


ANCHOR = re.compile(r'''["']file://[^"']+/node_modules/css-tree/lib/data(?:-patch)?\.js["']''')


def host_anchor_count(standalone):
    count = 0
    for path in Path(standalone).rglob('*.js'):
        if 'node_modules' in path.relative_to(standalone).parts:
            continue
        count += len(ANCHOR.findall(path.read_text(errors='replace')))
    return count


def has_nonportable_symlink(standalone):
    root = Path(standalone).resolve()
    for path in root.rglob('*'):
        if path.is_symlink() and (path.readlink().is_absolute()
                or not path.resolve(strict=True).is_relative_to(root)):
            return True
    return False


NATIVE_PROBE = r"""
const fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
const root=fs.realpathSync(process.argv[1]), entry=process.argv[2];
function owned(file){const rel=path.relative(root,fs.realpathSync(file));if(rel==='..'||rel.startsWith('..'+path.sep)||path.isAbsolute(rel))throw Error('outside_artifact');}
try{
 const r=createRequire(entry);const css=r.resolve('css-tree');owned(css);
 const data=createRequire(css);
 for(const name of ['mdn-data/css/at-rules.json','mdn-data/css/properties.json','mdn-data/css/syntaxes.json'])owned(data.resolve(name));
 const tree=r('css-tree');
 const ast=tree.parse('color:red;padding:calc(1rem + 2px)',{context:'declarationList'});
 let declarations=0;tree.walk(ast,n=>{if(n.type==='Declaration')declarations++;});
 if(declarations!==2||!tree.lexer.matchProperty('color','red').matched)throw Error('invalid_css_data');
 const generated=tree.generate(ast);if(tree.parse(generated,{context:'declarationList'}).type!=='DeclarationList')throw Error('invalid_roundtrip');
 console.log(JSON.stringify({native_css_tree:true,mdn_data_inside_artifact:true,css_roundtrip:true,original_build_directory_readable:false}));
}catch{console.log(JSON.stringify({native_css_tree:false,failure_code:'STANDALONE_CSS_CLOSURE_FAILED'}));process.exitCode=1;}
"""


def inspect(app):
    standalone = (Path(app) / '.next/standalone').resolve()
    if not standalone.is_dir():
        raise ValueError('STANDALONE_ABSENT')
    entries = [standalone / name for name in ('server.js', 'bigbike-web/server.js')]
    entry = next((path for path in entries if path.is_file()), None)
    if entry is None:
        raise ValueError('STANDALONE_ENTRY_ABSENT')
    if has_nonportable_symlink(standalone):
        return {'portable': False, 'failure_code': 'STANDALONE_NONPORTABLE_SYMLINK',
                'scope': 'css-tree data portability; not full application acceptance'}
    count = host_anchor_count(standalone)
    if count:
        return {'portable': False, 'build_host_css_anchors': count,
                'scope': 'css-tree data portability; not full application acceptance',
                'failure_code': 'STANDALONE_BUILD_HOST_CSS_ANCHOR'}
    result = subprocess.run(['node', '--permission', '--allow-fs-read=' + str(standalone),
        '--input-type=commonjs', '-e', NATIVE_PROBE, str(standalone), str(entry)],
        cwd=standalone, capture_output=True, text=True, timeout=30)
    try:
        report = json.loads(result.stdout)
    except (ValueError, TypeError):
        report = {'failure_code': 'STANDALONE_NATIVE_PROBE_FAILED'}
    return {**report, 'build_host_css_anchors': 0,
            'scope': 'css-tree data portability; not full application acceptance',
            'portable': result.returncode == 0 and report.get('native_css_tree') is True}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--app', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    try:
        report = inspect(args.app)
    except Exception:
        report = {'portable': False, 'failure_code': 'STANDALONE_INSPECTION_FAILED'}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report))
    if not report['portable']:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
