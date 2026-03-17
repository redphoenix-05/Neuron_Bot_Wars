#!/usr/bin/env python3
"""
HTTP Server for Neuro Bot Wars Visualization with Game API
Serves frontend and provides game state API endpoints
"""

import http.server
import socketserver
import os
import json
from pathlib import Path
from urllib.parse import urlparse, parse_qs
import sys

# Add parent directory to path so we can import core modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from core.game_controller import GameController

PORT = 8000
FRONTEND_DIR = Path(__file__).parent

# Global game controller instance
game_controller = None

class GameAPIHandler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        """Translate URL path to filesystem path"""
        # Handle API routes
        if path.startswith('/api/'):
            return path  # Return as-is for API routing
        
        if path == '/' or path == '':
            path = '/index.html'
        return str(FRONTEND_DIR / path.lstrip('/'))
    
    def do_GET(self):
        """Handle GET requests"""
        parsed_url = urlparse(self.path)
        
        # Game API routes
        if parsed_url.path == '/api/game/state':
            self.send_game_state()
            return
        elif parsed_url.path == '/api/game/next':
            self.send_next_state()
            return
        elif parsed_url.path == '/api/game/status':
            self.send_game_status()
            return
        
        # Default file serving
        super().do_GET()
    
    def do_POST(self):
        """Handle POST requests"""
        parsed_url = urlparse(self.path)
        
        if parsed_url.path == '/api/game/start':
            self.start_new_game()
            return
        
        self.send_error(404)
    
    def send_json_response(self, data, status=200):
        """Send JSON response"""
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))
    
    def send_game_state(self):
        """Send current game state"""
        global game_controller
        if game_controller is None:
            self.send_json_response({'error': 'Game not started'}, 400)
            return
        
        state = game_controller.get_current_state()
        self.send_json_response(state)
    
    def send_next_state(self):
        """Advance game by one turn and return new state"""
        global game_controller
        if game_controller is None:
            self.send_json_response({'error': 'Game not started'}, 400)
            return
        
        # TODO: Implement single-step game advancement
        state = game_controller.get_current_state()
        self.send_json_response(state)
    
    def send_game_status(self):
        """Send game status (running, finished, etc.)"""
        global game_controller
        if game_controller is None:
            self.send_json_response({'status': 'not_started'})
            return
        
        state = game_controller.get_current_state()
        status = 'running'
        if state['phase'] > 2 or not state['aegis']['alive'] or not state['velo']['alive']:
            status = 'finished'
        
        self.send_json_response({
            'status': status,
            'phase': state['phase'],
            'turn': state['turn']
        })
    
    def start_new_game(self):
        """Start a new game"""
        global game_controller
        game_controller = GameController()
        game_controller.simulate_full_game()
        
        state = game_controller.get_current_state()
        self.send_json_response({
            'message': 'Game started',
            'state': state
        }, 201)

def run_server():
    """Start the HTTP server"""
    os.chdir(FRONTEND_DIR)
    
    Handler = GameAPIHandler
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"=" * 60)
        print(f"Neuro Bot Wars - Server with Game API")
        print(f"=" * 60)
        print(f"\n✓ Server running at: http://localhost:{PORT}")
        print(f"✓ Frontend: http://localhost:{PORT}/index.html")
        print(f"✓ API Endpoints:")
        print(f"  - GET  /api/game/state  → Current game state")
        print(f"  - GET  /api/game/status → Game status")
        print(f"  - POST /api/game/start  → Start new game")
        print(f"\n✓ Serving from: {FRONTEND_DIR}")
        print(f"\nPress Ctrl+C to stop the server\n")
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n✓ Server stopped")

if __name__ == "__main__":
    run_server()
