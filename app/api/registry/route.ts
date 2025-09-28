import { NextRequest } from "next/server";
import { registry } from "@/lib/registry/store";
import { z } from "zod";

const RegisterSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  category: z.string().optional(),
  categories: z
    .array(
      z.object({
        mainCategory: z.string(),
        subCategory: z.string(),
        description: z.string().optional(),
      })
    )
    .optional(),
  capabilities: z.array(z.string()),
  endpoint: z.string().url(),
  apiKey: z.string().optional(),
  type: z.enum(["informational", "transactional", "task"]).optional(),
  version: z.string().optional(),
  author: z
    .object({
      name: z.string(),
      website: z.string().optional(),
      contactEmail: z.string().optional(),
    })
    .optional(),
  tags: z.array(z.string()).optional(),
  verified: z.boolean().optional(),
  trustScore: z.number().min(0).max(100).optional(),
  status: z.enum(["active", "inactive", "deprecated"]).optional(),
  logoUrl: z.string().url().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pageSize = parseInt(searchParams.get('pageSize') || '1000');
    const page = parseInt(searchParams.get('page') || '1');
    const query = searchParams.get('q') || '';

    const servers = await registry.getAllServers();

    // Filter servers if query provided
    let filteredServers = servers;
    if (query) {
      const lowerQuery = query.toLowerCase();
      filteredServers = servers.filter(s =>
        s.name?.toLowerCase().includes(lowerQuery) ||
        s.description?.toLowerCase().includes(lowerQuery) ||
        s.category?.toLowerCase().includes(lowerQuery) ||
        (s as any).qualified_name?.toLowerCase().includes(lowerQuery) ||
        (s as any).author?.toLowerCase().includes(lowerQuery)
      );
    }

    // Paginate results
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedServers = filteredServers.slice(startIndex, endIndex);

    return Response.json({
      servers: paginatedServers.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        category: s.categories?.[0]
          ? `${s.categories[0].mainCategory}/${s.categories[0].subCategory}`
          : s.category,
        categories: s.categories,
        capabilities: s.capabilities,
        endpoint: s.endpoint,
        verified: s.verified,
        trustScore: s.trustScore,
        lastHealthCheck: s.lastHealthCheck,
        // Smithery fields
        display_name: (s as any).display_name,
        qualified_name: (s as any).qualified_name,
        icon_url: (s as any).icon_url,
        use_count: (s as any).use_count,
        author: (s as any).author,
        homepage: (s as any).homepage,
        repository_url: (s as any).repository_url,
        source_url: (s as any).source_url,
        tools: (s as any).tools,
        tags: (s as any).tags,
        is_remote: (s as any).is_remote,
        security_scan_passed: (s as any).security_scan_passed,
        deployment_url: (s as any).deployment_url,
        connections: (s as any).connections,
        downloads: (s as any).downloads,
        version: (s as any).version,
        source_created_at: (s as any).source_created_at,
        fetched_at: (s as any).fetched_at,
        api_source: (s as any).api_source,
        raw_json: (s as any).raw_json,
      })),
      pagination: {
        page,
        pageSize,
        totalCount: filteredServers.length,
        totalPages: Math.ceil(filteredServers.length / pageSize),
        hasNext: endIndex < filteredServers.length,
        hasPrev: page > 1
      }
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = RegisterSchema.parse(body);

    const now = new Date();

    const server = {
      id: `server-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...validated,
      // Transform the author object to include required id and createdAt fields
      author: validated.author
        ? {
            ...validated.author,
            id: `author-${Date.now()}-${Math.random()
              .toString(36)
              .substr(2, 9)}`,
            createdAt: now,
          }
        : undefined,
      category: validated.category || "Uncategorized",
      verified: validated.verified ?? false,
      trustScore: validated.trustScore ?? 50,
      status: validated.status ?? "active",
      createdAt: now,
      updatedAt: now,
    };

    await registry.register(server);

    return Response.json({
      success: true,
      server: {
        id: server.id,
        name: server.name,
        category: server.categories?.[0]
          ? `${server.categories[0].mainCategory}/${server.categories[0].subCategory}`
          : server.category,
        categories: server.categories,
        capabilities: server.capabilities,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      );
    }
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const serverId = searchParams.get("id");

    if (!serverId) {
      return Response.json({ error: "Server ID required" }, { status: 400 });
    }

    await registry.delete(serverId);
    return Response.json({ success: true });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
