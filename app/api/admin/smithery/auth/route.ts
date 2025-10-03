// Admin endpoint to initiate Smithery OAuth
// GET: Check auth status
// POST: Start OAuth flow

import { NextRequest, NextResponse } from 'next/server';
import { smitheryOAuth } from '@/lib/mcp/smithery-oauth';
import {
  discoverOAuthProtectedResourceMetadata,
  discoverAuthorizationServerMetadata,
  startAuthorization,
  registerClient
} from '@modelcontextprotocol/sdk/client/auth.js';

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

    // Use LibraLM as a test server for OAuth
    const serverUrl = 'https://server.smithery.ai/@libralm-ai/libralm_mcp_server/mcp';

    // Check if we already have tokens
    if (smitheryOAuth.isAuthenticated()) {
      return NextResponse.json({
        success: true,
        message: 'Already authenticated with Smithery',
        status: 'Ready for all Smithery MCPs'
      });
    }

    // Discover OAuth metadata
    console.log('🔍 Discovering OAuth metadata...');
    const resourceMetadata = await discoverOAuthProtectedResourceMetadata(serverUrl);

    if (!resourceMetadata?.authorization_servers?.[0]) {
      throw new Error('No authorization server found');
    }

    const authServerUrl = resourceMetadata.authorization_servers[0];
    const authServerMetadata = await discoverAuthorizationServerMetadata(authServerUrl);

    // Check if we need to register the client
    let clientInfo = smitheryOAuth.clientInformation();

    if (!clientInfo) {
      console.log('📝 Registering OAuth client...');
      const registrationResponse = await registerClient(authServerUrl, {
        metadata: authServerMetadata,
        clientMetadata: smitheryOAuth.clientMetadata
      });

      clientInfo = {
        client_id: registrationResponse.client_id,
        client_secret: registrationResponse.client_secret
      };

      await smitheryOAuth.saveClientInformation(clientInfo);
      console.log('✅ Client registered:', clientInfo.client_id.substring(0, 20) + '...');
    }

    // Start authorization flow with PKCE
    console.log('🔐 Starting authorization flow...');
    const { authorizationUrl, codeVerifier } = await startAuthorization(authServerUrl, {
      metadata: authServerMetadata,
      clientInformation: clientInfo,
      redirectUrl: smitheryOAuth.redirectUrl,
      scope: 'read write',
      resource: new URL(serverUrl)
    });

    // Save code verifier for the callback
    await smitheryOAuth.saveCodeVerifier(codeVerifier);

    // Add client_id and code_verifier to state for serverless persistence
    const stateData = JSON.stringify({
      client_id: clientInfo.client_id,
      code_verifier: codeVerifier
    });
    const stateBase64 = Buffer.from(stateData).toString('base64');
    authorizationUrl.searchParams.set('state', stateBase64);

    return NextResponse.json({
      authRequired: true,
      authUrl: authorizationUrl.toString(),
      message: 'Visit this URL to complete Smithery OAuth',
      instructions: 'After authentication, tokens will be valid for ALL Smithery MCPs'
    });

  } catch (error: any) {
    console.error('❌ Smithery OAuth initiation error:', error);
    return NextResponse.json({
      error: 'Failed to initiate Smithery OAuth',
      details: error.message
    }, { status: 500 });
  }
}