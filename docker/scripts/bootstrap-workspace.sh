#!/bin/bash
# ==============================================================================
# OpenClaw Workspace Bootstrap Script
# ==============================================================================
#
# This script initializes the OpenClaw workspace directory with template files.
# It is designed to run at container startup.
#
# Environment Variables:
#   AGENT_TEMPLATE    - Template to use (academic-researcher, data-scientist, paper-reviewer)
#   WORKSPACE_ID      - Workspace ID for cloud sync
#   CLOUD_SYNC_URL    - Cloud API URL for syncing persisted files
#   USER_CONTEXT      - User profile information (JSON or markdown)
#   SKIP_CLOUD_SYNC   - Set to "true" to skip cloud sync
#
# ==============================================================================

set -e

# Configuration
WORKSPACE_DIR="${OPENCLAW_WORKSPACE:-${HOME}/.openclaw/workspace}"
TEMPLATE_TYPE="${AGENT_TEMPLATE:-mathematician}"
TEMPLATES_BASE="/opt/prismer/templates"
BASE_TEMPLATE="${TEMPLATES_BASE}/base"
ROLE_TEMPLATE="${TEMPLATES_BASE}/${TEMPLATE_TYPE}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# ==============================================================================
# Main Bootstrap Logic
# ==============================================================================

log_info "Starting workspace bootstrap..."
log_info "Template: ${TEMPLATE_TYPE}"
log_info "Workspace: ${WORKSPACE_DIR}"

# Create workspace directory structure
mkdir -p "${WORKSPACE_DIR}/skills"
mkdir -p "${WORKSPACE_DIR}/memory"

# ==============================================================================
# Copy Base Templates
# ==============================================================================

if [ -d "${BASE_TEMPLATE}" ]; then
    log_info "Copying base templates..."

    for file in SOUL.md TOOLS.md HEARTBEAT.md; do
        if [ -f "${BASE_TEMPLATE}/${file}" ]; then
            cp "${BASE_TEMPLATE}/${file}" "${WORKSPACE_DIR}/"
            log_info "  Copied ${file}"
        fi
    done
else
    log_warn "Base template directory not found: ${BASE_TEMPLATE}"
fi

# ==============================================================================
# Copy Role-Specific Templates
# ==============================================================================

if [ -d "${ROLE_TEMPLATE}" ]; then
    log_info "Copying role-specific templates (${TEMPLATE_TYPE})..."

    # Copy IDENTITY.md and MEMORY.md
    for file in IDENTITY.md MEMORY.md; do
        if [ -f "${ROLE_TEMPLATE}/${file}" ]; then
            cp "${ROLE_TEMPLATE}/${file}" "${WORKSPACE_DIR}/"
            log_info "  Copied ${file}"
        fi
    done

    # Copy skills
    if [ -d "${ROLE_TEMPLATE}/skills" ]; then
        log_info "Copying skills..."
        cp -r "${ROLE_TEMPLATE}/skills/"* "${WORKSPACE_DIR}/skills/" 2>/dev/null || true
        skill_count=$(find "${WORKSPACE_DIR}/skills" -name "SKILL.md" 2>/dev/null | wc -l | tr -d ' ')
        log_info "  Copied ${skill_count} skills"
    fi
else
    log_warn "Role template directory not found: ${ROLE_TEMPLATE}"
fi

# ==============================================================================
# Inject User Context
# ==============================================================================

if [ -n "${USER_CONTEXT}" ]; then
    log_info "Injecting user context..."
    echo "${USER_CONTEXT}" > "${WORKSPACE_DIR}/USER.md"
    log_info "  Created USER.md"
fi

# ==============================================================================
# Cloud Sync (if enabled)
# ==============================================================================

if [ "${SKIP_CLOUD_SYNC}" != "true" ] && [ -n "${CLOUD_SYNC_URL}" ] && [ -n "${WORKSPACE_ID}" ]; then
    log_info "Syncing with cloud storage..."

    # Fetch file list from cloud
    SYNC_RESPONSE=$(curl -s "${CLOUD_SYNC_URL}/api/workspace/${WORKSPACE_ID}/files" 2>/dev/null || echo '{"success":false}')

    if echo "${SYNC_RESPONSE}" | grep -q '"success":true'; then
        # Extract file paths and download each
        FILE_PATHS=$(echo "${SYNC_RESPONSE}" | jq -r '.data.files[].path' 2>/dev/null || true)

        for path in ${FILE_PATHS}; do
            if [ -n "${path}" ]; then
                # Create directory if needed
                dir=$(dirname "${WORKSPACE_DIR}/${path}")
                mkdir -p "${dir}"

                # Download file content
                FILE_RESPONSE=$(curl -s "${CLOUD_SYNC_URL}/api/workspace/${WORKSPACE_ID}/files/${path}" 2>/dev/null || echo '{"success":false}')

                if echo "${FILE_RESPONSE}" | grep -q '"success":true'; then
                    echo "${FILE_RESPONSE}" | jq -r '.data.content' > "${WORKSPACE_DIR}/${path}"
                    log_info "  Synced ${path}"
                fi
            fi
        done

        log_info "Cloud sync complete"
    else
        log_warn "Cloud sync failed or returned empty response"
    fi
else
    log_info "Cloud sync skipped"
fi

# ==============================================================================
# Initialize Memory Log
# ==============================================================================

TODAY=$(date +%Y-%m-%d)
MEMORY_FILE="${WORKSPACE_DIR}/memory/${TODAY}.md"

if [ ! -f "${MEMORY_FILE}" ]; then
    log_info "Creating today's memory log..."
    cat > "${MEMORY_FILE}" << EOF
# Memory Log - ${TODAY}

## Session Start
- Time: $(date +%H:%M:%S)
- Template: ${TEMPLATE_TYPE}

## Activities

(No activities recorded yet)

## Insights

(No insights recorded yet)
EOF
    log_info "  Created ${TODAY}.md"
fi

# ==============================================================================
# Summary
# ==============================================================================

log_info "Bootstrap complete!"
log_info "Workspace contents:"
ls -la "${WORKSPACE_DIR}" | tail -n +2 | while read line; do
    log_info "  ${line}"
done

# Count files
total_files=$(find "${WORKSPACE_DIR}" -type f | wc -l | tr -d ' ')
log_info "Total files: ${total_files}"
