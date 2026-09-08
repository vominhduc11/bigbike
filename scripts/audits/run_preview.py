#!/usr/bin/env python3
"""Run the isolated audit launcher; configuration stays outside the checkout."""
import argparse
import os
from pathlib import Path
import shutil
import uuid

parser = argparse.ArgumentParser()
parser.add_argument('--private-dir', type=Path, required=True)
parser.add_argument('--overlay-classes', type=Path)
parser.add_argument('--base-classes', type=Path)
args = parser.parse_args()
root = Path(__file__).resolve().parents[2]
private = args.private_dir.resolve()
snapshot = private / ('runtime-classes-' + uuid.uuid4().hex[:8])
base = args.base_classes.resolve() if args.base_classes else root / 'bigbike-backend/target/classes'
if args.base_classes and not base.is_relative_to(private):
    raise ValueError('Preview base snapshot must stay inside this audit directory')
shutil.copytree(base, snapshot)
if args.overlay_classes:
    # A changed-class preview can be tested while a separate Maven run still reads target/.
    overlay = args.overlay_classes.resolve()
    if not overlay.is_relative_to(private):
        raise ValueError('Preview overlay must stay inside this audit directory')
    shutil.copytree(overlay, snapshot, dirs_exist_ok=True)
(private / 'active-classpath-snapshot.txt').write_text(str(snapshot))
classpath = ':'.join([str(private / 'classes'), str(snapshot),
                      (private / 'classpath.txt').read_text().strip()])
os.execvp('java', ['java', '-XX:ActiveProcessorCount=2', '-Xmx640m', '-cp', classpath,
                    'audit.AuditPreview', '--spring.config.additional-location=file:'
                    + str(private / 'application-audit.properties')])
