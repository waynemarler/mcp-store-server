import { NextRequest, NextResponse } from 'next/server';

// VERCEL CRON JOB ENDPOINT
// Triggered every 5 minutes by Vercel Cron to check for new notifications
// This solves the serverless setInterval limitation

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    console.log('🤖 Vercel Cron: Starting autonomous polling check...');

    // Get the notification emitter
    const { getRecentEvents } = await import('../feedback-mcp/notificationEmitter');

    // Get all recent notifications
    const recentNotifications = getRecentEvents();

    // Check if there are any new notifications in the last 6 minutes
    // (6 minutes to account for cron timing variations)
    const sixMinutesAgo = new Date(Date.now() - 6 * 60 * 1000);
    const newNotifications = recentNotifications.filter(notif => {
      const notifTime = new Date(notif.timestamp);
      return notifTime > sixMinutesAgo;
    });

    const responseTime = Date.now() - startTime;

    if (newNotifications.length > 0) {
      console.log(`🔔 Cron found ${newNotifications.length} new notifications:`);
      newNotifications.forEach(notif => {
        console.log(`  📨 ${notif.type}: ${notif.data.message || JSON.stringify(notif.data)}`);
      });

      // Store notifications in database for Claude Desktop to retrieve
      await storeNotificationsForPolling(newNotifications);

      return NextResponse.json({
        success: true,
        message: `Autonomous polling found ${newNotifications.length} new notifications`,
        notifications: newNotifications.length,
        executionTime: responseTime,
        timestamp: new Date().toISOString(),
        status: 'notifications_found'
      });
    } else {
      console.log('🤖 Cron: No new notifications found');

      return NextResponse.json({
        success: true,
        message: 'Autonomous polling completed - no new notifications',
        notifications: 0,
        executionTime: responseTime,
        timestamp: new Date().toISOString(),
        status: 'no_new_notifications'
      });
    }

  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    console.error('❌ Cron polling error:', error);

    return NextResponse.json({
      success: false,
      error: error.message,
      executionTime: responseTime,
      timestamp: new Date().toISOString(),
      status: 'error'
    }, { status: 500 });
  }
}

// Store notifications in database for later retrieval by polling clients
async function storeNotificationsForPolling(notifications: any[]) {
  try {
    // Initialize database
    const { sql } = await import('@vercel/postgres');

    // Create polling_notifications table if it doesn't exist
    await sql`
      CREATE TABLE IF NOT EXISTS polling_notifications (
        id SERIAL PRIMARY KEY,
        notification_id VARCHAR(255) UNIQUE NOT NULL,
        notification_type VARCHAR(100) NOT NULL,
        feedback_id VARCHAR(255),
        notification_data JSONB NOT NULL,
        timestamp TIMESTAMPTZ NOT NULL,
        retrieved_by_clients TEXT[] DEFAULT ARRAY[]::TEXT[],
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    // Insert new notifications
    for (const notif of notifications) {
      try {
        await sql`
          INSERT INTO polling_notifications (
            notification_id, notification_type, feedback_id,
            notification_data, timestamp
          ) VALUES (
            ${notif.id}, ${notif.type}, ${notif.feedbackId},
            ${JSON.stringify(notif)}, ${notif.timestamp}
          )
          ON CONFLICT (notification_id) DO NOTHING
        `;
      } catch (insertError) {
        console.error(`Failed to insert notification ${notif.id}:`, insertError);
      }
    }

    console.log(`📥 Stored ${notifications.length} notifications in polling database`);

  } catch (error) {
    console.error('❌ Failed to store notifications for polling:', error);
    throw error;
  }
}

// Optional: Endpoint for manual testing
export async function POST(request: NextRequest) {
  return NextResponse.json({
    message: 'Manual cron trigger - use GET endpoint',
    timestamp: new Date().toISOString()
  });
}