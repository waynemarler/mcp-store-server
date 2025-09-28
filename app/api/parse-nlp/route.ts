import { NextRequest } from "next/server";

// Ultra-fast NLP parsing engine - the crown jewel of our system
// Target: <10ms for 90% of queries, >95% accuracy

const parseCache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL = 300000; // 5 minutes

export async function POST(request: NextRequest) {
  try {
    const startTime = Date.now();
    const body = await request.json();
    const { query, sessionId, context = {} } = body;

    if (!query || typeof query !== 'string') {
      return Response.json({
        success: false,
        error: "Query is required and must be a string"
      }, { status: 400 });
    }

    // Check cache first for speed
    const cacheKey = `${query.toLowerCase().trim()}_${JSON.stringify(context)}`;
    const cached = parseCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      return Response.json({
        ...cached.data,
        metadata: {
          ...cached.data.metadata,
          cached: true,
          parseTime: `${Date.now() - startTime}ms`
        }
      });
    }

    // STEP 1: Ultra-fast pattern matching
    const parseResult = await parseQuery(query, context);

    const totalTime = Date.now() - startTime;

    const response = {
      success: true,
      query: query,
      sessionId: sessionId,
      parsed: parseResult,
      metadata: {
        parseTime: `${totalTime}ms`,
        cached: false,
        engine: "pattern-match-v1"
      }
    };

    // Cache the result
    parseCache.set(cacheKey, {
      data: response,
      timestamp: Date.now()
    });

    return Response.json(response);

  } catch (error: any) {
    console.error('NLP parsing error:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

// Main parsing engine - ultra-fast pattern matching
async function parseQuery(query: string, context: any = {}) {
  const normalizedQuery = query.toLowerCase().trim();

  // STEP 1: Intent classification (lightning fast)
  const intent = classifyIntent(normalizedQuery);

  // STEP 2: Entity extraction (parallel)
  const entities = extractEntities(normalizedQuery);

  // STEP 3: Capability mapping
  const capabilities = mapCapabilities(intent, entities);

  // STEP 4: Category classification
  const category = classifyCategory(intent);

  // STEP 5: Execution strategy
  const strategy = determineExecutionStrategy(intent, normalizedQuery);

  return {
    intent: intent.name,
    confidence: intent.confidence,
    entities: entities,
    capabilities: capabilities,
    category: category,
    strategy: strategy,
    originalQuery: query,
    normalizedQuery: normalizedQuery
  };
}

// Lightning-fast intent classification using pattern matching
function classifyIntent(query: string) {
  // Define intent patterns with confidence scores
  const intentPatterns = [
    // Weather queries
    {
      name: 'weather_query',
      patterns: [
        /weather\s+in\s+([a-zA-Z\s]+)/i,
        /forecast.*?([a-zA-Z\s]+)/i,
        /temperature.*?([a-zA-Z\s]+)/i,
        /(current|today's?)\s+weather/i,
        /how.*?(hot|cold|warm).*?is.*?it/i
      ],
      confidence: 0.95
    },

    // Cryptocurrency queries
    {
      name: 'cryptocurrency_price_query',
      patterns: [
        /(bitcoin|btc|ethereum|eth|crypto).*?price/i,
        /price.*?(bitcoin|btc|ethereum|eth)/i,
        /how.*?much.*?(bitcoin|btc|ethereum|eth)/i,
        /(bitcoin|btc|ethereum|eth).*?(cost|value)/i
      ],
      confidence: 0.95
    },

    // Stock queries
    {
      name: 'stock_price_query',
      patterns: [
        /stock.*?price.*?([A-Z]{2,5})/i,
        /([A-Z]{2,5}).*?stock.*?price/i,
        /share.*?price.*?([A-Z]{2,5})/i
      ],
      confidence: 0.90
    },

    // Web search
    {
      name: 'web_search',
      patterns: [
        /search.*?for\s+(.+)/i,
        /find.*?about\s+(.+)/i,
        /look.*?up\s+(.+)/i,
        /google\s+(.+)/i
      ],
      confidence: 0.85
    },

    // Food delivery (comparison required)
    {
      name: 'food_delivery',
      patterns: [
        /order.*?food/i,
        /food.*?delivery/i,
        /(pizza|burger|chinese|indian).*?(order|delivery)/i,
        /hungry.*?(order|delivery)/i
      ],
      confidence: 0.90
    },

    // Translation
    {
      name: 'translation',
      patterns: [
        /translate.*?to\s+([a-zA-Z]+)/i,
        /how.*?say.*?in\s+([a-zA-Z]+)/i,
        /([a-zA-Z]+).*?translation/i
      ],
      confidence: 0.95
    }
  ];

  // Fast pattern matching
  for (const intentPattern of intentPatterns) {
    for (const pattern of intentPattern.patterns) {
      if (pattern.test(query)) {
        return {
          name: intentPattern.name,
          confidence: intentPattern.confidence,
          matchedPattern: pattern.toString()
        };
      }
    }
  }

  // Fallback for unknown queries
  return {
    name: 'general_query',
    confidence: 0.3,
    matchedPattern: 'fallback'
  };
}

// Extract entities (locations, currencies, etc.)
function extractEntities(query: string) {
  const entities: any = {};

  // Location extraction
  const locationPatterns = [
    /in\s+([a-zA-Z\s]+?)(?:\s|$|,|\?|!)/i,
    /at\s+([a-zA-Z\s]+?)(?:\s|$|,|\?|!)/i,
    /([A-Z][a-zA-Z\s]{2,15})(?:\s|$|,|\?|!)/
  ];

  for (const pattern of locationPatterns) {
    const match = query.match(pattern);
    if (match) {
      entities.location = match[1].trim();
      break;
    }
  }

  // Currency/Crypto extraction
  const cryptoPatterns = [
    /(bitcoin|btc|ethereum|eth|dogecoin|doge)/i
  ];

  for (const pattern of cryptoPatterns) {
    const match = query.match(pattern);
    if (match) {
      entities.cryptocurrency = match[1].toLowerCase();
      break;
    }
  }

  // Stock symbols
  const stockPattern = /([A-Z]{2,5})(?:\s|$)/;
  const stockMatch = query.match(stockPattern);
  if (stockMatch) {
    entities.stockSymbol = stockMatch[1];
  }

  return entities;
}

// Map intent to required capabilities
function mapCapabilities(intent: any, entities: any) {
  const capabilityMap: Record<string, string[]> = {
    'weather_query': ['weather_lookup', 'location_search'],
    'cryptocurrency_price_query': ['crypto_price', 'market_data'],
    'stock_price_query': ['stock_price', 'market_data'],
    'web_search': ['web_search', 'content_retrieval'],
    'food_delivery': ['food_ordering', 'delivery_search', 'location_search'],
    'translation': ['text_translation', 'language_detection']
  };

  return capabilityMap[intent.name] || ['general'];
}

// Classify into broad categories
function classifyCategory(intent: any) {
  const categoryMap: Record<string, string> = {
    'weather_query': 'Weather',
    'cryptocurrency_price_query': 'Finance',
    'stock_price_query': 'Finance',
    'web_search': 'Search',
    'food_delivery': 'Commerce',
    'translation': 'Language'
  };

  return categoryMap[intent.name] || 'General';
}

// Determine execution strategy
function determineExecutionStrategy(intent: any, query: string) {
  // Direct execution - just return best result
  const directExecution = [
    'weather_query',
    'cryptocurrency_price_query',
    'stock_price_query',
    'translation',
    'web_search'
  ];

  // Comparison required - present options
  const requiresComparison = [
    'food_delivery',
    'flight_booking',
    'hotel_booking',
    'crypto_trading'
  ];

  if (directExecution.includes(intent.name)) {
    return {
      type: 'direct_execution',
      description: 'Execute best matching MCP server immediately'
    };
  }

  if (requiresComparison.includes(intent.name)) {
    return {
      type: 'present_options',
      description: 'Present available MCP servers for user selection'
    };
  }

  return {
    type: 'fallback',
    description: 'Use general query processing'
  };
}

// GET endpoint for testing
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || searchParams.get('query') || '';

  if (!query) {
    return Response.json({
      success: false,
      error: "Query parameter 'q' or 'query' is required"
    }, { status: 400 });
  }

  return POST(new NextRequest(request.url, {
    method: 'POST',
    body: JSON.stringify({ query }),
    headers: { 'Content-Type': 'application/json' }
  }));
}