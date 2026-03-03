#!/usr/bin/env python3
"""
Patch base image entrypoint.sh:
  - Add arxiv-server startup
  - Replace Web Frontend with Container Gateway
"""

import re
import sys

ENTRYPOINT = "/app/entrypoint.sh"

with open(ENTRYPOINT) as f:
    content = f.read()

# ── 1. Add arxiv-server before Jupyter ────────────────────────
# arxiv-to-prompt is installed system-wide but the entrypoint may activate a venv.
# We use the system python directly to avoid PATH issues.

arxiv_block = """# 2.5. arXiv paper server
echo -e "${CYAN}[start]${NC} arXiv server on :8082..."
/usr/bin/python3 /home/user/.local/bin/arxiv-server.py &
PIDS+=($!)

"""

if "arxiv-server" not in content:
    content = content.replace(
        "# 3. Jupyter server",
        arxiv_block + "# 3. Jupyter server",
    )
    print("[patch] Added arxiv-server startup")
else:
    print("[patch] arxiv-server already present, skipping")

# ── 2. Replace Web Frontend with Container Gateway ────────────

# Match the entire section from "# 5. Wait for Gateway" through the frontend PIDS line
# The section includes:
#   # 5. Wait for Gateway to be ready before starting frontend
#   sleep 3
#   # 6. Web frontend
#   echo ... (multiple lines)
#   PIDS+=($!)
pattern = (
    r"# 5\. Wait for Gateway[^\n]*\n"  # Header line
    r"sleep \d+\n+"                     # sleep N
    r"# 6\. Web frontend\n"             # Web frontend comment
    r"[\s\S]*?"                         # Any content
    r"PIDS\+=\(\$!\)"                   # Until PIDS line
)

gateway_block = """# 6. Container Gateway (unified service proxy)
echo -e "${CYAN}[start]${NC} Container Gateway on :${FRONTEND_PORT}..."
GATEWAY_PORT="${FRONTEND_PORT}" node /app/gateway/container-gateway.mjs &
PIDS+=($!)"""

if re.search(pattern, content):
    content = re.sub(pattern, gateway_block, content)
    print("[patch] Replaced web frontend with container gateway")
elif "container-gateway" not in content:
    print("[patch] WARNING: Could not find web frontend block to replace", file=sys.stderr)
else:
    print("[patch] Container gateway already present, skipping")

# ── 3. Update banner ─────────────────────────────────────────

content = content.replace(
    "🌐 Web UI:",
    "🌐 Gateway:",
)
content = content.replace(
    "Open the URL above to get started!",
    "Container Gateway ready!",
)
content = content.replace(
    "Open ${BOLD}http://${LAN_IP}:${FRONTEND_PORT}${NC} in your browser.",
    "Gateway at ${BOLD}http://${LAN_IP}:${FRONTEND_PORT}/api/v1/health${NC}",
)

# ── Write back ────────────────────────────────────────────────

with open(ENTRYPOINT, "w") as f:
    f.write(content)

print("[patch] Entrypoint patched successfully")
