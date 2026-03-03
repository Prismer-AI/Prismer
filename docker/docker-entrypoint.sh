#!/bin/bash
# ============================================================
# OpenClaw Container Entrypoint
# ============================================================
#
# 生成 openclaw.json 配置并启动 Gateway
#

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ============================================================
# 环境变量
# ============================================================

# 必须的环境变量
: "${PRISMER_IM_SERVER_URL:?'PRISMER_IM_SERVER_URL is required'}"
: "${PRISMER_CONVERSATION_ID:?'PRISMER_CONVERSATION_ID is required'}"
: "${PRISMER_AGENT_TOKEN:?'PRISMER_AGENT_TOKEN is required'}"

# 可选环境变量
OPENCLAW_GATEWAY_PORT=${OPENCLAW_GATEWAY_PORT:-18789}
OPENCLAW_CONFIG_DIR=${OPENCLAW_CONFIG_DIR:-/root/.openclaw}
OPENCLAW_LOG_LEVEL=${OPENCLAW_LOG_LEVEL:-info}
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-}
OPENCLAW_MODEL=${OPENCLAW_MODEL:-anthropic/claude-sonnet-4-20250514}

log_info "Prismer OpenClaw Agent Starting..."
log_info "Gateway Port: $OPENCLAW_GATEWAY_PORT"
log_info "IM Server: $PRISMER_IM_SERVER_URL"

# ============================================================
# 生成 OpenClaw 配置 (JSON 格式)
# ============================================================

generate_config() {
    log_info "Generating OpenClaw configuration..."

    mkdir -p "$OPENCLAW_CONFIG_DIR"

    # 生成 openclaw.json
    cat > "$OPENCLAW_CONFIG_DIR/openclaw.json" << EOF
{
  "agent": {
    "model": "$OPENCLAW_MODEL"
  },
  "gateway": {
    "port": $OPENCLAW_GATEWAY_PORT,
    "host": "0.0.0.0"
  },
  "logging": {
    "level": "$OPENCLAW_LOG_LEVEL"
  },
  "channels": {
    "prismer-im": {
      "accounts": {
        "default": {
          "imServerUrl": "$PRISMER_IM_SERVER_URL",
          "conversationId": "$PRISMER_CONVERSATION_ID",
          "agentToken": "$PRISMER_AGENT_TOKEN",
          "capabilities": ["latex", "jupyter", "pdf", "code"]
        }
      }
    }
  },
  "skills": {
    "prismer-workspace": {
      "apiBaseUrl": "${PRISMER_API_BASE_URL:-http://host.docker.internal:3000}",
      "agentId": "${PRISMER_AGENT_ID:-default}",
      "enabledTools": [
        "latex_compile",
        "jupyter_execute",
        "jupyter_notebook",
        "load_pdf",
        "switch_component",
        "send_ui_directive"
      ]
    }
  },
  "plugins": [
    "/opt/prismer/plugins/prismer-im",
    "/opt/prismer/plugins/prismer-workspace"
  ]
}
EOF

    log_info "Configuration written to $OPENCLAW_CONFIG_DIR/openclaw.json"

    # 如果有 API Key，写入环境
    if [ -n "$ANTHROPIC_API_KEY" ]; then
        export ANTHROPIC_API_KEY
        log_info "Anthropic API Key configured"
    fi
}

# ============================================================
# 启动基础服务 (来自 v1.1 镜像)
# ============================================================

start_base_services() {
    log_info "Starting base services..."

    # 检查并启动 Jupyter (如果存在)
    if command -v jupyter &> /dev/null; then
        log_info "Starting Jupyter..."
        jupyter notebook --ip=0.0.0.0 --port=8888 --no-browser --allow-root \
            --NotebookApp.token='' --NotebookApp.password='' &
    fi

    # 检查并启动 LaTeX API (如果存在)
    if [ -f /opt/latex-api/start.sh ]; then
        log_info "Starting LaTeX API..."
        /opt/latex-api/start.sh &
    fi

    # 等待服务启动
    sleep 2
}

# ============================================================
# 启动 OpenClaw Gateway
# ============================================================

start_gateway() {
    log_info "Starting OpenClaw Gateway on port $OPENCLAW_GATEWAY_PORT..."

    cd "$OPENCLAW_CONFIG_DIR"

    # 启动 Gateway
    exec openclaw gateway \
        --port "$OPENCLAW_GATEWAY_PORT" \
        --verbose
}

# ============================================================
# 主逻辑
# ============================================================

case "${1:-start}" in
    start)
        generate_config
        start_base_services
        start_gateway
        ;;
    gateway)
        shift
        exec openclaw gateway "$@"
        ;;
    doctor)
        exec openclaw doctor
        ;;
    shell|bash|sh)
        exec /bin/bash
        ;;
    *)
        # 直接传递给 openclaw
        exec openclaw "$@"
        ;;
esac
