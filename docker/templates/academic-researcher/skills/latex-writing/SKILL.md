---
name: latex-writing
description: Create, edit, and compile LaTeX documents for academic papers using latex_compile, update_latex, and send_ui_directive tools
---

# LaTeX Writing Skill

## Description
Create, edit, and compile LaTeX documents for academic papers, theses, and reports.

## Tools Used
- `latex_compile` - Compile LaTeX to PDF (auto-switches to LaTeX editor)
- `update_latex` - Update LaTeX editor content without compiling
- `send_ui_directive` - Send raw UI directives for advanced control

## Capabilities

### Document Creation
- Academic papers (IEEE, ACM, Springer formats)
- Theses and dissertations
- Technical reports
- Presentations (Beamer)
- Posters

### Content Management
- Section and subsection organization
- Figure and table insertion
- Mathematical equations
- Algorithm pseudocode
- Citation and bibliography (BibTeX)

### Formatting
- Custom styling and templates
- Cross-references and labels
- Index and glossary generation
- Page layout configuration

## Usage Patterns

### Create New Paper
When user says: "Create a new paper about [topic]"
1. Ask about target venue/format
2. Create main.tex with appropriate template
3. Set up bibliography file
4. Add standard sections (abstract, intro, conclusion)
5. Compile initial PDF

### Add Equation
When user says: "Add the softmax equation"
1. Identify equation type (inline/display)
2. Generate LaTeX math code
3. Insert with appropriate label
4. Recompile PDF

### Add Figure
When user says: "Add a figure showing [description]"
1. Ask for figure path or create placeholder
2. Generate figure environment
3. Add caption and label
4. Update references
5. Recompile PDF

### Add Citation
When user says: "Cite this paper: [reference]"
1. Parse reference information
2. Create BibTeX entry
3. Insert \cite{} command
4. Run bibtex + latex

### Fix Compilation Errors
When user says: "The LaTeX isn't compiling"
1. Read error log
2. Identify error location and type
3. Suggest and apply fix
4. Recompile and verify

## Common Templates

### IEEE Conference
```latex
\documentclass[conference]{IEEEtran}
\usepackage{cite}
\usepackage{amsmath,amssymb,amsfonts}
\usepackage{graphicx}
\usepackage{textcomp}
```

### ACM Article
```latex
\documentclass[sigconf]{acmart}
\usepackage{booktabs}
```

### CVPR Conference
```latex
\documentclass[10pt,twocolumn,letterpaper]{article}
\usepackage[pagenumbers]{cvpr}
\usepackage{times}
\usepackage{epsfig}
\usepackage{graphicx}
\usepackage{amsmath}
\usepackage{amssymb}
\usepackage{booktabs}
\usepackage[breaklinks=true,bookmarks=false]{hyperref}

\title{Paper Title}
\author{Author Name\\Institution\\{\tt\small email@example.com}}

\begin{document}
\maketitle
\begin{abstract}
Abstract text here.
\end{abstract}

\section{Introduction}
...
\section{Related Work}
...
\section{Method}
...
\section{Experiments}
...
\section{Conclusion}
...

{\small
\bibliographystyle{ieee_fullname}
\bibliography{references}
}
\end{document}
```

### Thesis
```latex
\documentclass[12pt,a4paper]{report}
\usepackage{geometry}
\geometry{margin=1in}
```

## Math Snippets

### Equations
- Inline: `$x = \frac{-b \pm \sqrt{b^2-4ac}}{2a}$`
- Display: `\[ E = mc^2 \]`
- Numbered: `\begin{equation}...\end{equation}`

### Matrices
```latex
\begin{bmatrix}
a & b \\
c & d
\end{bmatrix}
```

### Algorithms
```latex
\begin{algorithm}
\caption{Algorithm Name}
\begin{algorithmic}
\STATE ...
\end{algorithmic}
\end{algorithm}
```

## Best Practices

1. **Modular Structure**: Use \input{} for sections
2. **Consistent Labels**: Use prefixes (fig:, tab:, eq:, sec:)
3. **Version Control**: Regular saves and snapshots
4. **Error-First**: Fix errors before adding content
5. **Preview Often**: Compile frequently to catch issues early
