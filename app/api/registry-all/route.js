// API endpoint to fetch all MCP servers (internal + external)
import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const source = searchParams.get('source'); // 'internal', 'external', or null for all
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '50');
    const offset = (page - 1) * pageSize;

    let query;
    let countQuery;
    let params = [];
    let countParams = [];

    if (source === 'internal') {
      // Fetch only internal servers from 'mcp_servers' table
      query = `
        SELECT id, name, name as display_name, description,
               author, version, category, status, downloads,
               created_at, 'internal' as source
        FROM mcp_servers
        WHERE 1=1
      `;
      countQuery = `SELECT COUNT(*) as total FROM mcp_servers WHERE 1=1`;

    } else if (source === 'external') {
      // Fetch only external servers
      query = `
        SELECT id, qualified_name as name, display_name, description,
               author, version, category, is_verified as status,
               use_count as downloads, source_created_at as created_at,
               source, icon_url, deployment_url, tools, tags
        FROM external_mcp_servers
        WHERE 1=1
      `;
      countQuery = `SELECT COUNT(*) as total FROM external_mcp_servers WHERE 1=1`;

    } else {
      // Fetch all servers (union of internal and external)
      query = `
        SELECT * FROM (
          SELECT
            'internal_' || id as unique_id,
            name,
            name as display_name,
            description,
            author,
            version,
            category,
            status,
            downloads,
            created_at,
            'internal' as source,
            NULL as icon_url,
            NULL as deployment_url,
            NULL as tools,
            NULL as tags,
            NULL as qualified_name
          FROM mcp_servers

          UNION ALL

          SELECT
            'external_' || id as unique_id,
            qualified_name as name,
            display_name,
            description,
            author,
            version,
            category,
            CASE
              WHEN is_verified THEN 'approved'
              ELSE 'pending'
            END as status,
            use_count as downloads,
            source_created_at as created_at,
            source,
            icon_url,
            deployment_url,
            tools::text,
            array_to_string(tags, ',') as tags,
            qualified_name
          FROM external_mcp_servers
        ) AS combined_servers
        WHERE 1=1
      `;

      countQuery = `
        SELECT
          (SELECT COUNT(*) FROM mcp_servers) +
          (SELECT COUNT(*) FROM external_mcp_servers) as total
      `;
    }

    // Add category filter if provided
    if (category) {
      query += ` AND category = $${params.length + 1}`;
      countQuery += ` AND category = $${countParams.length + 1}`;
      params.push(category);
      countParams.push(category);
    }

    // Add search filter if provided
    if (search) {
      const searchCondition = source === 'external'
        ? ` AND (display_name ILIKE $${params.length + 1} OR description ILIKE $${params.length + 1} OR array_to_string(tags, ' ') ILIKE $${params.length + 1})`
        : ` AND (name ILIKE $${params.length + 1} OR description ILIKE $${params.length + 1})`;

      query += searchCondition;

      if (source !== null) {
        countQuery += searchCondition.replace(`$${params.length + 1}`, `$${countParams.length + 1}`);
      }

      const searchPattern = `%${search}%`;
      params.push(searchPattern);
      countParams.push(searchPattern);
    }

    // Add ordering
    query += ` ORDER BY created_at DESC`;

    // Add pagination
    query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(pageSize, offset);

    // Execute queries
    const [dataResult, countResult] = await Promise.all([
      sql.query(query, params),
      source === null && !category && !search
        ? sql.query(countQuery)
        : sql.query(countQuery, countParams)
    ]);

    // Process the results
    const servers = dataResult.rows.map(server => {
      // Parse tools if it's a string
      if (server.tools && typeof server.tools === 'string') {
        try {
          server.tools = JSON.parse(server.tools);
        } catch (e) {
          server.tools = [];
        }
      }

      // Parse tags if it's a string
      if (server.tags && typeof server.tags === 'string') {
        server.tags = server.tags.split(',').filter(t => t);
      }

      return server;
    });

    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / pageSize);

    return NextResponse.json({
      servers: servers,
      pagination: {
        page: page,
        pageSize: pageSize,
        total: total,
        totalPages: totalPages
      },
      sources: {
        internal: source === 'internal' || source === null,
        external: source === 'external' || source === null
      }
    });

  } catch (error) {
    console.error('Error fetching servers:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch servers',
        message: error.message
      },
      { status: 500 }
    );
  }
}

// Get available categories
export async function OPTIONS(request) {
  try {
    const internalCategories = await sql`
      SELECT DISTINCT category
      FROM mcp_servers
      WHERE category IS NOT NULL
    `;

    const externalCategories = await sql`
      SELECT DISTINCT category
      FROM external_mcp_servers
      WHERE category IS NOT NULL
    `;

    // Combine and deduplicate categories
    const allCategories = new Set([
      ...internalCategories.rows.map(r => r.category),
      ...externalCategories.rows.map(r => r.category)
    ]);

    return NextResponse.json({
      categories: Array.from(allCategories).sort()
    });

  } catch (error) {
    console.error('Error fetching categories:', error);
    return NextResponse.json(
      { error: 'Failed to fetch categories' },
      { status: 500 }
    );
  }
}