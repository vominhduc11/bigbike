#!/usr/bin/env python3
"""Allowlisted aggregate test results; never copy environment/logs/test payloads."""
import argparse
import json
from pathlib import Path
import xml.etree.ElementTree as ET


def junit(directory):
    counts = dict(tests=0, failures=0, errors=0, skipped=0)
    nonpassing = []
    files = list(Path(directory).glob('TEST-*.xml'))
    if not files:
        raise ValueError('JUnit reports absent')
    for path in files:
        root = ET.parse(path).getroot()
        for key in counts:
            counts[key] += int(root.get(key, 0))
        for case in root.findall('testcase'):
            kinds = [tag for tag in ('failure', 'error', 'skipped') if case.find(tag) is not None]
            if kinds:
                nonpassing.append({'class': case.get('classname'), 'name': case.get('name'), 'status': kinds})
    return {'suite_files': len(files), **counts, 'passed': counts['tests'] - sum(counts[key] for key in ('failures','errors','skipped')),
            'nonpassing_cases': nonpassing}


def vitest(file):
    report = json.loads(Path(file).read_text())
    keys = ('numTotalTests', 'numPassedTests', 'numFailedTests', 'numPendingTests', 'numTodoTests',
            'numTotalTestSuites', 'numPassedTestSuites', 'numFailedTestSuites', 'success')
    return {**{key: report.get(key) for key in keys}, 'file_reports': len(report.get('testResults', []))}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--format', choices=('junit', 'vitest'), required=True)
    parser.add_argument('--input', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    result = junit(args.input) if args.format == 'junit' else vitest(args.input)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2) + '\n')
    if args.format == 'junit':
        if any(result[key] for key in ('failures', 'errors', 'skipped')):
            raise SystemExit('Backend gate contains failures/errors/skips; summary retained')
    elif not result.get('success') or any(result.get(key, 0) for key in ('numFailedTests', 'numPendingTests', 'numTodoTests')):
        raise SystemExit('Frontend gate incomplete; summary retained')


if __name__ == '__main__':
    main()
