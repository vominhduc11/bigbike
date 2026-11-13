from http.server import ThreadingHTTPServer,BaseHTTPRequestHandler
import urllib.request,urllib.error,pathlib,json
P=pathlib.Path('/tmp/bigbike-gmc-continue-20261110');(P/'fault-mode.json').write_text('{"detail":200,"snapshot":200}')
slug='tai-nghe-bluetooth-intercom-scs-s13'
class Handler(BaseHTTPRequestHandler):
 def log_message(self,*a):pass
 def do_GET(self):
  state=json.loads((P/'fault-mode.json').read_text());is_detail=self.path.split('?')[0]=='/api/v1/products/'+slug
  if is_detail and state['detail']!=200:
   code=state['detail'];self.send_response(code);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(json.dumps({'error':{'code':'ISOLATED_FAULT','message':'Isolated test'}}).encode());return
  if self.path.startswith('/api/internal/'):
   self.send_response(404);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(b'{}');return
  try:
   r=urllib.request.urlopen('http://127.0.0.1:8080'+self.path,timeout=15);b=r.read();self.send_response(r.status);self.send_header('Content-Type',r.headers.get('Content-Type','application/json'));self.end_headers();self.wfile.write(b)
  except urllib.error.HTTPError as e:
   self.send_response(e.code);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(e.read())
  except Exception:
   self.send_response(503);self.end_headers()
ThreadingHTTPServer(('127.0.0.1',3192),Handler).serve_forever()
