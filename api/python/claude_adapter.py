"""
Claude Code CLI Adapter
Reference implementation from Claudable project, provides bridge layer for Claude Code SDK
"""
import asyncio
import logging
import os
import uuid
from datetime import datetime
from typing import Any, AsyncGenerator, Dict, List, Optional

from claude_code_sdk import ClaudeSDKClient, ClaudeCodeOptions

# Configure logger
logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(name)s] %(levelname)s: %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)


class ClaudeCodeAdapter:
    """Claude Code Python SDK Adapter"""

    def __init__(self):
        self.session_mapping: Dict[str, str] = {}

    async def check_availability(self) -> Dict[str, Any]:
        """Check if Claude Code CLI is available"""
        try:
            # Check if Claude CLI is installed
            result = await asyncio.create_subprocess_shell(
                "claude -h",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await result.communicate()

            if result.returncode != 0:
                return {
                    "available": False,
                    "configured": False,
                    "error": (
                        "Claude Code CLI is not installed or not working.\n\nInstallation:\n"
                        "1. Install Claude Code: npm install -g @anthropic-ai/claude-code\n"
                        "2. Login to Claude: claude login\n"
                        "3. Retry your request"
                    ),
                }

            # Check if output contains expected content
            help_output = stdout.decode() + stderr.decode()
            if "claude" not in help_output.lower():
                return {
                    "available": False,
                    "configured": False,
                    "error": (
                        "Claude Code CLI responded abnormally.\n\nPlease try:\n"
                        "1. Reinstall: npm install -g @anthropic-ai/claude-code\n"
                        "2. Login: claude login\n"
                        "3. Check installation: claude -h"
                    ),
                }

            return {
                "available": True,
                "configured": True,
                "mode": "CLI",
                "models": [
                    "claude-sonnet-4-5-20250929",
                    "claude-opus-4-1-20250805",
                ],
            }
        except Exception as e:
            return {
                "available": False,
                "configured": False,
                "error": (
                    f"Failed to check Claude Code CLI: {str(e)}\n\nInstallation:\n"
                    "1. Install Claude Code: npm install -g @anthropic-ai/claude-code\n"
                    "2. Login to Claude: claude login"
                ),
            }

    async def execute_streaming(
        self,
        prompt: str,
        model: str = "claude-sonnet-4-5-20250929",
        session_id: Optional[str] = None,
        system_prompt: Optional[str] = None,
        project_path: Optional[str] = None,
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Execute streaming generation using Claude Code SDK

        Args:
            prompt: User input
            model: Model name
            session_id: Session ID (for continuing conversation)
            system_prompt: System prompt
            project_path: Project path (where Claude will create files)

        Yields:
            Messages in Dict format, containing type and related data
        """
        logger.info(f"Starting execution with model: {model}")

        # Configure allowed tools (reference Claudable implementation)
        allowed_tools = [
            "Read",
            "Write",
            "Edit",
            "Bash",
            "Glob",
            "Grep",
            "WebFetch",
            "WebSearch",
        ]

        # Configure Claude Code options
        # Use continue_conversation=False for fresh sessions - this ensures Claude
        # acts as a tool executor rather than a conversational assistant
        options = ClaudeCodeOptions(
            system_prompt=system_prompt or "You are an expert React developer.",
            model=model,
            allowed_tools=allowed_tools,  # Explicitly allow tools
            permission_mode="bypassPermissions",
            continue_conversation=False,  # Fresh session each time for tool-first behavior
        )

        logger.info(f"Allowed tools: {allowed_tools}")

        # If there's an existing session, set resume
        if session_id:
            existing_session = await self.get_session_id(session_id)
            if existing_session:
                options.resumeSessionId = existing_session
                logger.info(f"Resuming session: {existing_session}")

        # Switch to project directory (reference Claudable implementation)
        original_cwd = os.getcwd()
        if project_path:
            logger.info(f"Changing working directory to: {project_path}")
            os.chdir(project_path)
        else:
            # Default to project root directory (two levels up, from api/python to root)
            default_project_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
            logger.info(f"Using default project path: {default_project_path}")
            os.chdir(default_project_path)

        # Clean src directory for fresh generation (avoid Claude reading existing files)
        # This ensures Claude starts from scratch instead of checking/updating existing files
        import shutil
        src_path = os.path.join(os.getcwd(), "src")
        if os.path.exists(src_path):
            # Remove components directory
            components_path = os.path.join(src_path, "components")
            if os.path.exists(components_path):
                logger.info(f"Cleaning components directory: {components_path}")
                shutil.rmtree(components_path)
                os.makedirs(components_path)

            # Remove App.jsx if it exists (will be regenerated)
            app_path = os.path.join(src_path, "App.jsx")
            if os.path.exists(app_path):
                logger.info(f"Removing existing App.jsx")
                os.remove(app_path)

            logger.info("Source directory cleaned for fresh generation")

        try:
            async with ClaudeSDKClient(options=options) as client:
                # Send query
                await client.query(prompt)

                # Receive streaming response
                claude_session_id = None
                generated_files = []  # Collect generated files

                async for message_obj in client.receive_response():
                    # Import SDK types
                    try:
                        from claude_code_sdk.types import (
                            SystemMessage,
                            AssistantMessage,
                            UserMessage,
                            ResultMessage,
                            TextBlock,
                            ToolUseBlock,
                            ToolResultBlock,
                        )
                    except ImportError:
                        # Fallback handling
                        SystemMessage = type(None)
                        AssistantMessage = type(None)
                        UserMessage = type(None)
                        ResultMessage = type(None)
                        TextBlock = type(None)
                        ToolUseBlock = type(None)
                        ToolResultBlock = type(None)

                    # Diagnostics: Display received message type
                    logger.info(f"Received message type: {type(message_obj).__name__}")
                    logger.debug(f"Message content: {str(message_obj)[:200]}...")

                    # Handle SystemMessage (contains session_id)
                    if isinstance(message_obj, SystemMessage):
                        if hasattr(message_obj, "session_id") and message_obj.session_id:
                            claude_session_id = message_obj.session_id
                            await self.set_session_id(session_id or "default", claude_session_id)

                        yield {
                            "type": "system",
                            "content": f"Claude Code SDK initialized successfully (Model: {model})",
                            "session_id": claude_session_id,
                        }

                    # Handle AssistantMessage
                    elif isinstance(message_obj, AssistantMessage):
                        logger.info("Processing AssistantMessage")
                        logger.debug(f"Has content: {hasattr(message_obj, 'content')}")
                        if hasattr(message_obj, "content"):
                            logger.debug(f"Content type: {type(message_obj.content)}")
                            logger.debug(f"Content is list: {isinstance(message_obj.content, list)}")
                            if isinstance(message_obj.content, list):
                                logger.debug(f"Content blocks: {len(message_obj.content)}")

                        if hasattr(message_obj, "content") and isinstance(message_obj.content, list):
                            for block in message_obj.content:
                                if isinstance(block, TextBlock):
                                    # Text content
                                    logger.info(f"Text block: {block.text[:100]}...")
                                    yield {
                                        "type": "text",
                                        "content": block.text,
                                    }
                                elif isinstance(block, ToolUseBlock):
                                    # Tool usage (typically Write tool for creating files)
                                    logger.info(f"Tool Use: {block.name}")

                                    # If it's the Write tool, extract file information
                                    if block.name == "Write" and isinstance(block.input, dict):
                                        file_path = block.input.get("file_path", "")
                                        content = block.input.get("content", "")
                                        logger.info(f"Write file: {file_path} ({len(content)} chars)")

                                        # Collect files
                                        generated_files.append({
                                            "path": file_path,
                                            "content": content
                                        })

                                    yield {
                                        "type": "tool_use",
                                        "tool_name": block.name,
                                        "tool_input": block.input,
                                        "tool_id": block.id,
                                    }

                    # Handle ResultMessage (completion message)
                    elif isinstance(message_obj, ResultMessage) or (
                        hasattr(message_obj, "type") and getattr(message_obj, "type", None) == "result"
                    ):
                        # If files were generated, format them for frontend
                        if generated_files:
                            logger.info(f"Generated {len(generated_files)} files in total")

                            # Format as XML (expected by frontend)
                            generated_code_parts = []
                            for file_info in generated_files:
                                generated_code_parts.append(
                                    f'<file path="{file_info["path"]}">\n{file_info["content"]}\n</file>'
                                )
                            generated_code = "\n\n".join(generated_code_parts)

                            # Send message containing all files
                            yield {
                                "type": "files_generated",
                                "files": generated_files,
                                "generatedCode": generated_code,
                                "files_count": len(generated_files),
                            }

                        yield {
                            "type": "complete",
                            "duration_ms": getattr(message_obj, "duration_ms", 0),
                            "total_cost_usd": getattr(message_obj, "total_cost_usd", 0),
                            "session_id": getattr(message_obj, "session_id", claude_session_id),
                        }
                        break

        except Exception as e:
            logger.error(f"Error: {str(e)}")
            yield {
                "type": "error",
                "error": str(e),
            }
            raise
        finally:
            # Restore original working directory
            os.chdir(original_cwd)
            logger.info(f"Restored working directory to: {original_cwd}")

    async def get_session_id(self, key: str) -> Optional[str]:
        """Get session ID"""
        return self.session_mapping.get(key)

    async def set_session_id(self, key: str, session_id: str) -> None:
        """Set session ID"""
        self.session_mapping[key] = session_id
        logger.info(f"Session ID saved: {key} -> {session_id}")


# Global instance
adapter = ClaudeCodeAdapter()
