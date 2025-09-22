import { NextRequest } from 'next/server';
import { registry } from '@/lib/registry/store';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const capability = searchParams.get('capability');
    const category = searchParams.get('category');
    const verified = searchParams.get('verified');

    const query = {
      capability: capability || undefined,
      category: category || undefined,
      verified: verified === 'true' ? true : verified === 'false' ? false : undefined
    };

    const servers = await registry.discover(query);

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
        status: s.status,
        type: s.type,
        version: s.version,
        author: s.author,
        tags: s.tags,
        logoUrl: s.logoUrl
      }))
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}