"""Compare only successful completed arms; missing metrics remain explicitly missing."""
import json
from pathlib import Path
from statistics import median


def compare(directory):
    directory = Path(directory)
    identities = [directory / arm / 'dataset-identity.json' for arm in ('before', 'after')]
    if not all(path.exists() for path in identities):
        raise ValueError('Both frozen dataset identities are required')
    if json.loads(identities[0].read_text()) != json.loads(identities[1].read_text()):
        raise ValueError('Frozen datasets differ between arms')
    runtime = []
    for arm in ('before', 'after'):
        path = directory / arm / 'runtime-identity.json'
        if not path.exists():
            raise ValueError('Runtime configuration/resource proof missing')
        value = json.loads(path.read_text())
        if not value.get('configuration_sha256') or not value.get('limits'):
            raise ValueError('Runtime configuration/resource proof incomplete')
        runtime.append(value)
    if (runtime[0]['configuration_sha256'] != runtime[1]['configuration_sha256']
            or runtime[0]['limits'] != runtime[1]['limits']):
        raise ValueError('Configuration/resources differ between measured arms')
    large_count = json.loads(identities[0].read_text()).get('large_catalog_count', 0)
    large_pages = []
    if large_count:
        for arm in ('before', 'after'):
            path = directory / arm / 'large-catalog-pages.json'
            if not path.exists():
                raise ValueError('Large catalog page proof missing')
            report = json.loads(path.read_text())
            if not report.get('complete') or report.get('count') != large_count or not report.get('page_identities'):
                raise ValueError('Large catalog page proof incomplete')
            large_pages.append(report['page_identities'])
        if large_pages[0] != large_pages[1]:
            raise ValueError('Large catalog sampled pages differ between arms')
    reports = {}
    for arm in ('before', 'after'):
        status = json.loads((directory / arm / 'status.json').read_text())
        if not status.get('complete'):
            raise ValueError('Both arms must complete before publishing a comparison')
        api = json.loads((directory / arm / 'api.json').read_text())
        if api.get('stopped'):
            raise ValueError('Stopped API arm cannot pass acceptance')
        reports[arm] = api['results']
    grouped = {}
    for arm, rows in reports.items():
        for row in rows:
            if row.get('phase') != 'measurement':
                continue
            if row['non_2xx_or_network_error_rate'] != 0:
                raise ValueError('Mixed-success API results cannot establish a latency win')
            key = (row['path'], row['concurrency'])
            grouped.setdefault(key, {}).setdefault(arm, []).append(row)
    results = []
    for (path, concurrency), arms in grouped.items():
        if set(arms) != {'before', 'after'} or len(arms['before']) != len(arms['after']):
            raise ValueError('Measured workloads/repeats differ between arms')
        result = {'path': path, 'concurrency': concurrency}
        for arm, rows in arms.items():
            result[arm] = {'successful_requests': sum(row['requests'] for row in rows),
                           'median_of_repeat_p95_ms': median(row['latency_ms_2xx_only']['p95'] for row in rows),
                           'median_successful_rps': median(row['successful_requests_per_second'] for row in rows)}
        results.append(result)
    if not results:
        raise ValueError('No API measurements to compare')
    output = {'api': results, 'note': 'Median of per-repeat P95 values is not a pooled P95. Inspect raw counts/tails/statuses.',
              'large_catalog_count': large_count, 'sampled_large_pages_equivalent': bool(large_pages),
              'field_INP': 'not measured', 'production_capacity': 'not certified',
              'whole_system_acceptance': 'not established by this bounded suite'}
    (directory / 'comparison.json').write_text(json.dumps(output, indent=2) + '\n')
    return output
