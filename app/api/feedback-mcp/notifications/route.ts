import { NextRequest } from "next/server";

// SERVER-SENT EVENTS (SSE) FOR REAL-TIME FEEDBACK NOTIFICATIONS
// Enables autonomous Claude-to-Claude communication without polling

// Store active SSE connections
const activeConnections = new Map<string, WritableStreamDefaultWriter>();

// Event types for notifications
export type NotificationEvent = {
  type: 'feedback_created' | 'status_updated' | 'deployment_ready' | 'test_requested' | 'fix_deployed';
  feedbackId: string;
  data: any;
  timestamp: string;
};

// Keep track of recent events for replay
const recentEvents: NotificationEvent[] = [];
const MAX_RECENT_EVENTS = 50;

// Emit event to all connected clients
export function emitNotification(event: NotificationEvent) {
  // Store in recent events
  recentEvents.push(event);
  if (recentEvents.length > MAX_RECENT_EVENTS) {
    recentEvents.shift();
  }

  // Send to all active connections
  const message = `data: ${JSON.stringify(event)}\n\n`;

  activeConnections.forEach((writer, clientId) => {
    try {
      const encoder = new TextEncoder();
      writer.write(encoder.encode(message));
    } catch (error) {
      console.error(`Failed to send to client ${clientId}:`, error);
      activeConnections.delete(clientId);
    }
  });
}

export async function GET(request: NextRequest) {
  // Get client ID from query params or generate one
  const url = new URL(request.url);
  const clientId = url.searchParams.get('client_id') || `claude-${Date.now()}`;
  const lastEventId = url.searchParams.get('last_event_id');

  console.log(`🔔 SSE Connection established: ${clientId}`);

  // Create SSE stream
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  // Store the connection
  activeConnections.set(clientId, writer);

  // Send initial connection message
  const encoder = new TextEncoder();
  await writer.write(encoder.encode(`:connected\n\n`));

  // Send keepalive ping
  await writer.write(encoder.encode(`event: ping\ndata: {"time": "${new Date().toISOString()}"}\n\n`));

  // If client requests replay of recent events
  if (lastEventId === 'replay') {
    for (const event of recentEvents) {
      await writer.write(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
    }
  }

  // Send system ready notification
  const readyEvent: NotificationEvent = {
    type: 'test_requested',
    feedbackId: 'system',
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

  await writer.write(encoder.encode(`data: ${JSON.stringify(readyEvent)}\n\n`));

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