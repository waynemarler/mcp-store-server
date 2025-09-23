import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  return Response.json({
    environment: {
      USE_ENHANCED_SCHEMA: process.env.USE_ENHANCED_SCHEMA,
      POSTGRES_URL: !!process.env.POSTGRES_URL,
      NODE_ENV: process.env.NODE_ENV,
    },
    timestamp: new Date().toISOString(),
    message: 'Environment variable debug endpoint'
  });
}