#!/bin/bash
# Start the Claude bridge without inheriting CLAUDECODE env var
# (prevents nested session error when launched from Claude Code terminal)
unset CLAUDECODE
cd "$(dirname "$0")"
exec python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
