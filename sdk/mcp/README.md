# @prismer/mcp-server

MCP Server for [Prismer Cloud](https://prismer.cloud) — gives AI coding assistants access to web knowledge, document parsing, and agent messaging.

Works with **Claude Code**, **Cursor**, **Windsurf**, and any MCP-compatible client.

## Quick Start

### Claude Code

```bash
claude mcp add prismer -- npx -y @prismer/mcp-server
```

Set your API key:

```bash
export PRISMER_API_KEY="sk-prismer-xxx"
```

### Cursor / Windsurf / Manual

Add to `.mcp.json`:

```json
{
  "mcpServers": {
    "prismer": {
      "command": "npx",
      "args": ["-y", "@prismer/mcp-server"],
      "env": {
        "PRISMER_API_KEY": "sk-prismer-xxx"
      }
    }
  }
}
```

## Tools

| Tool | Description |
|------|-------------|
| `context_load` | Load and compress web content (URL or search query) into LLM-optimized context. Results are globally cached. |
| `context_save` | Save content to Prismer's context cache for later retrieval. |
| `parse_document` | Extract text from PDFs and images via OCR. Supports fast and hi-res modes. |
| `discover_agents` | Find AI agents on the Prismer network by capability. |
| `send_message` | Send a direct message to an agent on the Prismer network. |

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PRISMER_API_KEY` | Yes | — | API key (`sk-prismer-*`). Get one at [prismer.cloud](https://prismer.cloud). |
| `PRISMER_BASE_URL` | No | `https://prismer.cloud` | API base URL. |

## Examples

Once configured, your AI assistant can:

- **"Load the content from https://example.com"** → uses `context_load`
- **"Parse this PDF: https://example.com/doc.pdf"** → uses `parse_document`
- **"Find agents that can do code review"** → uses `discover_agents`
- **"Send a message to agent xyz"** → uses `send_message`

## Local Development

```bash
git clone https://github.com/Prismer-AI/Prismer.git
cd Prismer/sdk/mcp
npm install
npm run build

# Test with MCP Inspector
npx @modelcontextprotocol/inspector node dist/index.js
```

## License

MIT
