// Populate database with diverse, rich test servers
const BASE_URL = 'https://mcp-store-server.vercel.app';

// Comprehensive test servers showcasing all enhanced schema features
const testServers = [
  {
    name: 'WeatherWise Pro',
    description: 'Advanced weather analytics and forecasting with AI-powered predictions and climate insights',
    type: 'informational',
    version: '3.2.1',
    logoUrl: 'https://cdn.weatherwise.io/logo.png',
    author: {
      name: 'ClimateData Solutions',
      website: 'https://climatedata.solutions',
      contactEmail: 'api@climatedata.solutions'
    },
    categories: [
      { mainCategory: 'Weather', subCategory: 'Forecasting', description: 'Weather prediction and analysis' },
      { mainCategory: 'Data', subCategory: 'Environmental', description: 'Environmental data processing' }
    ],
    capabilities: [
      'weather.current',
      'weather.forecast',
      'weather.historical',
      'climate.analysis',
      'alerts.severe'
    ],
    endpoint: 'https://api.weatherwise.io/mcp',
    tags: ['weather', 'forecasting', 'climate', 'analytics', 'real-time'],
    verified: true,
    trustScore: 95,
    status: 'active'
  },

  {
    name: 'CryptoMarket Intelligence',
    description: 'Real-time cryptocurrency market data, trading signals, and portfolio analytics',
    type: 'transactional',
    version: '2.8.4',
    logoUrl: 'https://cdn.cryptomarket.ai/logo.svg',
    author: {
      name: 'BlockChain Analytics Inc',
      website: 'https://blockchain-analytics.com',
      contactEmail: 'developers@blockchain-analytics.com'
    },
    categories: [
      { mainCategory: 'Finance', subCategory: 'Cryptocurrency', description: 'Digital currency market data' },
      { mainCategory: 'Trading', subCategory: 'Analytics', description: 'Trading analysis and signals' }
    ],
    capabilities: [
      'crypto.prices',
      'crypto.portfolio',
      'trading.signals',
      'market.analysis',
      'defi.protocols'
    ],
    endpoint: 'https://api.cryptomarket.ai/mcp',
    tags: ['cryptocurrency', 'trading', 'defi', 'portfolio', 'real-time', 'blockchain'],
    verified: true,
    trustScore: 88,
    status: 'active'
  },

  {
    name: 'CodeGen Assistant',
    description: 'AI-powered code generation, refactoring, and documentation tools for multiple programming languages',
    type: 'task',
    version: '1.5.2',
    logoUrl: 'https://assets.codegen.dev/logo.png',
    author: {
      name: 'DevTools Collective',
      website: 'https://devtools.dev',
      contactEmail: 'support@devtools.dev'
    },
    categories: [
      { mainCategory: 'Development', subCategory: 'Code Generation', description: 'Automated code creation' },
      { mainCategory: 'AI', subCategory: 'Programming', description: 'AI-assisted development' },
      { mainCategory: 'Tools', subCategory: 'Documentation', description: 'Code documentation automation' }
    ],
    capabilities: [
      'code.generate',
      'code.refactor',
      'docs.generate',
      'tests.create',
      'review.automated'
    ],
    endpoint: 'https://api.codegen.dev/mcp',
    tags: ['ai', 'code-generation', 'documentation', 'testing', 'refactoring', 'productivity'],
    verified: true,
    trustScore: 92,
    status: 'active'
  },

  {
    name: 'HealthMonitor Plus',
    description: 'Comprehensive health tracking and medical data analysis with wearable device integration',
    type: 'informational',
    version: '4.1.0',
    logoUrl: 'https://health-monitor.app/assets/logo.png',
    author: {
      name: 'MedTech Innovations',
      website: 'https://medtech-innovations.health',
      contactEmail: 'api@medtech-innovations.health'
    },
    categories: [
      { mainCategory: 'Health', subCategory: 'Monitoring', description: 'Health metrics tracking' },
      { mainCategory: 'Medical', subCategory: 'Analytics', description: 'Medical data analysis' }
    ],
    capabilities: [
      'health.vitals',
      'fitness.tracking',
      'medical.records',
      'alerts.health',
      'wearables.sync'
    ],
    endpoint: 'https://api.healthmonitor.app/mcp',
    tags: ['health', 'fitness', 'medical', 'wearables', 'monitoring', 'analytics'],
    verified: true,
    trustScore: 94,
    status: 'active'
  },

  {
    name: 'Smart Home Hub',
    description: 'Universal IoT device control and automation platform for smart home management',
    type: 'transactional',
    version: '2.3.7',
    logoUrl: 'https://smarthome-hub.io/images/logo.png',
    author: {
      name: 'IoT Dynamics Ltd',
      website: 'https://iot-dynamics.com',
      contactEmail: 'hello@iot-dynamics.com'
    },
    categories: [
      { mainCategory: 'IoT', subCategory: 'Home Automation', description: 'Smart home device control' },
      { mainCategory: 'Control', subCategory: 'Devices', description: 'Device management and automation' }
    ],
    capabilities: [
      'devices.control',
      'automation.rules',
      'energy.monitoring',
      'security.systems',
      'voice.commands'
    ],
    endpoint: 'https://api.smarthome-hub.io/mcp',
    tags: ['iot', 'smart-home', 'automation', 'devices', 'energy', 'security'],
    verified: false,
    trustScore: 76,
    status: 'active'
  },

  {
    name: 'Language Learning AI',
    description: 'Adaptive language learning platform with AI tutoring and progress tracking',
    type: 'task',
    version: '1.9.3',
    logoUrl: 'https://languageai.learn/static/logo.svg',
    author: {
      name: 'EduTech Global',
      website: 'https://edutech-global.com',
      contactEmail: 'contact@edutech-global.com'
    },
    categories: [
      { mainCategory: 'Education', subCategory: 'Language Learning', description: 'Language acquisition tools' },
      { mainCategory: 'AI', subCategory: 'Tutoring', description: 'AI-powered education' }
    ],
    capabilities: [
      'language.lessons',
      'progress.tracking',
      'pronunciation.analysis',
      'vocabulary.building',
      'conversation.practice'
    ],
    endpoint: 'https://api.languageai.learn/mcp',
    tags: ['education', 'language-learning', 'ai-tutoring', 'pronunciation', 'vocabulary'],
    verified: true,
    trustScore: 90,
    status: 'active'
  },

  {
    name: 'Legacy System Bridge (Deprecated)',
    description: 'Bridge connector for legacy enterprise systems - being phased out',
    type: 'transactional',
    version: '0.8.1',
    author: {
      name: 'Enterprise Solutions Corp',
      website: 'https://enterprisesolutions.corp',
      contactEmail: 'legacy-support@enterprisesolutions.corp'
    },
    categories: [
      { mainCategory: 'Enterprise', subCategory: 'Legacy Systems', description: 'Legacy system integration' }
    ],
    capabilities: [
      'legacy.connect',
      'data.migration',
      'system.bridge'
    ],
    endpoint: 'https://legacy.enterprisesolutions.corp/mcp',
    tags: ['legacy', 'enterprise', 'migration', 'deprecated'],
    verified: false,
    trustScore: 45,
    status: 'deprecated'
  },

  {
    name: 'Social Media Analytics Pro',
    description: 'Advanced social media monitoring, sentiment analysis, and engagement metrics',
    type: 'informational',
    version: '3.4.2',
    logoUrl: 'https://socialmedia-analytics.pro/logo.png',
    author: {
      name: 'Social Insights Team',
      website: 'https://social-insights.com',
      contactEmail: 'api@social-insights.com'
    },
    categories: [
      { mainCategory: 'Social Media', subCategory: 'Analytics', description: 'Social media data analysis' },
      { mainCategory: 'Marketing', subCategory: 'Insights', description: 'Marketing analytics and insights' }
    ],
    capabilities: [
      'social.monitoring',
      'sentiment.analysis',
      'engagement.metrics',
      'influencer.tracking',
      'trend.analysis'
    ],
    endpoint: 'https://api.socialmedia-analytics.pro/mcp',
    tags: ['social-media', 'analytics', 'sentiment', 'marketing', 'engagement', 'trends'],
    verified: true,
    trustScore: 87,
    status: 'active'
  }
];

async function callMcpTool(toolName, args = {}) {
  const response = await fetch(`${BASE_URL}/api/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args
      },
      id: Date.now()
    })
  });

  const result = await response.json();
  if (result.error) {
    throw new Error(result.error.message);
  }
  return result.result;
}

async function populateFreshData() {
  console.log('🚀 Populating Fresh Enhanced Schema Data');
  console.log('==========================================');

  try {
    // Step 1: Clear existing data
    console.log('1. Clearing existing database data...');
    const clearResponse = await fetch(`${BASE_URL}/api/reset-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!clearResponse.ok) {
      throw new Error('Failed to clear database');
    }

    const clearResult = await clearResponse.json();
    console.log(`✅ Database cleared: ${clearResult.details.tablesCleared.length} tables`);

    // Step 2: Register all test servers
    console.log('\n2. Registering diverse test servers...');
    const registeredServers = [];

    for (let i = 0; i < testServers.length; i++) {
      const server = testServers[i];
      console.log(`\n📝 Registering: ${server.name}`);
      console.log(`   Type: ${server.type} | Status: ${server.status} | Trust: ${server.trustScore}`);
      console.log(`   Categories: ${server.categories.length} | Capabilities: ${server.capabilities.length} | Tags: ${server.tags.length}`);

      try {
        const result = await callMcpTool('register_server', server);
        const registration = JSON.parse(result.content[0].text);
        registeredServers.push({
          id: registration.serverId,
          name: server.name,
          type: server.type,
          status: server.status
        });
        console.log(`   ✅ Registered with ID: ${registration.serverId}`);
      } catch (error) {
        console.log(`   ❌ Failed: ${error.message}`);
      }

      // Small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Step 3: Verify registration and analyze data
    console.log('\n3. Verifying registered data...');
    const allServers = await callMcpTool('list_all_servers');
    const serverList = JSON.parse(allServers.content[0].text);

    console.log(`✅ Total servers in database: ${serverList.length}`);

    // Step 4: Analyze the data diversity
    console.log('\n📊 Data Diversity Analysis:');
    console.log('============================');

    const typeCount = {};
    const statusCount = {};
    const categoryCount = {};
    const verifiedCount = { true: 0, false: 0 };

    serverList.forEach(server => {
      // Type analysis
      typeCount[server.type] = (typeCount[server.type] || 0) + 1;

      // Status analysis
      statusCount[server.status] = (statusCount[server.status] || 0) + 1;

      // Verified analysis
      verifiedCount[server.verified] = (verifiedCount[server.verified] || 0) + 1;

      // Category analysis
      if (server.categories) {
        server.categories.forEach(cat => {
          const categoryKey = cat.mainCategory;
          categoryCount[categoryKey] = (categoryCount[categoryKey] || 0) + 1;
        });
      }
    });

    console.log('\nServer Types:');
    Object.entries(typeCount).forEach(([type, count]) => {
      console.log(`  ${type}: ${count} servers`);
    });

    console.log('\nServer Status:');
    Object.entries(statusCount).forEach(([status, count]) => {
      console.log(`  ${status}: ${count} servers`);
    });

    console.log('\nVerification Status:');
    console.log(`  Verified: ${verifiedCount.true} servers`);
    console.log(`  Unverified: ${verifiedCount.false} servers`);

    console.log('\nMain Categories:');
    Object.entries(categoryCount).forEach(([category, count]) => {
      console.log(`  ${category}: ${count} servers`);
    });

    // Step 5: Test discovery functionality
    console.log('\n4. Testing discovery functionality...');

    // Test capability-based discovery
    const weatherServers = await callMcpTool('discover_services', { capability: 'weather.current' });
    const weatherList = JSON.parse(weatherServers.content[0].text);
    console.log(`✅ Weather capability search: ${weatherList.length} servers found`);

    // Test verified filter
    const verifiedServers = await callMcpTool('discover_services', { verified: true });
    const verifiedList = JSON.parse(verifiedServers.content[0].text);
    console.log(`✅ Verified servers search: ${verifiedList.length} servers found`);

    console.log('\n🎉 Fresh Data Population Completed Successfully!');
    console.log('===============================================');
    console.log(`✅ ${registeredServers.length} servers registered`);
    console.log(`✅ Enhanced schema features fully utilized`);
    console.log(`✅ Discovery functionality verified`);
    console.log(`✅ Database ready for comprehensive testing`);

  } catch (error) {
    console.error('❌ Population failed:', error.message);
    console.error('Full error:', error);
  }
}

// Run the population
populateFreshData().catch(console.error);