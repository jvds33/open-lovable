"""
Python FastAPI Service - Claude Code SDK Bridge Layer
Provides Claude Code CLI subscription support for Next.js frontend
"""
import os
import logging
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv

from claude_adapter import adapter

# Load environment variables
load_dotenv()

# Configure logger
logger = logging.getLogger(__name__)


# Define request models
class GenerateRequest(BaseModel):
    prompt: str
    model: str = "claude-sonnet-4-5-20250929"
    session_id: Optional[str] = None
    system_prompt: Optional[str] = None
    is_edit: bool = False


class StatusResponse(BaseModel):
    available: bool
    configured: bool
    mode: Optional[str] = None
    models: Optional[list] = None
    error: Optional[str] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle management"""
    logger.info("Starting Claude Code bridge service...")

    # Check Claude Code availability
    status = await adapter.check_availability()
    if status["available"]:
        logger.info("✅ Claude Code CLI is available")
    else:
        logger.warning(f"⚠️ Claude Code CLI is unavailable: {status.get('error', 'Unknown')}")

    yield

    logger.info("Shutting down service...")


# Create FastAPI application
app = FastAPI(
    title="Claude Code Bridge API",
    description="Bridge between Next.js frontend and Claude Code SDK",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS configuration - Allow Next.js frontend calls
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],  # Next.js dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "service": "Claude Code Bridge API",
        "status": "running",
        "version": "1.0.0",
    }


@app.get("/api/claude-code/status", response_model=StatusResponse)
async def check_status():
    """
    Check Claude Code CLI status

    Returns:
        Status information, including availability and error messages
    """
    status = await adapter.check_availability()
    return StatusResponse(**status)


@app.post("/api/claude-code/generate")
async def generate_code_stream(request: GenerateRequest):
    """
    Generate code using Claude Code CLI (streaming mode)

    Args:
        request: Generation request containing prompt, model, and other parameters

    Returns:
        StreamingResponse: Server-Sent Events (SSE) format streaming response
    """
    logger.info(f"Received generation request:")
    logger.info(f"  - prompt: {request.prompt[:50]}...")
    logger.info(f"  - model: {request.model}")
    logger.info(f"  - session_id: {request.session_id}")
    logger.info(f"  - system_prompt: {request.system_prompt[:100] if request.system_prompt else 'None'}...")

    # Check if Claude Code is available
    status = await adapter.check_availability()
    if not status["available"]:
        raise HTTPException(
            status_code=503,
            detail=status.get("error", "Claude Code CLI is unavailable")
        )

    logger.info("Preparing to create StreamingResponse...")

    async def event_stream():
        """Generate SSE event stream"""
        try:
            logger.info("Starting streaming generation...")

            # Calculate project root directory (two levels up from api/python)
            project_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
            logger.info(f"Project path: {project_path}")

            message_count = 0
            async for message in adapter.execute_streaming(
                prompt=request.prompt,
                model=request.model,
                session_id=request.session_id,
                system_prompt=request.system_prompt,
                project_path=project_path,
            ):
                message_count += 1
                logger.info(f"Received message #{message_count}: {message.get('type', 'unknown')}")
                # Convert message to SSE format
                import json
                yield f"data: {json.dumps(message, ensure_ascii=False)}\n\n"

            logger.info(f"Streaming completed, total {message_count} messages")
        except Exception as e:
            # Error handling
            import json
            import traceback
            logger.error(f"Error: {str(e)}")
            traceback.print_exc()
            error_msg = {"type": "error", "error": str(e)}
            yield f"data: {json.dumps(error_msg, ensure_ascii=False)}\n\n"

    logger.info("Returning StreamingResponse...")
    import sys
    sys.stdout.flush()  # Force flush output

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


if __name__ == "__main__":
    import uvicorn
    import logging

    # Configure logging format with timestamp
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s [%(levelname)s] %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )

    port = int(os.getenv("PYTHON_API_PORT", "8000"))

    # Configure uvicorn logging format
    log_config = {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "default": {
                "format": "%(asctime)s [%(name)s] %(levelprefix)s %(message)s",
                "datefmt": "%Y-%m-%d %H:%M:%S",
            },
        },
        "handlers": {
            "default": {
                "formatter": "default",
                "class": "logging.StreamHandler",
                "stream": "ext://sys.stdout",
            },
        },
        "loggers": {
            "uvicorn": {"handlers": ["default"], "level": "INFO"},
            "uvicorn.error": {"level": "INFO"},
            "uvicorn.access": {"handlers": ["default"], "level": "INFO"},
        },
    }

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=True,
        log_level="info",
        log_config=log_config,
    )
