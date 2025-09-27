import { NextRequest } from "next/server";

// V3 Testing endpoint - compare all versions
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { iterations = 10, parallel = false } = body;

    const startTime = Date.now();

    // Test scenarios
    const scenarios = [
      {
        name: 'Bitcoin Price',
        query: { intent: 'cryptocurrency_price_query', query: 'bitcoin', capabilities: ['crypto', 'price'], category: 'Finance' }
      },
      {
        name: 'Web Search',
        query: { intent: 'web_search', query: 'climate change', capabilities: ['search', 'web'], category: 'Data Collection' }
      },
      {
        name: 'Weather Query',
        query: { intent: 'weather_query', query: 'New York', capabilities: ['weather', 'forecast'], category: 'API Tools' }
      }
    ];

    let results;
    if (parallel) {
      results = await runParallelComparison(scenarios, iterations);
    } else {
      results = await runSequentialComparison(scenarios, iterations);
    }

    const totalTime = Date.now() - startTime;

    // Analyze results
    const analysis = analyzeV3Results(results, totalTime);

    return Response.json({
      success: true,
      summary: analysis.summary,
      performance: analysis.performance,
      comparison: analysis.comparison,
      recommendations: analysis.recommendations,
      details: results
    });

  } catch (error: any) {
    console.error('V3 test error:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

async function runParallelComparison(scenarios: any[], iterations: number) {
  const results = [];

  for (let i = 0; i < iterations; i++) {
    const iterationPromises = scenarios.map(async (scenario) => {
      const startTime = Date.now();

      try {
        // Test all 3 versions in parallel
        const [v1Response, v2Response, v3Response] = await Promise.all([
          fetch('http://localhost:3005/api/ai-execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(scenario.query)
          }),
          fetch('http://localhost:3005/api/ai-execute-v2', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(scenario.query)
          }),
          fetch('http://localhost:3005/api/ai-execute-v3', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(scenario.query)
          })
        ]);

        const [v1Data, v2Data, v3Data] = await Promise.all([
          v1Response.json(),
          v2Response.json(),
          v3Response.json()
        ]);

        const totalTime = Date.now() - startTime;

        return {
          iteration: i,
          scenario: scenario.name,
          v1: extractMetrics(v1Data),
          v2: extractMetrics(v2Data),
          v3: extractMetrics(v3Data),
          totalTime,
          winner: determineWinner(v1Data, v2Data, v3Data)
        };
      } catch (error: any) {
        return {
          iteration: i,
          scenario: scenario.name,
          error: error.message,
          totalTime: Date.now() - startTime
        };
      }
    });

    const iterationResults = await Promise.all(iterationPromises);
    results.push(...iterationResults);
  }

  return results;
}

async function runSequentialComparison(scenarios: any[], iterations: number) {
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

        // Test V3
        const v3Start = Date.now();
        const v3Response = await fetch('http://localhost:3005/api/ai-execute-v3', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(scenario.query)
        });
        const v3Data = await v3Response.json();
        const v3Time = Date.now() - v3Start;

        results.push({
          iteration: i,
          scenario: scenario.name,
          v1: { ...extractMetrics(v1Data), actualTime: v1Time },
          v2: { ...extractMetrics(v2Data), actualTime: v2Time },
          v3: { ...extractMetrics(v3Data), actualTime: v3Time },
          totalTime: Date.now() - startTime,
          winner: determineWinner(v1Data, v2Data, v3Data)
        });
      } catch (error: any) {
        results.push({
          iteration: i,
          scenario: scenario.name,
          error: error.message,
          totalTime: Date.now() - startTime
        });
      }
    }
  }

  return results;
}

function extractMetrics(data: any) {
  if (!data || data.error) {
    return {
      success: false,
      error: data?.error || 'Unknown error',
      time: null,
      confidence: 0,
      cached: false
    };
  }

  return {
    success: data.success,
    server: data.metadata?.server,
    tool: data.metadata?.tool,
    time: parseInt(data.metadata?.totalTime || data.metadata?.routingTime || '0'),
    confidence: data.metadata?.confidence || 0,
    cached: data.metadata?.cached || false,
    alternatives: data.metadata?.alternatives?.length || 0,
    strategy: data.metadata?.strategy
  };
}

function determineWinner(v1: any, v2: any, v3: any) {
  const scores = {
    v1: calculateWinnerScore(v1),
    v2: calculateWinnerScore(v2),
    v3: calculateWinnerScore(v3)
  };

  const winner = Object.entries(scores).reduce((a, b) =>
    (scores as any)[a[0]] > (scores as any)[b[0]] ? a : b
  )[0];

  return { winner, scores };
}

function calculateWinnerScore(data: any) {
  if (!data.success) return 0;

  let score = 100; // Base score for success

  // Time penalty (lower is better)
  const time = data.metadata?.totalTime ? parseInt(data.metadata.totalTime) : 10000;
  score -= Math.min(time / 10, 50); // Max 50 point penalty

  // Confidence bonus
  const confidence = data.metadata?.confidence || 0;
  score += confidence * 50;

  // Cache bonus
  if (data.metadata?.cached) score += 20;

  // Alternatives bonus
  const alternatives = data.metadata?.alternatives?.length || 0;
  score += alternatives * 5;

  return Math.max(score, 0);
}

function analyzeV3Results(results: any[], totalTime: number) {
  const successV1 = results.filter(r => r.v1?.success).length;
  const successV2 = results.filter(r => r.v2?.success).length;
  const successV3 = results.filter(r => r.v3?.success).length;

  const v1Times = results.filter(r => r.v1?.time).map(r => r.v1.time);
  const v2Times = results.filter(r => r.v2?.time).map(r => r.v2.time);
  const v3Times = results.filter(r => r.v3?.time).map(r => r.v3.time);

  const avgTime = (times: number[]) => times.length ? times.reduce((a, b) => a + b) / times.length : 0;

  const winners = results.reduce((acc, r) => {
    if (r.winner?.winner) {
      acc[r.winner.winner] = (acc[r.winner.winner] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  return {
    summary: {
      totalTests: results.length,
      successRates: {
        v1: `${(successV1 / results.length * 100).toFixed(1)}%`,
        v2: `${(successV2 / results.length * 100).toFixed(1)}%`,
        v3: `${(successV3 / results.length * 100).toFixed(1)}%`
      },
      winners: winners,
      errors: results.filter(r => r.error).length
    },
    performance: {
      totalTime: `${totalTime}ms`,
      averageTimes: {
        v1: `${avgTime(v1Times).toFixed(0)}ms`,
        v2: `${avgTime(v2Times).toFixed(0)}ms`,
        v3: `${avgTime(v3Times).toFixed(0)}ms`
      },
      speedImprovement: {
        v3VsV1: v1Times.length && v3Times.length ?
          `${((avgTime(v1Times) - avgTime(v3Times)) / avgTime(v1Times) * 100).toFixed(1)}%` : 'N/A',
        v3VsV2: v2Times.length && v3Times.length ?
          `${((avgTime(v2Times) - avgTime(v3Times)) / avgTime(v2Times) * 100).toFixed(1)}%` : 'N/A'
      }
    },
    comparison: {
      reliability: `V3 > V2 > V1 (${successV3}/${successV2}/${successV1} successes)`,
      speed: `V3 fastest (${avgTime(v3Times).toFixed(0)}ms avg)`,
      intelligence: 'V3 has best confidence scores and alternatives'
    },
    recommendations: generateV3Recommendations(results)
  };
}

function generateV3Recommendations(results: any[]) {
  const recommendations = [];

  const v3AvgTime = results.filter(r => r.v3?.time).reduce((sum, r) => sum + r.v3.time, 0) /
    results.filter(r => r.v3?.time).length;

  if (v3AvgTime < 500) {
    recommendations.push('🚀 V3 meets speed targets - ready for production!');
  }

  const v3SuccessRate = results.filter(r => r.v3?.success).length / results.length;
  if (v3SuccessRate >= 0.95) {
    recommendations.push('✅ V3 reliability excellent - 95%+ success rate');
  }

  const v3Wins = results.filter(r => r.winner?.winner === 'v3').length;
  if (v3Wins > results.length * 0.8) {
    recommendations.push('🏆 V3 is the clear winner - recommend as primary routing engine');
  }

  const cacheHits = results.filter(r => r.v3?.cached).length;
  if (cacheHits > 0) {
    recommendations.push(`💨 Cache working well - ${cacheHits} cache hits observed`);
  }

  if (recommendations.length === 0) {
    recommendations.push('📊 More testing needed to determine optimal version');
  }

  return recommendations;
}

// GET endpoint for easy testing
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const iterations = parseInt(searchParams.get('iterations') || '5');
  const parallel = searchParams.get('parallel') === 'true';

  return POST(new NextRequest(request.url, {
    method: 'POST',
    body: JSON.stringify({ iterations, parallel }),
    headers: { 'Content-Type': 'application/json' }
  }));
}