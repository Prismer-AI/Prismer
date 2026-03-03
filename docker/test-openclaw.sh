#!/bin/bash
# ============================================================
# OpenClaw Integration Test Script
# ============================================================
#
# 用法:
#   ./test-openclaw.sh [command]
#
# Commands:
#   mock      - 启动 Mock IM Server
#   build     - 构建 Docker 镜像
#   up        - 启动 OpenClaw Agent
#   down      - 停止所有服务
#   logs      - 查看日志
#   test      - 运行集成测试
#   all       - 运行完整测试流程
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"
ROOT_ENV_FILE="../.env"
ROOT_ENV_EXAMPLE="../.env.example"
COMPOSE_FILE="docker-compose.openclaw.yml"

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "${BLUE}[STEP]${NC} $1"; }

compose() {
    docker compose --env-file "$ROOT_ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

# ============================================================
# Commands
# ============================================================

cmd_mock() {
    log_step "Starting Mock IM Server..."
    npx tsx mock-im-server.ts
}

cmd_build() {
    log_step "Building OpenClaw Docker image via compose..."
    compose build
    log_info "Build complete"
}

cmd_up() {
    log_step "Starting OpenClaw Agent..."

    # 检查 .env 文件
    if [ ! -f "$ROOT_ENV_FILE" ]; then
        log_warn ".env file not found at repo root. Creating from .env.example..."
        cp "$ROOT_ENV_EXAMPLE" "$ROOT_ENV_FILE"
        log_warn "Please edit .env with your actual values"
    fi

    compose up -d
    log_info "OpenClaw Agent started"
    log_info "Gateway: http://localhost:16888"
    log_info "Health:  http://localhost:16888/api/v1/health"
}

cmd_down() {
    log_step "Stopping services..."
    compose down
    log_info "Services stopped"
}

cmd_logs() {
    compose logs -f
}

cmd_test() {
    log_step "Running integration tests..."

    # 检查 Gateway 健康
    log_info "Checking Gateway health..."
    curl -sS http://localhost:16888/api/v1/health | jq . || {
        log_error "Gateway not responding"
        exit 1
    }

    log_info "Checking OpenClaw Gateway sub-service..."
    curl -sS http://localhost:16888/api/v1/health/gateway | jq . || {
        log_error "OpenClaw gateway service not healthy"
        exit 1
    }

    # 测试 Jupyter 连接
    log_info "Checking Jupyter..."
    if [ "$(curl -sS -o /dev/null -w '%{http_code}' http://localhost:16888/api/v1/jupyter/api/status || true)" != "200" ]; then
        log_error "Jupyter status check failed"
        exit 1
    fi

    # 测试 LaTeX 编译
    log_info "Checking LaTeX compile..."
    curl -sS -X POST http://localhost:16888/api/v1/latex/compile \
        -H "Content-Type: application/json" \
        -d '{"content":"\\documentclass{article}\\begin{document}hello\\end{document}"}' \
        | jq .success | grep -q true || {
        log_error "LaTeX compile failed"
        exit 1
    }

    # 测试 Prover
    log_info "Checking Prover..."
    curl -sS -X POST http://localhost:16888/api/v1/prover/z3/solve \
        -H "Content-Type: application/json" \
        -d '{"formula":"(declare-const x Int) (assert (> x 5)) (check-sat)"}' \
        | jq .success | grep -q true || {
        log_error "Prover check failed"
        exit 1
    }

    # 测试 arXiv 健康
    log_info "Checking arXiv service..."
    curl -sS http://localhost:16888/api/v1/arxiv/health | jq . || {
        log_error "arXiv health check failed"
        exit 1
    }

    log_info "Basic tests passed!"
}

cmd_all() {
    log_step "Running full test flow..."

    # 1. 构建镜像
    cmd_build

    # 2. 启动 Agent
    cmd_up
    sleep 5

    # 3. 运行测试
    cmd_test

    # 4. 清理
    log_info "Cleaning up..."
    cmd_down

    log_info "✅ All tests passed!"
}

cmd_help() {
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  mock      Start Mock IM Server for testing"
    echo "  build     Build Docker image"
    echo "  up        Start OpenClaw Agent container"
    echo "  down      Stop all services"
    echo "  logs      View container logs"
    echo "  test      Run integration tests"
    echo "  all       Run complete test flow"
    echo "  help      Show this help"
}

# ============================================================
# Main
# ============================================================

case "${1:-help}" in
    mock)   cmd_mock ;;
    build)  cmd_build ;;
    up)     cmd_up ;;
    down)   cmd_down ;;
    logs)   cmd_logs ;;
    test)   cmd_test ;;
    all)    cmd_all ;;
    help)   cmd_help ;;
    *)
        log_error "Unknown command: $1"
        cmd_help
        exit 1
        ;;
esac
