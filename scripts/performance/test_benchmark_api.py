import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from urllib.parse import urlsplit
from benchmark_api import measure, percentile, validate_target


class BenchmarkBoundaryTest(unittest.TestCase):
    ci = {"GITHUB_ACTIONS": "true", "RUNNER_ENVIRONMENT": "github-hosted"}

    def test_refuses_shared_host_even_with_loopback_url(self):
        for env in ({}, {"GITHUB_ACTIONS": "true", "RUNNER_ENVIRONMENT": "self-hosted"}):
            with self.assertRaises(ValueError):
                validate_target("http://localhost:18080", env)

    def test_refuses_production_standard_ports_credentials_and_query(self):
        for url in ("https://api.bigbike.vn", "http://localhost:8080", "http://example.org:18080",
                    "http://user:password@localhost:18080", "http://localhost:18080?x=1",
                    "http://localhost:18080/api", "http://localhost:18080#fragment"):
            with self.subTest(url=url), self.assertRaises(ValueError):
                validate_target(url, self.ci)

    def test_allows_only_isolated_runner_target(self):
        self.assertEqual(validate_target("http://127.0.0.1:18080", self.ci).port, 18080)

    def test_percentiles_keep_tail_and_empty_samples_explicit(self):
        self.assertEqual(percentile([2, 1, 100], .95), 100)
        self.assertEqual(percentile([2, 1, 100], .5), 2)
        self.assertIsNone(percentile([], .95))

    def test_sampler_separates_success_and_failures_without_following_redirects(self):
        class Handler(BaseHTTPRequestHandler):
            protocol_version = "HTTP/1.1"

            def do_GET(self):
                self.send_response(200 if self.path == "/ok" else 302)
                self.send_header("Content-Length", "2")
                self.send_header("Location", "/ok")
                self.end_headers()
                self.wfile.write(b"{}")

            def log_message(self, *_):
                pass

        with ThreadingHTTPServer(("127.0.0.1", 0), Handler) as server:
            thread = Thread(target=server.serve_forever, daemon=True)
            thread.start()
            try:
                target = urlsplit(f"http://127.0.0.1:{server.server_port}")
                ok = measure(target, "/ok", 1, .05)
                redirect = measure(target, "/redirect", 1, .05)
                self.assertGreater(ok["requests"], 0)
                self.assertEqual(ok["non_2xx_or_network_error_rate"], 0)
                self.assertIsNotNone(ok["latency_ms_2xx_only"]["p95"])
                self.assertEqual(redirect["statuses"], {"302": redirect["requests"]})
                self.assertEqual(redirect["non_2xx_or_network_error_rate"], 1)
                self.assertIsNone(redirect["latency_ms_2xx_only"]["p95"])
                self.assertEqual(redirect["successful_requests_per_second"], 0)
            finally:
                server.shutdown()
                thread.join(timeout=2)


if __name__ == "__main__":
    unittest.main()
