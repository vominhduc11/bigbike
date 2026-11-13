"""Run the existing Admin smoke fixture only against the isolated hosted CI stack."""
import json
import os
from pathlib import Path
import signal
import subprocess

from ci_guard import loopback_url, require_ci, safe_directory


def _counts(report):
    """Count project test cases, never copy titles, errors, attachments or stdout."""
    counts = dict(tests=0, passed=0, failed=0, skipped=0, not_run=0,
                  flaky=0, timed_out=0, interrupted=0)

    def visit(suite):
        for spec in suite.get('specs', []):
            for test in spec.get('tests', []):
                counts['tests'] += 1
                results = test.get('results', [])
                last = results[-1].get('status') if results else None
                status = test.get('status')
                if status == 'flaky':
                    counts['flaky'] += 1
                if last == 'timedOut':
                    counts['timed_out'] += 1
                if last == 'interrupted':
                    counts['interrupted'] += 1
                if status == 'skipped' or last == 'skipped':
                    counts['skipped'] += 1
                elif last is None:
                    counts['not_run'] += 1
                elif last == 'passed' and status == 'expected' and test.get('expectedStatus', 'passed') == 'passed':
                    counts['passed'] += 1
                else:
                    # Expected failures and flaky retries do not certify the smoke flow.
                    counts['failed'] += 1
        for child in suite.get('suites', []):
            visit(child)

    for suite in report.get('suites', []):
        visit(suite)
    counts['report_errors'] = len(report.get('errors', []))
    return counts


def _private_file(path):
    return os.fdopen(os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600), 'w')


def run_smoke(root, password, private_dir, environment):
    """Return sanitized counts even on failure; caller persists them before gating.

    No environment is inherited from this Python process. The standard fixture
    performs real authentication/rotation and prefix-scoped E2E cleanup. Traces,
    screenshots, JSON, stdout and stderr stay under the private temporary path.
    """
    require_ci(environment)
    temporary_root = environment.get('RUNNER_TEMP')
    if not temporary_root or not isinstance(password, str) or not password:
        raise ValueError('CI temporary directory and generated credential required')
    root = safe_directory(root, temporary_root)
    private_dir = safe_directory(private_dir, temporary_root)
    origin = loopback_url('http://localhost:14000')
    directory = private_dir / 'admin-smoke'
    directory.mkdir(mode=0o700, parents=True, exist_ok=False)
    directory.chmod(0o700)
    names = ('PATH', 'HOME', 'LANG', 'LC_ALL', 'TMPDIR', 'RUNNER_TEMP',
             'GITHUB_ACTIONS', 'RUNNER_ENVIRONMENT', 'CI', 'PLAYWRIGHT_BROWSERS_PATH',
             'NODE_OPTIONS')
    env = {key: environment[key] for key in names if key in environment}
    env.update(E2E_BASE_URL=origin, E2E_NO_WEBSERVER='1',
               E2E_ADMIN_EMAIL='perf-admin@example.invalid', E2E_ADMIN_PASSWORD=password,
               CI='true', NO_COLOR='1')
    command = ['npm', 'exec', '--', 'playwright', 'test', 'smoke-routes.spec.ts',
               '--workers=1', '--retries=0', '--reporter=json',
               '--output=' + str(directory / 'artifacts')]
    timed_out = False
    launch_failed = False
    exit_code = None
    stdout_path = directory / 'report-private.json'
    with _private_file(stdout_path) as stdout, _private_file(directory / 'stderr-private.log') as stderr:
        try:
            process = subprocess.Popen(command, cwd=root / 'bigbike-admin', env=env,
                                       stdout=stdout, stderr=stderr, start_new_session=True)
        except OSError:
            launch_failed = True
        else:
            try:
                exit_code = process.wait(timeout=900)
            except subprocess.TimeoutExpired:
                timed_out = True
                # These are only the wrapper's own npm/Playwright children, never services.
                try:
                    os.killpg(process.pid, signal.SIGTERM)
                except ProcessLookupError:
                    pass
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    try:
                        os.killpg(process.pid, signal.SIGKILL)
                    except ProcessLookupError:
                        pass
                    process.wait(timeout=5)
                exit_code = 124
    summary = dict(exit_code=127 if launch_failed else exit_code,
                   report_valid=False, timed_out_process=timed_out,
                   scope='Existing desktop Admin smoke/create-form fixture; no all-screen or performance certification',
                   discontinued_screen_in_catalog=False)
    summary.update(_counts({}))
    try:
        report = json.loads(stdout_path.read_text())
        if not isinstance(report, dict) or not isinstance(report.get('suites'), list):
            raise ValueError('Missing Playwright suites')
        summary.update(_counts(report))
        summary['report_valid'] = True
    except (OSError, ValueError, TypeError, AttributeError):
        summary['failure_code'] = 'SMOKE_REPORT_INVALID'
    if launch_failed:
        summary['failure_code'] = 'SMOKE_PROCESS_START_FAILED'
    elif timed_out:
        summary['failure_code'] = 'SMOKE_PROCESS_TIMEOUT'
    elif exit_code:
        summary['failure_code'] = 'SMOKE_PROCESS_FAILED'
    return summary
