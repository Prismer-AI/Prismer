# MVP Full-Chain Solution: Workspace ↔ Collection ↔ Agent Pipeline

## Overview

This document describes the end-to-end data flow for 4 MVP scenarios, covering how the agent (running in an OpenClaw container) produces artifacts that flow through the directive pipeline to the frontend and persist to the workspace collection.

## Architecture

```
Container (OpenClaw Agent)
  └─ prismer-workspace plugin v0.5.0 (26 tools)
      ├─ update_notes    → SWITCH_COMPONENT + UPDATE_NOTES directive
      ├─ update_latex     → SWITCH_COMPONENT + UPDATE_LATEX directive
      ├─ update_notebook  → SWITCH_COMPONENT + UPDATE_NOTEBOOK directive
      ├─ latex_compile    → SWITCH_COMPONENT + LATEX_COMPILE_COMPLETE directive
      ├─ jupyter_execute  → SWITCH_COMPONENT + JUPYTER_CELL_RESULT directive
      ├─ save_artifact    → POST /api/agents/:id/artifacts → S3 + Collection
      ├─ update_gallery   → SWITCH_COMPONENT + UPDATE_GALLERY directive
      ├─ load_pdf         → SWITCH_COMPONENT + PDF_LOAD_DOCUMENT directive
      ├─ switch_component → SWITCH_COMPONENT directive
      ├─ send_ui_directive → raw directive passthrough
      ├─ arxiv_to_prompt  → arXiv paper → LLM text
      └─ jupyter_notebook → CRUD for notebook files

Directive Pipeline:
  Plugin tool → POST /api/agents/:id/directive → in-memory queue
  → SSE /api/agents/:id/directive/stream → useDirectiveStream hook
  → mapPluginDirective() (UPPERCASE → lowercase) → executeDirective()
  → componentStore + CustomEvent dispatch → editor components

Collection Pipeline:
  Workspace creation → auto-create collection (collectionId in settings)
  Agent artifacts → POST /api/agents/:id/artifacts → S3 + remote MySQL
  Notes auto-save → PUT /api/workspace/:id/notes → remote MySQL (5s interval)
  LaTeX compile → /api/workspace/:id/latex-compile → container or local
```

## MVP Scenarios

### S0: Identity Response
- **Input**: "Who are you, what can you do?"
- **Flow**: Pure LLM response from agent system prompt. No tool calls needed.
- **Status**: Working

### S1: LaTeX Survey with CVPR Template
- **Input**: "Write a survey about vision transformer with CVPR template"
- **Expected Flow**:
  1. Agent calls `update_latex` with CVPR-formatted LaTeX content
  2. Plugin sends SWITCH_COMPONENT (latex-editor) + UPDATE_LATEX directives
  3. Frontend switches to LaTeX editor, content appears
  4. Agent calls `latex_compile` with the same content
  5. Plugin proxies to container LaTeX service (port 8080) or local TeXLive
  6. Compiled PDF returned as base64 data URL
  7. Frontend displays PDF in split preview
  8. Agent calls `save_artifact` to persist PDF to collection
- **Key Files**:
  - `/api/workspace/:id/latex-compile` — smart routing (container vs local)
  - `LatexEditorPreview.tsx` — uses workspace-aware compile URL
  - `latex-writing/SKILL.md` — CVPR template structure

### S2: Jupyter Plot → Collection → Gallery
- **Input**: "Plot sin, cos, tan functions"
- **Expected Flow**:
  1. Agent calls `jupyter_execute` with matplotlib code
  2. Plugin proxies to container Jupyter (port 8888)
  3. Execution returns outputs including base64 plot image
  4. Frontend shows notebook with rendered plot
  5. Agent calls `save_artifact` with plot image
  6. Artifact saved to S3 + linked to workspace collection
  7. Agent calls `update_gallery` with image URL
  8. Frontend switches to gallery, image displayed in bento grid
- **Key Files**:
  - `save_artifact` tool → `/api/agents/:id/artifacts`
  - `update_gallery` tool → UPDATE_GALLERY directive
  - `BentoGalleryPreview.tsx` — CustomEvent listener for agent images

### S3: Notes Experiment Template → Periodic Save
- **Input**: "Write experiment template to notes"
- **Expected Flow**:
  1. Agent calls `update_notes` with HTML experiment template
  2. Plugin sends SWITCH_COMPONENT (ai-editor) + UPDATE_NOTES directives
  3. Frontend switches to notes editor, content rendered
  4. `useNotesAutoSave` detects content change (5s interval)
  5. Calls `PUT /api/workspace/:id/notes`
  6. Backend creates/updates note asset in remote MySQL
  7. Asset linked to workspace collection
  8. Subsequent edits auto-saved periodically
- **Key Files**:
  - `useNotesAutoSave.ts` — 5s interval auto-save hook
  - `/api/workspace/:id/notes` — upsert endpoint

## Workspace ↔ Collection Binding

Every workspace gets an auto-created collection on workspace creation. The `collectionId` is stored in the workspace `settings` JSON field.

```
WorkspaceSession.settings = {
  collectionId: 42,    // Remote MySQL po_user_collections.id
  ...
}
```

**Safety**: `ensureCollectionBinding(workspaceId)` in `workspace.service.ts` creates a collection if one doesn't exist (for legacy workspaces).

**Frontend access**: `useWorkspaceCollectionId()` selector hook from `agentInstanceStore`.

## Plugin Version History

| Version | Tools | Changes |
|---------|-------|---------|
| v0.1.0 | 7 | Initial: latex_compile, jupyter_execute, jupyter_notebook, load_pdf, switch_component, send_ui_directive, arxiv_to_prompt |
| v0.2.0 | 10 | Added: update_notes, update_latex, update_notebook. Fixed registerTool API. |
| v0.3.0 | 12 | Added: save_artifact, update_gallery. Workspace-aware LaTeX compilation. |
| v0.4.0 | 14 | Added: code_execute, update_code. Code playground integration. |
| v0.5.0 | 26 | **Rewrite with registerTool API**. Added: data_list, data_load, data_query, data_save, latex_project, latex_project_compile, get_paper_context, navigate_pdf, context_search, context_load, get_workspace_state, sync_files_to_workspace. |
