import { NextRequest } from 'next/server';
import { registry } from '@/lib/registry/store';
import { z } from 'zod';
import type { PartialAuthor } from '@/lib/types';

const RegisterSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  category: z.string().optional(),
  categories: z.array(z.object({
    mainCategory: z.string(),
    subCategory: z.string(),
    description: z.string().optional()
  })).optional(),
  capabilities: z.array(z.string()),
  endpoint: z.string().url(),
  apiKey: z.string().optional(),
  type: z.enum(['informational', 'transactional', 'task']).optional(),
  version: z.string().optional(),
  author: z.object({
    name: z.string(),
    website: z.string().optional(),
    contactEmail: z.string().optional()
  }).optional(),
  tags: z.array(z.string()).optional(),
  verified: z.boolean().optional(),
  trustScore: z.number().min(0).max(100).optional(),
  status: z.enum(['active', 'inactive', 'deprecated']).optional(),
  logoUrl: z.string().url().optional()
});

export async function GET(request: NextRequest) {
  try {
    const servers = await registry.getAllServers();
    return Response.json({
      servers: servers.map(s => ({
        id: s.id,
        name: s.name,
        description: s.description,
        category: s.categories?.[0] ? `${s.categories[0].mainCategory}/${s.categories[0].subCategory}` : s.category,
        categories: s.categories,
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
      author: validated.author as PartialAuthor | undefined,
      verified: validated.verified ?? false,
      trustScore: validated.trustScore ?? 50,
      status: validated.status ?? 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await registry.register(server);

    return Response.json({
      success: true,
      server: {
        id: server.id,
        name: server.name,
        category: server.categories?.[0] ? `${server.categories[0].mainCategory}/${server.categories[0].subCategory}` : server.category,
        categories: server.categories,
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