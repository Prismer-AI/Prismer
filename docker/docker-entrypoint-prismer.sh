#!/bin/bash
# ============================================================
# Prismer OpenClaw Configuration Override
# ============================================================
#
# 在基础镜像启动前，注入 Prismer IM 配置
#

set -e

log_info() { echo -e "\033[0;32m[prismer]\033[0m $1"; }

# ============================================================
# 生成 Prismer 配置覆盖
# ============================================================

if [ -n "$PRISMER_IM_SERVER_URL" ] || [ -n "$PRISMER_API_BASE_URL" ]; then
    log_info "Configuring Prismer plugins (IM + Workspace)..."

    # 等待基础配置生成
    sleep 2

    # 读取现有配置并合并
    CONFIG_FILE="/home/user/.openclaw/openclaw.json"

    if [ -f "$CONFIG_FILE" ]; then
        # 使用 jq 合并配置 (如果可用)
        if command -v jq &> /dev/null; then
            PRISMER_CONFIG=$(cat << EOF
{
  "channels": {
    "prismer-im": {
      "accounts": {
        "default": {
          "imServerUrl": "${PRISMER_IM_SERVER_URL}",
          "conversationId": "${PRISMER_CONVERSATION_ID:-default}",
          "agentToken": "${PRISMER_AGENT_TOKEN:-}",
          "capabilities": ["latex", "jupyter", "pdf", "code"]
        }
      }
    }
  },
  "skills": {
    "prismer-workspace": {
      "apiBaseUrl": "${PRISMER_API_BASE_URL:-http://host.docker.internal:3000}",
      "agentId": "${PRISMER_AGENT_ID:-default}"
    }
  },
  "plugins": [
    "/opt/prismer/plugins/prismer-im",
    "/opt/prismer/plugins/prismer-workspace"
  ]
}
EOF
)
            # 合并配置
            jq -s '.[0] * .[1]' "$CONFIG_FILE" <(echo "$PRISMER_CONFIG") > "${CONFIG_FILE}.tmp"
            mv "${CONFIG_FILE}.tmp" "$CONFIG_FILE"
            log_info "Configuration merged into $CONFIG_FILE"
        else
            log_info "Warning: jq not available, using environment variables directly"
        fi
    else
        log_info "Warning: OpenClaw config not found at $CONFIG_FILE"
    fi
fi

log_info "Prismer configuration complete"

# 执行原始入口点或传入的命令
exec "$@"
