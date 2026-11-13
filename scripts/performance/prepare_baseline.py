#!/usr/bin/env python3
"""Check reproducible source identities, or reconstruct Before in a separate CI checkout."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    root = args.root.resolve()
    own_root = Path(__file__).resolve().parents[2]
    if args.apply and (os.environ.get("GITHUB_ACTIONS") != "true"
                       or os.environ.get("RUNNER_ENVIRONMENT") != "github-hosted" or root == own_root):
        parser.error("Applying the baseline requires a SEPARATE checkout on a GitHub-hosted runner")
    manifest = json.loads(Path(__file__).with_name("baseline-manifest.json").read_text())
    replacements = []
    for entry in manifest["files"]:
        path = root / entry["path"]
        if not path.resolve().is_relative_to(root) or path.is_symlink():
            parser.error("Source path escapes the isolated checkout")
        if hashlib.sha256(path.read_bytes()).hexdigest() != entry["candidate_sha256"]:
            parser.error(f"Candidate changed since baseline recorded: {entry['path']}; re-audit before regenerating")
        if "before_file" in entry:
            snapshot = own_root / entry["before_file"]
            if not snapshot.resolve().is_relative_to(own_root) or snapshot.is_symlink():
                parser.error("Before snapshot escapes tool source")
            original = snapshot.read_bytes()
            if hashlib.sha256(original).hexdigest() != entry["before_sha256"]:
                parser.error("Frozen Before snapshot changed; re-audit required")
        else:
            original = subprocess.check_output(["git", "-C", str(root), "cat-file", "blob", entry["before_blob"]])
        replacements.append((path, original))
    # Validate ALL files before changing any of them.
    if args.apply:
        for path, contents in replacements:
            path.write_bytes(contents)
    print(f"{'Reconstructed' if args.apply else 'Verified'} {len(replacements)} attributed source files")


if __name__ == "__main__":
    main()
