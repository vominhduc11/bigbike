#!/usr/bin/env python3
"""Bounded read-only API benchmark, exclusively for GitHub-hosted isolated jobs."""
import argparse
import concurrent.futures
import http.client
import json
import math
import os
import time
from collections import Counter
from threading import Event
from urllib.parse import urlsplit

PATHS = ("/api/v1/settings/public", "/api/v1/categories", "/api/v1/products?page=1&size=20")


def validate_target(base_url, environment):
    target = urlsplit(base_url)
    if environment.get("GITHUB_ACTIONS") != "true" or environment.get("RUNNER_ENVIRONMENT") != "github-hosted":
        raise ValueError("Benchmark requires an isolated GitHub-hosted runner; local/shared hosts are refused")
    if (target.scheme != "http" or target.hostname not in ("localhost", "127.0.0.1")
            or target.port is None or target.port < 10000 or target.username or target.password
            or target.path not in ("", "/") or target.query or target.fragment):
        raise ValueError("Use an isolated HTTP loopback service on a dedicated port >=10000")
    return target


def percentile(values, fraction):
    return sorted(values)[max(0, math.ceil(len(values) * fraction) - 1)] if values else None


def measure(target, path, concurrency, duration, *, headers=None, interval=0, stop=None):
    deadline = time.perf_counter() + duration
    stop = stop or Event()

    def worker():
        connection = http.client.HTTPConnection(target.hostname, target.port, timeout=10)
        samples, successful_samples, statuses, byte_count = [], [], Counter(), 0
        try:
            while time.perf_counter() < deadline and len(samples) < 10000 and not stop.is_set():
                started = time.perf_counter()
                successful = False
                try:
                    connection.request("GET", path, headers={"Accept": "application/json", **(headers or {})})
                    response = connection.getresponse()
                    # Consume and discard response bodies; never persist catalog/customer data.
                    while chunk := response.read(65536):
                        byte_count += len(chunk)
                    statuses[str(response.status)] += 1
                    successful = 200 <= response.status < 300
                    if not successful:
                        stop.set()
                except (OSError, http.client.HTTPException) as error:
                    statuses["timeout" if isinstance(error, TimeoutError) else "network_error"] += 1
                    stop.set()
                    connection.close()
                    connection = http.client.HTTPConnection(target.hostname, target.port, timeout=10)
                elapsed_ms = (time.perf_counter() - started) * 1000
                samples.append(elapsed_ms)
                if successful:
                    successful_samples.append(elapsed_ms)
                if interval:
                    stop.wait(min(max(0, interval - elapsed_ms / 1000), max(0, deadline - time.perf_counter())))
        finally:
            connection.close()
        return samples, statuses, byte_count, successful_samples

    started = time.perf_counter()
    with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as executor:
        runs = list(executor.map(lambda _: worker(), range(concurrency)))
    elapsed = time.perf_counter() - started
    samples, successes, statuses = [], [], Counter()
    for timings, counts, _, successful_timings in runs:
        samples.extend(timings)
        successes.extend(successful_timings)
        statuses.update(counts)
    return {"path": path, "concurrency": concurrency, "elapsed_seconds": elapsed,
            "requests": len(samples), "statuses": dict(statuses),
            "requests_per_second": len(samples) / elapsed,
            "successful_requests_per_second": len(successes) / elapsed,
            "non_2xx_or_network_error_rate": (len(samples) - len(successes)) / len(samples) if samples else None,
            "rate_limited_requests": statuses.get("429", 0), "timeouts": statuses.get("timeout", 0),
            "network_errors": statuses.get("network_error", 0),
            "latency_ms_2xx_only": {f"p{p}": percentile(successes, p / 100) for p in (50, 95, 99)},
            "latency_ms_including_errors": {f"p{p}": percentile(samples, p / 100) for p in (50, 95, 99)},
            "bytes_received": sum(run[2] for run in runs)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", required=True)
    parser.add_argument("--arm", choices=("before", "after"), required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    target = validate_target(args.base_url, os.environ)
    results = []
    stop = Event()
    for path in PATHS:
        for concurrency in (1, 2, 4):
            for repeat in range(1, 3):
                measure(target, path, concurrency, 3, interval=.5, stop=stop)
                if stop.is_set():
                    break
                results.append({"repeat": repeat, **measure(target, path, concurrency, 12, interval=.5, stop=stop)})
            if stop.is_set():
                break
        if stop.is_set():
            break
    report = {"arm": args.arm, "method": "HTTP/1.1 keep-alive; no redirects/retries; concurrency 1/2/4, <=2rps/worker, 3s warmup, 12s measurement, two repeats; stop on any error",
              "note": "Closed-loop local client timings, not production SLO. 429 and errors remain in results; reject mixed-success latency claims.",
              "results": results}
    with open(args.output, "w", encoding="utf-8") as stream:
        json.dump(report, stream, indent=2)
    if stop.is_set():
        raise SystemExit('API progression stopped: non-success/timeout; partial evidence retained')


if __name__ == "__main__":
    main()
