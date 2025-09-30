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
// PRAGMATIC SOLUTION: Use existing feedback_items table instead of new polling_notifications table
async function storeNotificationsForPolling(notifications: any[]) {
  try {
    // Initialize database - using proven feedback_items table
    const { sql } = await import('@vercel/postgres');

    console.log(`📤 PRAGMATIC APPROACH: Storing ${notifications.length} notifications in feedback_items table`);

    // Insert notifications as special feedback entries
    let successCount = 0;
    for (const notif of notifications) {
      try {
        // Store notification as a special feedback entry
        const result = await sql`
          INSERT INTO feedback_items (
            feedback_type, component, severity, current_behavior, expected_behavior,
            suggested_fix, test_query, current_performance_ms, target_performance_ms,
            confidence_score, additional_metrics, priority_score, related_feedback_id
          ) VALUES (
            'notification', ${notif.type}, 'info',
            ${'Autonomous notification: ' + (notif.data.message || JSON.stringify(notif.data))},
            ${'Auto-retrieved by polling clients'},
            ${'No action needed - this is an autonomous notification'},
            ${notif.feedbackId || 'autonomous_polling'},
            NULL, NULL, 100,
            ${JSON.stringify({
              notification_id: notif.id,
              notification_type: notif.type,
              feedback_id: notif.feedbackId,
              original_data: notif,
              autonomous_polling: true,
              retrieved_by_clients: []
            })},
            10, NULL
          )
          RETURNING id, created_at
        `;

        if (result.rows.length > 0) {
          successCount++;
          console.log(`✅ Stored notification ${notif.id} as feedback entry ${result.rows[0].id}`);
        }
      } catch (insertError) {
        console.error(`❌ Failed to insert notification ${notif.id}:`, insertError);
        console.error(`❌ Notification data:`, JSON.stringify(notif));
      }
    }

    console.log(`📥 PRAGMATIC SUCCESS: Stored ${successCount}/${notifications.length} notifications in feedback_items table`);

    // Verify storage by counting notification entries
    const countResult = await sql`
      SELECT COUNT(*) as total
      FROM feedback_items
      WHERE feedback_type = 'notification'
    `;
    console.log(`📊 Total notification entries in feedback_items: ${countResult.rows[0].total}`);

  } catch (error) {
    console.error('❌ Failed to store notifications using pragmatic approach:', error);
    console.error('❌ Error details:', error.message);
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