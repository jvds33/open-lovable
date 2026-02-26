#!/usr/bin/env python3
"""Test if Claude Code SDK is working properly"""
import asyncio
from claude_code_sdk import ClaudeSDKClient, ClaudeCodeOptions


async def test_claude_sdk():
    """Test Claude Code SDK"""
    print("🧪 Testing Claude Code SDK...")

    options = ClaudeCodeOptions(
        system_prompt="You are a helpful assistant.",
        model="claude-sonnet-4-5-20250929",
        continue_conversation=True,
        permission_mode="bypassPermissions",
    )

    try:
        print("📡 Connecting to Claude Code SDK...")
        async with ClaudeSDKClient(options=options) as client:
            print("✅ Connection successful")

            # Send simple query
            prompt = "Say hello in one sentence."
            print(f"📝 Sending prompt: {prompt}")
            await client.query(prompt)

            print("⏳ Waiting for response...")
            message_count = 0

            async for message_obj in client.receive_response():
                message_count += 1
                print(f"\n📨 Received message #{message_count}:")
                print(f"   Type: {type(message_obj).__name__}")
                print(f"   Content: {message_obj}")

                # Check if has session_id
                if hasattr(message_obj, "session_id"):
                    print(f"   Session ID: {message_obj.session_id}")

                # Check if has content
                if hasattr(message_obj, "content"):
                    print(f"   Content: {message_obj.content}")

                # If it's a result message, exit
                if hasattr(message_obj, "type") and message_obj.type == "result":
                    print("✅ Complete")
                    break

            if message_count == 0:
                print("❌ No messages received")
            else:
                print(f"\n✅ Total {message_count} messages received")

    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

    return True


if __name__ == "__main__":
    success = asyncio.run(test_claude_sdk())
    exit(0 if success else 1)
