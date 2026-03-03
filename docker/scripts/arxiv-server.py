#!/usr/bin/env python3
"""
arXiv-to-Prompt HTTP Server

Wraps the arxiv-to-prompt library as an HTTP API.
Runs on port 8082 inside the container.

Endpoints:
  POST /convert   — Convert arXiv paper to flattened LaTeX
  POST /sections  — List paper sections
  POST /abstract  — Extract abstract
  GET  /health    — Health check
"""

import json
import os
import sys
import traceback
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = int(os.environ.get("ARXIV_SERVER_PORT", "8082"))
CACHE_DIR = os.environ.get("ARXIV_CACHE_DIR", "/workspace/.cache/arxiv")

os.makedirs(CACHE_DIR, exist_ok=True)


class ArxivHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/health":
            self._json(200, {"status": "ok", "service": "arxiv-server"})
        else:
            self._json(404, {"error": "Not found"})

    def do_POST(self):
        try:
            body = self._read_body()
        except Exception:
            self._json(400, {"error": "Invalid JSON"})
            return

        if self.path == "/convert":
            self._handle_convert(body)
        elif self.path == "/sections":
            self._handle_sections(body)
        elif self.path == "/abstract":
            self._handle_abstract(body)
        else:
            self._json(404, {"error": "Not found"})

    def _handle_convert(self, body):
        from arxiv_to_prompt import process_latex_source

        arxiv_id = body.get("arxiv_id")
        if not arxiv_id:
            self._json(400, {"error": "arxiv_id is required"})
            return

        try:
            content = process_latex_source(
                arxiv_id=arxiv_id,
                keep_comments=not body.get("remove_comments", True),
                remove_appendix_section=body.get("remove_appendix", False),
                abstract_only=body.get("abstract_only", False),
                figure_paths_only=body.get("figure_paths", False),
                cache_dir=CACHE_DIR,
                use_cache=True,
            )
            self._json(200, {
                "content": content,
                "arxiv_id": arxiv_id,
                "cached": True,
            })
        except Exception as e:
            traceback.print_exc()
            self._json(500, {"error": str(e), "arxiv_id": arxiv_id})

    def _handle_sections(self, body):
        from arxiv_to_prompt import process_latex_source, list_sections

        arxiv_id = body.get("arxiv_id")
        if not arxiv_id:
            self._json(400, {"error": "arxiv_id is required"})
            return

        try:
            # Get full LaTeX first, then extract sections
            content = process_latex_source(
                arxiv_id=arxiv_id,
                keep_comments=True,
                cache_dir=CACHE_DIR,
                use_cache=True,
            )
            if content is None:
                self._json(500, {"error": "Failed to process paper", "arxiv_id": arxiv_id})
                return

            sections = list_sections(content)
            self._json(200, {"arxiv_id": arxiv_id, "sections": sections})
        except Exception as e:
            traceback.print_exc()
            self._json(500, {"error": str(e), "arxiv_id": arxiv_id})

    def _handle_abstract(self, body):
        from arxiv_to_prompt import process_latex_source

        arxiv_id = body.get("arxiv_id")
        if not arxiv_id:
            self._json(400, {"error": "arxiv_id is required"})
            return

        try:
            content = process_latex_source(
                arxiv_id=arxiv_id,
                abstract_only=True,
                cache_dir=CACHE_DIR,
                use_cache=True,
            )
            self._json(200, {"arxiv_id": arxiv_id, "abstract": content})
        except Exception as e:
            traceback.print_exc()
            self._json(500, {"error": str(e), "arxiv_id": arxiv_id})

    def _read_body(self):
        length = int(self.headers.get("Content-Length", 0))
        if length == 0:
            return {}
        return json.loads(self.rfile.read(length))

    def _json(self, status, data):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        sys.stdout.write(f"[arxiv-server] {args[0]}\n")
        sys.stdout.flush()


if __name__ == "__main__":
    server = HTTPServer(("127.0.0.1", PORT), ArxivHandler)
    print(f"[arxiv-server] Starting on http://127.0.0.1:{PORT}")
    print(f"[arxiv-server] Cache dir: {CACHE_DIR}")
    print(f"[arxiv-server] Endpoints:")
    print(f"  POST /convert   - Convert arXiv paper to LLM prompt")
    print(f"  POST /sections  - List paper sections")
    print(f"  POST /abstract  - Extract abstract")
    print(f"  GET  /health    - Health check")
    server.serve_forever()
