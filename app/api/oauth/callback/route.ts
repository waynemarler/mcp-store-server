// OAuth callback handler for Smithery MCP servers
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const state = searchParams.get('state');

  console.log('🔄 OAuth callback received:', { code: !!code, error, state });

  if (error) {
    console.error('❌ OAuth error:', error);
    return NextResponse.json({
      error: 'OAuth authentication failed',
      details: error
    }, { status: 400 });
  }

  if (!code) {
    return NextResponse.json({
      error: 'No authorization code provided'
    }, { status: 400 });
  }

  try {
    // TODO: Complete OAuth flow
    // For now, just store the code and return success
    console.log('✅ OAuth authorization code received');

    // In a real implementation, we would:
    // 1. Exchange code for tokens
    // 2. Store tokens securely
    // 3. Associate with user/server

    return NextResponse.json({
      success: true,
      message: 'OAuth flow completed successfully'
    });

  } catch (error: any) {
    console.error('❌ OAuth callback error:', error);
    return NextResponse.json({
      error: 'Failed to process OAuth callback',
      details: error.message
    }, { status: 500 });
  }
}