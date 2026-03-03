# prismer-tools

> CLI utilities for Prismer.AI workspace operations inside OpenClaw containers

**Version:** 0.1.0
**Runtime:** Python 3
**Install Path:** `/home/user/.local/bin/`

## Overview

Four CLI tools that the OpenClaw agent invokes via `exec` to perform workspace operations. Each tool writes JSON directives to `/workspace/.openclaw/directives/` for frontend consumption via the Bridge API.

## Tools

### prismer-latex

Compile LaTeX documents via the container's TeXLive service (:8080).

```bash
# Compile a .tex file (writes PDF to /workspace/output/)
prismer-latex compile /workspace/projects/paper.tex

# Compile with xelatex (CJK support)
prismer-latex compile /workspace/projects/paper.tex --engine xelatex

# Compile inline LaTeX content
prismer-latex compile-content "\documentclass{article}\begin{document}Hello\end{document}"

# Compile and return base64 PDF preview
prismer-latex preview /workspace/projects/paper.tex
```

**Directives written:** `switch_component` (latex-editor), `update_content`, `compile_complete` (with PDF base64)

### prismer-jupyter

Execute Python code via subprocess or Jupyter REST API (:8888).

```bash
# Execute a Python file
prismer-jupyter execute /workspace/notebooks/analysis.py

# Execute inline code
prismer-jupyter execute-code "import numpy as np; print(np.pi)"

# Run a Jupyter notebook
prismer-jupyter run-notebook /workspace/notebooks/experiment.ipynb
```

**Directives written:** `switch_component` (jupyter-notebook), `jupyter_cell_result`, `add_gallery_image` (for generated plots)

### prismer-component

Control workspace UI components.

```bash
# Switch active component
prismer-component switch latex-editor
prismer-component switch jupyter-notebook
prismer-component switch bento-gallery

# Update component content from file
prismer-component update ai-editor --content /workspace/projects/report.html

# Send user notification
prismer-component notify "Compilation complete"
```

**Directives written:** `switch_component`, `update_content`, `notification`

### prismer-workspace-sync

Workspace file state management.

```bash
# List tracked directories and files
prismer-workspace-sync list

# Create JSON state snapshot
prismer-workspace-sync snapshot

# List pending UI directives
prismer-workspace-sync directives

# Clear processed directives
prismer-workspace-sync clear-directives
```

## Directive Protocol

Tools write JSON files to `/workspace/.openclaw/directives/` with timestamp-based names:

```
/workspace/.openclaw/directives/
├── 20260224_101816_622751.json
├── 20260224_101816_622752.json
└── 20260224_101816_622753.json
```

Each file contains:
```json
{
  "type": "switch_component",
  "target": "latex-editor",
  "data": { ... },
  "timestamp": "2026-02-24T10:18:16.622710"
}
```

The Bridge API (`/api/v2/im/bridge/[workspaceId]`) reads these files after each agent run, parses them into UI directives, and clears processed files.

## Workspace Directory Standard

```
/workspace/
├── projects/          ← Documents, LaTeX source files
├── notebooks/         ← Python scripts, Jupyter notebooks
├── output/            ← Compiled artifacts (PDF, images, data)
├── skills/            ← Installed skill definitions
└── .openclaw/
    └── directives/    ← UI directive queue (JSON files)
```

## Installation

Handled by `Dockerfile.openclaw`:
```dockerfile
COPY scripts/prismer-tools/ /opt/prismer/tools/
RUN chmod +x /opt/prismer/tools/*
RUN ln -sf /opt/prismer/tools/prismer-latex /home/user/.local/bin/prismer-latex
# ... (similar for other tools)
```
