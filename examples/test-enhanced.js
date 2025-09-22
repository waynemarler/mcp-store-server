// Test script for enhanced MCP Store Server with normalized schema

const BASE_URL = 'https://mcp-store-server.vercel.app';
// const BASE_URL = 'http://localhost:3000'; // for local testing

// Utility function for JSON-RPC calls
async function callJsonRpc(method, params = {}) {
  const response = await fetch(`${BASE_URL}/api/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method,
      params,
      id: Date.now()
    })
  });

  const result = await response.json();
  if (result.error) {
    throw new Error(result.error.message);
  }
  return result.result;
}

// Test enhanced registration with full metadata
async function testEnhancedRegistration() {
  console.log('\n=== Testing Enhanced Registration ===\n');

  const weatherServer = {
    id: 'weather-service-enhanced',
    name: 'Enhanced Weather Service',
    description: 'Advanced weather service with comprehensive meteorological data',
    logoUrl: 'https://example.com/weather-logo.png',
    endpoint: `${BASE_URL}/api/weather-mcp`,
    type: 'informational',
    version: '2.0.0',
    author: {
      name: 'Weather Corp',
      website: 'https://weathercorp.example.com',
      contactEmail: 'support@weathercorp.example.com'
    },
    categories: [
      { mainCategory: 'Information', subCategory: 'Weather' },
      { mainCategory: 'Tools', subCategory: 'Analytics' }
    ],
    capabilities: [
      'weather.current',
      'weather.forecast',
      'weather.alerts',
      'data.query'
    ],
    tags: ['meteorology', 'climate', 'real-time', 'api'],
    verified: true,
    trustScore: 95,
    status: 'active'
  };

  const analyticsServer = {
    id: 'analytics-service',
    name: 'Data Analytics Engine',
    description: 'Powerful data analytics and visualization platform',
    logoUrl: 'https://example.com/analytics-logo.png',
    endpoint: 'https://analytics.example.com/mcp',
    type: 'task',
    version: '1.5.0',
    author: {
      name: 'DataTech Solutions',
      website: 'https://datatech.example.com',
      contactEmail: 'info@datatech.example.com'
    },
    categories: [
      { mainCategory: 'Tools', subCategory: 'Analytics' },
      { mainCategory: 'Data', subCategory: 'Processing' }
    ],
    capabilities: [
      'data.query',
      'data.insert',
      'data.update',
      'compute.execute'
    ],
    tags: ['analytics', 'bigdata', 'visualization', 'ml'],
    verified: false,
    trustScore: 80,
    status: 'active'
  };

  const dbServer = {
    id: 'database-service',
    name: 'Cloud Database Manager',
    description: 'Manage cloud databases with ease',
    endpoint: 'https://db.example.com/mcp',
    type: 'transactional',
    version: '3.0.1',
    categories: [
      { mainCategory: 'Data', subCategory: 'Database' },
      { mainCategory: 'Data', subCategory: 'Storage' }
    ],
    capabilities: [
      'data.query',
      'data.insert',
      'data.update',
      'data.delete'
    ],
    tags: ['database', 'cloud', 'sql', 'nosql'],
    verified: true,
    trustScore: 90,
    status: 'active'
  };

  try {
    // Register servers
    console.log('Registering Weather Service...');
    await callJsonRpc('register_server', weatherServer);
    console.log('✓ Weather Service registered');

    console.log('Registering Analytics Engine...');
    await callJsonRpc('register_server', analyticsServer);
    console.log('✓ Analytics Engine registered');

    console.log('Registering Database Manager...');
    await callJsonRpc('register_server', dbServer);
    console.log('✓ Database Manager registered');

    return true;
  } catch (error) {
    console.error('Registration error:', error);
    return false;
  }
}

// Test discovery with enhanced schema
async function testEnhancedDiscovery() {
  console.log('\n=== Testing Enhanced Discovery ===\n');

  try {
    // Test 1: Discover by capability
    console.log('1. Discovering services with data.query capability:');
    const dataServices = await callJsonRpc('discover_services', {
      capability: 'data.query'
    });
    console.log(`   Found ${dataServices.length} services:`);
    dataServices.forEach(s => {
      console.log(`   - ${s.name} (${s.id})`);
      if (s.categories) {
        console.log(`     Categories: ${s.categories.map(c => `${c.mainCategory}/${c.subCategory}`).join(', ')}`);
      }
      console.log(`     Capabilities: ${s.capabilities.join(', ')}`);
      if (s.tags) {
        console.log(`     Tags: ${s.tags.join(', ')}`);
      }
    });

    // Test 2: Discover by category
    console.log('\n2. Discovering services in Tools category:');
    const toolServices = await callJsonRpc('discover_services', {
      category: 'Tools'
    });
    console.log(`   Found ${toolServices.length} services:`);
    toolServices.forEach(s => {
      console.log(`   - ${s.name} (Trust Score: ${s.trustScore})`);
      if (s.author) {
        console.log(`     Author: ${s.author.name}`);
      }
    });

    // Test 3: Discover verified services
    console.log('\n3. Discovering verified services:');
    const verifiedServices = await callJsonRpc('discover_services', {
      verified: true
    });
    console.log(`   Found ${verifiedServices.length} verified services:`);
    verifiedServices.forEach(s => {
      console.log(`   - ${s.name} (Version: ${s.version || 'N/A'})`);
      console.log(`     Type: ${s.type || 'N/A'}, Status: ${s.status}`);
    });

    // Test 4: List all services
    console.log('\n4. Listing all registered services:');
    const allServices = await callJsonRpc('list_all_servers');
    console.log(`   Total services: ${allServices.length}`);
    allServices.forEach(s => {
      console.log(`   - ${s.name}`);
      console.log(`     ID: ${s.id}`);
      console.log(`     Trust Score: ${s.trustScore}`);
      console.log(`     Status: ${s.status}`);
      if (s.categories?.length) {
        console.log(`     Categories: ${s.categories.length}`);
      }
      if (s.tags?.length) {
        console.log(`     Tags: ${s.tags.length}`);
      }
    });

    return true;
  } catch (error) {
    console.error('Discovery error:', error);
    return false;
  }
}

// Test routing with enhanced metadata
async function testEnhancedRouting() {
  console.log('\n=== Testing Enhanced Routing ===\n');

  try {
    // Route to weather service
    console.log('Routing request to weather service...');
    const weatherResult = await callJsonRpc('route_request', {
      capability: 'weather.current',
      method: 'get_current_weather',
      params: { location: 'San Francisco' }
    });

    console.log('Weather routing result:');
    console.log(`  Server: ${weatherResult.serverName} (${weatherResult.serverId})`);
    console.log(`  Execution Time: ${weatherResult.executionTime}ms`);
    console.log('  Response:', JSON.stringify(weatherResult.response, null, 2));

    return true;
  } catch (error) {
    console.error('Routing error:', error);
    return false;
  }
}

// Main test runner
async function runTests() {
  console.log('=====================================');
  console.log('Enhanced MCP Store Server Test Suite');
  console.log('=====================================');
  console.log(`Testing against: ${BASE_URL}`);
  console.log('Note: Set USE_ENHANCED_SCHEMA=true in environment to use enhanced schema');

  let allTestsPassed = true;

  // Run tests
  const registrationPassed = await testEnhancedRegistration();
  allTestsPassed = allTestsPassed && registrationPassed;

  const discoveryPassed = await testEnhancedDiscovery();
  allTestsPassed = allTestsPassed && discoveryPassed;

  const routingPassed = await testEnhancedRouting();
  allTestsPassed = allTestsPassed && routingPassed;

  console.log('\n=====================================');
  console.log(allTestsPassed ? '✓ All tests passed!' : '✗ Some tests failed');
  console.log('=====================================');
}

// Run tests
runTests().catch(console.error);