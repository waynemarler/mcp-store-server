import { NextRequest } from "next/server";

// CLAUDE-TO-CLAUDE FEEDBACK LOOP - REVOLUTIONARY AI DEVELOPMENT SYSTEM
// First-ever autonomous feedback system between Claude Frontend and Claude Dev

// Database connection will be established once
let dbInitialized = false;

async function initDatabase() {
  if (dbInitialized) return;

  try {
    const { sql } = await import('@vercel/postgres');

    // Create feedback_items table with comprehensive schema
    await sql`
      CREATE TABLE IF NOT EXISTS feedback_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        -- Feedback Classification
        feedback_type VARCHAR(50) NOT NULL, -- bug, performance, feature_request, improvement, praise
        component VARCHAR(100) NOT NULL, -- routing, nlp, cache, database, etc.
        severity VARCHAR(20) NOT NULL, -- critical, high, medium, low
        status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, fixed, deployed, verified, wont_fix

        -- Issue Details
        current_behavior TEXT NOT NULL,
        expected_behavior TEXT NOT NULL,
        suggested_fix TEXT,
        test_query TEXT,

        -- Performance Metrics
        current_performance_ms INTEGER,
        target_performance_ms INTEGER,
        confidence_score FLOAT,
        additional_metrics JSONB,

        -- Assignment and Priority
        assigned_to VARCHAR(100) DEFAULT 'claude-dev',
        priority_score INTEGER DEFAULT 50, -- 1-100 calculated from severity + impact

        -- Resolution Tracking
        fix_description TEXT,
        fix_deployed_at TIMESTAMP,
        verification_status VARCHAR(50), -- pending_test, passed, failed
        claude_frontend_notes TEXT,
        commit_hash VARCHAR(100),

        -- Relationship tracking
        related_feedback_id UUID REFERENCES feedback_items(id)
      )
    `;

    // Create indexes for performance
    await sql`CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback_items(status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_feedback_severity ON feedback_items(severity)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback_items(created_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_feedback_priority ON feedback_items(priority_score DESC)`;

    console.log('✅ Feedback database initialized successfully');
    dbInitialized = true;
  } catch (error) {
    console.error('❌ Failed to initialize feedback database:', error);
    throw error;
  }
}

// Calculate priority score based on severity and other factors
function calculatePriorityScore(severity: string, feedbackType: string, performanceImpact?: number): number {
  const severityScores = {
    'critical': 90,
    'high': 70,
    'medium': 50,
    'low': 30
  };

  const typeModifiers = {
    'bug': 10,
    'performance': 15,
    'feature_request': 0,
    'improvement': 5,
    'praise': -10
  };

  let score = severityScores[severity] || 50;
  score += typeModifiers[feedbackType] || 0;

  // Performance impact modifier
  if (performanceImpact && performanceImpact > 100) {
    score += Math.min(10, Math.floor(performanceImpact / 100));
  }

  return Math.max(1, Math.min(100, score));
}

export async function POST(request: NextRequest) {
  try {
    // Initialize database if needed
    await initDatabase();

    const body = await request.json();

    // Handle MCP protocol messages
    if (body.jsonrpc === "2.0") {
      return handleMCPMessage(body);
    }

    return Response.json({
      error: "This is an MCP-only endpoint. Use JSON-RPC 2.0 format"
    }, { status: 400 });

  } catch (error: any) {
    console.error('Feedback MCP Error:', error);
    return Response.json({
      error: error.message
    }, { status: 500 });
  }
}

async function handleMCPMessage(message: any) {
  const { method, params, id } = message;

  try {
    switch (method) {
      case "tools/list":
        return Response.json({
          jsonrpc: "2.0",
          id,
          result: {
            tools: [
              {
                name: "submit_feedback",
                description: "Claude Frontend submits structured feedback about platform performance, bugs, or improvements",
                inputSchema: {
                  type: "object",
                  properties: {
                    feedback_type: {
                      type: "string",
                      enum: ["bug", "performance", "feature_request", "improvement", "praise"],
                      description: "Type of feedback being submitted"
                    },
                    component: {
                      type: "string",
                      description: "Which component (routing, nlp, cache, database, ui, etc.)"
                    },
                    severity: {
                      type: "string",
                      enum: ["critical", "high", "medium", "low"],
                      description: "Severity level of the issue"
                    },
                    current_behavior: {
                      type: "string",
                      description: "What's currently happening (be specific)"
                    },
                    expected_behavior: {
                      type: "string",
                      description: "What should happen instead"
                    },
                    suggested_fix: {
                      type: "string",
                      description: "Your recommendation for fixing it (optional)"
                    },
                    test_query: {
                      type: "string",
                      description: "Query that exposed the issue (optional)"
                    },
                    metrics: {
                      type: "object",
                      description: "Performance data (current_ms, target_ms, confidence, etc.)",
                      properties: {
                        current_performance_ms: { type: "number" },
                        target_performance_ms: { type: "number" },
                        confidence_score: { type: "number" },
                        additional_data: { type: "object" }
                      }
                    },
                    related_feedback_id: {
                      type: "string",
                      description: "UUID of related feedback item (for follow-ups)"
                    }
                  },
                  required: ["feedback_type", "component", "severity", "current_behavior", "expected_behavior"]
                }
              },
              {
                name: "get_feedback_status",
                description: "Query feedback items by status, severity, or other filters",
                inputSchema: {
                  type: "object",
                  properties: {
                    feedback_id: {
                      type: "string",
                      description: "Specific feedback ID to query (optional)"
                    },
                    status_filter: {
                      type: "array",
                      items: {
                        type: "string",
                        enum: ["pending", "in_progress", "fixed", "deployed", "verified", "wont_fix"]
                      },
                      description: "Filter by status (optional)"
                    },
                    severity_filter: {
                      type: "array",
                      items: {
                        type: "string",
                        enum: ["critical", "high", "medium", "low"]
                      },
                      description: "Filter by severity (optional)"
                    },
                    component_filter: {
                      type: "string",
                      description: "Filter by component (optional)"
                    },
                    limit: {
                      type: "number",
                      description: "Maximum number of results (default 20)"
                    },
                    order_by: {
                      type: "string",
                      enum: ["priority", "created_at", "updated_at"],
                      description: "Sort order (default: priority)"
                    }
                  }
                }
              },
              {
                name: "update_feedback_status",
                description: "Update status and progress of feedback items (for Claude Dev)",
                inputSchema: {
                  type: "object",
                  properties: {
                    feedback_id: {
                      type: "string",
                      description: "UUID of feedback item to update"
                    },
                    status: {
                      type: "string",
                      enum: ["pending", "in_progress", "fixed", "deployed", "verified", "wont_fix"],
                      description: "New status"
                    },
                    fix_description: {
                      type: "string",
                      description: "Description of what was changed/fixed"
                    },
                    commit_hash: {
                      type: "string",
                      description: "Git commit reference for the fix"
                    },
                    verification_status: {
                      type: "string",
                      enum: ["pending_test", "passed", "failed"],
                      description: "Test verification status"
                    },
                    claude_dev_notes: {
                      type: "string",
                      description: "Additional notes from Claude Dev"
                    }
                  },
                  required: ["feedback_id"]
                }
              }
            ]
          }
        });

      case "tools/call":
        const { name, arguments: args } = params;

        switch (name) {
          case "submit_feedback":
            return await handleSubmitFeedback(args, id);

          case "get_feedback_status":
            return await handleGetFeedbackStatus(args, id);

          case "update_feedback_status":
            return await handleUpdateFeedbackStatus(args, id);

          default:
            return Response.json({
              jsonrpc: "2.0",
              id,
              error: {
                code: -32601,
                message: `Unknown tool: ${name}`
              }
            });
        }

      default:
        return Response.json({
          jsonrpc: "2.0",
          id,
          error: {
            code: -32601,
            message: `Unknown method: ${method}`
          }
        });
    }

  } catch (error: any) {
    return Response.json({
      jsonrpc: "2.0",
      id,
      error: {
        code: -32000,
        message: error.message
      }
    }, { status: 500 });
  }
}

async function handleSubmitFeedback(args: any, id: any) {
  const startTime = Date.now();

  try {
    const { sql } = await import('@vercel/postgres');
    const {
      feedback_type,
      component,
      severity,
      current_behavior,
      expected_behavior,
      suggested_fix,
      test_query,
      metrics,
      related_feedback_id
    } = args;

    // Calculate priority score
    const performanceImpact = metrics?.current_performance_ms;
    const priorityScore = calculatePriorityScore(severity, feedback_type, performanceImpact);

    // Insert feedback into database
    const result = await sql`
      INSERT INTO feedback_items (
        feedback_type, component, severity, current_behavior, expected_behavior,
        suggested_fix, test_query, current_performance_ms, target_performance_ms,
        confidence_score, additional_metrics, priority_score, related_feedback_id
      ) VALUES (
        ${feedback_type}, ${component}, ${severity}, ${current_behavior}, ${expected_behavior},
        ${suggested_fix}, ${test_query}, ${metrics?.current_performance_ms}, ${metrics?.target_performance_ms},
        ${metrics?.confidence_score}, ${JSON.stringify(metrics?.additional_data || {})},
        ${priorityScore}, ${related_feedback_id}
      )
      RETURNING id, created_at, priority_score
    `;

    const feedbackItem = result.rows[0];
    const responseTime = Date.now() - startTime;

    console.log(`🔔 NEW ${severity.toUpperCase()} FEEDBACK: ${component} - ${feedback_type} (ID: ${feedbackItem.id})`);

    return Response.json({
      jsonrpc: "2.0",
      id,
      result: {
        content: [
          {
            type: "text",
            text: `✅ **FEEDBACK SUBMITTED SUCCESSFULLY**

**Feedback ID**: ${feedbackItem.id}
**Type**: ${feedback_type}
**Component**: ${component}
**Severity**: ${severity.toUpperCase()}
**Priority Score**: ${priorityScore}/100

**Issue**: ${current_behavior}
**Expected**: ${expected_behavior}
${suggested_fix ? `**Suggested Fix**: ${suggested_fix}` : ''}
${test_query ? `**Test Query**: "${test_query}"` : ''}

**Metrics**:
${metrics?.current_performance_ms ? `• Current Performance: ${metrics.current_performance_ms}ms` : ''}
${metrics?.target_performance_ms ? `• Target Performance: ${metrics.target_performance_ms}ms` : ''}
${metrics?.confidence_score ? `• Confidence Score: ${metrics.confidence_score}` : ''}

**Status**: PENDING (assigned to claude-dev)
**Submitted**: ${feedbackItem.created_at}
**Response Time**: ${responseTime}ms

🚀 **This feedback will be automatically picked up by Claude Dev for analysis and implementation!**`
          }
        ]
      }
    });

  } catch (error: any) {
    console.error('Submit feedback error:', error);
    return Response.json({
      jsonrpc: "2.0",
      id,
      error: {
        code: -32000,
        message: `Failed to submit feedback: ${error.message}`
      }
    });
  }
}

async function handleGetFeedbackStatus(args: any, id: any) {
  const startTime = Date.now();

  try {
    const { sql } = await import('@vercel/postgres');
    const {
      feedback_id,
      status_filter,
      severity_filter,
      component_filter,
      limit = 20,
      order_by = 'priority'
    } = args;

    let queryText = `
      SELECT id, created_at, updated_at, feedback_type, component, severity, status,
             current_behavior, expected_behavior, suggested_fix, test_query,
             current_performance_ms, target_performance_ms, confidence_score,
             priority_score, fix_description, fix_deployed_at, verification_status,
             claude_frontend_notes, commit_hash
      FROM feedback_items
    `;

    const conditions = [];
    const params = [];
    let paramIndex = 0;

    if (feedback_id) {
      conditions.push(`id = $${++paramIndex}`);
      params.push(feedback_id);
    }

    if (status_filter && status_filter.length > 0) {
      conditions.push(`status = ANY($${++paramIndex})`);
      params.push(status_filter);
    }

    if (severity_filter && severity_filter.length > 0) {
      conditions.push(`severity = ANY($${++paramIndex})`);
      params.push(severity_filter);
    }

    if (component_filter) {
      conditions.push(`component ILIKE $${++paramIndex}`);
      params.push(`%${component_filter}%`);
    }

    if (conditions.length > 0) {
      queryText += ` WHERE ${conditions.join(' AND ')}`;
    }

    // Add ordering
    const orderMap = {
      'priority': 'priority_score DESC, created_at DESC',
      'created_at': 'created_at DESC',
      'updated_at': 'updated_at DESC'
    };
    queryText += ` ORDER BY ${orderMap[order_by] || orderMap.priority}`;
    queryText += ` LIMIT $${++paramIndex}`;
    params.push(limit);

    const result = await sql.query(queryText, params);
    const responseTime = Date.now() - startTime;

    // Format results for display
    let output = `📊 **FEEDBACK STATUS REPORT**\n`;
    output += `${"=".repeat(50)}\n\n`;
    output += `**Found ${result.rows.length} feedback items**\n`;
    output += `**Query Time**: ${responseTime}ms\n\n`;

    if (result.rows.length === 0) {
      output += `No feedback items match your criteria.`;
    } else {
      for (const item of result.rows) {
        const statusIcon = {
          'pending': '⏳',
          'in_progress': '🔄',
          'fixed': '✅',
          'deployed': '🚀',
          'verified': '✅',
          'wont_fix': '❌'
        }[item.status] || '❓';

        const severityIcon = {
          'critical': '🔴',
          'high': '🟡',
          'medium': '🟢',
          'low': '🔵'
        }[item.severity] || '⚪';

        output += `${statusIcon} **${item.feedback_type.toUpperCase()}** - ${item.component}\n`;
        output += `   ID: \`${item.id}\`\n`;
        output += `   ${severityIcon} Severity: ${item.severity} | Priority: ${item.priority_score}/100\n`;
        output += `   Status: ${item.status.toUpperCase()}\n`;
        output += `   Issue: ${item.current_behavior.substring(0, 100)}${item.current_behavior.length > 100 ? '...' : ''}\n`;

        if (item.fix_description) {
          output += `   Fix: ${item.fix_description.substring(0, 100)}${item.fix_description.length > 100 ? '...' : ''}\n`;
        }

        if (item.test_query) {
          output += `   Test: "${item.test_query}"\n`;
        }

        output += `   Created: ${new Date(item.created_at).toISOString()}\n`;

        if (item.fix_deployed_at) {
          output += `   Deployed: ${new Date(item.fix_deployed_at).toISOString()}\n`;
        }

        output += `\n`;
      }
    }

    return Response.json({
      jsonrpc: "2.0",
      id,
      result: {
        content: [
          {
            type: "text",
            text: output
          }
        ]
      }
    });

  } catch (error: any) {
    console.error('Get feedback status error:', error);
    return Response.json({
      jsonrpc: "2.0",
      id,
      error: {
        code: -32000,
        message: `Failed to get feedback status: ${error.message}`
      }
    });
  }
}

async function handleUpdateFeedbackStatus(args: any, id: any) {
  const startTime = Date.now();

  try {
    const { sql } = await import('@vercel/postgres');
    const {
      feedback_id,
      status,
      fix_description,
      commit_hash,
      verification_status,
      claude_dev_notes
    } = args;

    // Build update query dynamically
    const updates = ['updated_at = CURRENT_TIMESTAMP'];
    const params = [];
    let paramIndex = 0;

    if (status) {
      updates.push(`status = $${++paramIndex}`);
      params.push(status);

      // If status is deployed, set deployment timestamp
      if (status === 'deployed') {
        updates.push(`fix_deployed_at = CURRENT_TIMESTAMP`);
      }
    }

    if (fix_description) {
      updates.push(`fix_description = $${++paramIndex}`);
      params.push(fix_description);
    }

    if (commit_hash) {
      updates.push(`commit_hash = $${++paramIndex}`);
      params.push(commit_hash);
    }

    if (verification_status) {
      updates.push(`verification_status = $${++paramIndex}`);
      params.push(verification_status);
    }

    if (claude_dev_notes) {
      updates.push(`claude_frontend_notes = COALESCE(claude_frontend_notes, '') || $${++paramIndex}`);
      params.push(`\n[${new Date().toISOString()}] ${claude_dev_notes}`);
    }

    // Add feedback_id as final parameter
    params.push(feedback_id);

    const result = await sql.query(`
      UPDATE feedback_items
      SET ${updates.join(', ')}
      WHERE id = $${++paramIndex}
      RETURNING id, status, fix_description, fix_deployed_at, verification_status
    `, params);

    if (result.rows.length === 0) {
      return Response.json({
        jsonrpc: "2.0",
        id,
        error: {
          code: -32000,
          message: `Feedback item ${feedback_id} not found`
        }
      });
    }

    const updatedItem = result.rows[0];
    const responseTime = Date.now() - startTime;

    console.log(`📝 FEEDBACK UPDATED: ${feedback_id} → ${status || 'status unchanged'}`);

    return Response.json({
      jsonrpc: "2.0",
      id,
      result: {
        content: [
          {
            type: "text",
            text: `✅ **FEEDBACK STATUS UPDATED**

**Feedback ID**: ${feedback_id}
**New Status**: ${updatedItem.status.toUpperCase()}
${fix_description ? `**Fix Description**: ${fix_description}` : ''}
${commit_hash ? `**Commit Hash**: ${commit_hash}` : ''}
${verification_status ? `**Verification**: ${verification_status}` : ''}
${updatedItem.fix_deployed_at ? `**Deployed At**: ${updatedItem.fix_deployed_at}` : ''}

**Update Time**: ${responseTime}ms

${status === 'deployed' ? '🔔 **Claude Frontend will be notified to retest!**' : ''}
${status === 'verified' ? '🎉 **Feedback loop completed successfully!**' : ''}`
          }
        ]
      }
    });

  } catch (error: any) {
    console.error('Update feedback status error:', error);
    return Response.json({
      jsonrpc: "2.0",
      id,
      error: {
        code: -32000,
        message: `Failed to update feedback status: ${error.message}`
      }
    });
  }
}

// GET endpoint for monitoring and stats
export async function GET(request: NextRequest) {
  try {
    await initDatabase();
    const { sql } = await import('@vercel/postgres');

    // Get summary statistics
    const stats = await sql`
      SELECT
        COUNT(*) as total_feedback,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
        COUNT(*) FILTER (WHERE status = 'fixed') as fixed,
        COUNT(*) FILTER (WHERE status = 'deployed') as deployed,
        COUNT(*) FILTER (WHERE status = 'verified') as verified,
        COUNT(*) FILTER (WHERE severity = 'critical') as critical,
        COUNT(*) FILTER (WHERE severity = 'high') as high,
        AVG(priority_score) as avg_priority
      FROM feedback_items
    `;

    const recentFeedback = await sql`
      SELECT id, feedback_type, component, severity, status, created_at
      FROM feedback_items
      ORDER BY created_at DESC
      LIMIT 5
    `;

    return Response.json({
      name: "claude-feedback-loop-mcp",
      version: "1.0.0",
      description: "Revolutionary Claude-to-Claude autonomous feedback system",
      status: "🚀 FEEDBACK LOOP ACTIVE",
      statistics: stats.rows[0],
      recent_feedback: recentFeedback.rows,
      tools: ["submit_feedback", "get_feedback_status", "update_feedback_status"],
      database_initialized: dbInitialized
    });

  } catch (error: any) {
    return Response.json({
      error: error.message,
      database_initialized: dbInitialized
    }, { status: 500 });
  }
}