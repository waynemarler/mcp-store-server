// Service OAuth callback for Smithery platform
// Handles authentication for ALL Smithery MCP servers

import { NextRequest, NextResponse } from 'next/server';
import { smitheryOAuth } from '@/lib/mcp/smithery-oauth';
import { auth } from '@modelcontextprotocol/sdk/client/auth.js';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const state = searchParams.get('state');

  console.log('🔄 Smithery OAuth callback received:', { code: !!code, error, state });

  if (error) {
    console.error('❌ Smithery OAuth error:', error);
    return NextResponse.json({
      error: 'Smithery OAuth authentication failed',
      details: error
    }, { status: 400 });
  }

  if (!code) {
    return NextResponse.json({
      error: 'No authorization code provided'
    }, { status: 400 });
  }

  try {
    console.log('✅ Smithery OAuth authorization code received');
    console.log('🔄 Completing OAuth flow...');

    // Complete the OAuth flow using MCP SDK
    const serverUrl = 'https://server.smithery.ai/@libralm-ai/libralm_mcp_server/mcp';

    const result = await auth(smitheryOAuth, {
      serverUrl,
      authorizationCode: code,
      scope: 'read write'
    });

    if (result === 'AUTHORIZED') {
      console.log('✅ Smithery OAuth completed successfully - tokens stored');
      return NextResponse.json({
        success: true,
        message: 'Smithery OAuth flow completed - tokens valid for ALL Smithery MCPs',
        status: 'Authenticated for all Smithery servers'
      });
    } else {
      throw new Error('OAuth authorization failed - unexpected result: ' + result);
    }

  } catch (error: any) {
    console.error('❌ Smithery OAuth callback error:', error);
    return NextResponse.json({
      error: 'Failed to process Smithery OAuth callback',
      details: error.message
    }, { status: 500 });
  }
}

// Also handle POST requests if Smithery sends them
export async function POST(request: NextRequest) {
  return GET(request);
}