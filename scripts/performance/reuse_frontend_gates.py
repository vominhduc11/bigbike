#!/usr/bin/env python3
"""Reuse only immutable, successful, source-identical frontend gates; fail closed to rerun."""
import argparse
import json
import os
from pathlib import Path
import subprocess
import urllib.request

ANCHOR = '7ce05befd54a10f2aee36e8f20c52d0dee36863c'
RUN_ID = 43702380890
REPOSITORY = 'vominhduc11/bigbike'
WORKFLOW = '.github/workflows/performance-validation.yml'
CONDITION = "    if: needs.boundary.outputs.reuse_frontend != 'true'\n"


def frontend_block(source):
    return source.split('\n  frontend:\n', 1)[1].split('\n  backend:\n', 1)[0].replace(CONDITION, '')


def successful_jobs(run, report):
    if (run.get('head_sha') != ANCHOR or run.get('path') != WORKFLOW
            or run.get('status') != 'completed'
            or run.get('repository', {}).get('full_name') != REPOSITORY
            or run.get('repository', {}).get('private') is not False):
        return False
    for app in ('bigbike-web', 'bigbike-admin'):
        jobs = [job for job in report.get('jobs', []) if job.get('name') == f'Frontend regression gates ({app})']
        if len(jobs) != 1 or jobs[0].get('conclusion') != 'success':
            return False
        steps = jobs[0].get('steps', [])
        for name in ('Unit regressions', 'Preserve only sanitized counts and enforce no skips'):
            if not any(step.get('name') == name and step.get('conclusion') == 'success' for step in steps):
                return False
        for prefix in ('Run npm run lint >', 'Run npm run build'):
            if not any(step.get('name', '').startswith(prefix) and step.get('conclusion') == 'success' for step in steps):
                return False
        if app == 'bigbike-web' and not any(
                step.get('name') == 'Check standalone portability without access to the build directory'
                and step.get('conclusion') == 'success' for step in steps):
            return False
    return True


def decision(root, fetch):
    result = {'reuse_frontend': False, 'anchor_commit': ANCHOR, 'anchor_run_id': RUN_ID,
              'anchor_url': f'https://github.com/{REPOSITORY}/actions/runs/{RUN_ID}'}
    try:
        diff = subprocess.run(['git', 'diff', '--quiet', ANCHOR, 'HEAD', '--',
            'bigbike-web', 'bigbike-admin', 'scripts/performance/summarize_tests.py',
            'scripts/performance/check_standalone.py'], cwd=root)
        if diff.returncode != 0:
            return {**result, 'reason': 'frontend_source_changed_or_unavailable'}
        previous = subprocess.check_output(['git', 'show', ANCHOR + ':' + WORKFLOW], cwd=root, text=True)
        if frontend_block(previous) != frontend_block((root / WORKFLOW).read_text()):
            return {**result, 'reason': 'frontend_gate_definition_changed'}
        base = f'https://api.github.com/repos/{REPOSITORY}/actions/runs/{RUN_ID}'
        if not successful_jobs(fetch(base), fetch(base + '/jobs?filter=latest&per_page=100')):
            return {**result, 'reason': 'remote_success_proof_missing'}
        return {**result, 'reuse_frontend': True, 'reason': 'same_source_same_gates_both_remote_jobs_passed'}
    except Exception:
        return {**result, 'reason': 'proof_unavailable_rerun_full_frontends'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    if os.environ.get('GITHUB_ACTIONS') != 'true' or os.environ.get('RUNNER_ENVIRONMENT') != 'github-hosted':
        parser.error('Hosted CI boundary required')
    def fetch(url):
        request = urllib.request.Request(url, headers={'Accept': 'application/vnd.github+json', 'User-Agent': 'BigBike-gate-proof'})
        with urllib.request.urlopen(request, timeout=15) as response:
            return json.load(response)
    result = decision(Path(__file__).resolve().parents[2], fetch)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2) + '\n')
    with open(os.environ['GITHUB_OUTPUT'], 'a') as output:
        output.write('reuse_frontend=' + str(result['reuse_frontend']).lower() + '\n')
    print('Frontend reuse:', result['reuse_frontend'], result['reason'])


if __name__ == '__main__':
    main()
