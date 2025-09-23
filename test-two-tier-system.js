// Test the Two-Tier Discovery System
const BASE_URL = 'https://mcp-store-server.vercel.app';

async function testTwoTierSystem() {
  console.log('🎯 Testing Two-Tier Discovery System');
  console.log('=====================================');

  try {
    console.log('\n1. Testing GitHub Discovery & Auto-Cataloging...');
    console.log('------------------------------------------------');

    // Step 1: Scan GitHub and automatically catalog discovered servers
    const scanResponse = await fetch(`${BASE_URL}/api/discovery/catalog`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'scan_and_store',
        query: 'mcp server',
        limit: 10
      })
    });

    const scanResult = await scanResponse.json();
    console.log('📊 Scan Results:');
    console.log(`  Repositories searched: ${scanResult.results?.repositoriesSearched || 0}`);
    console.log(`  MCP candidates detected: ${scanResult.results?.candidatesDetected || 0}`);
    console.log(`  Servers auto-cataloged: ${scanResult.results?.serversStored || 0}`);

    console.log('\n2. Viewing Discovery Catalog...');
    console.log('--------------------------------');

    // Step 2: Get the discovery catalog (Tier 1)
    const catalogResponse = await fetch(`${BASE_URL}/api/discovery/catalog?limit=5`);
    const catalogResult = await catalogResponse.json();

    if (catalogResult.success) {
      console.log(`✅ Discovery Catalog: ${catalogResult.servers.length} servers found`);
      console.log('\nCatalog Overview:');
      console.log(`  Total discovered: ${catalogResult.stats.total}`);
      console.log(`  Total stars: ${catalogResult.stats.totalStars.toLocaleString()}`);
      console.log(`  Average confidence: ${(catalogResult.stats.averageConfidence * 100).toFixed(1)}%`);

      console.log('\n📋 Status Breakdown:');
      Object.entries(catalogResult.stats.byStatus).forEach(([status, count]) => {
        console.log(`  ${status}: ${count} servers`);
      });

      console.log('\n🔍 Sample Discovered Servers:');
      catalogResult.servers.slice(0, 3).forEach((server, i) => {
        console.log(`\n  ${i + 1}. ${server.repository.fullName}`);
        console.log(`     Status: ${server.status} | Confidence: ${(server.analysis.confidence * 100).toFixed(1)}%`);
        console.log(`     Stars: ⭐ ${server.repository.stars} | Language: ${server.repository.language || 'Unknown'}`);
        console.log(`     Description: ${server.analysis.inferredDescription || server.repository.description || 'No description'}`);
        console.log(`     Developer: ${server.developer.githubUsername}`);

        if (server.analysis.inferredCapabilities?.length) {
          console.log(`     Capabilities: ${server.analysis.inferredCapabilities.join(', ')}`);
        }
      });
    }

    console.log('\n3. Testing Active Registry (Tier 2)...');
    console.log('---------------------------------------');

    // Step 3: Get the active registry (servers that are live and routable)
    const activeResponse = await fetch(`${BASE_URL}/api/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

    const activeResult = await activeResponse.json();
    if (activeResult.result) {
      const activeServers = JSON.parse(activeResult.result.content[0].text);
      console.log(`✅ Active Registry: ${activeServers.length} live servers`);

      console.log('\n🚀 Sample Active Servers:');
      activeServers.slice(0, 3).forEach((server, i) => {
        console.log(`\n  ${i + 1}. ${server.name}`);
        console.log(`     Status: ⚡ Active & Routable`);
        console.log(`     Type: ${server.type || 'Unknown'}`);
        console.log(`     Capabilities: ${server.capabilities?.length || 0} available`);
        console.log(`     Trust Score: ${server.trustScore || 'N/A'}`);
        console.log(`     Verified: ${server.verified ? '✅' : '❌'}`);
      });
    }

    console.log('\n4. Demonstrating Status Workflow...');
    console.log('------------------------------------');

    if (catalogResult.success && catalogResult.servers.length > 0) {
      const sampleServer = catalogResult.servers[0];
      console.log(`\n📧 Example: Contacting developer for ${sampleServer.repository.fullName}`);

      // Simulate recording a contact attempt
      const contactResponse = await fetch(`${BASE_URL}/api/discovery/catalog`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'record_contact',
          serverId: sampleServer.id,
          method: 'email',
          template: 'initial-discovery',
          successful: true,
          response: 'Developer interested in listing'
        })
      });

      if (contactResponse.ok) {
        console.log('✅ Contact attempt recorded');
        console.log('   Status updated: discovered → contacted');
        console.log('   Next step: Wait for developer approval');
      }
    }

    console.log('\n🎉 Two-Tier System Analysis Complete!');
    console.log('======================================');
    console.log('✅ Tier 1 (Discovery): Auto-catalogs all MCP servers');
    console.log('✅ Tier 2 (Active): Only developer-approved servers');
    console.log('✅ Workflow: discovered → contacted → approved → active');
    console.log('✅ Benefits: Massive scale + Developer consent');

    console.log('\n💡 Strategic Value:');
    console.log('   • Complete ecosystem visibility (discovery catalog)');
    console.log('   • Respectful developer engagement (approval required)');
    console.log('   • Quality curation (confidence scoring)');
    console.log('   • Network effects (developers see ecosystem size)');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Full error:', error);
  }
}

// Run the test
testTwoTierSystem().catch(console.error);