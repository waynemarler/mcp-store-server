import { NextRequest } from "next/server";

// ULTRA-FAST DEBUG VERSION - Should show <50ms routing times!
// This debug endpoint uses the ultra-fast routing architecture

export async function POST(request: NextRequest) {
  const body = await request.json();

  // Handle MCP protocol messages
  if (body.jsonrpc === "2.0") {
    return handleMCPMessage(body);
  }

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
                description: "Execute queries with ULTRA-FAST routing (<50ms target). Shows pre-computed mappings, cache hits, and performance stats.",
                inputSchema: {
                  type: "object",
                  properties: {
                    query: {
                      type: "string",
                      description: "Natural language query (e.g., 'bitcoin price', 'weather in Tokyo')"
                    },
                    context: {
                      type: "object",
                      description: "Optional context",
                      properties: {
                        sessionId: { type: "string" }
                      }
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
          const queryResult = await handleUltraFastQuery(args);
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

async function handleUltraFastQuery(args: any): Promise<string> {
  const { query, context = {} } = args;
  const sessionId = context.sessionId || `ultra-${Date.now()}`;

  const debugLog: any = {
    timestamp: new Date().toISOString(),
    sessionId,
    query,
    mode: "ULTRA-FAST",
    steps: []
  };

  try {
    const totalStartTime = Date.now();

    // STEP 1: NLP Parsing (should be ~1ms)
    const parseStartTime = Date.now();
    debugLog.steps.push({
      step: 1,
      name: "NLP_PARSING",
      startTime: new Date().toISOString(),
      description: "Ultra-fast intent classification"
    });

    const baseUrl = 'https://mcp-store-server.vercel.app';
    const parseResponse = await fetch(`${baseUrl}/api/parse-nlp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, sessionId, context })
    });

    const parseResult = await parseResponse.json();
    const parseTime = Date.now() - parseStartTime;

    debugLog.steps[0].result = parseResult;
    debugLog.steps[0].duration = `${parseTime}ms`;

    // STEP 2: ULTRA-FAST Routing (should be <50ms)
    const routeStartTime = Date.now();
    debugLog.steps.push({
      step: 2,
      name: "ULTRA_FAST_ROUTING",
      startTime: new Date().toISOString(),
      description: "Pre-computed + cached routing (target: <50ms)"
    });

    const routeResponse = await fetch(`${baseUrl}/api/ai-execute-ultra`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intent: parseResult.parsed?.intent,
        query: query,
        capabilities: parseResult.parsed?.capabilities,
        category: parseResult.parsed?.category,
        params: parseResult.parsed?.entities
      })
    });

    const routeResult = await routeResponse.json();
    const routeTime = Date.now() - routeStartTime;

    debugLog.steps[1].result = routeResult;
    debugLog.steps[1].duration = `${routeTime}ms`;

    // STEP 3: Performance Analysis
    const totalTime = Date.now() - totalStartTime;
    debugLog.steps.push({
      step: 3,
      name: "PERFORMANCE_ANALYSIS",
      duration: `${totalTime}ms`,
      breakdown: {
        nlpParsing: `${parseTime}ms`,
        ultraFastRouting: `${routeTime}ms`,
        totalTime: `${totalTime}ms`
      },
      performance: {
        targetMet: totalTime < 100,
        speedImprovement: `${Math.round(1228 / totalTime)}x faster than old system`,
        cacheUsed: routeResult.metadata?.cached || false,
        preComputedUsed: routeResult.metadata?.preComputed || false
      }
    });

    debugLog.summary = {
      success: routeResult.success,
      totalDuration: `${totalTime}ms`,
      performanceTarget: totalTime < 100 ? "✅ TARGET MET" : "❌ TARGET MISSED",
      routingStrategy: routeResult.metadata?.strategy,
      confidence: routeResult.metadata?.confidence,
      serverSelected: routeResult.metadata?.server
    };

    return formatUltraFastDebugOutput(query, routeResult, debugLog);

  } catch (error: any) {
    debugLog.error = {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    };

    return formatUltraFastError(query, error, debugLog);
  }
}

function formatUltraFastDebugOutput(query: string, result: any, debugLog: any): string {
  let output = `🚀 **ULTRA-FAST ROUTING DEBUG** 🚀\n`;
  output += `${"=".repeat(50)}\n\n`;

  output += `📝 **Query**: "${query}"\n`;
  output += `⚡ **Mode**: ULTRA-FAST ARCHITECTURE\n`;
  output += `🎯 **Target**: <100ms total time\n\n`;

  // Performance Summary (show this first!)
  const summary = debugLog.summary;
  output += `📊 **PERFORMANCE RESULTS**\n`;
  output += `${"─".repeat(30)}\n`;
  output += `• Total Time: ${summary.totalDuration}\n`;
  output += `• Target Status: ${summary.performanceTarget}\n`;

  if (debugLog.steps[2]?.performance) {
    const perf = debugLog.steps[2].performance;
    output += `• Speed Improvement: ${perf.speedImprovement}\n`;
    output += `• Cache Used: ${perf.cacheUsed ? '✅' : '❌'}\n`;
    output += `• Pre-computed: ${perf.preComputedUsed ? '✅' : '❌'}\n`;
  }

  output += `• Strategy: ${summary.routingStrategy}\n`;
  output += `• Confidence: ${Math.round((summary.confidence || 0) * 100)}%\n\n`;

  // Step by step breakdown
  output += `⏱️ **TIMING BREAKDOWN**\n`;
  output += `${"─".repeat(30)}\n`;
  for (const step of debugLog.steps) {
    output += `**${step.name}**: ${step.duration}\n`;
    if (step.description) {
      output += `  ${step.description}\n`;
    }
  }

  // Server selection details
  if (result.metadata?.serverCandidates) {
    output += `\n🎯 **SERVER SELECTION**\n`;
    output += `${"─".repeat(30)}\n`;
    const candidates = result.metadata.serverCandidates.slice(0, 3);
    candidates.forEach((candidate, idx) => {
      const icon = idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉';
      output += `${icon} **${candidate.name}**\n`;
      output += `   • Confidence: ${Math.round(candidate.confidence * 100)}%\n`;
      output += `   • Reason: ${candidate.reason}\n`;
      output += `   • Source: ${candidate.source}\n\n`;
    });
  }

  // Final result
  output += `📤 **EXECUTION RESULT**\n`;
  output += `${"─".repeat(30)}\n`;
  output += formatResultData(result.result);

  // Architecture explanation
  output += `\n\n🏗️ **ULTRA-FAST ARCHITECTURE**\n`;
  output += `${"─".repeat(30)}\n`;
  output += `1. **Pre-computed Mappings**: Top intents → best servers (1-5ms)\n`;
  output += `2. **Smart Caching**: Recent queries cached for 15min (5-10ms)\n`;
  output += `3. **Optimized Fallback**: Single query vs 3 parallel (20-50ms)\n`;
  output += `4. **Performance Target**: <100ms total time\n\n`;

  output += `🎉 **Result**: ${summary.performanceTarget} 🎉`;

  return output;
}

function formatResultData(data: any): string {
  if (!data) return "No result data";

  if (data.temperature) {
    return `🌤️ **Weather**: ${data.location}\n• Temperature: ${data.temperature}\n• Condition: ${data.condition}`;
  } else if (data.price) {
    return `💰 **${data.symbol}**: ${data.price}\n• Change: ${data.change_24h || data.change}\n• Volume: ${data.volume_24h || data.volume || 'N/A'}`;
  } else if (data.results) {
    return `🔍 **Search Results**: ${data.results.length} results found`;
  } else {
    return `📋 **Result**: ${JSON.stringify(data, null, 2)}`;
  }
}

function formatUltraFastError(query: string, error: any, debugLog: any): string {
  return `❌ **ULTRA-FAST ROUTING ERROR**\n\n**Query**: "${query}"\n**Error**: ${error.message}`;
}

export async function GET(request: NextRequest) {
  return Response.json({
    name: "ultra-fast-debug-server",
    version: "1.0.0",
    description: "Debug endpoint for ultra-fast routing architecture",
    target: "<100ms total time",
    features: ["pre-computed mappings", "smart caching", "optimized fallback"],
    status: "🚀 ULTRA-FAST MODE"
  });
}