import importlib.util
from pathlib import Path
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

spec = importlib.util.spec_from_file_location('uptime', Path(__file__).parents[1] / 'check-storefront-uptime.py')
uptime = importlib.util.module_from_spec(spec)
spec.loader.exec_module(uptime)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        if self.path == '/redirect':
            self.send_response(301)
            self.send_header('Location', '/valid')
        else:
            self.send_response(200)
            self.send_header('Content-Type', 'text/html')
        self.end_headers()
        self.wfile.write(b'<html>Bigbike <script>{"@type":"Product","sku":"REAL-SKU"}</script></html>')


class UptimeTests(unittest.TestCase):
    def test_false_green_html_and_challenge_are_rejected(self):
        headers = {'content-type': 'text/html'}
        self.assertTrue(uptime.inspect_body('product', b'<html>Challenge</html>', headers, 'REAL-SKU'))
        self.assertTrue(uptime.inspect_body('product', b'<html>REAL-SKU error</html>', headers, 'REAL-SKU'))
        self.assertTrue(uptime.inspect_body('home', b'<html>Bigbike', headers, 'Bigbike'))
        self.assertTrue(uptime.inspect_body('feed', b'<html>Bigbike</html>', headers))

    def test_real_http_status_and_no_redirect_following(self):
        server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            base = f'http://127.0.0.1:{server.server_port}'
            self.assertEqual(uptime.probe('product', base + '/valid', 'REAL-SKU')['errors'], [])
            self.assertEqual(uptime.probe('product', base + '/redirect', 'REAL-SKU')['status'], 301)
            self.assertEqual(uptime.probe('product', base + '/redirect', 'REAL-SKU')['errors'], ['HTTP_NOT_200'])
        finally:
            server.shutdown()
            server.server_close()
            thread.join()


if __name__ == '__main__':
    unittest.main()
