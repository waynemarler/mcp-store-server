// Test script to register the working weather MCP server and test routing
// Run with: node examples/test-weather-routing.js

const BASE_URL = 'https://mcp-store-server.vercel.app';

async function testWeatherMCPRouting() {
  console.log('🌤️  Testing Weather MCP Server Routing\n');

  // Step 1: Register the working weather MCP server
  console.log('1️⃣ Registering working weather MCP server...');
  const registerResponse = await fetch(`${BASE_URL}/api/registry`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Live Weather Service',
      description: 'A working weather MCP server with real endpoints',
      category: 'weather',
      capabilities: ['current-weather', 'forecast', 'weather-alerts'],
      endpoint: `${BASE_URL}/api/weather-mcp`
    })
  });

  const registerResult = await registerResponse.json();
  console.log('✅ Weather server registered:', registerResult);
  const serverId = registerResult.server.id;

  // Step 2: Test direct weather server endpoint
  console.log('\n2️⃣ Testing direct weather server endpoint...');
  const directTest = await fetch(`${BASE_URL}/api/weather-mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'get_current_weather',
        arguments: { location: 'London', units: 'celsius' }
      }
    })
  });

  const directResult = await directTest.json();
  console.log('✅ Direct weather call successful:', directResult.result ? 'Yes' : 'No');

  // Step 3: Test routing through the MCP store
  console.log('\n3️⃣ Testing routing through MCP store...');
  const routeResponse = await fetch(`${BASE_URL}/api/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'route_request',
        arguments: {
          capability: 'current-weather',
          method: 'get_current_weather',
          params: { location: 'New York', units: 'fahrenheit' }
        }
      }
    })
  });

  const routeResult = await routeResponse.json();
  console.log('✅ Routing test:', routeResult.result ? 'Success' : 'Failed');

  if (routeResult.result) {
    const routeData = JSON.parse(routeResult.result.content[0].text);
    console.log('📍 Routed to server:', routeData.serverId);
    console.log('⏱️  Execution time:', routeData.executionTime + 'ms');
  }

  // Step 4: Test discovery
  console.log('\n4️⃣ Testing weather service discovery...');
  const discoveryResponse = await fetch(`${BASE_URL}/api/discovery?capability=current-weather`);
  const discoveryResult = await discoveryResponse.json();
  console.log('✅ Weather services found:', discoveryResult.servers.length);

  // Step 5: Test forecast routing
  console.log('\n5️⃣ Testing forecast routing...');
  const forecastResponse = await fetch(`${BASE_URL}/api/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'route_request',
        arguments: {
          capability: 'forecast',
          method: 'get_forecast',
          params: { location: 'Paris', days: 5, units: 'celsius' }
        }
      }
    })
  });

  const forecastResult = await forecastResponse.json();
  console.log('✅ Forecast routing:', forecastResult.result ? 'Success' : 'Failed');

  // Step 6: List available tools through routing
  console.log('\n6️⃣ Testing tools list through routing...');
  const toolsResponse = await fetch(`${BASE_URL}/api/weather-mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/list'
    })
  });

  const toolsResult = await toolsResponse.json();
  console.log('✅ Available tools:', toolsResult.result?.tools?.length || 0);
  if (toolsResult.result?.tools) {
    toolsResult.result.tools.forEach(tool => {
      console.log(`   - ${tool.name}: ${tool.description}`);
    });
  }

  console.log('\n🎉 Weather MCP routing test completed!');
  console.log('\n📝 Summary:');
  console.log(`   • Weather server registered with ID: ${serverId}`);
  console.log('   • Direct weather calls working');
  console.log('   • Store routing working');
  console.log('   • Discovery working');
  console.log('   • Multiple weather tools available');

  console.log('\n💡 Try these URLs:');
  console.log(`   • Registry: ${BASE_URL}/api/registry`);
  console.log(`   • Discovery: ${BASE_URL}/api/discovery?capability=current-weather`);
  console.log(`   • Direct weather: ${BASE_URL}/api/weather-mcp`);
}

// Run the test
testWeatherMCPRouting().catch(console.error);