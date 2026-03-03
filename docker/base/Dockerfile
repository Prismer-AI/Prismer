# ============================================================================
# Prismer Academic Base Image v5.0 (optimized)
# ============================================================================
#
# Agent-agnostic academic research sandbox.
# Contains: Python 3.12, R, LaTeX, Lean4, Coq, Z3, Jupyter, Node.js 22
# Does NOT contain any Agent framework (OpenClaw, Claude Code, etc.)
#
# Build (~10–12GB):
#   docker build -t prismer-academic:v5.0 .
#
# With registry proxy (faster in China):
#   docker build --build-arg REGISTRY_PROXY=dh.prismer.dev/ -t prismer-academic:v5.0 .
#
# Size optimization notes (vs naive ~27GB):
#   - No standalone `chown -R` (avoids 13GB+ layer duplication)
#   - CPU-only PyTorch (saves ~2GB vs CUDA bundle)
#   - TeX docs removed in same layer as install (saves ~1GB)
#   - No coqide, Lean install+check merged (saves ~1GB)
#   - Build-only deps removed after compilation (saves ~500MB)
#
# ============================================================================
ARG REGISTRY_PROXY=""
FROM ${REGISTRY_PROXY}ubuntu:24.04

LABEL maintainer="dev@prismer.dev"
LABEL version="5.0.0"
LABEL description="Academic research sandbox — Python, R, LaTeX, Lean4, Coq, Z3, Jupyter"
LABEL org.opencontainers.image.source="https://github.com/nicepkg/pisaloop"

# ============================================================================
# 0. Environment Setup
# ============================================================================
ENV DEBIAN_FRONTEND=noninteractive
ENV LANG=C.UTF-8
ENV LC_ALL=C.UTF-8
ENV HOME=/home/user
ENV PATH="/home/user/.local/bin:/home/user/.venv/bin:/root/.local/bin:$PATH"
ENV PYTHONUNBUFFERED=1
ENV MPLBACKEND=Agg

RUN if id -u 1000 >/dev/null 2>&1; then \
      existing_user=$(getent passwd 1000 | cut -d: -f1); \
      userdel -r "$existing_user" 2>/dev/null || true; \
    fi && \
    useradd -m -s /bin/bash -u 1000 user

# ============================================================================
# 1. System + Build Tools + Document Processing (single layer)
# ============================================================================
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential gcc g++ gfortran \
    make cmake pkg-config \
    git git-lfs \
    curl wget rsync \
    unzip zip tar \
    vim nano \
    ca-certificates openssh-client \
    jq sqlite3 \
    time htop tree file \
    inotify-tools procps lsof \
    locales \
    pandoc wkhtmltopdf ghostscript poppler-utils qpdf imagemagick \
    && locale-gen en_US.UTF-8 \
    && (sed -i 's/rights="none" pattern="PDF"/rights="read|write" pattern="PDF"/' /etc/ImageMagick-6/policy.xml || true) \
    && rm -rf /var/lib/apt/lists/*

# ============================================================================
# 2. LaTeX (medium scheme, docs stripped in same layer)
# ============================================================================
RUN apt-get update && apt-get install -y --no-install-recommends \
    texlive-latex-base \
    texlive-latex-recommended \
    texlive-latex-extra \
    texlive-fonts-recommended \
    texlive-fonts-extra \
    texlive-science \
    texlive-bibtex-extra \
    texlive-lang-chinese \
    texlive-xetex \
    texlive-luatex \
    latexmk biber python3-pygments \
    && rm -rf /usr/share/texlive/texmf-dist/doc \
              /usr/share/texmf/doc \
    && rm -rf /var/lib/apt/lists/*

# ============================================================================
# 3. Python 3.12 + uv + venv (dirs owned by user from creation)
# ============================================================================
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.12 python3.12-venv python3.12-dev python3-pip \
    && rm -rf /var/lib/apt/lists/* \
    && update-alternatives --install /usr/bin/python python /usr/bin/python3.12 1 \
    && update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.12 1 \
    && curl -LsSf https://astral.sh/uv/install.sh | sh \
    && (mv /root/.local/bin/uv /usr/local/bin/uv 2>/dev/null || \
        mv /home/user/.local/bin/uv /usr/local/bin/uv 2>/dev/null || true) \
    && chmod +x /usr/local/bin/uv

# Create all user directories with correct ownership upfront (avoids chown -R later)
RUN install -d -o user -g user \
    /home/user/.venv \
    /home/user/.local/bin \
    /home/user/.local/share/jupyter/runtime \
    /home/user/.config/matplotlib \
    /home/user/.config/jupyter \
    /home/user/workspace \
    /home/user/cache/pip /home/user/cache/huggingface /home/user/cache/nltk_data \
    /home/user/cache/latex /home/user/cache/provers \
    /home/user/output/charts /home/user/output/data /home/user/output/reports \
    /home/user/output/code /home/user/output/figures /home/user/output/tables \
    /home/user/output/temp /home/user/output/proofs

# Switch to user — all pip/venv operations run as user, no chown needed
USER user
WORKDIR /home/user

RUN uv venv /home/user/.venv

# ============================================================================
# 4. Python packages (installed as user — no layer-duplicating chown)
# ============================================================================

# Core scientific
COPY --chown=user:user requirements-core.txt /tmp/
RUN uv pip install --python /home/user/.venv/bin/python -r /tmp/requirements-core.txt \
    && rm -rf /home/user/.cache/uv

# CPU-only PyTorch first (prevents transformers/sentence-transformers from pulling ~2GB CUDA bundle)
RUN uv pip install --python /home/user/.venv/bin/python \
    torch torchvision --index-url https://download.pytorch.org/whl/cpu \
    && rm -rf /home/user/.cache/uv

# ML & NLP (torch already satisfied from CPU index above)
COPY --chown=user:user requirements-ml.txt /tmp/
RUN uv pip install --python /home/user/.venv/bin/python -r /tmp/requirements-ml.txt \
    && rm -rf /home/user/.cache/uv \
    || echo "Warning: Some ML packages failed"

# Jupyter
COPY --chown=user:user requirements-jupyter.txt /tmp/
RUN uv pip install --python /home/user/.venv/bin/python -r /tmp/requirements-jupyter.txt \
    && rm -rf /home/user/.cache/uv \
    || echo "Warning: Jupyter packages failed"

# arxiv-to-prompt
RUN /home/user/.venv/bin/python -m pip install --no-cache-dir arxiv-to-prompt || true

# NLP models
RUN /home/user/.venv/bin/python -m spacy download en_core_web_sm || true
RUN /home/user/.venv/bin/python -m spacy download zh_core_web_sm || true
RUN /home/user/.venv/bin/python -c "import nltk; nltk.download('punkt'); nltk.download('stopwords'); nltk.download('wordnet')" || true

# ============================================================================
# 5. R Language
# ============================================================================
USER root
RUN apt-get update && apt-get install -y --no-install-recommends r-base r-base-dev \
    && rm -rf /var/lib/apt/lists/* \
    && R -e "install.packages(c('tidyverse','data.table','ggplot2','lme4','survival','knitr','rmarkdown'), repos='https://cloud.r-project.org/')" \
    || echo "Warning: Some R packages failed"

# ============================================================================
# 6. Formal Methods — Coq + Lean4 (merged, no coqide)
# ============================================================================
RUN apt-get update && apt-get install -y --no-install-recommends coq \
    && rm -rf /var/lib/apt/lists/*

# Lean 4: install elan + trigger toolchain download in SAME layer
ENV ELAN_HOME="/home/user/.elan"
RUN curl -sSf https://raw.githubusercontent.com/leanprover/elan/master/elan-init.sh | \
    ELAN_HOME=/home/user/.elan sh -s -- -y --default-toolchain stable \
    && /home/user/.elan/bin/lean --version || true \
    && chown -R user:user /home/user/.elan
ENV PATH="/home/user/.elan/bin:$PATH"

# ============================================================================
# 7. Other Tools + Node.js 22
# ============================================================================
RUN apt-get update && apt-get install -y --no-install-recommends \
    gnuplot graphviz ffmpeg maxima octave bibutils \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs \
    && npm install -g pnpm esbuild \
    && rm -rf /var/lib/apt/lists/* /root/.npm

# ============================================================================
# 8. Remove build-only packages (no longer needed after compilation)
# ============================================================================
RUN apt-get purge -y --auto-remove \
    gfortran cmake r-base-dev python3.12-dev \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* \
              /usr/share/doc /usr/share/man /usr/share/info /usr/share/lintian \
              /tmp/* /var/tmp/* /root/.cache

# ============================================================================
# 9. Configuration & Scripts
# ============================================================================
USER user

RUN echo 'backend: Agg' > /home/user/.config/matplotlib/matplotlibrc \
    && echo 'savefig.dpi: 150' >> /home/user/.config/matplotlib/matplotlibrc \
    && echo 'savefig.format: png' >> /home/user/.config/matplotlib/matplotlibrc \
    && echo 'savefig.bbox: tight' >> /home/user/.config/matplotlib/matplotlibrc \
    && echo 'figure.figsize: 10, 6' >> /home/user/.config/matplotlib/matplotlibrc

RUN echo "c.ServerApp.notebook_dir = '/home/user/workspace'" > /home/user/.config/jupyter/jupyter_server_config.py \
    && echo "c.ServerApp.open_browser = False" >> /home/user/.config/jupyter/jupyter_server_config.py

COPY --chown=user:user latex-server.py /home/user/.local/bin/
COPY --chown=user:user prover-server.py /home/user/.local/bin/
COPY --chown=user:user arxiv-server.py /home/user/.local/bin/
COPY --chown=user:user output-sync.py /home/user/.local/bin/
RUN chmod +x /home/user/.local/bin/*.py

# ============================================================================
# 10. Verification
# ============================================================================
RUN python --version && pip --version \
    && pdflatex --version | head -1 && pandoc --version | head -1 && node --version \
    && (R --version 2>/dev/null | head -1 || true) \
    && (lean --version 2>/dev/null || true) \
    && (coqc --version 2>/dev/null || true)

EXPOSE 8080 8081 8082 8888

WORKDIR /home/user
CMD ["/bin/bash"]
