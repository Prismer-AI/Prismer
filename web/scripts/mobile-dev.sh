#!/bin/bash

# =============================================================================
# PISA-OS Mobile Development Script
# =============================================================================
# 一键启动/停止移动端开发环境
# 
# 包含服务:
#   1. Agent Server (WebSocket, port 3456) - 状态同步服务
#   2. Next.js Dev Server (port 3000) - Web 应用服务
#   3. Jupyter Server (port 8888) - Python Notebook 服务
#   4. Tauri iOS Dev - iOS 模拟器应用
#
# 用法:
#   ./scripts/mobile-dev.sh start   # 启动所有服务（Agent + Next.js + Jupyter + iOS）
#   ./scripts/mobile-dev.sh quick   # 快速启动（Agent + Next.js）
#   ./scripts/mobile-dev.sh full    # 同 start
#   ./scripts/mobile-dev.sh stop    # 停止所有服务
#   ./scripts/mobile-dev.sh restart # 重启所有服务
#   ./scripts/mobile-dev.sh status  # 查看服务状态
#   ./scripts/mobile-dev.sh logs    # 查看日志
# =============================================================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 项目根目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# PID 文件目录
PID_DIR="$PROJECT_ROOT/.mobile-dev"
AGENT_PID_FILE="$PID_DIR/agent-server.pid"
NEXTJS_PID_FILE="$PID_DIR/nextjs-dev.pid"
JUPYTER_PID_FILE="$PID_DIR/jupyter-server.pid"
TAURI_PID_FILE="$PID_DIR/tauri-ios.pid"

# 日志目录
LOG_DIR="$PID_DIR/logs"
AGENT_LOG="$LOG_DIR/agent-server.log"
NEXTJS_LOG="$LOG_DIR/nextjs-dev.log"
JUPYTER_LOG="$LOG_DIR/jupyter-server.log"
TAURI_LOG="$LOG_DIR/tauri-ios.log"

# 端口配置
AGENT_PORT=3456
NEXTJS_PORT=3000
JUPYTER_PORT=8889  # 匹配前端 JupyterNotebookPreview 默认端口

# iOS 配置
IOS_BUNDLE_ID="com.prismer.pisa-mobile"
IOS_SIMULATOR="iPhone 17 Pro Max"  # 可通过环境变量覆盖: IOS_SIMULATOR="iPhone 16 Pro"

# Jupyter 配置
# 默认使用空 token 方便本地开发 (匹配前端 JupyterNotebookPreview 默认设置)
JUPYTER_TOKEN="${JUPYTER_TOKEN:-}"
JUPYTER_NOTEBOOK_DIR="${JUPYTER_NOTEBOOK_DIR:-$PROJECT_ROOT/notebooks}"

# 获取本机 IP
get_local_ip() {
    # macOS
    if command -v ipconfig &> /dev/null; then
        ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "localhost"
    else
        # Linux
        hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost"
    fi
}

LOCAL_IP=$(get_local_ip)

# 初始化目录
init_dirs() {
    mkdir -p "$PID_DIR"
    mkdir -p "$LOG_DIR"
}

# 打印带颜色的消息
print_header() {
    echo ""
    echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${PURPLE}  🚀 PISA-OS Mobile Development Environment${NC}"
    echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_step() {
    echo -e "${CYAN}▶ $1${NC}"
}

# 检查端口是否被占用
check_port() {
    local port=$1
    if lsof -i :$port -sTCP:LISTEN &>/dev/null; then
        return 0  # 端口被占用
    else
        return 1  # 端口可用
    fi
}

# 获取占用端口的进程
get_port_pid() {
    local port=$1
    lsof -i :$port -sTCP:LISTEN -t 2>/dev/null | head -1
}

# 检查进程是否运行
is_running() {
    local pid_file=$1
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if ps -p "$pid" &>/dev/null; then
            return 0
        fi
    fi
    return 1
}

# 停止单个服务
stop_service() {
    local name=$1
    local pid_file=$2
    local port=$3
    
    if is_running "$pid_file"; then
        local pid=$(cat "$pid_file")
        print_step "Stopping $name (PID: $pid)..."
        kill "$pid" 2>/dev/null || true
        sleep 1
        # 强制终止子进程
        pkill -P "$pid" 2>/dev/null || true
        rm -f "$pid_file"
        print_success "$name stopped"
    elif [ -n "$port" ] && check_port "$port"; then
        local pid=$(get_port_pid "$port")
        print_step "Stopping $name on port $port (PID: $pid)..."
        kill "$pid" 2>/dev/null || true
        sleep 1
        print_success "$name stopped"
    else
        print_info "$name is not running"
    fi
}

# 启动 Agent Server
start_agent_server() {
    print_step "Starting Agent Server..."
    
    if check_port $AGENT_PORT; then
        print_warning "Port $AGENT_PORT is already in use"
        local pid=$(get_port_pid $AGENT_PORT)
        print_info "Existing process PID: $pid"
        echo "$pid" > "$AGENT_PID_FILE"
        return 0
    fi
    
    cd "$PROJECT_ROOT"
    
    # 启动 Agent Server
    nohup npx tsx scripts/agent-server.ts > "$AGENT_LOG" 2>&1 &
    local pid=$!
    echo "$pid" > "$AGENT_PID_FILE"
    
    # 等待启动
    sleep 2
    
    if check_port $AGENT_PORT; then
        print_success "Agent Server started on port $AGENT_PORT (PID: $pid)"
        print_info "WebSocket URL: ws://$LOCAL_IP:$AGENT_PORT"
    else
        print_error "Agent Server failed to start"
        cat "$AGENT_LOG"
        return 1
    fi
}

# 启动 Next.js Dev Server
start_nextjs_server() {
    print_step "Starting Next.js Dev Server..."
    
    if check_port $NEXTJS_PORT; then
        print_warning "Port $NEXTJS_PORT is already in use"
        local pid=$(get_port_pid $NEXTJS_PORT)
        print_info "Existing process PID: $pid"
        echo "$pid" > "$NEXTJS_PID_FILE"
        return 0
    fi
    
    cd "$PROJECT_ROOT"
    
    # 启动 Next.js (APP_ENV=test 启用移动端配置)
    APP_ENV=test nohup npm run dev > "$NEXTJS_LOG" 2>&1 &
    local pid=$!
    echo "$pid" > "$NEXTJS_PID_FILE"
    
    # 等待启动 (Next.js 启动较慢)
    print_info "Waiting for Next.js to compile..."
    local count=0
    while ! check_port $NEXTJS_PORT && [ $count -lt 30 ]; do
        sleep 1
        count=$((count + 1))
        echo -n "."
    done
    echo ""
    
    if check_port $NEXTJS_PORT; then
        print_success "Next.js Dev Server started on port $NEXTJS_PORT (PID: $pid)"
        print_info "Web URL: http://$LOCAL_IP:$NEXTJS_PORT"
    else
        print_error "Next.js Dev Server failed to start"
        tail -20 "$NEXTJS_LOG"
        return 1
    fi
}

# 启动 Jupyter Server
start_jupyter_server() {
    print_step "Starting Jupyter Server..."
    
    if check_port $JUPYTER_PORT; then
        print_warning "Port $JUPYTER_PORT is already in use"
        local pid=$(get_port_pid $JUPYTER_PORT)
        print_info "Existing process PID: $pid"
        echo "$pid" > "$JUPYTER_PID_FILE"
        return 0
    fi
    
    # 检查 jupyter 是否安装
    if ! command -v jupyter &> /dev/null; then
        print_error "Jupyter is not installed. Install with: pip install jupyter"
        print_info "Or use Docker: docker run -p 8888:8888 jupyter/scipy-notebook"
        return 1
    fi
    
    cd "$PROJECT_ROOT"
    
    # 创建 notebooks 目录
    mkdir -p "$JUPYTER_NOTEBOOK_DIR"
    
    # 启动 Jupyter Server (允许跨域访问，兼容新旧版本)
    # 优先使用 jupyter server (Jupyter 7.x+)，否则回退到 jupyter notebook
    if jupyter server --version &>/dev/null; then
        # Jupyter Server 模式 (推荐)
        nohup jupyter server \
            --ip=0.0.0.0 \
            --port=$JUPYTER_PORT \
            --no-browser \
            --ServerApp.token="$JUPYTER_TOKEN" \
            --ServerApp.allow_origin='*' \
            --ServerApp.disable_check_xsrf=True \
            --ServerApp.root_dir="$JUPYTER_NOTEBOOK_DIR" \
            > "$JUPYTER_LOG" 2>&1 &
    else
        # 回退到 jupyter notebook (旧版)
        nohup jupyter notebook \
            --ip=0.0.0.0 \
            --port=$JUPYTER_PORT \
            --no-browser \
            --NotebookApp.token="$JUPYTER_TOKEN" \
            --NotebookApp.allow_origin='*' \
            --NotebookApp.disable_check_xsrf=True \
            --notebook-dir="$JUPYTER_NOTEBOOK_DIR" \
            > "$JUPYTER_LOG" 2>&1 &
    fi
    local pid=$!
    echo "$pid" > "$JUPYTER_PID_FILE"
    
    # 等待启动
    sleep 3
    
    if check_port $JUPYTER_PORT; then
        print_success "Jupyter Server started on port $JUPYTER_PORT (PID: $pid)"
        if [ -n "$JUPYTER_TOKEN" ]; then
            print_info "Jupyter URL: http://$LOCAL_IP:$JUPYTER_PORT/?token=$JUPYTER_TOKEN"
        else
            print_info "Jupyter URL: http://$LOCAL_IP:$JUPYTER_PORT/ (no auth)"
        fi
    else
        print_error "Jupyter Server failed to start"
        tail -20 "$JUPYTER_LOG"
        return 1
    fi
}

# 获取 iOS 模拟器 UDID
get_ios_simulator_udid() {
    local sim_name="${IOS_SIMULATOR:-iPhone 17 Pro Max}"
    # 使用 jq 来可靠地解析 JSON (如果可用)
    if command -v jq &> /dev/null; then
        xcrun simctl list devices -j 2>/dev/null | jq -r --arg name "$sim_name" \
            '.devices | to_entries[] | .value[] | select(.name == $name and .isAvailable == true) | .udid' | head -1
    else
        # 回退方案：使用 plutil 转换为 xml 再解析
        xcrun simctl list devices -j 2>/dev/null | python3 -c "
import sys, json
data = json.load(sys.stdin)
name = '$sim_name'
for runtime, devices in data.get('devices', {}).items():
    for d in devices:
        if d.get('name') == name and d.get('isAvailable', False):
            print(d.get('udid', ''))
            sys.exit(0)
" 2>/dev/null | head -1
    fi
}

# 卸载 iOS 应用
uninstall_ios_app() {
    local sim_name="${IOS_SIMULATOR:-iPhone 17 Pro Max}"
    print_step "Uninstalling old app from $sim_name..."

    # 获取模拟器状态
    local sim_udid=$(get_ios_simulator_udid)
    if [ -z "$sim_udid" ]; then
        print_warning "Simulator '$sim_name' not found"
        return 1
    fi

    # 确保模拟器已启动
    local sim_state=$(xcrun simctl list devices | grep "$sim_name" | grep -o "Shutdown\|Booted" | head -1)
    if [ "$sim_state" = "Shutdown" ]; then
        print_step "Booting simulator..."
        xcrun simctl boot "$sim_udid" 2>/dev/null || true
        sleep 2
    fi

    # 卸载应用
    xcrun simctl uninstall "$sim_udid" "$IOS_BUNDLE_ID" 2>/dev/null && {
        print_success "Old app uninstalled"
    } || {
        print_info "No existing app to uninstall"
    }
}

# 终止 iOS 应用进程
terminate_ios_app() {
    local sim_name="${IOS_SIMULATOR:-iPhone 17 Pro Max}"
    local sim_udid=$(get_ios_simulator_udid)

    if [ -n "$sim_udid" ]; then
        xcrun simctl terminate "$sim_udid" "$IOS_BUNDLE_ID" 2>/dev/null || true
    fi
}

# 启动 Tauri iOS
start_tauri_ios() {
    local force_reinstall="${1:-false}"
    local sim_name="${IOS_SIMULATOR:-iPhone 17 Pro Max}"

    print_step "Starting Tauri iOS Dev..."
    print_info "Target simulator: $sim_name"

    cd "$PROJECT_ROOT"

    # 检查是否已有 Tauri 进程
    if pgrep -f "cargo-tauri.*ios" &>/dev/null; then
        if [ "$force_reinstall" = "true" ]; then
            print_step "Stopping existing Tauri iOS process..."
            pkill -f "cargo-tauri.*ios" 2>/dev/null || true
            sleep 2
        else
            print_warning "Tauri iOS is already running. Use 'reload ios' to restart."
            return 0
        fi
    fi

    # 强制重装时先卸载旧应用
    if [ "$force_reinstall" = "true" ]; then
        terminate_ios_app
        uninstall_ios_app
    fi

    # 确保模拟器已启动
    local sim_udid=$(get_ios_simulator_udid)
    if [ -z "$sim_udid" ]; then
        print_error "Simulator '$sim_name' not found!"
        print_info "Available simulators:"
        xcrun simctl list devices available | grep iPhone | head -10
        return 1
    fi

    local sim_state=$(xcrun simctl list devices | grep "$sim_name" | grep -o "Shutdown\|Booted" | head -1)
    if [ "$sim_state" = "Shutdown" ]; then
        print_step "Booting $sim_name simulator..."
        xcrun simctl boot "$sim_udid" 2>/dev/null || true
        open -a Simulator
        sleep 3
        print_success "Simulator booted"
    fi

    # 启动 Tauri iOS
    print_info "Building and deploying to iOS Simulator..."
    print_info "This will open in a new terminal window..."

    # 使用 osascript 在新终端窗口中启动
    osascript -e "
        tell application \"Terminal\"
            do script \"/bin/bash -l -c 'cd \\\"$PROJECT_ROOT\\\" && cargo tauri ios dev \\\"$sim_name\\\"'\"
            activate
        end tell
    " 2>/dev/null || {
        # 如果 osascript 失败，在后台启动
        print_info "Fallback: running in background..."
        nohup cargo tauri ios dev "$sim_name" > "$TAURI_LOG" 2>&1 &
        echo $! > "$TAURI_PID_FILE"
    }

    print_success "Tauri iOS Dev launched"
    print_info "iOS app should deploy shortly..."
}

# 启动 Tauri macOS 桌面端
start_tauri_desktop() {
    print_step "Starting Tauri macOS Dev..."
    
    cd "$PROJECT_ROOT"
    
    # 检查是否已有 Tauri desktop 进程
    if pgrep -f "tauri dev$" &>/dev/null; then
        print_warning "Tauri Desktop is already running"
        return 0
    fi
    
    print_info "Launching macOS Desktop App..."
    print_info "This will open in a new terminal window..."
    
    # 使用 osascript 在新终端窗口中启动
    # 注意：用 /bin/bash -l -c 避免 oh-my-zsh 更新提示吞掉命令首字符
    osascript -e "
        tell application \"Terminal\"
            do script \"/bin/bash -l -c 'cd \\\"$PROJECT_ROOT\\\" && npm run tauri:dev'\"
            activate
        end tell
    " 2>/dev/null || {
        # 如果 osascript 失败，在后台启动
        nohup npm run tauri:dev > "$LOG_DIR/tauri-desktop.log" 2>&1 &
    }

    print_success "Tauri Desktop Dev launched"
    print_info "macOS app should open shortly..."
}

# 显示服务状态
show_status() {
    print_header
    echo -e "${CYAN}Service Status:${NC}"
    echo ""
    
    # Agent Server
    if check_port $AGENT_PORT; then
        local pid=$(get_port_pid $AGENT_PORT)
        echo -e "  ${GREEN}●${NC} Agent Server     ${GREEN}RUNNING${NC} (port $AGENT_PORT, PID: $pid)"
        # 尝试获取健康状态
        local health=$(curl -s "http://localhost:$AGENT_PORT/health" 2>/dev/null || echo "")
        if [ -n "$health" ]; then
            local clients=$(echo "$health" | grep -o '"clients":[0-9]*' | cut -d: -f2)
            echo -e "                       └─ Clients connected: ${CYAN}$clients${NC}"
        fi
    else
        echo -e "  ${RED}●${NC} Agent Server     ${RED}STOPPED${NC}"
    fi
    
    # Next.js
    if check_port $NEXTJS_PORT; then
        local pid=$(get_port_pid $NEXTJS_PORT)
        echo -e "  ${GREEN}●${NC} Next.js Server   ${GREEN}RUNNING${NC} (port $NEXTJS_PORT, PID: $pid)"
    else
        echo -e "  ${RED}●${NC} Next.js Server   ${RED}STOPPED${NC}"
    fi
    
    # Jupyter
    if check_port $JUPYTER_PORT; then
        local pid=$(get_port_pid $JUPYTER_PORT)
        echo -e "  ${GREEN}●${NC} Jupyter Server   ${GREEN}RUNNING${NC} (port $JUPYTER_PORT, PID: $pid)"
    else
        echo -e "  ${RED}●${NC} Jupyter Server   ${RED}STOPPED${NC}"
    fi
    
    # Tauri Desktop (macOS)
    if pgrep -f "cargo-tauri.*dev$" &>/dev/null || pgrep -f "tauri dev$" &>/dev/null; then
        local pid=$(pgrep -f "tauri dev" | head -1)
        echo -e "  ${GREEN}●${NC} Tauri Desktop    ${GREEN}RUNNING${NC} (PID: $pid)"
    else
        echo -e "  ${RED}●${NC} Tauri Desktop    ${RED}STOPPED${NC}"
    fi
    
    # Tauri iOS
    if pgrep -f "tauri.*ios" &>/dev/null; then
        local pid=$(pgrep -f "tauri.*ios" | head -1)
        echo -e "  ${GREEN}●${NC} Tauri iOS Dev    ${GREEN}RUNNING${NC} (PID: $pid)"
    else
        echo -e "  ${RED}●${NC} Tauri iOS Dev    ${RED}STOPPED${NC}"
    fi
    
    echo ""
    echo -e "${CYAN}Network Info:${NC}"
    echo -e "  Local IP: ${YELLOW}$LOCAL_IP${NC}"
    echo -e "  Agent WS: ${YELLOW}ws://$LOCAL_IP:$AGENT_PORT${NC}"
    echo -e "  Web App:  ${YELLOW}http://$LOCAL_IP:$NEXTJS_PORT${NC}"
    if [ -n "$JUPYTER_TOKEN" ]; then
        echo -e "  Jupyter:  ${YELLOW}http://$LOCAL_IP:$JUPYTER_PORT/?token=$JUPYTER_TOKEN${NC}"
    else
        echo -e "  Jupyter:  ${YELLOW}http://$LOCAL_IP:$JUPYTER_PORT/ (no auth)${NC}"
    fi
    echo ""
}

# 启动所有服务
start_all() {
    print_header
    init_dirs
    
    echo -e "${CYAN}Starting all services...${NC}"
    echo ""
    
    start_agent_server
    echo ""
    start_nextjs_server
    echo ""
    start_jupyter_server
    echo ""
    
    # 询问是否启动客户端
    echo ""
    echo -e "${CYAN}Launch clients:${NC}"
    
    read -p "$(echo -e ${YELLOW}  Launch macOS Desktop App? [y/N]: ${NC})" -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        start_tauri_desktop
    else
        print_info "Skipped macOS Desktop. Run 'npm run tauri:dev' manually when ready."
    fi
    
    read -p "$(echo -e ${YELLOW}  Launch iOS Simulator? [y/N]: ${NC})" -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        start_tauri_ios
    else
        print_info "Skipped iOS Simulator. Run 'npm run tauri:ios:sim' manually when ready."
    fi
    
    echo ""
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}  ✅ Development environment is ready!${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "  ${CYAN}Agent Server:${NC}  ws://localhost:$AGENT_PORT"
    echo -e "  ${CYAN}Web App:${NC}       http://localhost:$NEXTJS_PORT"
    echo -e "  ${CYAN}Workspace:${NC}     http://localhost:$NEXTJS_PORT/workspace"
    echo -e "  ${CYAN}Mobile:${NC}        http://localhost:$NEXTJS_PORT/mobile"
    echo -e "  ${CYAN}Monitor:${NC}       http://localhost:$NEXTJS_PORT/admin/monitor"
    echo ""
    echo -e "  ${YELLOW}Tip:${NC} Use './scripts/mobile-dev.sh status' to check services"
    echo -e "  ${YELLOW}Tip:${NC} Use './scripts/mobile-dev.sh logs' to view logs"
    echo ""
}

# 停止所有服务
stop_all() {
    print_header
    echo -e "${CYAN}Stopping all services...${NC}"
    echo ""
    
    # 停止 Tauri iOS
    if pgrep -f "cargo-tauri" &>/dev/null; then
        print_step "Stopping Tauri iOS Dev..."
        pkill -f "cargo-tauri" 2>/dev/null || true
        print_success "Tauri iOS Dev stopped"
    fi
    
    # 停止 Jupyter
    stop_service "Jupyter Server" "$JUPYTER_PID_FILE" "$JUPYTER_PORT"
    
    # 停止 Next.js
    stop_service "Next.js Server" "$NEXTJS_PID_FILE" "$NEXTJS_PORT"
    
    # 停止 Agent Server
    stop_service "Agent Server" "$AGENT_PID_FILE" "$AGENT_PORT"
    
    # 清理可能残留的进程
    pkill -f "tsx scripts/agent-server.ts" 2>/dev/null || true
    pkill -f "jupyter-notebook" 2>/dev/null || true
    pkill -f "jupyter-server" 2>/dev/null || true
    pkill -f "jupyter server" 2>/dev/null || true
    
    echo ""
    print_success "All services stopped"
    echo ""
}

# 查看日志
show_logs() {
    print_header
    
    echo -e "${CYAN}Select log to view:${NC}"
    echo "  1) Agent Server"
    echo "  2) Next.js Server"
    echo "  3) Jupyter Server"
    echo "  4) Tauri iOS"
    echo "  5) All (tail -f)"
    echo ""
    read -p "$(echo -e ${YELLOW}Enter choice [1-5]: ${NC})" choice
    
    case $choice in
        1)
            if [ -f "$AGENT_LOG" ]; then
                tail -100 "$AGENT_LOG"
            else
                print_warning "No Agent Server log found"
            fi
            ;;
        2)
            if [ -f "$NEXTJS_LOG" ]; then
                tail -100 "$NEXTJS_LOG"
            else
                print_warning "No Next.js log found"
            fi
            ;;
        3)
            if [ -f "$JUPYTER_LOG" ]; then
                tail -100 "$JUPYTER_LOG"
            else
                print_warning "No Jupyter log found"
            fi
            ;;
        4)
            if [ -f "$TAURI_LOG" ]; then
                tail -100 "$TAURI_LOG"
            else
                print_warning "No Tauri iOS log found"
            fi
            ;;
        5)
            print_info "Press Ctrl+C to stop watching logs"
            tail -f "$AGENT_LOG" "$NEXTJS_LOG" "$JUPYTER_LOG" "$TAURI_LOG" 2>/dev/null
            ;;
        *)
            print_error "Invalid choice"
            ;;
    esac
}

# 快速启动 (无交互，无 Jupyter)
start_quick() {
    print_header
    init_dirs
    
    echo -e "${CYAN}Quick start (Agent + Next.js only)...${NC}"
    echo ""
    
    start_agent_server
    echo ""
    start_nextjs_server
    echo ""
    
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}  ✅ Services ready! (Agent + Next.js)${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "  Agent: ws://$LOCAL_IP:$AGENT_PORT"
    echo -e "  Web:   http://$LOCAL_IP:$NEXTJS_PORT/mobile"
    echo ""
}

# 完整启动 (包含 Jupyter)
start_full() {
    print_header
    init_dirs
    
    echo -e "${CYAN}Full start (Agent + Next.js + Jupyter)...${NC}"
    echo ""
    
    start_agent_server
    echo ""
    start_nextjs_server
    echo ""
    start_jupyter_server
    echo ""
    
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}  ✅ All services ready!${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "  Agent:   ws://$LOCAL_IP:$AGENT_PORT"
    echo -e "  Web:     http://$LOCAL_IP:$NEXTJS_PORT/mobile"
    if [ -n "$JUPYTER_TOKEN" ]; then
        echo -e "  Jupyter: http://$LOCAL_IP:$JUPYTER_PORT/?token=$JUPYTER_TOKEN"
    else
        echo -e "  Jupyter: http://$LOCAL_IP:$JUPYTER_PORT/ (no auth)"
    fi
    echo ""
    echo -e "  ${YELLOW}Tip:${NC} Run './scripts/mobile-dev.sh start' to also launch iOS Simulator"
    echo ""
}

# 重新加载客户端（仅重启 iOS / Desktop，不动 Agent 和 Next.js）
reload_clients() {
    print_header
    echo -e "${CYAN}Reloading clients (iOS + Desktop)...${NC}"
    echo ""

    # 停止现有 Tauri 进程
    if pgrep -f "cargo-tauri" &>/dev/null; then
        print_step "Stopping existing Tauri processes..."
        pkill -f "cargo-tauri" 2>/dev/null || true
        sleep 2
        print_success "Tauri processes stopped"
    else
        print_info "No running Tauri processes found"
    fi

    echo ""

    # 重启客户端 (强制重装)
    local launched=false
    local target="${2:-ios}"

    if [ "$target" = "ios" ] || [ "$target" = "all" ]; then
        start_tauri_ios "true"  # force_reinstall=true
        launched=true
    fi

    if [ "$target" = "desktop" ] || [ "$target" = "all" ]; then
        echo ""
        start_tauri_desktop
        launched=true
    fi

    if [ "$launched" = true ]; then
        echo ""
        print_success "Client reload complete"
    else
        print_info "Usage: $0 reload [ios|desktop|all]"
        print_info "  ios     - Rebuild & reinstall iOS app (default)"
        print_info "  desktop - Restart macOS Desktop"
        print_info "  all     - Restart both"
    fi
    echo ""
}

# 清理 iOS 模拟器（卸载应用 + 清理缓存）
clean_ios() {
    print_header
    echo -e "${CYAN}Cleaning iOS Simulator...${NC}"
    echo ""

    # 停止 Tauri 进程
    if pgrep -f "cargo-tauri.*ios" &>/dev/null; then
        print_step "Stopping Tauri iOS process..."
        pkill -f "cargo-tauri.*ios" 2>/dev/null || true
        sleep 1
    fi

    # 终止应用
    terminate_ios_app
    sleep 1

    # 卸载应用
    uninstall_ios_app

    # 清理 Tauri 构建缓存
    print_step "Cleaning Tauri build cache..."
    rm -rf "$PROJECT_ROOT/src-tauri/gen/apple/build" 2>/dev/null || true
    rm -rf "$PROJECT_ROOT/src-tauri/target" 2>/dev/null || true
    print_success "Build cache cleaned"

    # 清理 Xcode DerivedData
    print_step "Cleaning Xcode DerivedData..."
    rm -rf ~/Library/Developer/Xcode/DerivedData/pisa-mobile-* 2>/dev/null || true
    print_success "DerivedData cleaned"

    echo ""
    print_success "iOS cleanup complete!"
    print_info "Next step: Run '$0 reload ios' to rebuild and deploy"
    echo ""
}

# 帮助信息
show_help() {
    print_header
    echo "Usage: $0 <command>"
    echo ""
    echo "Commands:"
    echo "  start       Start services + optionally launch Desktop/iOS clients"
    echo "  quick       Quick start (Agent + Next.js only)"
    echo "  full        Full start (same as start)"
    echo "  desktop     Start services + macOS Desktop"
    echo "  ios         Start services + iOS Simulator"
    echo "  reload      Rebuild & reinstall clients (ios|desktop|all)"
    echo "  clean       Clean iOS simulator (uninstall app + clear cache)"
    echo "  stop        Stop all services"
    echo "  restart     Restart all services"
    echo "  status      Show service status"
    echo "  logs        View service logs"
    echo "  help        Show this help"
    echo ""
    echo "Examples:"
    echo "  $0 start          # Start with prompts"
    echo "  $0 quick          # Start Agent + Next.js only"
    echo "  $0 reload ios     # Force rebuild & reinstall iOS app"
    echo "  $0 clean          # Clean iOS (use when app crashes)"
    echo "  $0 status         # Check what's running"
    echo ""
    echo "Environment variables:"
    echo "  IOS_SIMULATOR     iOS simulator name (default: iPhone 17 Pro Max)"
    echo "  JUPYTER_TOKEN     Jupyter auth token (default: empty)"
    echo ""
}

# 主入口
case "${1:-}" in
    start)
        start_all
        ;;
    quick)
        start_quick
        ;;
    full)
        start_full
        ;;
    desktop)
        print_header
        init_dirs
        echo -e "${CYAN}Starting services + macOS Desktop...${NC}"
        echo ""
        start_agent_server
        echo ""
        start_nextjs_server
        echo ""
        start_jupyter_server
        echo ""
        start_tauri_desktop
        ;;
    ios)
        print_header
        init_dirs
        echo -e "${CYAN}Starting services + iOS Simulator...${NC}"
        echo ""
        start_agent_server
        echo ""
        start_nextjs_server
        echo ""
        start_jupyter_server
        echo ""
        start_tauri_ios "true"  # force_reinstall=true
        ;;
    stop)
        stop_all
        ;;
    reload)
        reload_clients "$@"
        ;;
    clean)
        clean_ios
        ;;
    restart)
        stop_all
        sleep 2
        start_all
        ;;
    status)
        show_status
        ;;
    logs)
        show_logs
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        if [ -z "${1:-}" ]; then
            show_help
        else
            print_error "Unknown command: $1"
            echo ""
            show_help
        fi
        ;;
esac
