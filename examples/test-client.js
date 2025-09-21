// Example MCP client to test the store server
// Run with: node examples/test-client.js

const BASE_URL = "https://mcp-store-server.vercel.app";

async function testMCPStoreServer() {
  console.log("🧪 Testing MCP Store Server\n");

  // Test 1: Register a test server
  console.log("1️⃣ Registering a test MCP server...");
  const registerResponse = await fetch(`${BASE_URL}/api/registry`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Test Weather Service",
      description: "A test weather MCP server",
      category: "weather",
      capabilities: ["current-weather", "forecast", "alerts"],
      endpoint: "https://weather-test.example.com/api/mcp",
    }),
  });

  const registerResult = await registerResponse.json();
  console.log("✅ Server registered:", registerResult);
  const serverId = registerResult.server.id;

  // Test 2: Discover servers
  console.log("\n2️⃣ Discovering weather services...");
  const discoveryResponse = await fetch(
    `${BASE_URL}/api/discovery?capability=current-weather`
  );
  const discoveryResult = await discoveryResponse.json();
  console.log("✅ Found servers:", discoveryResult.servers.length);

  // Test 3: List all servers
  console.log("\n3️⃣ Listing all registered servers...");
  const listResponse = await fetch(`${BASE_URL}/api/registry`);
  const listResult = await listResponse.json();
  console.log("✅ Total servers:", listResult.servers.length);

  // Test 4: Test MCP protocol endpoint
  console.log("\n4️⃣ Testing MCP protocol endpoint...");
  const mcpResponse = await fetch(`${BASE_URL}/api/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "discover_services",
        arguments: { capability: "current-weather" },
      },
    }),
  });

  const mcpResult = await mcpResponse.json();
  console.log(
    "✅ MCP Protocol Response:",
    mcpResult.result ? "Success" : "Error"
  );

  // Test 5: Health check
  console.log("\n5️⃣ Testing health check...");
  const healthResponse = await fetch(`${BASE_URL}/api/health/${serverId}`, {
    method: "POST",
  });
  const healthResult = await healthResponse.json();
  console.log(
    "✅ Health check:",
    healthResult.healthy ? "Healthy" : "Unhealthy"
  );

  // Test 6: Clean up - delete test server
  console.log("\n6️⃣ Cleaning up test server...");
  const deleteResponse = await fetch(
    `${BASE_URL}/api/registry?id=${serverId}`,
    {
      method: "DELETE",
    }
  );
  const deleteResult = await deleteResponse.json();
  console.log("✅ Cleanup:", deleteResult.success ? "Success" : "Failed");

  console.log("\n🎉 All tests completed!");
}

// Run the tests
testMCPStoreServer().catch(console.error);
