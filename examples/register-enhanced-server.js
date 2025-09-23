// Register a new MCP server using the enhanced schema with rich metadata

const BASE_URL = 'https://mcp-store-server.vercel.app';
// const BASE_URL = 'http://localhost:3000'; // for local testing

// Enhanced MCP server with full metadata
const enhancedServer = {
  name: 'Financial Data Analytics Platform',
  description: 'Comprehensive financial data analysis with real-time market insights, portfolio management, and risk assessment tools',

  // Enhanced metadata fields
  type: 'transactional',
  version: '3.2.1',
  logoUrl: 'https://example.com/financial-platform-logo.png',

  // Author information for trust and branding
  author: {
    name: 'FinTech Innovations Inc.',
    website: 'https://fintechinnovations.com',
    contactEmail: 'api-support@fintechinnovations.com'
  },

  // Multiple hierarchical categories
  categories: [
    {
      mainCategory: 'Information',
      subCategory: 'Financial',
      description: 'Real-time and historical financial market data'
    },
    {
      mainCategory: 'Tools',
      subCategory: 'Analytics',
      description: 'Advanced analytics and risk assessment tools'
    },
    {
      mainCategory: 'Data',
      subCategory: 'Processing',
      description: 'High-frequency data processing and aggregation'
    }
  ],

  // Legacy category for backward compatibility
  category: 'Information/Financial',

  // Comprehensive capabilities
  capabilities: [
    'market.quotes.realtime',
    'market.quotes.historical',
    'portfolio.analysis',
    'risk.assessment',
    'data.query',
    'data.insert',
    'compute.execute',
    'api.call'
  ],

  // Discovery tags
  tags: [
    'finance',
    'trading',
    'analytics',
    'real-time',
    'portfolio',
    'risk-management',
    'market-data',
    'quantitative',
    'enterprise'
  ],

  // Trust and verification
  verified: true,
  trustScore: 92,
  status: 'active',

  // Endpoint configuration
  endpoint: 'https://api.fintechinnovations.com/mcp/v3'
};

// Utility function for MCP tool calls
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

async function registerEnhancedServer() {
  console.log('=====================================');
  console.log('Enhanced MCP Server Registration Test');
  console.log('=====================================');
  console.log(`Registering to: ${BASE_URL}`);
  console.log(`Server: ${enhancedServer.name}`);
  console.log(`Type: ${enhancedServer.type}`);
  console.log(`Version: ${enhancedServer.version}`);
  console.log(`Trust Score: ${enhancedServer.trustScore}`);
  console.log(`Categories: ${enhancedServer.categories.length}`);
  console.log(`Capabilities: ${enhancedServer.capabilities.length}`);
  console.log(`Tags: ${enhancedServer.tags.length}`);
  console.log('');

  try {
    console.log('🚀 Registering enhanced server...');
    const result = await callMcpTool('register_server', enhancedServer);
    const registrationResult = JSON.parse(result.content[0].text);

    console.log('✅ Registration successful!');
    console.log(`Server ID: ${registrationResult.serverId}`);
    console.log('');

    // Test discovery by different criteria
    console.log('🔍 Testing discovery capabilities...');

    // 1. Discovery by capability
    console.log('\n1. Discovery by financial capability:');
    const financialServers = await callMcpTool('discover_services', {
      capability: 'portfolio.analysis'
    });
    const servers1 = JSON.parse(financialServers.content[0].text);
    console.log(`   Found ${servers1.length} servers with portfolio.analysis capability`);

    // 2. Discovery by category
    console.log('\n2. Discovery by Financial category:');
    const categoryServers = await callMcpTool('discover_services', {
      category: 'Financial'
    });
    const servers2 = JSON.parse(categoryServers.content[0].text);
    console.log(`   Found ${servers2.length} servers in Financial category`);

    // 3. Discovery by verified status
    console.log('\n3. Discovery of verified servers:');
    const verifiedServers = await callMcpTool('discover_services', {
      verified: true
    });
    const servers3 = JSON.parse(verifiedServers.content[0].text);
    console.log(`   Found ${servers3.length} verified servers`);

    // 4. List all servers to see our new one
    console.log('\n4. Finding our registered server in the list:');
    const allServers = await callMcpTool('list_all_servers');
    const allServersList = JSON.parse(allServers.content[0].text);

    const ourServer = allServersList.find(s => s.id === registrationResult.serverId);
    if (ourServer) {
      console.log('✅ Found our server in the registry:');
      console.log(`   Name: ${ourServer.name}`);
      console.log(`   Type: ${ourServer.type}`);
      console.log(`   Version: ${ourServer.version}`);
      console.log(`   Trust Score: ${ourServer.trustScore}`);
      console.log(`   Status: ${ourServer.status}`);
      console.log(`   Author: ${ourServer.author?.name || 'Not set'}`);
      console.log(`   Categories: ${ourServer.categories?.length || 0}`);
      console.log(`   Capabilities: ${ourServer.capabilities?.length || 0}`);
      console.log(`   Tags: ${ourServer.tags?.length || 0}`);

      if (ourServer.categories?.length > 0) {
        console.log('   Category details:');
        ourServer.categories.forEach(cat => {
          console.log(`     - ${cat.mainCategory}/${cat.subCategory}`);
        });
      }

      if (ourServer.tags?.length > 0) {
        console.log(`   Tags: ${ourServer.tags.join(', ')}`);
      }
    } else {
      console.log('❌ Could not find our server in the registry');
    }

    console.log('\n=====================================');
    console.log('✅ Enhanced server registration test completed successfully!');
    console.log('=====================================');

    return registrationResult.serverId;

  } catch (error) {
    console.error('❌ Registration failed:', error.message);
    console.log('\n=====================================');
    console.log('❌ Enhanced server registration test failed');
    console.log('=====================================');
    return null;
  }
}

// Run the registration test
registerEnhancedServer().catch(console.error);