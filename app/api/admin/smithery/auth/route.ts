// Admin endpoint to initiate Smithery OAuth
// GET: Check auth status
// POST: Start OAuth flow

import { NextRequest, NextResponse } from 'next/server';
import { smitheryOAuth } from '@/lib/mcp/smithery-oauth';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

export async function GET() {
  try {
    const isAuthenticated = smitheryOAuth.isAuthenticated();
    const tokens = smitheryOAuth.tokens();

    return NextResponse.json({
      authenticated: isAuthenticated,
      hasTokens: !!tokens,
      tokenType: tokens?.token_type,
      // Don't expose actual token values for security
      status: isAuthenticated ? 'Ready for all Smithery MCPs' : 'Authentication required'
    });

  } catch (error: any) {
    return NextResponse.json({
      error: 'Failed to check auth status',
      details: error.message
    }, { status: 500 });
  }
}

export async function POST() {
  try {
    console.log('🔄 Initiating Smithery OAuth flow...');

    // Use LibraLM as a test server to trigger OAuth
    const testServerUrl = new URL('https://server.smithery.ai/@libralm-ai/libralm_mcp_server/mcp');

    const transport = new StreamableHTTPClientTransport(
      testServerUrl,
      { authProvider: smitheryOAuth }
    );

    const client = new Client({
      name: "mcp-store-server",
      version: "1.0.0"
    }, {
      capabilities: {}
    });

    try {
      console.log('🔗 Attempting connection to trigger OAuth...');
      await client.connect(transport);

      // If we get here, OAuth was successful
      return NextResponse.json({
        success: true,
        message: 'Smithery OAuth completed successfully',
        status: 'Authenticated for all Smithery MCPs'
      });

    } catch (error: any) {
      // Check if this is an OAuth redirect requirement
      if (error.message.includes('Smithery OAuth required')) {
        const authUrl = error.message.split(': ')[1];

        return NextResponse.json({
          authRequired: true,
          authUrl,
          message: 'Visit this URL to complete Smithery OAuth',
          instructions: 'After authentication, tokens will be valid for ALL Smithery MCPs'
        });
      }

      throw error;
    }

  } catch (error: any) {
    console.error('❌ Smithery OAuth initiation error:', error);
    return NextResponse.json({
      error: 'Failed to initiate Smithery OAuth',
      details: error.message
    }, { status: 500 });
  }
}