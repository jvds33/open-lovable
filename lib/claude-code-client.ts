/**
 * Claude Code CLI Client
 * Communicates with Python FastAPI bridge service
 */

export interface ClaudeCodeStatus {
  available: boolean;
  configured: boolean;
  mode?: string;
  models?: string[];
  error?: string;
}

export interface GenerateRequest {
  prompt: string;
  model?: string;
  session_id?: string;
  system_prompt?: string;
  is_edit?: boolean;
}

export interface ClaudeCodeMessage {
  type: 'system' | 'text' | 'tool_use' | 'complete' | 'error';
  content?: string;
  session_id?: string;
  tool_name?: string;
  tool_input?: any;
  tool_id?: string;
  duration_ms?: number;
  total_cost_usd?: number;
  error?: string;
}

/**
 * Claude Code Client Class
 */
export class ClaudeCodeClient {
  private pythonApiUrl: string;

  constructor() {
    this.pythonApiUrl = process.env.PYTHON_API_URL || 'http://localhost:8000';
  }

  /**
   * Check Claude Code CLI status
   */
  async checkStatus(): Promise<ClaudeCodeStatus> {
    try {
      const response = await fetch(`${this.pythonApiUrl}/api/claude-code/status`);

      if (!response.ok) {
        throw new Error(`Status check failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('[ClaudeCodeClient] Status check error:', error);
      return {
        available: false,
        configured: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Generate code using Claude Code CLI (streaming mode)
   */
  async generateStream(
    request: GenerateRequest,
    onMessage: (message: ClaudeCodeMessage) => void
  ): Promise<void> {
    try {
      const response = await fetch(`${this.pythonApiUrl}/api/claude-code/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`Generate request failed: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      // Read SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        // Decode and process data
        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE messages
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = line.slice(6); // Remove "data: " prefix
              const message: ClaudeCodeMessage = JSON.parse(data);
              onMessage(message);

              // Stop processing if received complete or error message
              if (message.type === 'complete' || message.type === 'error') {
                return;
              }
            } catch (e) {
              console.error('[ClaudeCodeClient] Parse error:', e);
            }
          }
        }
      }
    } catch (error) {
      console.error('[ClaudeCodeClient] Generate stream error:', error);
      onMessage({
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

// Create singleton instance
export const claudeCodeClient = new ClaudeCodeClient();
