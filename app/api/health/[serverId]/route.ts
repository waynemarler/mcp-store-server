import { NextRequest } from 'next/server';
import { registry } from '@/lib/registry/store';

// Health check endpoints for MCP servers

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ serverId: string }> }
) {
  try {
    const { serverId } = await context.params;
    const health = await registry.getHealth(serverId);

    if (!health) {
      return Response.json({ error: 'Server not found' }, { status: 404 });
    }

    return Response.json(health);
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ serverId: string }> }
) {
  try {
    const { serverId } = await context.params;
    const server = await registry.get(serverId);

    if (!server) {
      return Response.json({ error: 'Server not found' }, { status: 404 });
    }

    // Perform health check
    const startTime = Date.now();
    let healthy = false;
    let error: string | undefined;

    try {
      const response = await fetch(server.endpoint, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });
      healthy = response.ok;
    } catch (e: any) {
      error = e.message;
    }

    const status = {
      serverId,
      healthy,
      lastCheck: new Date(),
      responseTime: Date.now() - startTime,
      error
    };

    await registry.updateHealth(serverId, status);

    return Response.json(status);
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}