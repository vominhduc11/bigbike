#!/usr/bin/env python3
"""Build and measure two frozen arms on an isolated, quota-approved hosted runner."""
import argparse
import sys
# Keep a clean published checkout clean before importing task-local modules.
sys.dont_write_bytecode = True
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import subprocess
import tempfile
from threading import Event, Thread
import time
from urllib.parse import urlsplit
import urllib.request

from benchmark_api import measure
from ci_guard import require_ci, project_name, safe_directory
from fixtures import generate
from frozen_dataset import capture, restore, identity as dataset_identity
from admin_smoke import run_smoke
from compare_results import compare
from commerce_checks import check_commerce
from large_catalog import seed_large, verify_large_pages, LargeCatalogFailure
from loopback_relay import LoopbackRelays
from merchant_checks import run_merchant_checks
from runtime_diagnostics import collect as collect_failure_diagnostics
from revalidation_checks import verify_revalidation
from s3_setup import setup as setup_bucket
from stack_checks import functional_checks, login, media_checks, NoRedirect, seed


def write_json(path, value):
    Path(path).write_text(json.dumps(value, indent=2) + '\n')


def finalize_arm(stack, output, status, original_error=False):
    """Always attempt both owned cleanups, even if evidence storage fails."""
    failures = []
    for code, operation in (
        ('relay_shutdown_failed', stack.relays.close),
        ('owned_stack_cleanup_failed', lambda: stack.compose('down', '--volumes', '--remove-orphans', '--timeout', '10') if stack.started else None),
        ('transport_write_failed', lambda: write_json(output / 'transport.json', stack.relays.stats())),
    ):
        try:
            operation()
        except Exception:
            failures.append(code)
    if failures:
        status.update(complete=False, completion_failure_codes=failures)
    try:
        write_json(output / 'status.json', status)
    except Exception:
        failures.append('status_write_failed')
    if failures and not original_error:
        raise RuntimeError('CI arm cleanup or evidence recording failed')


def bounded_resources(stack, expected_services=7):
    """Observe at most every3s, matching the load watcher without Docker probe storms."""
    state, collected_at = None, float('-inf')
    def collect():
        nonlocal state, collected_at
        if time.monotonic() - collected_at >= 3:
            state = stack.resources(expected_services)
            collected_at = time.monotonic()
        return state
    return collect


def clean_environment():
    # Explicit allowlist prevents inherited app .env/provider credentials from builds.
    names = ('PATH', 'HOME', 'JAVA_HOME', 'JAVA_HOME_17_X64', 'LANG', 'LC_ALL', 'TMPDIR',
             'RUNNER_TEMP', 'GITHUB_ACTIONS', 'RUNNER_ENVIRONMENT', 'CI', 'PLAYWRIGHT_BROWSERS_PATH',
             'CHROME_PATH', 'PYTHONDONTWRITEBYTECODE')
    return {key: os.environ[key] for key in names if key in os.environ}


class CommandFailure(RuntimeError):
    def __init__(self, executable, exit_code, categories):
        self.categories = categories
        super().__init__(f'Command failed: {executable}; exit={exit_code}; categories={",".join(categories)}')


def run(command, *, cwd=None, env=None, timeout=1200, combine_output=False):
    process = subprocess.run(command, cwd=cwd, env=env or clean_environment(),
                             capture_output=True, text=True, timeout=timeout)
    if process.returncode:
        # No raw build logs/XML/environment dumps become downloadable artifacts.
        # Publish fixed categories only, never captured lines or command arguments
        # (which can contain generated passwords or object/session identifiers).
        combined = process.stdout + process.stderr
        categories = [label for label, pattern in (
            ('java_compile', r'COMPILATION ERROR|cannot find symbol'),
            ('dependency_resolution', r'Could not resolve|Could not transfer|ENOTFOUND|ECONNRESET'),
            ('out_of_memory', r'OutOfMemoryError|heap out of memory|Killed'),
            ('disk_full', r'No space left on device|ENOSPC'),
            ('docker_health', r'unhealthy|failed to reach running'),
            ('registry_authentication', r'pull access denied|requested access.*denied|authentication required|unauthorized|insufficient_scope'),
            ('registry_manifest', r'manifest unknown|no matching manifest|manifest.*not found'),
            ('registry_rate_limit', r'toomanyrequests|pull rate limit'),
            ('registry_transport', r'TLS handshake timeout|i/o timeout|connection refused|temporary failure in name resolution|failed to resolve source metadata'),
            ('docker_network_overlap', r'pool overlaps|address space.*overlap'),
            ('compose_config', r'invalid compose|validating.*compose|invalid interpolation|must be a mapping|service.*refers to undefined'),
            ('port_conflict', r'address already in use|port is already allocated'),
            ('frontend_build', r'Failed to compile|Type error:|Build error occurred'),
            ('standalone_portability', r'STANDALONE_[A-Z_]+'),
            ('api_http_error', r'HTTPError|Unexpected HTTP status'),
            ('assertion', r'AssertionError'),
        ) if re.search(pattern, combined, re.I)]
        raise CommandFailure(Path(command[0]).name, process.returncode, categories)
    return process.stdout + process.stderr if combine_output else process.stdout


def tracked_identities(root):
    paths = run(['git', 'ls-files', '--stage', '-z'], cwd=root).split('\0')
    result = {}
    for entry in paths:
        if not entry:
            continue
        metadata, name = entry.split('\t', 1)
        mode, oid, stage = metadata.split()
        if stage != '0':
            raise ValueError('Unmerged source cannot be benchmarked')
        # Preserve pre-existing editor worktree gitlinks by OID. They are not
        # application source and must never be initialized or recursively read.
        if mode == '160000':
            result[name] = 'gitlink:' + oid
            continue
        path = root / name
        if path.is_symlink() or not path.resolve().is_relative_to(root.resolve()):
            raise ValueError('Source symlinks are not permitted in the frozen benchmark')
        if path.name.startswith('.env') and path.name not in ('.env.example', '.env.vps.example'):
            raise ValueError('Environment files must not be part of the benchmark source')
        result[name] = hashlib.sha256(path.read_bytes()).hexdigest()
    return result


def wait_ready(url, seconds=180):
    opener = urllib.request.build_opener(NoRedirect())
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        try:
            with opener.open(url, timeout=5) as response:
                if response.status == 200:
                    return
        except OSError:
            pass
        time.sleep(1)
    raise RuntimeError('Required CI service failed readiness')


class Stack:
    def __init__(self, root, directory, arm, fixtures_dir, password, jwt):
        self.root, self.directory, self.arm = root, directory, arm
        self.started = False
        self.project = project_name(f'bbperf-{os.environ["GITHUB_RUN_ID"]}-{os.environ["GITHUB_RUN_ATTEMPT"]}-{arm}')
        self.password, self.jwt = password, jwt
        self.migrations = directory / 'migration-fixtures'
        self.migrations.mkdir()
        source = root / 'bigbike-backend/src/test/resources/db/testmigration'
        for prefix in ('V26_5__', 'V1028_5__'):
            files = list(source.glob(prefix + '*.sql'))
            if len(files) != 1:
                raise ValueError('Required synthetic migration fixture absent/ambiguous')
            shutil.copy2(files[0], self.migrations / files[0].name)
        self.env_file = directory / 'ci.env'
        self.values = {'PERF_PASSWORD': self.password, 'PERF_JWT': self.jwt, 'PERF_TAG': self.project,
                  'PERF_MINIO_IMAGE': project_name(f'bbperf-{os.environ["GITHUB_RUN_ID"]}-{os.environ["GITHUB_RUN_ATTEMPT"]}-before') + '-minio',
                  'PERF_FIXTURE_DIR': str(self.migrations), 'PERF_SCRIPT_DIR': str(root / 'scripts/performance')}
        self.write_env()
        self.fixture_dir = fixtures_dir
        self.relays = LoopbackRelays(self.project, self.inspect_service, self.inspect_network)

    def inspect_service(self, service):
        ids = self.compose('ps', '-q', service).split()
        if len(ids) != 1 or not re.fullmatch(r'[a-f0-9]{12,64}', ids[0]):
            raise RuntimeError('Expected exactly one owned running service')
        return json.loads(run(['docker', 'inspect', ids[0]]))

    def inspect_network(self, name):
        if name != self.project + '_default':
            raise RuntimeError('Unexpected CI network')
        return json.loads(run(['docker', 'network', 'inspect', name]))

    def write_env(self):
        self.env_file.write_text(''.join(f'{key}={value}\n' for key, value in self.values.items()))
        self.env_file.chmod(0o600)

    def enable_web_revalidation(self):
        self.values.update(PERF_WEB_REVALIDATE_URL='http://bigbike-web:3000/api/revalidate',
                           PERF_WEB_REVALIDATE_REPLICAS='1')
        self.write_env()

    def compose(self, *arguments):
        return run(self.compose_command(*arguments), timeout=360)

    def compose_command(self, *arguments):
        project_name(self.project)
        return ['docker', 'compose', '--env-file', str(self.env_file), '-p', self.project,
                '-f', str(self.root / 'scripts/performance/compose.ci.yml'), *arguments]

    def sql(self, sql):
        # This database belongs to the guarded CI project, never a shared shop DB.
        return self.compose('exec', '-T', 'postgres', 'psql', '-U', 'perf', '-d', 'bigbike_perf', '-Atc', sql)

    def build_storage(self):
        # One image reused by BOTH arms, without exporting it or using shop images.
        run(['docker', 'build', '-f', str(self.root / 'scripts/performance/Dockerfile.minio'),
             '-t', self.values['PERF_MINIO_IMAGE'], str(self.root / 'scripts/performance')], timeout=600)

    def build(self, app, environment):
        if shutil.disk_usage(self.directory).free < 2 * 1024 ** 3:
            raise RuntimeError('CI disk headroom below 2GiB; no automatic cleanup authorized')
        name = 'bigbike-' + app
        if app == 'backend':
            # Regression gates already tested Candidate. Before intentionally lacks
            # new overloads: do not compile candidate-only test sources into images.
            run(['./mvnw', '-B', 'package', '-Dmaven.test.skip=true', '-DforkCount=1'], cwd=self.root / name,
                env={**environment, 'MAVEN_OPTS': '-Xmx768m'}, timeout=1200)
        else:
            run(['npm', 'ci', '--no-audit', '--no-fund'], cwd=self.root / name, env=environment)
            run(['npm', 'run', 'build', *(['--', '--webpack'] if app == 'web' else [])],
                cwd=self.root / name, env=environment, timeout=1200)
            if app == 'web':
                run(['python3', '-B', str(self.root / 'scripts/performance/check_standalone.py'),
                     '--app', str(self.root / name), '--output', str(self.directory / 'web-standalone.json')])
        context = self.directory / ('image-' + app)
        context.mkdir()
        if app == 'backend':
            target = context / name / 'target'
            target.mkdir(parents=True)
            shutil.copy2(self.root / name / 'target/bigbike-backend-0.0.1-SNAPSHOT.jar', target)
        elif app == 'web':
            for subdir in ('.next/standalone', '.next/static', 'public'):
                shutil.copytree(self.root / name / subdir, context / name / subdir)
            launcher = context / 'scripts/performance'
            launcher.mkdir(parents=True)
            shutil.copy2(self.root / 'scripts/performance/launch-web.cjs', launcher)
        else:
            shutil.copytree(self.root / name / 'dist', context / name / 'dist')
            shutil.copy2(self.root / name / 'nginx.conf', context / name / 'nginx.conf')
            # Same sidecars as the shipping Admin Dockerfile.
            import gzip
            for path in (context / name / 'dist').rglob('*'):
                if path.suffix in ('.js', '.css', '.html', '.json', '.svg'):
                    with path.with_name(path.name + '.gz').open('wb') as output:
                        output.write(gzip.compress(path.read_bytes(), compresslevel=9, mtime=0))
        run(['docker', 'build', '-f', str(self.root / 'scripts/performance' / ('Dockerfile.' + app)),
             '-t', self.project + '-' + app, str(context)])

    def resources(self, expected_services=7):
        ids = self.compose('ps', '--all', '-q').split()
        if expected_services not in (5, 7) or len(ids) != expected_services:
            raise RuntimeError('Required CI containers absent for the current controlled phase')
        states = json.loads(run(['docker', 'inspect', *ids]))
        rows = [json.loads(line) for line in run(['docker', 'stats', '--no-stream', '--format', '{{json .}}', *ids]).splitlines()]
        available = next(int(line.split()[1]) * 1024 for line in Path('/proc/meminfo').read_text().splitlines()
                         if line.startswith('MemAvailable:'))
        unsafe = any(state['State']['OOMKilled'] or state['RestartCount'] or not state['State']['Running'] for state in states)
        unsafe |= any(float(row['MemPerc'].rstrip('%')) >= 85 for row in rows)
        unsafe |= available < 512 * 1024 * 1024
        return {'containers': [{'name': row['Name'], 'cpu_percent': row['CPUPerc'],
                'memory': row['MemUsage'], 'memory_percent': row['MemPerc'], 'pids': row['PIDs']} for row in rows],
                'host_available_bytes': available, 'unsafe': unsafe}

    def database(self):
        return json.loads(self.sql("""SELECT json_build_object(
            'connections', (SELECT count(*) FROM pg_stat_activity WHERE datname=current_database()),
            'active', (SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND state='active'),
            'active_waiting', (SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND state='active' AND wait_event_type IS NOT NULL AND wait_event_type <> 'Client'),
            'ungranted_locks', (SELECT count(*) FROM pg_locks WHERE NOT granted),
            'statements', (SELECT coalesce(sum(calls),0) FROM pg_stat_statements WHERE dbid=(SELECT oid FROM pg_database WHERE datname=current_database())),
            'sql_execution_ms', (SELECT coalesce(sum(total_exec_time),0) FROM pg_stat_statements WHERE dbid=(SELECT oid FROM pg_database WHERE datname=current_database()))
        )"""))


def api_benchmark(stack, api, product, output):
    stop = Event()
    done = Event()
    resources, results = [], []
    watcher_failure = []

    pool = {}
    for name in ('hikaricp.connections.active', 'hikaricp.connections.idle',
                 'hikaricp.connections.pending', 'hikaricp.connections.timeout'):
        report, _, _ = api.call('GET', '/actuator/metrics/' + name)
        pool[name] = report.get('measurements', [])
    write_json(output / 'pool-before.json', pool)
    # Only the ephemeral CI DB statistics are reset; no security setting/data is changed.
    stack.sql('SELECT pg_stat_statements_reset()')

    def watch():
        while not done.is_set():
            try:
                sample = stack.resources()
                sample['offset_seconds'] = time.monotonic() - started
                sample['database'] = stack.database()
                resources.append(sample)
                if sample['unsafe']:
                    stop.set()
            except Exception:
                watcher_failure.append('resource_collection_failed')
                stop.set()
            done.wait(3)

    started = time.monotonic()
    thread = Thread(target=watch, daemon=True)
    thread.start()
    paths = [('/api/v1/settings/public', None, .5), ('/api/v1/categories', None, .5),
             ('/api/v1/products?page=1&size=20', None, .5), ('/api/v1/products/' + product['slug'], None, .5),
             ('/api/v1/admin/products?page=1&size=20&publishStatus=PUBLISHED&sort=name:asc', api.token, .5),
             ('/api/v1/admin/products?q=E2E_PERF_LARGE&publishStatus=DRAFT&page=1&size=20&sort=name:asc', api.token, .5),
             ('/api/v1/admin/media?page=1&size=20', api.token, .5),
             # SEARCH is 60/min per IP; max aggregate rate remains <1/sec.
             ('/api/v1/products?q=E2E_PERF&page=1&size=20', None, 5.0)]
    try:
        for path, token, interval in paths:
            for concurrency in (1, 2, 4):
                for repeat in (1, 2):
                    headers = {'Authorization': 'Bearer ' + token} if token else None
                    warmup = measure(urlsplit(api.origin), path, concurrency, 3, headers=headers, interval=interval, stop=stop)
                    if stop.is_set():
                        results.append({'phase': 'warmup', **warmup})
                        break
                    results.append({'phase': 'measurement', 'repeat': repeat,
                        **measure(urlsplit(api.origin), path, concurrency, 12, headers=headers, interval=interval, stop=stop)})
                if stop.is_set():
                    break
            if stop.is_set():
                break
    finally:
        done.set()
        thread.join(timeout=60)
        if thread.is_alive():
            stop.set()
            watcher_failure.append('resource_watcher_did_not_finish')
        write_json(output / 'api.json', {'results': results, 'stopped': stop.is_set(),
             'collector_failures': watcher_failure, 'method': 'closed-loop paced keepalive, no retries/redirects, 2 repeats; stages1/2/4; 3s warmup/12s samples',
             'scope': 'Ordinary reads only. Low sample counts are not a capacity or production P95 certification.'})
        write_json(output / 'resources.json', {'samples': resources, 'note': 'Database counters include collector/background work; not exact SQL/request'})
        pool = {}
        for name in ('hikaricp.connections.active', 'hikaricp.connections.idle',
                     'hikaricp.connections.pending', 'hikaricp.connections.timeout'):
            report, _, _ = api.call('GET', '/actuator/metrics/' + name)
            pool[name] = report.get('measurements', [])
        write_json(output / 'pool-after.json', pool)
    if stop.is_set():
        raise RuntimeError('API load progression stopped by failure/resource boundary')


def lighthouse(root, output, product, private):
    executable = Path(os.environ['RUNNER_TEMP']) / 'perf-tools/node_modules/.bin/lighthouse'
    raw = private / 'lighthouse-private.json'
    rows = []
    for device in ('mobile', 'desktop'):
        for name, url in (('home', 'http://localhost:13000/'),
                          ('product', 'http://localhost:13000/product/' + product['slug'] + '/')):
            for repeat in (1, 2, 3):
                command = [str(executable), url, '--quiet', '--only-categories=performance', '--output=json',
                    '--output-path=' + str(raw), '--chrome-flags=--headless --no-sandbox --host-resolver-rules="MAP * ~NOTFOUND, EXCLUDE localhost"']
                if device == 'desktop':
                    command.append('--preset=desktop')
                run(command, cwd=root, timeout=180)
                report = json.loads(raw.read_text())
                if report.get('runtimeError'):
                    raise RuntimeError('Lighthouse navigation failed')
                rows.append({'device': device, 'surface': name, 'repeat': repeat,
                    'performance_score': report['categories']['performance']['score'] * 100,
                    'metrics': {key: report['audits'][key].get('numericValue') for key in
                        ('first-contentful-paint', 'largest-contentful-paint', 'cumulative-layout-shift',
                         'total-blocking-time', 'server-response-time')}, 'lighthouse_version': report['lighthouseVersion']})
                write_json(output / 'lighthouse.json', {'results': rows, 'note': 'Mobile simulated throttling / desktop preset; TBT is not INP'})


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--quota-approved', action='store_true')
    args = parser.parse_args()
    require_ci()
    if not args.quota_approved:
        parser.error('Confirm available included Actions quota before running')
    root = Path(__file__).resolve().parents[2]
    if run(['git', 'status', '--porcelain'], cwd=root).strip():
        parser.error('Remote benchmark requires one clean published candidate revision')
    output = safe_directory(args.output, os.environ['RUNNER_TEMP'])
    output.mkdir(parents=True, exist_ok=False)
    browser_proof = json.loads((Path(os.environ['RUNNER_TEMP']) / 'browser-egress-native.json').read_text())
    if (not browser_proof.get('complete') or browser_proof.get('denied_target_connections') != 0
            or not browser_proof.get('explicit_clear_refetched_asset')
            or not browser_proof.get('default_service_worker_completed')):
        raise RuntimeError('Native browser cache/egress boundary proof required')
    write_json(output / 'browser-egress-native.json', browser_proof)
    # Compile tool/fixtures once; arms share exact generated bytes and workload source.
    with tempfile.TemporaryDirectory(prefix='bbperf-', dir=os.environ['RUNNER_TEMP']) as tmp:
        temp = Path(tmp)
        fixture_dir = temp / 'media'
        write_json(output / 'toolchain.json', {'node': run(['node', '--version']).strip(),
            'npm': run(['npm', '--version']).strip(),
            'java': run(['java', '--version']).splitlines()[0], 'python': run(['python3', '--version']).strip(),
            'docker': run(['docker', '--version']).strip(), 'compose': run(['docker', 'compose', 'version']).strip(),
            'docker_engine_api': json.loads(run(['docker', 'version', '--format', '{{json .Server}}']))['ApiVersion'],
            'host_cpu_count': os.cpu_count(),
            'host_memory_total_bytes': next(int(line.split()[1]) * 1024 for line in Path('/proc/meminfo').read_text().splitlines() if line.startswith('MemTotal:')),
            'runner_image': {name: os.environ.get(name) for name in ('ImageOS', 'ImageVersion')},
            'ffmpeg': run(['ffmpeg', '-version']).splitlines()[0],
            'lighthouse_version': '12.8.2',
            'web_vitals_version': '5.1.0',
            'web_vitals_bundle_sha256': hashlib.sha256((Path(os.environ['RUNNER_TEMP']) / 'perf-tools/node_modules/web-vitals/dist/web-vitals.iife.js').read_bytes()).hexdigest(),
            'lighthouse_dependency_lock_sha256': hashlib.sha256((Path(os.environ['RUNNER_TEMP']) / 'perf-tools/package-lock.json').read_bytes()).hexdigest(),
            'chromium': run([os.environ['CHROME_PATH'], '--version']).strip(),
            'node_build_and_lab_runtime': '22/glibc',
            'shipping_web_runtime_difference': 'shipping uses Node20/Alpine; this is a reproducible lab comparison'})
        write_json(output / 'fixture-identities.json', generate(fixture_dir))
        source = tracked_identities(root)
        manifest = json.loads((root / 'scripts/performance/baseline-manifest.json').read_text())
        arms = {}
        for arm in ('before', 'after'):
            checkout = temp / arm
            run(['git', 'clone', '--local', '--no-hardlinks', str(root), str(checkout)])
            run(['git', 'checkout', '--detach', run(['git', 'rev-parse', 'HEAD'], cwd=root).strip()], cwd=checkout)
            if arm == 'before':
                run(['python3', str(root / 'scripts/performance/prepare_baseline.py'), '--root', str(checkout), '--apply'])
            arms[arm] = checkout
        identities = {arm: tracked_identities(checkout) for arm, checkout in arms.items()}
        if identities['after'] != source:
            raise RuntimeError('After differs from frozen candidate')
        differences = {name for name in source if identities['before'][name] != source[name]}
        if differences != {entry['path'] for entry in manifest['files']}:
            raise RuntimeError('Before differs beyond the attributed optimizations')
        write_json(output / 'source-identities.json', {'commit': run(['git', 'rev-parse', 'HEAD'], cwd=root).strip(),
            'attributed_differences': sorted(differences), 'arms': identities})
        password, jwt = secrets.token_urlsafe(32), secrets.token_urlsafe(48)
        dataset, fixtures = None, None
        for arm, checkout in arms.items():
            arm_output = output / arm
            arm_output.mkdir()
            private = temp / ('private-' + arm)
            private.mkdir()
            stack = Stack(checkout, private, arm, fixture_dir, password, jwt)
            status = {'arm': arm, 'phase': 'build-backend', 'complete': False}
            write_json(arm_output / 'status.json', status)
            def phase(name):
                status['phase'] = name
                write_json(arm_output / 'status.json', status)
                print('BBPERF-PHASE', arm, name, flush=True)
            try:
                if arm == 'before':
                    phase('official-storage-image')
                    stack.build_storage()
                phase('build-backend')
                env = {**clean_environment(), 'NODE_OPTIONS': '--max-old-space-size=3072', 'NEXT_TELEMETRY_DISABLED': '1',
                       'BIGBIKE_DISABLE_DEV_FALLBACK': 'true', 'INTERNAL_API_TOKEN': stack.jwt,
                       'BIGBIKE_API_BASE_URL': 'http://localhost:18080', 'NEXT_PUBLIC_API_BASE_URL': 'http://localhost:18080',
                       'NEXT_PUBLIC_SITE_URL': 'http://localhost:13000', 'NEXT_PUBLIC_ADMIN_ORIGIN': 'http://localhost:14000',
                       'BIGBIKE_LEGACY_UPLOADS_BASE': 'http://localhost:19000/bigbike-media/wp-uploads',
                       'BIGBIKE_MEDIA_INTERNAL_URL': 'http://minio:9000/bigbike-media/wp-uploads',
                       'BIGBIKE_MEDIA_BUCKET_URL': 'http://minio:9000/bigbike-media',
                       'VITE_STOREFRONT_BASE_URL': 'http://localhost:13000', 'VITE_ADMIN_API_BASE': '/api/v1',
                       'NEXT_PUBLIC_GA4_MEASUREMENT_ID': '', 'NEXT_PUBLIC_META_PIXEL_ID': '', 'NEXT_PUBLIC_CLARITY_PROJECT_ID': ''}
                stack.build('backend', env)
                run(['docker', 'ps', '--format', '{{.Names}}'])
                if stack.compose('ps', '--all', '-q').strip():
                    raise RuntimeError('Refusing to adopt a pre-existing Docker project')
                stack.started = True
                phase('infrastructure-start')
                stack.compose('up', '-d', '--wait', 'postgres', 'redis', 'minio')
                phase('owned-loopback-storage-transport')
                stack.relays.refresh('minio')
                wait_ready('http://localhost:19000/minio/health/live', seconds=30)
                phase('synthetic-bucket-setup')
                setup_bucket(stack.password)
                if dataset is not None:
                    write_json(arm_output / 'dataset-identity.json', restore(stack, dataset))
                    stack.enable_web_revalidation()
                else:
                    stack.sql('CREATE EXTENSION IF NOT EXISTS pg_stat_statements')
                phase('real-schema-and-api-fixtures')
                stack.compose('up', '-d', 'bigbike-backend', 'api-proxy')
                stack.relays.refresh('api-proxy')
                wait_ready('http://localhost:18080/actuator/health')
                api = login('http://localhost:18080', stack.password)
                if dataset is None:
                    fixtures = seed(api, fixture_dir)
                    phase('large-admin-catalog-seed')
                    try:
                        large = seed_large(api, fixtures, bounded_resources(stack, 5),
                                           auth_refresh=lambda: login('http://localhost:18080', stack.password))
                        fixtures['large_catalog'] = large['metadata']
                        write_json(arm_output / 'large-seed.json', large['summary'])
                    except LargeCatalogFailure as error:
                        write_json(arm_output / 'large-seed.json', error.summary)
                        raise
                    dataset = capture(stack, fixtures, private)
                    write_json(arm_output / 'dataset-identity.json', dataset_identity(dataset))
                    # Only this newly created CI project: reset the provisioner JVM
                    # and its temporary limiter state, then restore the same snapshot.
                    # Both measured arms now start fresh from identical fixture data.
                    stack.compose('stop', '--timeout', '10', 'bigbike-backend', 'api-proxy', 'redis')
                    restore(stack, dataset)
                    stack.enable_web_revalidation()
                    stack.compose('up', '-d', '--no-deps', '--force-recreate', '--wait', 'redis')
                    stack.compose('up', '-d', '--no-deps', '--force-recreate', 'bigbike-backend', 'api-proxy')
                    stack.relays.refresh('api-proxy')
                    wait_ready('http://localhost:18080/actuator/health')
                    api = login('http://localhost:18080', stack.password)
                fixture_file = private / 'api-fixtures.json'
                write_json(fixture_file, fixtures)
                phase('build-frontends')
                for app in ('web', 'admin'):
                    stack.build(app, env)
                write_json(arm_output / 'build-identity.json', {
                    'jar_sha256': hashlib.sha256((checkout / 'bigbike-backend/target/bigbike-backend-0.0.1-SNAPSHOT.jar').read_bytes()).hexdigest(),
                    'standalone_portability': json.loads((private / 'web-standalone.json').read_text()),
                    'images': {app: run(['docker', 'image', 'inspect', '--format', '{{.Id}}', stack.project + '-' + app]).strip()
                               for app in ('backend', 'web', 'admin')}})
                stack.compose('up', '-d', 'bigbike-web', 'bigbike-admin')
                wait_ready('http://localhost:13000/')
                wait_ready('http://localhost:14000/')
                container_ids = stack.compose('ps', '--all', '-q').split()
                image_rows = run(['docker', 'inspect', '--format',
                    '{{index .Config.Labels "com.docker.compose.service"}}|{{.Image}}', *container_ids]).splitlines()
                limit_rows = run(['docker', 'inspect', '--format',
                    '{{index .Config.Labels "com.docker.compose.service"}}|{{.HostConfig.Memory}}|{{.HostConfig.NanoCpus}}', *container_ids]).splitlines()
                write_json(arm_output / 'runtime-identity.json', {
                    'images': dict(row.split('|', 1) for row in image_rows),
                    'limits': {parts[0]: {'memory_bytes': int(parts[1]), 'nano_cpus': int(parts[2])}
                              for row in limit_rows for parts in [row.split('|')]},
                    'internal_web_revalidation': 'enabled, one real owned web replica, generated shared CI secret',
                    'host_transport': 'bounded loopback TCP byte relay to owned internal container IPv4; same extra hop in both arms; not shipping network latency',
                    'configuration_sha256': hashlib.sha256(json.dumps({key: value for key, value in stack.values.items()
                        if key not in ('PERF_TAG', 'PERF_FIXTURE_DIR', 'PERF_SCRIPT_DIR')}, sort_keys=True).encode()).hexdigest(),
                    'backend_java': stack.compose('exec', '-T', 'bigbike-backend', 'java', '--version').splitlines()[0],
                    'web_node': stack.compose('exec', '-T', 'bigbike-web', 'node', '--version').strip()})
                # New ordinary login after potentially long production builds; no bypass.
                api = login('http://localhost:18080', stack.password)
                phase('large-admin-pagination-proof')
                try:
                    write_json(arm_output / 'large-catalog-pages.json', verify_large_pages(
                        api, fixtures['large_catalog'], bounded_resources(stack),
                        auth_refresh=lambda: login('http://localhost:18080', stack.password)))
                except LargeCatalogFailure as error:
                    write_json(arm_output / 'large-catalog-pages.json', error.summary)
                    raise
                refresh = next(cookie.value for cookie in api.jar if cookie.name == 'bb_admin_refresh')
                session_file = private / 'browser-session.json'
                write_json(session_file, {'refreshCookie': refresh})
                session_file.chmod(0o600)
                phase('real-web-revalidation')
                write_json(arm_output / 'revalidation.json', verify_revalidation(api, fixtures))
                phase('functional-and-media')
                write_json(arm_output / 'functional.json', functional_checks(api, fixtures))
                def commerce_counts():
                    return json.loads(stack.sql("""SELECT json_build_object(
                        'orders', (SELECT count(*) FROM orders),
                        'payments', (SELECT count(*) FROM payments),
                        'reservations', (SELECT count(*) FROM checkout_idempotency_keys))"""))
                write_json(arm_output / 'commerce.json', check_commerce(api, fixtures, commerce_counts))
                def record_media(rows):
                    write_json(arm_output / 'media.json', {'results': rows,
                        'note': 'photo-1600.jpg was seeded as product image: this sample exercises content dedup; wall duration includes transfer/storage, no server-only claim',
                        'not_measured': ['transfer-only/server-only/storage-only split', 'UI retry/progress', 'mid-stream fault injection']})
                media_checks(api, fixture_dir, record_media)
                phase('browser')
                run(['node', str(root / 'scripts/performance/browser.cjs'), str(checkout), str(fixture_file),
                     str(arm_output / 'browser.json'), str(session_file)], timeout=900)
                phase('admin-smoke')
                smoke = run_smoke(checkout, stack.password, private, clean_environment())
                write_json(arm_output / 'admin-smoke.json', smoke)
                if (not smoke['report_valid'] or smoke['exit_code'] != 0 or not smoke['tests']
                        or smoke['passed'] != smoke['tests'] or any(smoke[key] for key in
                            ('failed', 'skipped', 'not_run', 'flaky', 'report_errors'))):
                    raise RuntimeError('Required existing Admin smoke gate failed/incomplete')
                phase('lighthouse')
                lighthouse(checkout, arm_output, fixtures['products'][0], private)
                phase('api-load')
                api = login('http://localhost:18080', stack.password)
                api_benchmark(stack, api, fixtures['products'][0], arm_output)
                phase('post-measurement-merchant-variants')
                api = login('http://localhost:18080', stack.password)
                run_merchant_checks(checkout, api, fixtures, private,
                    {**clean_environment(), 'GITHUB_RUN_ID': os.environ['GITHUB_RUN_ID'],
                     'GITHUB_RUN_ATTEMPT': os.environ['GITHUB_RUN_ATTEMPT']},
                    measurements_complete=True,
                    record_callback=lambda report: write_json(arm_output / 'merchant.json', report))
                status.update(phase='complete', complete=True)
            except Exception as error:
                status.update(failure_type=type(error).__name__)
                if isinstance(error, CommandFailure):
                    status['command_failure_categories'] = error.categories
                try:
                    diagnostics = collect_failure_diagnostics(stack, run, fixtures)
                except Exception:
                    diagnostics = {'collection_failed': True, 'raw_diagnostics_exported': False}
                try:
                    write_json(arm_output / 'failure-diagnostics.json', diagnostics)
                except Exception:
                    pass  # Evidence storage must never mask the original failure.
                raise
            finally:
                finalize_arm(stack, arm_output, status, original_error=sys.exc_info()[0] is not None)
    compare(output)
    write_json(output / 'comparison-status.json', {'both_arms_completed': True,
        'field_INP': 'not measured', 'production_capacity': 'not certified',
        'ordinary_api_target_ms_p95': 300, 'TTFB_target_ms': 800, 'LCP_target_ms': 2500,
        'CLS_target': .1, 'lighthouse_target': 90})


if __name__ == '__main__':
    main()
