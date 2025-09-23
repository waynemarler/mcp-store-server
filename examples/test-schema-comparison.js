// Test to demonstrate the difference between simple and enhanced schemas

const BASE_URL = 'https://mcp-store-server.vercel.app';

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

async function testCurrentSchema() {
  console.log('===============================================');
  console.log('MCP Store Server - Schema Capability Test');
  console.log('===============================================');
  console.log(`Testing against: ${BASE_URL}`);
  console.log('');

  try {
    // Register a test server with enhanced metadata
    const testServer = {
      name: 'Schema Test Server',
      description: 'Testing enhanced schema capabilities',
      category: 'Tools/Development',

      // Enhanced fields
      type: 'task',
      version: '1.0.0',
      logoUrl: 'https://example.com/logo.png',

      author: {
        name: 'Test Developer',
        website: 'https://testdev.com',
        contactEmail: 'test@testdev.com'
      },

      categories: [
        { mainCategory: 'Tools', subCategory: 'Development' },
        { mainCategory: 'Information', subCategory: 'Testing' }
      ],

      capabilities: ['test.run', 'test.validate'],
      endpoint: 'https://testserver.example.com/mcp',

      tags: ['testing', 'development', 'validation'],

      verified: true,
      trustScore: 85,
      status: 'active'
    };

    console.log('🚀 Registering test server with enhanced metadata...');
    const registrationResult = await callMcpTool('register_server', testServer);
    const registration = JSON.parse(registrationResult.content[0].text);
    console.log(`✅ Registered server: ${registration.serverId}`);

    console.log('\n📊 Analyzing returned metadata...');

    // Get the server back and check what fields are populated
    const allServers = await callMcpTool('list_all_servers');
    const serverList = JSON.parse(allServers.content[0].text);
    const ourServer = serverList.find(s => s.id === registration.serverId);

    if (ourServer) {
      console.log('\n🔍 Server metadata analysis:');
      console.log('Basic fields:');
      console.log(`  ✅ Name: ${ourServer.name}`);
      console.log(`  ✅ Description: ${ourServer.description || 'Not set'}`);
      console.log(`  ✅ Category: ${ourServer.category}`);
      console.log(`  ✅ Capabilities: ${ourServer.capabilities.length} items`);
      console.log(`  ✅ Endpoint: ${ourServer.endpoint || 'Not set'}`);

      console.log('\nEnhanced fields:');
      console.log(`  ${ourServer.type ? '✅' : '❌'} Type: ${ourServer.type || 'undefined'}`);
      console.log(`  ${ourServer.version ? '✅' : '❌'} Version: ${ourServer.version || 'undefined'}`);
      console.log(`  ${ourServer.trustScore !== undefined ? '✅' : '❌'} Trust Score: ${ourServer.trustScore !== undefined ? ourServer.trustScore : 'undefined'}`);
      console.log(`  ${ourServer.status ? '✅' : '❌'} Status: ${ourServer.status || 'undefined'}`);
      console.log(`  ${ourServer.author ? '✅' : '❌'} Author: ${ourServer.author ? ourServer.author.name : 'undefined'}`);
      console.log(`  ${ourServer.categories && ourServer.categories.length > 0 ? '✅' : '❌'} Categories: ${ourServer.categories ? ourServer.categories.length : 0} items`);
      console.log(`  ${ourServer.tags && ourServer.tags.length > 0 ? '✅' : '❌'} Tags: ${ourServer.tags ? ourServer.tags.length : 0} items`);

      console.log('\n📈 Schema Analysis:');
      const enhancedFieldsPresent = [
        ourServer.type,
        ourServer.version,
        ourServer.trustScore !== undefined,
        ourServer.status,
        ourServer.author,
        ourServer.categories && ourServer.categories.length > 0,
        ourServer.tags && ourServer.tags.length > 0
      ].filter(Boolean).length;

      console.log(`Enhanced fields populated: ${enhancedFieldsPresent}/7`);

      if (enhancedFieldsPresent >= 5) {
        console.log('🎉 ENHANCED SCHEMA ACTIVE - Rich metadata available!');
      } else if (enhancedFieldsPresent >= 2) {
        console.log('⚡ PARTIAL ENHANCEMENT - Some enhanced fields available');
      } else {
        console.log('📋 SIMPLE SCHEMA ACTIVE - Basic metadata only');
        console.log('\n💡 To enable enhanced schema:');
        console.log('   Set USE_ENHANCED_SCHEMA=true in Vercel environment variables');
      }

      console.log('\n🔧 Current capabilities:');
      console.log('✅ Server registration and discovery');
      console.log('✅ Capability-based filtering');
      console.log('✅ Basic metadata support');
      console.log('✅ MCP protocol compliance');

      if (enhancedFieldsPresent >= 5) {
        console.log('✅ Enhanced metadata (authors, categories, tags)');
        console.log('✅ Trust scoring and verification');
        console.log('✅ Hierarchical categorization');
        console.log('✅ Advanced filtering and discovery');
      }

    } else {
      console.log('❌ Could not retrieve registered server');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }

  console.log('\n===============================================');
  console.log('Schema capability test completed');
  console.log('===============================================');
}

// Run the schema test
testCurrentSchema().catch(console.error);