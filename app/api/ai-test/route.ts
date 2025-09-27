import { NextRequest } from "next/server";

// AI Model Testing Ground - Stress test routing system with realistic AI queries
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { testType = 'basic', iterations = 10, parallel = false } = body;

    const startTime = Date.now();

    // Test scenarios that simulate real AI agent queries
    const testScenarios = getTestScenarios(testType);

    let results;
    if (parallel) {
      // Parallel execution - stress test
      results = await runParallelTests(testScenarios, iterations);
    } else {
      // Sequential execution - accuracy test
      results = await runSequentialTests(testScenarios, iterations);
    }

    const totalTime = Date.now() - startTime;

    // Analyze results
    const analysis = analyzeResults(results, totalTime);

    return Response.json({
      success: true,
      summary: analysis.summary,
      performance: analysis.performance,
      accuracy: analysis.accuracy,
      errors: analysis.errors,
      details: analysis.details,
      recommendations: generateRecommendations(analysis)
    });

  } catch (error: any) {
    console.error('Test error:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

// Define test scenarios
function getTestScenarios(testType: string) {
  const scenarios = {
    basic: [
      {
        name: 'Bitcoin Price Query',
        query: { intent: 'cryptocurrency_price_query', query: 'bitcoin', capabilities: ['crypto', 'price'], category: 'Finance' },
        expected: { serverPattern: /alpha|ccxt|crypto/i, toolPattern: /crypto|exchange|rate/i }
      },
      {
        name: 'Web Search',
        query: { intent: 'web_search', query: 'climate change', capabilities: ['search', 'web'], category: 'Data Collection' },
        expected: { serverPattern: /search|duck|google/i, toolPattern: /search|query/i }
      },
      {
        name: 'Weather Query',
        query: { intent: 'weather_query', query: 'New York', capabilities: ['weather', 'forecast'], category: 'API Tools' },
        expected: { serverPattern: /weather|forecast/i, toolPattern: /weather|temperature/i }
      }
    ],
    edge_cases: [
      {
        name: 'Typo Query',
        query: { intent: 'cryptocurrency_price_query', query: 'bitcon', capabilities: ['cryto'], category: 'Finnce' },
        expected: { serverPattern: /alpha|ccxt|crypto/i, shouldMatch: true }
      },
      {
        name: 'Vague Query',
        query: { intent: '', query: 'btc', capabilities: [], category: '' },
        expected: { serverPattern: /crypto|bitcoin/i, shouldMatch: true }
      },
      {
        name: 'Complex Intent',
        query: { intent: 'multi_step_analysis', query: 'analyze bitcoin trends and predict price', capabilities: ['analysis', 'prediction'], category: 'AI/ML' },
        expected: { serverPattern: /./i, shouldMatch: true }
      }
    ],
    stress: [
      ...Array(20).fill(null).map((_, i) => ({
        name: `Random Query ${i}`,
        query: generateRandomQuery(),
        expected: { shouldRespond: true }
      }))
    ]
  };

  return scenarios[testType] || scenarios.basic;
}

// Run tests in parallel
async function runParallelTests(scenarios: any[], iterations: number) {
  const results = [];

  for (let i = 0; i < iterations; i++) {
    const iterationPromises = scenarios.map(async (scenario) => {
      const startTime = Date.now();

      try {
        // Test both V1 and V2
        const [v1Response, v2Response] = await Promise.all([
          fetch('http://localhost:3005/api/ai-execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(scenario.query)
          }),
          fetch('http://localhost:3005/api/ai-execute-v2', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(scenario.query)
          })
        ]);

        const [v1Data, v2Data] = await Promise.all([
          v1Response.json(),
          v2Response.json()
        ]);

        const responseTime = Date.now() - startTime;

        return {
          iteration: i,
          scenario: scenario.name,
          v1: {
            success: v1Data.success,
            server: v1Data.metadata?.server,
            tool: v1Data.metadata?.tool,
            time: v1Data.metadata?.totalTime,
            cached: v1Data.metadata?.cached
          },
          v2: {
            success: v2Data.success,
            server: v2Data.metadata?.server,
            tool: v2Data.metadata?.tool,
            time: v2Data.metadata?.totalTime,
            cached: v2Data.metadata?.cached,
            confidence: v2Data.metadata?.confidence,
            alternatives: v2Data.metadata?.alternatives?.length
          },
          responseTime,
          matched: validateExpectation(scenario, v2Data)
        };
      } catch (error: any) {
        return {
          iteration: i,
          scenario: scenario.name,
          error: error.message,
          responseTime: Date.now() - startTime
        };
      }
    });

    const iterationResults = await Promise.all(iterationPromises);
    results.push(...iterationResults);
  }

  return results;
}

// Run tests sequentially
async function runSequentialTests(scenarios: any[], iterations: number) {
  const results = [];

  for (let i = 0; i < iterations; i++) {
    for (const scenario of scenarios) {
      const startTime = Date.now();

      try {
        // Test V1
        const v1Start = Date.now();
        const v1Response = await fetch('http://localhost:3005/api/ai-execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(scenario.query)
        });
        const v1Data = await v1Response.json();
        const v1Time = Date.now() - v1Start;

        // Test V2
        const v2Start = Date.now();
        const v2Response = await fetch('http://localhost:3005/api/ai-execute-v2', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(scenario.query)
        });
        const v2Data = await v2Response.json();
        const v2Time = Date.now() - v2Start;

        results.push({
          iteration: i,
          scenario: scenario.name,
          v1: {
            success: v1Data.success,
            server: v1Data.metadata?.server,
            tool: v1Data.metadata?.tool,
            time: v1Time,
            totalTime: v1Data.metadata?.totalTime
          },
          v2: {
            success: v2Data.success,
            server: v2Data.metadata?.server,
            tool: v2Data.metadata?.tool,
            time: v2Time,
            totalTime: v2Data.metadata?.totalTime,
            cached: v2Data.metadata?.cached,
            confidence: v2Data.metadata?.confidence,
            alternatives: v2Data.metadata?.alternatives?.length
          },
          responseTime: Date.now() - startTime,
          matched: validateExpectation(scenario, v2Data)
        });
      } catch (error: any) {
        results.push({
          iteration: i,
          scenario: scenario.name,
          error: error.message,
          responseTime: Date.now() - startTime
        });
      }
    }
  }

  return results;
}

// Validate if response matches expectations
function validateExpectation(scenario: any, response: any) {
  if (!scenario.expected) return true;

  const server = response.metadata?.server || '';
  const tool = response.metadata?.tool || '';

  let matches = true;

  if (scenario.expected.serverPattern) {
    matches = matches && scenario.expected.serverPattern.test(server);
  }

  if (scenario.expected.toolPattern) {
    matches = matches && scenario.expected.toolPattern.test(tool);
  }

  if (scenario.expected.shouldMatch !== undefined) {
    matches = response.success === scenario.expected.shouldMatch;
  }

  return matches;
}

// Analyze test results
function analyzeResults(results: any[], totalTime: number) {
  const successfulV1 = results.filter(r => r.v1?.success).length;
  const successfulV2 = results.filter(r => r.v2?.success).length;
  const errors = results.filter(r => r.error).length;
  const matched = results.filter(r => r.matched).length;

  const v1Times = results.filter(r => r.v1?.time).map(r => parseInt(r.v1.time));
  const v2Times = results.filter(r => r.v2?.time).map(r => parseInt(r.v2.time));

  const v1Avg = v1Times.length > 0 ? v1Times.reduce((a, b) => a + b, 0) / v1Times.length : 0;
  const v2Avg = v2Times.length > 0 ? v2Times.reduce((a, b) => a + b, 0) / v2Times.length : 0;

  const v1Max = Math.max(...v1Times, 0);
  const v2Max = Math.max(...v2Times, 0);

  const v1Min = Math.min(...v1Times, Infinity);
  const v2Min = Math.min(...v2Times, Infinity);

  const cachedCount = results.filter(r => r.v2?.cached).length;
  const avgConfidence = results
    .filter(r => r.v2?.confidence)
    .reduce((sum, r) => sum + r.v2.confidence, 0) / results.filter(r => r.v2?.confidence).length || 0;

  return {
    summary: {
      totalTests: results.length,
      successfulV1,
      successfulV2,
      errors,
      matched,
      matchRate: results.length > 0 ? (matched / results.length * 100).toFixed(1) + '%' : '0%'
    },
    performance: {
      totalTime: `${totalTime}ms`,
      v1: {
        avg: `${v1Avg.toFixed(0)}ms`,
        min: `${v1Min === Infinity ? 0 : v1Min}ms`,
        max: `${v1Max}ms`,
        successRate: `${(successfulV1 / results.length * 100).toFixed(1)}%`
      },
      v2: {
        avg: `${v2Avg.toFixed(0)}ms`,
        min: `${v2Min === Infinity ? 0 : v2Min}ms`,
        max: `${v2Max}ms`,
        successRate: `${(successfulV2 / results.length * 100).toFixed(1)}%`,
        cachedHits: cachedCount,
        cacheRate: `${(cachedCount / results.length * 100).toFixed(1)}%`
      },
      improvement: v1Avg > 0 ? `${((v2Avg - v1Avg) / v1Avg * 100).toFixed(1)}%` : 'N/A'
    },
    accuracy: {
      avgConfidence: avgConfidence.toFixed(2),
      withAlternatives: results.filter(r => r.v2?.alternatives > 0).length,
      topServers: getTopServers(results)
    },
    errors: results.filter(r => r.error).map(r => ({
      scenario: r.scenario,
      error: r.error
    })),
    details: results
  };
}

// Get most frequently matched servers
function getTopServers(results: any[]) {
  const serverCounts: Record<string, number> = {};

  results.forEach(r => {
    if (r.v2?.server) {
      serverCounts[r.v2.server] = (serverCounts[r.v2.server] || 0) + 1;
    }
  });

  return Object.entries(serverCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([server, count]) => ({ server, count }));
}

// Generate recommendations based on analysis
function generateRecommendations(analysis: any) {
  const recommendations = [];

  // Performance recommendations
  if (parseFloat(analysis.performance.v2.avg) > 100) {
    recommendations.push('⚠️ V2 average response time exceeds 100ms target - consider query optimization');
  } else {
    recommendations.push('✅ V2 response times are within target range');
  }

  if (parseFloat(analysis.performance.v2.cacheRate) < 20 && analysis.summary.totalTests > 10) {
    recommendations.push('💡 Low cache hit rate - consider increasing cache TTL or optimizing cache keys');
  }

  // Accuracy recommendations
  if (parseFloat(analysis.accuracy.avgConfidence) < 0.5) {
    recommendations.push('⚠️ Low average confidence scores - review scoring algorithm');
  }

  if (parseFloat(analysis.summary.matchRate) < 80) {
    recommendations.push('🔍 Low match rate - expand semantic mappings and intent patterns');
  }

  // Compare V1 vs V2
  if (analysis.performance.improvement && parseFloat(analysis.performance.improvement) > 0) {
    recommendations.push('⚠️ V2 is slower than V1 - investigate performance bottlenecks');
  } else {
    recommendations.push('✅ V2 performs better than or equal to V1');
  }

  if (analysis.errors.length > 0) {
    recommendations.push(`❌ ${analysis.errors.length} errors detected - review error scenarios`);
  }

  return recommendations;
}

// Generate random query for stress testing
function generateRandomQuery() {
  const intents = ['cryptocurrency_price_query', 'web_search', 'weather_query', 'stock_price', 'news_query'];
  const queries = ['bitcoin', 'weather', 'apple stock', 'news today', 'ethereum', 'google', 'temperature'];
  const capabilities = ['crypto', 'search', 'weather', 'price', 'news', 'data'];
  const categories = ['Finance', 'Data Collection', 'API Tools', 'AI/ML'];

  return {
    intent: intents[Math.floor(Math.random() * intents.length)],
    query: queries[Math.floor(Math.random() * queries.length)],
    capabilities: [capabilities[Math.floor(Math.random() * capabilities.length)]],
    category: categories[Math.floor(Math.random() * categories.length)]
  };
}

// GET endpoint for testing UI
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const testType = searchParams.get('testType') || 'basic';
  const iterations = parseInt(searchParams.get('iterations') || '10');
  const parallel = searchParams.get('parallel') === 'true';

  return POST(new NextRequest(request.url, {
    method: 'POST',
    body: JSON.stringify({ testType, iterations, parallel }),
    headers: { 'Content-Type': 'application/json' }
  }));
}