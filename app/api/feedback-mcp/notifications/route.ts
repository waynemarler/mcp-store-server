import { NextRequest } from "next/server";
import {
  type NotificationEvent,
  getActiveConnections,
  getRecentEvents
} from '../notificationEmitter';

// SERVER-SENT EVENTS (SSE) FOR REAL-TIME FEEDBACK NOTIFICATIONS
// Enables autonomous Claude-to-Claude communication without polling
export async function GET(request: NextRequest) {
  // Get client ID from query params or generate one
  const url = new URL(request.url);
  const clientId = url.searchParams.get('client_id') || `claude-${Date.now()}`;
  const lastEventId = url.searchParams.get('last_event_id');

  console.log(`🔔 SSE Connection established: ${clientId}`);

  // Create SSE stream
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  // Get the connections map
  const activeConnections = getActiveConnections();

  // Store the connection
  activeConnections.set(clientId, writer);

  // Send initial connection message
  const encoder = new TextEncoder();
  await writer.write(encoder.encode(`:connected\n\n`));

  // Send keepalive ping
  await writer.write(encoder.encode(`event: ping\ndata: {"time": "${new Date().toISOString()}"}\n\n`));

  // If client requests replay of recent events
  if (lastEventId === 'replay') {
    const recentEvents = getRecentEvents();
    for (const event of recentEvents) {
      await writer.write(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
    }
  }

  // Send system ready notification
  const readyEvent = {
    type: 'test_requested' as const,
    feedbackId: 'system',
    sender: 'system', // System-generated notification
    data: {
      message: 'Push notification system ready! Claude Desktop can now receive real-time updates.',
      capabilities: [
        'feedback_created - New feedback submitted',
        'status_updated - Feedback status changed',
        'deployment_ready - Code deployed and ready to test',
        'fix_deployed - Fix has been deployed',
        'test_requested - Testing is requested'
      ]
    },
    timestamp: new Date().toISOString()
  };

  // Add ID and send via emitNotification to maintain consistency
  const { emitNotification } = await import('../notificationEmitter');
  emitNotification(readyEvent);

  // Also send directly to this connection
  await writer.write(encoder.encode(`data: ${JSON.stringify({...readyEvent, id: `notif_${Date.now()}_temp`})}\n\n`));

  // Set up keepalive interval (every 30 seconds)
  const keepaliveInterval = setInterval(async () => {
    try {
      await writer.write(encoder.encode(`:keepalive ${Date.now()}\n\n`));
    } catch (error) {
      console.log(`Client ${clientId} disconnected`);
      clearInterval(keepaliveInterval);
      activeConnections.delete(clientId);
    }
  }, 30000);

  // Clean up on disconnect
  request.signal.addEventListener('abort', () => {
    console.log(`Client ${clientId} disconnected (abort signal)`);
    clearInterval(keepaliveInterval);
    activeConnections.delete(clientId);
    writer.close();
  });

  // Return SSE response with proper headers
  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable Nginx buffering
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Last-Event-ID'
    },
  });
}

// Handle OPTIONS for CORS
export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Last-Event-ID'
    },
  });
}