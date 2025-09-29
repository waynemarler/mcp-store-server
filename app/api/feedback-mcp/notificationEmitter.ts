// Notification emitter for Server-Sent Events
// Shared between routes to enable push notifications

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

// Get active connections (for the notifications route)
export function getActiveConnections() {
  return activeConnections;
}

// Get recent events (for replay)
export function getRecentEvents() {
  return recentEvents;
}