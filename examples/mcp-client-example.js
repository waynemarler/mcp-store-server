// Example of using the MCP Store Server with the official MCP SDK
// Install dependencies: npm install @modelcontextprotocol/sdk

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

async function mcpClientExample() {
  console.log('🔌 Connecting to MCP Store Server...\n');

  // Create MCP client
  const client = new Client({
    name: "example-client",
    version: "1.0.0",
  }, {
    capabilities: {}
  });

  // Connect to the store server
  const transport = new SSEClientTransport(
    new URL("http://localhost:3000/api/mcp")
  );

  try {
    await client.connect(transport);
    console.log('✅ Connected to MCP Store Server');

    // Example 1: Register a server
    console.log('\n1️⃣ Registering a demo server...');
    const registerResult = await client.callTool({
      name: "register_server",
      arguments: {
        name: "Demo Calculator Service",
        description: "Provides basic mathematical operations",
        category: "utilities",
        capabilities: ["add", "subtract", "multiply", "divide"],
        endpoint: "https://calc-demo.example.com/api/mcp"
      }
    });
    console.log('✅ Registration result:', registerResult.content[0].text);

    // Example 2: Discover services
    console.log('\n2️⃣ Discovering utility services...');
    const discoverResult = await client.callTool({
      name: "discover_services",
      arguments: { category: "utilities" }
    });
    console.log('✅ Found services:', JSON.parse(discoverResult.content[0].text).length);

    // Example 3: List all available tools
    console.log('\n3️⃣ Listing available tools...');
    const tools = await client.listTools();
    console.log('✅ Available tools:');
    tools.tools.forEach(tool => {
      console.log(`   - ${tool.name}: ${tool.description}`);
    });

    // Example 4: Route a request (simulation)
    console.log('\n4️⃣ Simulating request routing...');
    try {
      const routeResult = await client.callTool({
        name: "route_request",
        arguments: {
          capability: "add",
          method: "calculate",
          params: { a: 5, b: 3, operation: "add" }
        }
      });
      console.log('✅ Route result:', routeResult.content[0].text);
    } catch (error) {
      console.log('⚠️  Route failed (expected - demo server not available):', error.message);
    }

    // Example 5: List all servers
    console.log('\n5️⃣ Listing all registered servers...');
    const allServers = await client.callTool({
      name: "list_all_servers",
      arguments: {}
    });
    const servers = JSON.parse(allServers.content[0].text);
    console.log(`✅ Total registered servers: ${servers.length}`);
    servers.forEach(server => {
      console.log(`   - ${server.name} (${server.category}): ${server.capabilities.join(', ')}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
    console.log('\n🔌 Disconnected from MCP Store Server');
  }
}

// Run the example
mcpClientExample().catch(console.error);