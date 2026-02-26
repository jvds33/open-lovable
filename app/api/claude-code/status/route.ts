import { NextResponse } from 'next/server';

/**
 * Check Claude Code CLI status
 *
 * GET /api/claude-code/status
 */
export async function GET() {
  const pythonApiUrl = process.env.PYTHON_API_URL || 'http://localhost:8000';

  try {
    const response = await fetch(`${pythonApiUrl}/api/claude-code/status`);

    if (!response.ok) {
      return NextResponse.json(
        {
          available: false,
          configured: false,
          error: 'Python API service is unreachable',
        },
        { status: 503 }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      {
        available: false,
        configured: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
