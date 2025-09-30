// Notification emitter for Server-Sent Events
// Shared between routes to enable push notifications

// Store active SSE connections
const activeConnections = new Map<string, WritableStreamDefaultWriter>();

// Event types for notifications
export type NotificationEvent = {
  id: string;
  type: 'feedback_created' | 'status_updated' | 'deployment_ready' | 'test_requested' | 'fix_deployed';
  feedbackId: string;
  sender: string; // claude_desktop or claude_dev - prevents message loops
  data: any;
  timestamp: string;
};

// Keep track of recent events for replay
const recentEvents: NotificationEvent[] = [];
const MAX_RECENT_EVENTS = 50;

// Emit event to all connected clients
export function emitNotification(event: Omit<NotificationEvent, 'id'>) {
  // Add unique ID if not present
  const eventWithId: NotificationEvent = {
    ...event,
    id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  };

  // Store in recent events
  recentEvents.push(eventWithId);
  if (recentEvents.length > MAX_RECENT_EVENTS) {
    recentEvents.shift();
  }

  // Send to all active connections
  const message = `data: ${JSON.stringify(eventWithId)}\n\n`;

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

// Get notifications since a specific notification ID
export function getNotificationsSince(lastNotificationId?: string): NotificationEvent[] {
  if (!lastNotificationId) {
    // Return all recent events if no ID provided
    return recentEvents;
  }

  // Find the index of the last notification ID
  const lastIndex = recentEvents.findIndex(event => event.id === lastNotificationId);
  if (lastIndex === -1) {
    // If ID not found, return all recent events
    return recentEvents;
  }

  // Return notifications after the last ID
  return recentEvents.slice(lastIndex + 1);
}

// Get notifications for specific sender (prevents message loops)
export function getNotificationsForTarget(targetSender?: string, lastNotificationId?: string): NotificationEvent[] {
  // Get base notifications
  let notifications = getNotificationsSince(lastNotificationId);

  // Filter by target sender if specified
  if (targetSender) {
    notifications = notifications.filter(event => event.sender === targetSender);
  }

  return notifications;
}