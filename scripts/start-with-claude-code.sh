#!/bin/bash

# Start open-lovable with Claude Code CLI support
# This script will start both Next.js frontend and Python FastAPI service

set -e

echo "🚀 Starting open-lovable with Claude Code CLI support..."
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+"
    exit 1
fi

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python is not installed. Please install Python 3.10+"
    exit 1
fi

# Check Claude Code CLI (optional)
if command -v claude &> /dev/null; then
    echo "✅ Claude Code CLI detected"
    claude --version || echo "⚠️ Unable to get Claude Code version info"
else
    echo "⚠️ Claude Code CLI not installed"
    echo "   To use subscription mode, run:"
    echo "   npm install -g @anthropic-ai/claude-code"
    echo "   claude login"
fi

echo ""
echo "📦 Installing Node.js dependencies..."
npm install

echo ""
echo "🐍 Setting up Python virtual environment..."
cd api/python

# Create virtual environment
if [ ! -d "venv" ]; then
    echo "Creating new virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Install Python dependencies
echo "📦 Installing Python dependencies..."
pip install --upgrade pip -q
pip install -r requirements.txt -q

cd ../..

# Create logs directory
mkdir -p logs

echo ""
echo "✨ Setup complete!"
echo ""
echo "🌐 Starting services:"
echo "   - Python API: http://localhost:8000"
echo "   - Next.js frontend: http://localhost:3000"
echo ""
echo "💡 Tips:"
echo "   - Press Ctrl+C to stop all services"
echo "   - Python API logs: logs/python-api.log"
echo "   - Use 'tail -f logs/python-api.log' to view real-time logs"
echo ""

# Use trap to ensure all child processes are killed when script exits
trap 'echo ""; echo "🛑 Stopping all services..."; kill $(jobs -p) 2>/dev/null; exit 0' EXIT INT TERM

# Start Python API (background, logs to file)
echo "🐍 Starting Python API (background)..."
cd api/python
source venv/bin/activate
python main.py > ../../logs/python-api.log 2>&1 &
PYTHON_PID=$!
cd ../..

# Wait for Python API to start
echo "⏳ Waiting for Python API to start..."
for i in {1..15}; do
    if curl -s http://localhost:8000/ > /dev/null 2>&1; then
        echo "✅ Python API started"
        break
    fi
    if [ $i -eq 15 ]; then
        echo "⚠️ Python API startup timeout"
        echo "   Check logs: tail -f logs/python-api.log"
        exit 1
    fi
    sleep 1
done

echo ""

# Start Next.js (foreground)
echo "🌐 Starting Next.js..."
echo ""
npm run dev

# Background processes will be automatically killed when script exits
