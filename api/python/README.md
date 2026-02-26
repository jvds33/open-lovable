# Python FastAPI Service - Claude Code Bridge Layer

This service provides Claude Code CLI subscription support for the Next.js frontend, communicating with Claude Code CLI through `claude-code-sdk`.

## Requirements

- Python 3.10 or higher
- Claude Code CLI (required for subscription mode)

## Install Claude Code CLI

```bash
# Install Claude Code CLI
npm install -g @anthropic-ai/claude-code

# Login to Claude account
claude login

# Verify installation
claude --version
```

## Quick Start

### Method 1: Using Startup Script (Recommended)

Execute in project root directory:

```bash
# Linux/macOS
./scripts/start-with-claude-code.sh

# Windows
scripts\start-with-claude-code.bat
```

### Method 2: Manual Startup

```bash
# 1. Create virtual environment
python3 -m venv venv

# 2. Activate virtual environment
# Linux/macOS:
source venv/bin/activate
# Windows:
venv\Scripts\activate

# 3. Install dependencies
pip install --upgrade pip
pip install -r requirements.txt

# 4. Start service
python main.py
```

The service will start at `http://localhost:8000`.

## API Endpoints

### Health Check
```
GET /
```

### Check Claude Code Status
```
GET /api/claude-code/status
```

Returns the availability and configuration status of Claude Code CLI.

### Generate Code (Streaming)
```
POST /api/claude-code/generate
Content-Type: application/json

{
  "prompt": "Create a React button component",
  "model": "claude-sonnet-4-5-20250929",
  "session_id": "optional-session-id",
  "system_prompt": "You are an expert React developer",
  "is_edit": false
}
```

Returns streaming response in Server-Sent Events (SSE) format.

## Environment Variables

Configure in `.env.local` in project root directory:

```env
# Python API settings
PYTHON_API_PORT=8000

# Claude Code mode
CLAUDE_CODE_ENABLED=true
AI_PROVIDER_MODE=cli
```

## Troubleshooting

### Claude Code CLI Not Found

**Error**: `Claude Code CLI not installed or not working`

**Solution**:
1. Confirm installation: `npm install -g @anthropic-ai/claude-code`
2. Confirm login: `claude login`
3. Check PATH: `which claude` (Linux/macOS) or `where claude` (Windows)

### Virtual Environment Activation Failed

**Error**: `No module named 'venv'`

**Solution**:
```bash
# Ubuntu/Debian
sudo apt-get install python3-venv

# macOS (usually included)
# Windows (usually included)
```

### Dependency Installation Failed

**Error**: `Failed building wheel for ...`

**Solution**:
```bash
# Update pip
pip install --upgrade pip setuptools wheel

# Reinstall dependencies
pip install -r requirements.txt
```

### Port Already in Use

**Error**: `Address already in use`

**Solution**:
```bash
# Find process using the port
# Linux/macOS:
lsof -i :8000
# Windows:
netstat -ano | findstr :8000

# Kill the process or modify PYTHON_API_PORT in .env.local
```

## Development

### Enable Auto-reload

main.py is configured with `reload=True`, the service will automatically restart after code changes.

### View Logs

```bash
# If using startup script, view logs:
tail -f logs/python-api.log

# If started manually, logs display directly in terminal
```

### Test API

```bash
# Check status
curl http://localhost:8000/api/claude-code/status

# Test generation (requires Claude Code CLI logged in)
curl -X POST http://localhost:8000/api/claude-code/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Create a simple React component"}'
```

## Architecture

```
api/python/
├── main.py              # FastAPI main program
├── claude_adapter.py    # Claude Code SDK adapter
├── requirements.txt     # Python dependencies
├── venv/               # Virtual environment (auto-created)
└── README.md           # This file
```

## Related Links

- [Claude Code Documentation](https://docs.anthropic.com/en/docs/claude-code/overview)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [claude-code-sdk](https://pypi.org/project/claude-code-sdk/)
