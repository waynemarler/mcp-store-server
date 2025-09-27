import { NextRequest } from "next/server";

// Debug endpoint to check Smithery API pagination info
export async function GET() {
  try {
    const apiKey = process.env.SMITHERY_API_KEY;
    const baseUrl = 'https://registry.smithery.ai';

    console.log('🔍 Checking Smithery API pagination...');

    // Check first page with small pageSize to get pagination info
    const response = await fetch(`${baseUrl}/servers?page=1&pageSize=1`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    console.log('📊 Smithery API Response:', JSON.stringify(data, null, 2));

    return Response.json({
      success: true,
      apiResponse: data,
      pagination: data.pagination,
      totalCount: data.pagination?.totalCount,
      totalPages: data.pagination?.totalPages,
      pageSize: data.pagination?.pageSize,
      currentPage: data.pagination?.currentPage,
      serversInResponse: data.servers?.length || 0,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('🚨 Debug error:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}