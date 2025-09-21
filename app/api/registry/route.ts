import { NextRequest } from 'next/server';
import { registry } from '@/lib/registry/store';
import { z } from 'zod';

const RegisterSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  category: z.string(),
  capabilities: z.array(z.string()),
  endpoint: z.string().url(),
  apiKey: z.string().optional()
});

export async function GET(request: NextRequest) {
  try {
    const servers = await registry.getAllServers();
    return Response.json({
      servers: servers.map(s => ({
        id: s.id,
        name: s.name,
        description: s.description,
        category: s.category,
        capabilities: s.capabilities,
        endpoint: s.endpoint,
        verified: s.verified,
        trustScore: s.trustScore,
        lastHealthCheck: s.lastHealthCheck
      }))
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = RegisterSchema.parse(body);

    const server = {
      id: `server-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...validated,
      verified: false,
      trustScore: 50,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await registry.register(server);

    return Response.json({
      success: true,
      server: {
        id: server.id,
        name: server.name,
        category: server.category,
        capabilities: server.capabilities
      }
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const serverId = searchParams.get('id');

    if (!serverId) {
      return Response.json({ error: 'Server ID required' }, { status: 400 });
    }

    await registry.delete(serverId);
    return Response.json({ success: true });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}