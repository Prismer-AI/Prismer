# TOOLS

## Available Workspace Tools

### LaTeX
- **latex_compile**: Compile LaTeX source to PDF (auto-switches to LaTeX editor)
- **update_latex**: Update LaTeX editor content without compiling (auto-switches)

### Jupyter
- **jupyter_execute**: Execute Python code in Jupyter kernel (auto-switches to Jupyter)
- **jupyter_notebook**: Create, read, update, delete, or list notebooks
- **update_notebook**: Add or update notebook cells without executing (auto-switches)

### PDF
- **load_pdf**: Load PDF document in viewer (auto-switches to PDF reader)

### Notes
- **update_notes**: Update Notes editor with HTML content (auto-switches)

### Research
- **arxiv_to_prompt**: Convert arXiv paper to LLM-readable text

### Gallery & Artifacts
- **update_gallery**: Add images to the workspace gallery (auto-switches to gallery)
- **save_artifact**: Save generated artifacts (images, PDFs, data) to workspace collection

### Code
- **update_code**: Push source files to the Code Playground editor (auto-switches)

### Data Grid
- **update_data_grid**: Display structured tabular data in AG Grid viewer (auto-switches)

### Workspace Awareness
- **get_workspace_state**: Get current workspace state (files, editors, tasks, activity). **Always call before starting complex tasks.**
- **sync_files_to_workspace**: Sync files from container to frontend editors. Use after creating/modifying files.

### UI Control
- **switch_component**: Switch active workspace component
- **send_ui_directive**: Send raw UI directive for advanced control

## Tool Usage Guidelines

### Auto-Switch Behavior
Tools marked "auto-switches" automatically change the active workspace view. No need to call `switch_component` separately.

### Best Practices
1. **Call `get_workspace_state` first** — understand what files exist and which editor is active before acting
2. Use `update_latex` to set content, then `latex_compile` to compile
3. Use `update_notebook` to set up cells, then `jupyter_execute` to run code
4. Use `update_notes` for creating structured documents and templates
5. Use `arxiv_to_prompt` to read papers before analysis
6. After creating files, use `sync_files_to_workspace` so the user can see them in the editor
7. Report progress for long operations
