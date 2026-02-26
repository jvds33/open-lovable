@echo off
REM Start open-lovable with Claude Code CLI support (Windows)
REM This script will set up both Next.js frontend and Python FastAPI service

echo ============================================
echo 🚀 Starting open-lovable with Claude Code CLI
echo ============================================
echo.

REM Check Node.js
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ❌ Node.js is not installed. Please install Node.js 18+
    exit /b 1
)

REM Check Python
where python >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ❌ Python is not installed. Please install Python 3.10+
    exit /b 1
)

REM Check Claude Code CLI
where claude >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo ✅ Claude Code CLI detected
    claude --version
) else (
    echo ⚠️ Claude Code CLI not installed
    echo    To use subscription mode, run:
    echo    npm install -g @anthropic-ai/claude-code
    echo    claude login
)

echo.
echo 📦 Installing Node.js dependencies...
call npm install

echo.
echo 🐍 Setting up Python virtual environment...
cd api\python

REM Create virtual environment
if not exist "venv" (
    python -m venv venv
)

REM Activate virtual environment
call venv\Scripts\activate.bat

REM Install Python dependencies
echo 📦 Installing Python dependencies...
pip install -r requirements.txt

cd ..\..

echo.
echo ✨ Setup complete!
echo.
echo 🌐 To start services:
echo    - Next.js frontend: http://localhost:3000
echo    - Python API: http://localhost:8000
echo.
echo Please run the following commands in separate terminal windows:
echo.
echo   1. Start Python API:
echo      cd api\python
echo      venv\Scripts\activate
echo      python main.py
echo.
echo   2. Start Next.js (in project root):
echo      npm run dev
echo.
pause
