// Direct test endpoint to bypass routing and connect to specific server
import { NextRequest, NextResponse } from 'next/server';
import { oauthMCPClient } from '@/lib/mcp/oauth-client';

export async function POST(request: NextRequest) {
  try {
    const { serverId, method, params } = await request.json();

    // Create a mock server object for server 98
    const mockServer = {
      id: serverId || "98",
      name: "@fisher1006/time-mcp-4",
      endpoint: "https://server.smithery.ai/@fisher1006/time-mcp-4/mcp",
      description: "Time MCP Server",
      category: "Time",
      capabilities: ["get_current_time", "convert_time"],
      verified: true,
      trustScore: 85,
      status: "active" as const,
      type: "informational" as const,
      categories: [{
        mainCategory: "Time",
        subCategory: "Utilities",
        description: "Time zone utilities"
      }],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    console.log(`🎯 Direct test: Calling ${method} on server ${serverId}`);

    // Call the tool directly using OAuth
    const response = await oauthMCPClient.callTool(
      mockServer as any,
      method || "get_current_time",
      params || { timezone: "America/New_York" }
    );

    return NextResponse.json({
      success: true,
      serverId: mockServer.id,
      serverName: mockServer.name,
      method: method || "get_current_time",
      response
    });

  } catch (error: any) {
    console.error('❌ Direct test error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      details: error.stack
    }, { status: 500 });
  }
}