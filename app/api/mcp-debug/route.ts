import { NextRequest } from "next/server";
import { z } from "zod";

// DEBUG VERSION OF MCP ENDPOINT - FULL LOGGING FOR CLAUDE DESKTOP
// This endpoint provides complete visibility into the NLP → SQL → MCP execution flow
// Use this for testing/debugging, switch to /api/mcp for production

const DEBUG_MODE = process.env.ENABLE_DEBUG_MODE !== 'false'; // Default to true

export async function POST(request: NextRequest) {
  const body = await request.json();

  // Handle MCP protocol messages
  if (body.jsonrpc === "2.0") {
    return handleMCPMessage(body);
  }

  // Handle direct API calls
  return Response.json({
    error: "This is MCP-only endpoint. Use JSON-RPC 2.0 format"
  }, { status: 400 });
}

async function handleMCPMessage(message: any) {
  try {
    const { method, params, id } = message;

    switch (method) {
      case "tools/list":
        return Response.json({
          jsonrpc: "2.0",
          id,
          result: {
            tools: [
              {
                name: "execute_query",
                description: "Execute any natural language query with FULL DEBUG LOGGING. Shows NLP parsing, SQL queries, server selection, and execution details.",
                inputSchema: {
                  type: "object",
                  properties: {
                    query: {
                      type: "string",
                      description: "Natural language query (e.g., 'weather in Tokyo', 'Bitcoin price', 'translate hello to Spanish')"
                    },
                    context: {
                      type: "object",
                      description: "Optional context for multi-step conversations",
                      properties: {
                        location: { type: "string" },
                        previousQuery: { type: "string" },
                        sessionId: { type: "string" }
                      }
                    },
                    debugLevel: {
                      type: "string",
                      enum: ["minimal", "normal", "verbose"],
                      description: "Level of debug detail (default: verbose for testing)"
                    }
                  },
                  required: ["query"]
                }
              },
            ],
          },
        });

      case "tools/call":
        const { name, arguments: args } = params;

        if (name === "execute_query") {
          const queryResult = await handleExecuteQueryWithDebug(args);
          return Response.json({
            jsonrpc: "2.0",
            id,
            result: {
              content: [
                {
                  type: "text",
                  text: queryResult,
                },
              ],
            },
          });
        }

        return Response.json({
          jsonrpc: "2.0",
          id,
          error: {
            code: -32601,
            message: `Unknown tool: ${name}`,
          },
        });

      default:
        return Response.json({
          jsonrpc: "2.0",
          id,
          error: {
            code: -32601,
            message: `Unknown method: ${method}`,
          },
        });
    }
  } catch (error: any) {
    return Response.json(
      {
        jsonrpc: "2.0",
        id: message.id,
        error: {
          code: -32000,
          message: error.message,
        },
      },
      { status: 500 }
    );
  }
}

// Main handler with comprehensive debugging
async function handleExecuteQueryWithDebug(args: any): Promise<string> {
  const { query, context = {}, debugLevel = "verbose" } = args;
  const sessionId = context.sessionId || `debug-${Date.now()}`;

  const debugLog: any = {
    timestamp: new Date().toISOString(),
    sessionId,
    query,
    context,
    debugLevel,
    steps: []
  };

  try {
    // STEP 1: Call execute-nlp which orchestrates everything
    const execStartTime = Date.now();

    debugLog.steps.push({
      step: 1,
      name: "EXECUTE_NLP_ORCHESTRATION",
      startTime: new Date().toISOString(),
      description: "Calling execute-nlp endpoint for complete query processing",
      request: {
        query,
        sessionId,
        context,
        enableDebug: true // Request debug info from execute-nlp
      }
    });

    // Use the actual deployed URL directly to avoid environment variable issues
    const baseUrl = 'https://mcp-store-server.vercel.app';

    const executeResponse = await fetch(`${baseUrl}/api/execute-nlp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Debug-Mode': 'true' // Signal we want debug info
      },
      body: JSON.stringify({
        query,
        sessionId,
        context,
        returnDebugInfo: true
      })
    });

    const executeResult = await executeResponse.json();
    const execTime = Date.now() - execStartTime;

    debugLog.steps[0].response = executeResult;
    debugLog.steps[0].duration = `${execTime}ms`;

    // Extract detailed information from the response
    if (executeResult.success) {
      // Parse the internal steps from execute-nlp
      debugLog.steps.push({
        step: 2,
        name: "NLP_PARSING_DETAILS",
        description: "Natural language understanding phase",
        details: {
          intent: executeResult.parsed?.intent,
          confidence: executeResult.parsed?.confidence,
          entities: executeResult.parsed?.entities,
          capabilities: executeResult.parsed?.capabilities,
          category: executeResult.parsed?.category,
          strategy: executeResult.parsed?.strategy,
          normalizedQuery: executeResult.parsed?.normalizedQuery
        },
        duration: executeResult.metadata?.parseTime
      });

      debugLog.steps.push({
        step: 3,
        name: "ROUTING_DETAILS",
        description: "MCP server selection and routing",
        details: {
          selectedServer: executeResult.metadata?.server,
          selectedTool: executeResult.metadata?.tool,
          confidence: executeResult.metadata?.confidence,
          strategy: executeResult.metadata?.strategy,
          executionType: executeResult.parsed?.strategy?.type
        },
        duration: executeResult.metadata?.routeTime
      });

      // If we have routing debug info (from ai-execute-v3)
      if (executeResult.metadata?.serverCandidates) {
        debugLog.steps.push({
          step: 4,
          name: "SERVER_CANDIDATES_EVALUATION",
          description: "Server selection and ranking",
          serverCandidates: executeResult.metadata.serverCandidates,
          scoringDetails: executeResult.metadata.scoringDetails,
          queryStrategy: executeResult.metadata.queryStrategy,
          serversEvaluated: executeResult.metadata.serversEvaluated
        });
      }

      debugLog.steps.push({
        step: 5,
        name: "EXECUTION_RESULT",
        description: "Final execution on selected MCP server",
        result: executeResult.result,
        metadata: {
          totalTime: executeResult.metadata?.totalTime,
          cached: executeResult.metadata?.cached,
          engine: executeResult.metadata?.engine
        }
      });
    }

    // Create comprehensive summary
    debugLog.summary = {
      success: executeResult.success,
      totalDuration: `${execTime}ms`,
      pipeline: {
        nlpParsing: executeResult.metadata?.parseTime || "N/A",
        serverRouting: executeResult.metadata?.routeTime || "N/A",
        totalExecution: executeResult.metadata?.totalTime || `${execTime}ms`
      },
      finalOutcome: {
        intent: executeResult.parsed?.intent,
        server: executeResult.metadata?.server || "Mock",
        tool: executeResult.metadata?.tool || "mock_tool",
        confidence: executeResult.metadata?.confidence || 0,
        result: executeResult.result
      }
    };

    // Format output based on debug level
    return formatDebugOutput(query, executeResult, debugLog, debugLevel);

  } catch (error: any) {
    debugLog.error = {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    };

    return formatDebugError(query, error, debugLog);
  }
}

// Format debug output for Claude Desktop
function formatDebugOutput(query: string, result: any, debugLog: any, debugLevel: string): string {
  let output = "";

  if (debugLevel === "minimal") {
    // Minimal - just the result
    output = `✅ **Query**: ${query}\n\n`;
    output += formatResultData(result.result);
    output += `\n\n⚡ **Performance**: ${debugLog.summary.totalDuration}`;
    output += `\n🎯 **Server**: ${result.metadata?.server || "Mock"}`;
    return output;
  }

  // Normal and Verbose modes show full pipeline
  output = `🔍 **DEBUG MODE - FULL EXECUTION TRACE**\n`;
  output += `${"=".repeat(50)}\n\n`;

  output += `📝 **Query**: "${query}"\n`;
  output += `🆔 **Session**: ${debugLog.sessionId}\n`;
  output += `⏰ **Timestamp**: ${debugLog.timestamp}\n\n`;

  // Step-by-step execution
  output += `📊 **EXECUTION PIPELINE**\n`;
  output += `${"─".repeat(30)}\n\n`;

  for (const step of debugLog.steps) {
    output += `**Step ${step.step}: ${step.name}**\n`;
    if (step.description) {
      output += `📋 ${step.description}\n`;
    }

    if (debugLevel === "verbose") {
      // Show all details in verbose mode
      if (step.details) {
        output += `\nDetails:\n`;
        output += "```json\n";
        output += JSON.stringify(step.details, null, 2);
        output += "\n```\n";
      }

      if (step.queries) {
        output += `\nSQL Queries:\n`;
        output += "```sql\n";
        output += JSON.stringify(step.queries, null, 2);
        output += "\n```\n";
      }
    } else {
      // Normal mode - show key details only
      if (step.details?.intent) {
        output += `  • Intent: ${step.details.intent} (${Math.round(step.details.confidence * 100)}%)\n`;
      }
      if (step.details?.selectedServer) {
        output += `  • Server: ${step.details.selectedServer}\n`;
        output += `  • Tool: ${step.details.selectedTool}\n`;
      }
    }

    if (step.duration) {
      output += `  ⏱️ Duration: ${step.duration}\n`;
    }
    output += "\n";
  }

  // Final Result
  output += `📤 **FINAL RESULT**\n`;
  output += `${"─".repeat(30)}\n`;
  output += formatResultData(result.result);

  // Performance Summary
  output += `\n\n⚡ **PERFORMANCE SUMMARY**\n`;
  output += `${"─".repeat(30)}\n`;
  output += `• Total Time: ${debugLog.summary.totalDuration}\n`;
  output += `• NLP Parsing: ${debugLog.summary.pipeline.nlpParsing}\n`;
  output += `• Server Routing: ${debugLog.summary.pipeline.serverRouting}\n`;
  output += `• Execution: ${debugLog.summary.pipeline.totalExecution}\n`;

  // Final Outcome
  output += `\n🎯 **OUTCOME**\n`;
  output += `• Intent: ${debugLog.summary.finalOutcome.intent}\n`;
  output += `• Server: ${debugLog.summary.finalOutcome.server}\n`;
  output += `• Tool: ${debugLog.summary.finalOutcome.tool}\n`;
  output += `• Confidence: ${Math.round((debugLog.summary.finalOutcome.confidence || 0) * 100)}%\n`;

  if (debugLevel === "verbose") {
    output += `\n\n📦 **COMPLETE DEBUG LOG**\n`;
    output += "```json\n";
    output += JSON.stringify(debugLog, null, 2);
    output += "\n```\n";
  }

  return output;
}

// Format result data based on type
function formatResultData(data: any): string {
  if (!data) return "No result data";

  let output = "";

  if (data.temperature) {
    // Weather result
    output += `🌤️ **Weather in ${data.location}**\n`;
    output += `• Temperature: ${data.temperature}\n`;
    output += `• Condition: ${data.condition}\n`;
    output += `• Humidity: ${data.humidity}\n`;
  } else if (data.price) {
    // Crypto/Stock result
    output += `💰 **${data.symbol} Price**\n`;
    output += `• Current: ${data.price}\n`;
    output += `• Change: ${data.change_24h || data.change}\n`;
    if (data.volume_24h || data.volume) {
      output += `• Volume: ${data.volume_24h || data.volume}\n`;
    }
  } else if (data.type === 'options') {
    // Options result
    output += `🔍 **${data.message}**\n`;
    if (data.options && data.options.length > 0) {
      output += `\nAvailable options:\n`;
      data.options.forEach((option: any, i: number) => {
        output += `${i + 1}. **${option.name}** - ${option.description}\n`;
      });
    }
  } else if (data.results) {
    // Search results
    output += `🔍 **Search Results**\n`;
    data.results.forEach((result: any, i: number) => {
      output += `${i + 1}. ${result.title}\n`;
      output += `   ${result.url}\n`;
      output += `   ${result.snippet}\n`;
    });
  } else {
    // Generic result
    output += "```json\n";
    output += JSON.stringify(data, null, 2);
    output += "\n```";
  }

  return output;
}

// Format error with debug info
function formatDebugError(query: string, error: any, debugLog: any): string {
  let output = `❌ **EXECUTION FAILED**\n\n`;
  output += `**Query**: "${query}"\n`;
  output += `**Error**: ${error.message}\n\n`;

  output += `**Debug Trace**:\n`;
  for (const step of debugLog.steps || []) {
    output += `• Step ${step.step}: ${step.name}`;
    if (step.duration) {
      output += ` (${step.duration})`;
    }
    output += "\n";
  }

  output += `\n**Stack Trace**:\n`;
  output += "```\n";
  output += error.stack || "No stack trace available";
  output += "\n```";

  return output;
}

export async function GET(request: NextRequest) {
  return Response.json({
    name: "mcp-debug-server",
    version: "1.0.0",
    description: "Debug-enabled MCP server for testing with full logging",
    debugMode: DEBUG_MODE,
    capabilities: ["execute_query with full debug logging"],
    note: "Use this endpoint for testing. Switch to /api/mcp for production."
  });
}