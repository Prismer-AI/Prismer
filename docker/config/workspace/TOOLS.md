# Prismer Workspace Tools

> **Plugin Version:** 0.5.0 | **Total Tools:** 26 | **SSoT:** `docker/plugin/prismer-workspace/version.ts`

## LaTeX Tools

### latex_compile
Compile LaTeX source code to PDF.

**Parameters:**
- `content` (required): LaTeX source code
- `filename` (optional): Output filename without extension
- `engine` (optional): pdflatex | xelatex | lualatex

**Example:**
```
latex_compile({
  content: "\\documentclass{article}\\begin{document}Hello\\end{document}",
  engine: "pdflatex"
})
```

## Jupyter Tools

### jupyter_execute
Execute Python code in Jupyter kernel.

**Parameters:**
- `code` (required): Python code to execute
- `kernel` (optional): Kernel name (default: python3)

**Example:**
```
jupyter_execute({
  code: "import numpy as np\nprint(np.pi)"
})
```

### jupyter_notebook
Manage Jupyter notebooks.

**Parameters:**
- `path` (required): Notebook path
- `operation` (required): create | read | update | delete | list
- `content` (optional): Notebook content for create/update

## arXiv Tools

### arxiv_to_prompt
Convert an arXiv paper to flattened LaTeX optimized for LLM reading.
Downloads the paper source, flattens multi-file projects, strips comments.

**Parameters:**
- `arxiv_id` (required): arXiv paper ID (e.g., "2303.08774")
- `remove_comments` (optional): Remove LaTeX comments (default: true)
- `remove_appendix` (optional): Remove appendix sections (default: false)
- `abstract_only` (optional): Extract only the abstract
- `section` (optional): Extract a specific section by name
- `list_sections` (optional): List all section names instead of converting
- `figure_paths` (optional): Only include figure file paths

**Examples:**
```
arxiv_to_prompt({ arxiv_id: "2303.08774" })
arxiv_to_prompt({ arxiv_id: "2303.08774", list_sections: true })
arxiv_to_prompt({ arxiv_id: "2303.08774", section: "Introduction" })
arxiv_to_prompt({ arxiv_id: "2303.08774", abstract_only: true })
```

## Content Update Tools

### update_notes
Update the Notes editor (ai-editor) with HTML content. Auto-switches to Notes.

**Parameters:**
- `content` (required): HTML content string

**Example:**
```
update_notes({ content: "<h1>Title</h1><p>Content...</p>" })
```

### update_latex
Update the LaTeX editor with source code (no compilation). Auto-switches to LaTeX.

**Parameters:**
- `file` (optional): Filename (default: "main.tex")
- `content` (required): LaTeX source code

**Example:**
```
update_latex({ content: "\\documentclass{article}\\begin{document}...\\end{document}" })
```

### update_notebook
Add or update cells in the Jupyter notebook. Auto-switches to Jupyter.

**Parameters:**
- `cells` (required): Array of `{type: "code"|"markdown", source: string}`
- `execute` (optional): Whether to execute code cells (default: false)

**Example:**
```
update_notebook({ cells: [{ type: "code", source: "import numpy as np" }], execute: false })
```

### update_gallery
Update the bento gallery with images. Auto-switches to gallery.

**Parameters:**
- `images` (required): Array of `{url: string, caption?: string}`

**Example:**
```
update_gallery({ images: [{ url: "output/plot.png", caption: "Sine curve" }] })
```

### save_artifact
Save an artifact (file, image, PDF) to the workspace collection.

**Parameters:**
- `name` (required): Artifact name
- `type` (required): "pdf" | "image" | "code" | "data" | "latex" | "jupyter"
- `content` (optional): Base64 or text content
- `url` (optional): URL to artifact

## Workspace Awareness Tools

### get_workspace_state
Get current workspace state including files, editors, tasks, and recent activity.
**Always call this before starting a complex task** to understand what the user is working on.

**Parameters:**
- `include` (optional): Array of sections to include. Options: `files`, `editors`, `tasks`, `messages`, `timeline`. Default: all.

**Example:**
```
get_workspace_state({})
get_workspace_state({ include: ["files", "editors"] })
```

**Returns:**
- `workspace`: Name, description, template type
- `files`: List of project files (paths, hashes)
- `editors`: Active editor states (active file, page, cell count, etc.)
- `tasks`: Task list with statuses
- `recentMessages`: Last 5 chat messages
- `timeline`: Last 10 activity events

### sync_files_to_workspace
Sync files from the container to the workspace frontend editors.
Use after creating or modifying files that the user should see in the editor.

**Parameters:**
- `files` (required): Array of `{path: string, content: string}`
- `targetComponent` (optional): Editor to notify (e.g., "latex-editor")

**Example:**
```
sync_files_to_workspace({
  files: [
    { path: "main.tex", content: "\\documentclass{article}..." },
    { path: "refs.bib", content: "@article{..." }
  ]
})
```

## Code Playground Tools

### code_execute
Execute code in the code playground and display results. Auto-switches to code playground.

**Parameters:**
- `code` (required): Source code to execute
- `language` (optional): Programming language (default: python)

**Example:**
```
code_execute({ code: "def fib(n): return n if n < 2 else fib(n-1) + fib(n-2)\nprint(fib(10))" })
```

### update_code
Update the code playground with source code without execution. Auto-switches to code playground.

**Parameters:**
- `code` (required): Source code
- `language` (optional): Language for syntax highlighting

## Data Analysis Tools

### data_list
List available data files in the workspace.

**Parameters:** None

**Returns:** Array of `{path, name, format, size}`

### data_load
Load a CSV or JSON file into the AG Grid viewer. Auto-switches to ag-grid.

**Parameters:**
- `filename` (required): File path relative to workspace
- `format` (optional): "csv" | "json" (auto-detected from extension)

**Example:**
```
data_load({ filename: "data/students.csv" })
```

### data_query
Filter or query data currently loaded in the grid. Updates the grid view.

**Parameters:**
- `query` (required): SQL-like query string or filter object
- `columns` (optional): Array of column names to include

### data_save
Save data from the grid to a workspace file.

**Parameters:**
- `filename` (required): Output file path
- `format` (optional): "csv" | "json"

## LaTeX Project Tools

### latex_project
Manage multi-file LaTeX projects (create, list, read files).

**Parameters:**
- `operation` (required): "create" | "list" | "read" | "write"
- `path` (optional): File path within project
- `content` (optional): File content for write operation

### latex_project_compile
Compile a multi-file LaTeX project. Auto-switches to latex-editor.

**Parameters:**
- `mainFile` (optional): Main .tex file (default: "main.tex")
- `engine` (optional): pdflatex | xelatex | lualatex

## Academic Context Tools

### get_paper_context
Get context from papers loaded in the workspace (for LLM-informed responses).

**Parameters:**
- `paperId` (optional): Specific paper ID (arXiv or upload)
- `sections` (optional): Array of section names to extract

### navigate_pdf
Navigate the PDF reader to a specific page or section.

**Parameters:**
- `page` (required): Page number to navigate to

### context_search
Search across workspace context (papers, notes, code).

**Parameters:**
- `query` (required): Search query string
- `scope` (optional): Array of `["papers", "notes", "code", "data"]`

### context_load
Load specific context content by reference.

**Parameters:**
- `ref` (required): Context reference ID
- `format` (optional): "text" | "markdown" | "json"

## UI Control Tools

### load_pdf
Load a PDF document in the viewer. Auto-switches to PDF reader.

**Parameters:**
- `source` (required): URL or path to PDF
- `page` (optional): Page number to navigate to

### switch_component
Switch the active workspace component.

**Parameters:**
- `component` (required): Target component name
  - pdf-reader
  - latex-editor
  - jupyter-notebook
  - code-playground
  - ai-editor
  - ag-grid
  - bento-gallery
  - three-viewer
- `data` (optional): Initial data for component

### send_ui_directive
Send a raw UI directive for advanced control. Prefer dedicated tools above.

**Parameters:**
- `type` (required): Directive type
- `payload` (required): Directive payload object

## Available UIDirective Types

### Global
- SWITCH_COMPONENT
- LOAD_DOCUMENT
- SHOW_NOTIFICATION
- UPDATE_LAYOUT

### Content Updates
- UPDATE_LATEX — Update LaTeX editor (`{file, content}`)
- UPDATE_NOTES — Update Notes editor (`{content}`)
- UPDATE_NOTEBOOK — Update Jupyter cells (`{cells, execute}`)

### Jupyter
- JUPYTER_ADD_CELL
- JUPYTER_EXECUTE_CELL
- JUPYTER_UPDATE_CELL
- JUPYTER_CLEAR_OUTPUTS

### LaTeX
- LATEX_UPDATE_FILE
- LATEX_COMPILE
- LATEX_SCROLL_TO_LINE

### PDF
- PDF_LOAD_DOCUMENT
- PDF_NAVIGATE_TO_PAGE
- PDF_HIGHLIGHT_REGION

### Code Playground
- CODE_LOAD_FILES
- CODE_UPDATE_FILE
- CODE_EXECUTE
- CODE_TERMINAL_OUTPUT

### AG Grid
- GRID_LOAD_DATA
- GRID_UPDATE_DATA

### Timeline
- TIMELINE_ADD_EVENT
- TIMELINE_NAVIGATE
