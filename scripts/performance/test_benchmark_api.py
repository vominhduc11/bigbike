import unittest
import http.client
import io
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Barrier, Event, Lock, Thread
from unittest.mock import Mock, patch
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

    def sample_response(self, status, body_error=None):
        response = Mock(status=status, length=0)
        if body_error is None:
            response.read.return_value = b""
        else:
            response.read.side_effect = body_error
        connection = Mock()
        connection.getresponse.return_value = response
        stop = Event()
        with patch("benchmark_api.http.client.HTTPConnection", return_value=connection):
            result = measure(urlsplit("http://localhost:18080"), "/tool-unit-fixture", 1, 1, stop=stop)
        self.assertTrue(stop.is_set())
        self.assertEqual(connection.request.call_count, 1, "Failed requests must never be retried")
        return result

    def test_body_failure_keeps_observed_429_and_one_terminal_failure(self):
        for error, terminal in ((TimeoutError("body timeout"), "timeout"),
                                (ConnectionResetError("body reset"), "network_error")):
            with self.subTest(terminal=terminal):
                result = self.sample_response(429, error)
                self.assertEqual(result["rate_limited_requests"], 1)
                self.assertEqual(result["observed_http_statuses"], {"429": 1})
                self.assertEqual(result["statuses"], {terminal: 1})
                self.assertEqual(result["requests"], 1)
                self.assertEqual(result["timeouts"], int(terminal == "timeout"))
                self.assertEqual(result["network_errors"], int(terminal == "network_error"))
                self.assertEqual(result["non_2xx_or_network_error_rate"], 1)
                self.assertEqual(result["successful_requests_per_second"], 0)
                self.assertTrue(all(value is None for value in result["latency_ms_2xx_only"].values()))

    def test_200_headers_with_body_timeout_cannot_be_a_successful_sample(self):
        result = self.sample_response(200, TimeoutError("body timeout"))
        self.assertEqual(result["observed_http_statuses"], {"200": 1})
        self.assertEqual(result["statuses"], {"timeout": 1})
        self.assertEqual(result["rate_limited_requests"], 0)
        self.assertEqual(result["requests"], 1)
        self.assertEqual(result["non_2xx_or_network_error_rate"], 1)
        self.assertEqual(result["successful_requests_per_second"], 0)
        self.assertTrue(all(value is None for value in result["latency_ms_2xx_only"].values()))

    def test_complete_429_stops_and_remains_one_observed_terminal_error(self):
        result = self.sample_response(429)
        self.assertEqual(result["observed_http_statuses"], {"429": 1})
        self.assertEqual(result["statuses"], {"429": 1})
        self.assertEqual(result["rate_limited_requests"], 1)
        self.assertEqual(result["timeouts"], 0)
        self.assertEqual(result["network_errors"], 0)
        self.assertEqual(result["requests"], 1)
        self.assertTrue(all(value is None for value in result["latency_ms_2xx_only"].values()))

    def test_concurrent_partial_429_bodies_do_not_double_count_requests(self):
        barrier, lock = Barrier(4), Lock()
        errors = [None, TimeoutError("body timeout"), ConnectionResetError("body reset"), None]
        connections = []

        def connect(*_args, **_kwargs):
            connection = Mock()
            with lock:
                index = len(connections)
                connections.append(connection)
            if index < len(errors):
                response = Mock(status=429, length=0)
                if errors[index] is None:
                    response.read.return_value = b""
                else:
                    response.read.side_effect = errors[index]

                def headers():
                    barrier.wait(timeout=5)
                    return response

                connection.getresponse.side_effect = headers
            return connection

        with patch("benchmark_api.http.client.HTTPConnection", side_effect=connect):
            result = measure(urlsplit("http://localhost:18080"), "/tool-unit-fixture", 4, 1)
        self.assertEqual(result["requests"], 4)
        self.assertEqual(sum(client.request.call_count for client in connections), 4)
        self.assertEqual(result["observed_http_statuses"], {"429": 4})
        self.assertEqual(result["statuses"], {"429": 2, "timeout": 1, "network_error": 1})
        self.assertEqual(sum(result["statuses"].values()), result["requests"])
        self.assertEqual(result["rate_limited_requests"], 4)
        self.assertEqual(result["timeouts"], 1)
        self.assertEqual(result["network_errors"], 1)
        self.assertEqual(result["non_2xx_or_network_error_rate"], 1)
        self.assertEqual(result["successful_requests_per_second"], 0)
        self.assertTrue(all(value is None for value in result["latency_ms_2xx_only"].values()))

    def sample_wire_response(self, wire):
        class Socket:
            def makefile(self, *_args):
                return io.BytesIO(wire)

        response = http.client.HTTPResponse(Socket())
        response.begin()
        stop = Event()
        read = response.read

        def read_until_eof(size):
            chunk = read(size)
            if not chunk:
                stop.set()  # Bound this offline fixture to exactly one attempt.
            return chunk

        response.read = read_until_eof
        connection = Mock()
        connection.getresponse.return_value = response
        with patch("benchmark_api.http.client.HTTPConnection", return_value=connection):
            result = measure(urlsplit("http://localhost:18080"), "/tool-wire-fixture", 1, 1, stop=stop)
        self.assertTrue(stop.is_set())
        self.assertEqual(connection.request.call_count, 1)
        self.assertEqual(result["requests"], 1)
        return result

    def test_truncated_content_length_is_not_a_completed_http_response(self):
        for status in (200, 429):
            with self.subTest(status=status):
                result = self.sample_wire_response(
                    f"HTTP/1.1 {status} Test\r\nContent-Length: 10\r\n\r\n{{}}".encode())
                self.assertEqual(result["statuses"], {"network_error": 1})
                self.assertEqual(result["observed_http_statuses"], {str(status): 1})
                self.assertEqual(result["bytes_received"], 2)
                self.assertEqual(result["network_errors"], 1)
                self.assertEqual(result["rate_limited_requests"], int(status == 429))
                self.assertEqual(result["non_2xx_or_network_error_rate"], 1)
                self.assertEqual(result["successful_requests_per_second"], 0)
                self.assertTrue(all(value is None for value in result["latency_ms_2xx_only"].values()))

    def test_complete_fixed_chunked_and_close_delimited_bodies_are_successful(self):
        for framing in (b"Content-Length: 2\r\n\r\n{}",
                        b"Transfer-Encoding: chunked\r\n\r\n2\r\n{}\r\n0\r\n\r\n",
                        b"Connection: close\r\n\r\n{}"):
            with self.subTest(framing=framing.split(b"\r\n")[0]):
                result = self.sample_wire_response(b"HTTP/1.1 200 OK\r\n" + framing)
                self.assertEqual(result["statuses"], {"200": 1})
                self.assertEqual(result["observed_http_statuses"], {"200": 1})
                self.assertEqual(result["bytes_received"], 2)
                self.assertEqual(result["non_2xx_or_network_error_rate"], 0)
                self.assertTrue(all(value is not None for value in result["latency_ms_2xx_only"].values()))

    def test_truncated_chunked_body_stops_without_a_successful_sample(self):
        result = self.sample_wire_response(b"HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n5\r\n{}")
        self.assertEqual(result["statuses"], {"network_error": 1})
        self.assertEqual(result["observed_http_statuses"], {"200": 1})
        self.assertEqual(result["network_errors"], 1)
        self.assertEqual(result["non_2xx_or_network_error_rate"], 1)
        self.assertEqual(result["successful_requests_per_second"], 0)
        self.assertTrue(all(value is None for value in result["latency_ms_2xx_only"].values()))

    def test_truncated_chunked_body_counts_partial_bytes_reported_by_http_client(self):
        result = self.sample_wire_response(b"HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n2\r\n{}\r\n5\r\nx")
        self.assertEqual(result["statuses"], {"network_error": 1})
        self.assertEqual(result["observed_http_statuses"], {"200": 1})
        self.assertEqual(result["bytes_received"], 2)
        self.assertEqual(result["successful_requests_per_second"], 0)

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
                self.assertEqual(ok["observed_http_statuses"], {"200": ok["requests"]})
                self.assertIsNotNone(ok["latency_ms_2xx_only"]["p95"])
                self.assertEqual(redirect["statuses"], {"302": redirect["requests"]})
                self.assertEqual(redirect["observed_http_statuses"], {"302": redirect["requests"]})
                self.assertEqual(redirect["non_2xx_or_network_error_rate"], 1)
                self.assertIsNone(redirect["latency_ms_2xx_only"]["p95"])
                self.assertEqual(redirect["successful_requests_per_second"], 0)
            finally:
                server.shutdown()
                thread.join(timeout=2)


if __name__ == "__main__":
    unittest.main()
