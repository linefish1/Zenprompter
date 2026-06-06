"""No-cache HTTP server for testing."""
import http.server
import socketserver

PORT = 8080

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

print(f'Starting no-cache server on http://localhost:{PORT}')
print('Press Ctrl+C to stop.')
socketserver.TCPServer(('', PORT), NoCacheHandler).serve_forever()
