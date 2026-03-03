#!/usr/bin/env python3
"""
Output Sync Service for Prismer Academic Sandbox

Monitors /home/user/output/ for file changes and emits JSON events
to stdout for the backend to process and upload to S3.

Usage:
    python output-sync.py [--once] [--verbose]
"""

import os
import sys
import json
import time
import hashlib
import argparse
import mimetypes
from pathlib import Path
from datetime import datetime
from typing import Optional, Dict, Any

try:
    from watchdog.observers import Observer
    from watchdog.events import FileSystemEventHandler, FileCreatedEvent, FileModifiedEvent
    HAS_WATCHDOG = True
except ImportError:
    HAS_WATCHDOG = False
    print("Warning: watchdog not installed, using polling mode", file=sys.stderr)

# ============================================================================
# Configuration
# ============================================================================

OUTPUT_DIR = Path("/home/user/output")
SYNC_MANIFEST = OUTPUT_DIR / ".sync_manifest.json"
EXCLUDE_DIRS = {"temp", "__pycache__", ".ipynb_checkpoints"}
EXCLUDE_PATTERNS = {".sync_manifest.json", ".DS_Store", "Thumbs.db"}

# MIME type mappings for common academic files
MIME_TYPES = {
    # Images
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
    ".tiff": "image/tiff",
    ".tif": "image/tiff",
    ".eps": "application/postscript",
    
    # Documents
    ".pdf": "application/pdf",
    ".md": "text/markdown",
    ".tex": "application/x-latex",
    ".bib": "application/x-bibtex",
    ".html": "text/html",
    ".htm": "text/html",
    ".txt": "text/plain",
    ".rtf": "application/rtf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".doc": "application/msword",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    
    # Data
    ".csv": "text/csv",
    ".tsv": "text/tab-separated-values",
    ".json": "application/json",
    ".xml": "application/xml",
    ".yaml": "application/x-yaml",
    ".yml": "application/x-yaml",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".xls": "application/vnd.ms-excel",
    ".parquet": "application/x-parquet",
    ".hdf5": "application/x-hdf5",
    ".h5": "application/x-hdf5",
    
    # Code
    ".py": "text/x-python",
    ".r": "text/x-r",
    ".R": "text/x-r",
    ".jl": "text/x-julia",
    ".sh": "application/x-sh",
    ".sql": "application/sql",
    ".ipynb": "application/x-ipynb+json",
}

# ============================================================================
# Utility Functions
# ============================================================================

def get_mime_type(path: Path) -> str:
    """Get MIME type for a file."""
    ext = path.suffix.lower()
    if ext in MIME_TYPES:
        return MIME_TYPES[ext]
    
    # Fallback to mimetypes module
    mime_type, _ = mimetypes.guess_type(str(path))
    return mime_type or "application/octet-stream"


def get_file_hash(path: Path) -> str:
    """Calculate MD5 hash of a file."""
    try:
        return hashlib.md5(path.read_bytes()).hexdigest()
    except Exception:
        return ""


def is_excluded(path: Path) -> bool:
    """Check if a path should be excluded from sync."""
    # Check filename
    if path.name in EXCLUDE_PATTERNS:
        return True
    
    # Check if in excluded directory
    try:
        rel_path = path.relative_to(OUTPUT_DIR)
        for part in rel_path.parts:
            if part in EXCLUDE_DIRS:
                return True
    except ValueError:
        return True
    
    return False


def get_file_category(path: Path) -> str:
    """Determine the category of a file based on its location."""
    try:
        rel_path = path.relative_to(OUTPUT_DIR)
        if len(rel_path.parts) > 0:
            return rel_path.parts[0]
    except ValueError:
        pass
    return "other"


def emit_event(event_type: str, data: Dict[str, Any]) -> None:
    """Emit a JSON event to stdout."""
    event = {
        "type": event_type,
        "timestamp": datetime.now().isoformat(),
        **data
    }
    print(json.dumps(event), flush=True)


# ============================================================================
# Manifest Management
# ============================================================================

class SyncManifest:
    """Manages the sync state manifest."""
    
    def __init__(self):
        self.data = self._load()
    
    def _load(self) -> Dict:
        """Load manifest from disk."""
        if SYNC_MANIFEST.exists():
            try:
                return json.loads(SYNC_MANIFEST.read_text())
            except Exception:
                pass
        return {"version": 1, "files": {}}
    
    def save(self) -> None:
        """Save manifest to disk."""
        SYNC_MANIFEST.write_text(json.dumps(self.data, indent=2))
    
    def get_hash(self, rel_path: str) -> Optional[str]:
        """Get stored hash for a file."""
        return self.data["files"].get(rel_path, {}).get("hash")
    
    def update(self, rel_path: str, file_hash: str, size: int) -> None:
        """Update manifest entry for a file."""
        self.data["files"][rel_path] = {
            "hash": file_hash,
            "size": size,
            "synced_at": datetime.now().isoformat()
        }
    
    def remove(self, rel_path: str) -> None:
        """Remove a file from manifest."""
        self.data["files"].pop(rel_path, None)


# ============================================================================
# File Sync Handler
# ============================================================================

class OutputSyncHandler(FileSystemEventHandler if HAS_WATCHDOG else object):
    """Handles file system events and triggers sync."""
    
    def __init__(self, manifest: SyncManifest, verbose: bool = False):
        self.manifest = manifest
        self.verbose = verbose
        if HAS_WATCHDOG:
            super().__init__()
    
    def sync_file(self, path: Path) -> bool:
        """
        Sync a single file if it has changed.
        Returns True if file was synced.
        """
        if not path.exists() or not path.is_file():
            return False
        
        if is_excluded(path):
            return False
        
        try:
            rel_path = str(path.relative_to(OUTPUT_DIR))
        except ValueError:
            return False
        
        # Check if file has changed
        file_hash = get_file_hash(path)
        if not file_hash:
            return False
        
        stored_hash = self.manifest.get_hash(rel_path)
        if stored_hash == file_hash:
            if self.verbose:
                print(f"[sync] Unchanged: {rel_path}", file=sys.stderr)
            return False
        
        # File is new or changed - emit sync event
        stat = path.stat()
        
        emit_event("file_sync", {
            "path": str(path),
            "relative_path": rel_path,
            "category": get_file_category(path),
            "hash": file_hash,
            "size": stat.st_size,
            "mime_type": get_mime_type(path),
            "modified_at": datetime.fromtimestamp(stat.st_mtime).isoformat(),
            "is_new": stored_hash is None
        })
        
        # Update manifest
        self.manifest.update(rel_path, file_hash, stat.st_size)
        self.manifest.save()
        
        if self.verbose:
            action = "New" if stored_hash is None else "Modified"
            print(f"[sync] {action}: {rel_path}", file=sys.stderr)
        
        return True
    
    def on_created(self, event):
        """Handle file creation."""
        if isinstance(event, FileCreatedEvent) and not event.is_directory:
            self.sync_file(Path(event.src_path))
    
    def on_modified(self, event):
        """Handle file modification."""
        if isinstance(event, FileModifiedEvent) and not event.is_directory:
            self.sync_file(Path(event.src_path))
    
    def full_scan(self) -> int:
        """Scan all files in output directory. Returns count of synced files."""
        count = 0
        for subdir in OUTPUT_DIR.iterdir():
            if subdir.is_dir() and subdir.name not in EXCLUDE_DIRS:
                for path in subdir.rglob("*"):
                    if path.is_file():
                        if self.sync_file(path):
                            count += 1
        return count


# ============================================================================
# Main
# ============================================================================

def ensure_directories():
    """Ensure output directories exist."""
    for subdir in ["charts", "data", "reports", "code", "figures", "tables", "temp"]:
        (OUTPUT_DIR / subdir).mkdir(parents=True, exist_ok=True)


def run_watch_mode(handler: OutputSyncHandler):
    """Run in watch mode using watchdog."""
    if not HAS_WATCHDOG:
        print("watchdog not available, falling back to polling", file=sys.stderr)
        run_poll_mode(handler)
        return
    
    observer = Observer()
    observer.schedule(handler, str(OUTPUT_DIR), recursive=True)
    observer.start()
    
    print(f"[sync] Watching {OUTPUT_DIR} for changes...", file=sys.stderr)
    emit_event("sync_started", {"mode": "watch", "directory": str(OUTPUT_DIR)})
    
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
        print("\n[sync] Stopped.", file=sys.stderr)
    
    observer.join()


def run_poll_mode(handler: OutputSyncHandler, interval: float = 2.0):
    """Run in polling mode (fallback if watchdog unavailable)."""
    print(f"[sync] Polling {OUTPUT_DIR} every {interval}s...", file=sys.stderr)
    emit_event("sync_started", {"mode": "poll", "directory": str(OUTPUT_DIR), "interval": interval})
    
    try:
        while True:
            handler.full_scan()
            time.sleep(interval)
    except KeyboardInterrupt:
        print("\n[sync] Stopped.", file=sys.stderr)


def main():
    parser = argparse.ArgumentParser(description="Output sync service for Prismer sandbox")
    parser.add_argument("--once", action="store_true", help="Run a single scan and exit")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")
    parser.add_argument("--poll", action="store_true", help="Use polling instead of watchdog")
    parser.add_argument("--interval", type=float, default=2.0, help="Polling interval in seconds")
    args = parser.parse_args()
    
    # Ensure directories exist
    ensure_directories()
    
    # Initialize manifest and handler
    manifest = SyncManifest()
    handler = OutputSyncHandler(manifest, verbose=args.verbose)
    
    # Do initial full scan
    print(f"[sync] Initial scan of {OUTPUT_DIR}...", file=sys.stderr)
    count = handler.full_scan()
    print(f"[sync] Found {count} files to sync.", file=sys.stderr)
    
    if args.once:
        return
    
    # Start watching/polling
    if args.poll or not HAS_WATCHDOG:
        run_poll_mode(handler, args.interval)
    else:
        run_watch_mode(handler)


if __name__ == "__main__":
    main()
