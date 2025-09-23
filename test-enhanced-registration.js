// Test enhanced schema registration with rich metadata
const BASE_URL = 'https://mcp-store-server.vercel.app';

async function testEnhancedRegistration() {
  console.log('🚀 Testing Enhanced Schema Registration');
  console.log('=====================================');

  try {
    // Skip debug check for now and go straight to testing
    console.log('1. Starting enhanced registration test...');

    // Create a test server with rich enhanced metadata
    const enhancedTestServer = {
      name: 'Advanced Analytics MCP Server',
      description: 'Comprehensive data analytics and visualization server with AI-powered insights',

      // Enhanced metadata fields
      type: 'task',
      version: '2.1.4',
      logoUrl: 'https://cdn.example.com/analytics-logo.png',

      // Rich author information
      author: {
        name: 'DataViz Analytics Team',
        website: 'https://dataviz-analytics.com',
        contactEmail: 'support@dataviz-analytics.com'
      },

      // Multiple hierarchical categories
      categories: [
        {
          mainCategory: 'Analytics',
          subCategory: 'Data Processing',
          description: 'Core data processing and transformation capabilities'
        },
        {
          mainCategory: 'Visualization',
          subCategory: 'Charts',
          description: 'Advanced charting and graph generation'
        },
        {
          mainCategory: 'AI',
          subCategory: 'Machine Learning',
          description: 'ML-powered analytics and predictions'
        }
      ],

      // Comprehensive capabilities
      capabilities: [
        'data.analyze',
        'data.transform',
        'chart.create',
        'chart.export',
        'ml.predict',
        'ml.train',
        'report.generate',
        'dashboard.create'
      ],

      endpoint: 'https://analytics-server.dataviz.com/mcp',
      apiKey: 'ak_test_enhanced_12345',

      // Rich tagging
      tags: [
        'analytics',
        'data-science',
        'visualization',
        'machine-learning',
        'business-intelligence',
        'reporting',
        'dashboards'
      ],

      verified: true,
      trustScore: 92,
      status: 'active'
    };

    console.log('\n2. Registering enhanced server via MCP protocol...');

    // Register using MCP JSON-RPC protocol
    const registrationResponse = await fetch(`${BASE_URL}/api/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'register_server',
          arguments: enhancedTestServer
        },
        id: Date.now()
      })
    });

    const registrationResult = await registrationResponse.json();
    console.log('Registration response:', registrationResult);

    if (registrationResult.error) {
      throw new Error(registrationResult.error.message);
    }

    const registration = JSON.parse(registrationResult.result.content[0].text);
    const serverId = registration.serverId;
    console.log(`✅ Server registered with ID: ${serverId}`);

    console.log('\n3. Retrieving and analyzing stored metadata...');

    // Get all servers to see our registered server
    const listResponse = await fetch(`${BASE_URL}/api/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'list_all_servers',
          arguments: {}
        },
        id: Date.now()
      })
    });

    const listResult = await listResponse.json();
    const serverList = JSON.parse(listResult.result.content[0].text);
    const ourServer = serverList.find(s => s.id === serverId);

    if (!ourServer) {
      throw new Error('Could not find registered server in list');
    }

    console.log('\n📊 Enhanced Schema Analysis:');
    console.log('============================');

    // Analyze basic fields
    console.log('\nBasic Fields:');
    console.log(`✅ Name: ${ourServer.name}`);
    console.log(`✅ Description: ${ourServer.description?.substring(0, 50)}...`);
    console.log(`✅ Capabilities: ${ourServer.capabilities?.length || 0} items`);
    console.log(`✅ Endpoint: ${ourServer.endpoint ? 'Set' : 'Not set'}`);

    // Analyze enhanced fields
    console.log('\nEnhanced Fields:');
    console.log(`${ourServer.type ? '✅' : '❌'} Type: ${ourServer.type || 'undefined'}`);
    console.log(`${ourServer.version ? '✅' : '❌'} Version: ${ourServer.version || 'undefined'}`);
    console.log(`${ourServer.status ? '✅' : '❌'} Status: ${ourServer.status || 'undefined'}`);
    console.log(`${ourServer.trustScore !== undefined ? '✅' : '❌'} Trust Score: ${ourServer.trustScore !== undefined ? ourServer.trustScore : 'undefined'}`);
    console.log(`${ourServer.verified !== undefined ? '✅' : '❌'} Verified: ${ourServer.verified !== undefined ? ourServer.verified : 'undefined'}`);

    // Analyze complex objects
    console.log('\nComplex Objects:');
    console.log(`${ourServer.author ? '✅' : '❌'} Author: ${ourServer.author ? `${ourServer.author.name} (ID: ${ourServer.author.id})` : 'undefined'}`);
    if (ourServer.author) {
      console.log(`  - Website: ${ourServer.author.website || 'Not set'}`);
      console.log(`  - Email: ${ourServer.author.contactEmail || 'Not set'}`);
      console.log(`  - Created: ${ourServer.author.createdAt || 'Not set'}`);
    }

    console.log(`${ourServer.categories?.length ? '✅' : '❌'} Categories: ${ourServer.categories?.length || 0} items`);
    if (ourServer.categories?.length) {
      ourServer.categories.forEach((cat, i) => {
        console.log(`  ${i + 1}. ${cat.mainCategory}/${cat.subCategory}`);
        if (cat.description) console.log(`     Description: ${cat.description}`);
      });
    }

    console.log(`${ourServer.tags?.length ? '✅' : '❌'} Tags: ${ourServer.tags?.length || 0} items`);
    if (ourServer.tags?.length) {
      console.log(`  Tags: ${ourServer.tags.join(', ')}`);
    }

    // Calculate enhancement score
    const enhancedFields = [
      !!ourServer.type,
      !!ourServer.version,
      !!ourServer.status,
      ourServer.trustScore !== undefined,
      ourServer.verified !== undefined,
      !!ourServer.author,
      ourServer.categories?.length > 0,
      ourServer.tags?.length > 0
    ];

    const enhancementScore = enhancedFields.filter(Boolean).length;

    console.log('\n🎯 Enhancement Analysis:');
    console.log(`Enhanced fields populated: ${enhancementScore}/8`);
    console.log(`Enhancement percentage: ${Math.round((enhancementScore / 8) * 100)}%`);

    if (enhancementScore >= 7) {
      console.log('🎉 EXCELLENT: Full enhanced schema functionality active!');
    } else if (enhancementScore >= 5) {
      console.log('✅ GOOD: Enhanced schema mostly working');
    } else if (enhancementScore >= 3) {
      console.log('⚠️  PARTIAL: Some enhanced features active');
    } else {
      console.log('❌ LIMITED: Basic schema only');
    }

    console.log('\n4. Testing capability-based discovery...');

    // Test discovery with capability filter
    const discoveryResponse = await fetch(`${BASE_URL}/api/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'discover_services',
          arguments: {
            capability: 'data.analyze'
          }
        },
        id: Date.now()
      })
    });

    const discoveryResult = await discoveryResponse.json();
    const discoveredServers = JSON.parse(discoveryResult.result.content[0].text);

    console.log(`✅ Discovery found ${discoveredServers.length} servers with 'data.analyze' capability`);

    const foundOurServer = discoveredServers.find(s => s.id === serverId);
    if (foundOurServer) {
      console.log('✅ Our server was correctly discovered via capability search');
    } else {
      console.log('❌ Our server was not found in capability search');
    }

    console.log('\n🎉 Enhanced schema test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Full error:', error);
  }
}

// Run the test
testEnhancedRegistration().catch(console.error);