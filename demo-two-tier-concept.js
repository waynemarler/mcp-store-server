// Demonstrate Two-Tier System Concept with Working Endpoints
const BASE_URL = 'https://mcp-store-server.vercel.app';

async function demonstrateTwoTierConcept() {
  console.log('🎯 Two-Tier Discovery System Demonstration');
  console.log('==========================================');

  try {
    console.log('\n📊 TIER 1: Discovery Catalog (Auto-Discovery)');
    console.log('==============================================');

    // Use our working GitHub discovery endpoint
    console.log('🔍 Step 1: Scanning GitHub for MCP servers...');
    const discoveryResponse = await fetch(`${BASE_URL}/api/github/discover?q=mcp server&per_page=5&analyze=true`);
    const discoveryResult = await discoveryResponse.json();

    if (discoveryResult.success) {
      console.log(`✅ Found ${discoveryResult.candidates.length} MCP server candidates`);
      console.log(`📈 Detection rate: ${discoveryResult.meta.detection_rate}%`);

      console.log('\n🔍 Discovery Catalog Entries (Would be auto-stored):');
      console.log('┌─────────────────────────────────────────────────────────┐');

      discoveryResult.candidates.forEach((candidate, i) => {
        const server = candidate.repository;
        const analysis = candidate.analysis;
        const detection = candidate.detection;

        console.log(`│ ${i + 1}. ${server.full_name}`);
        console.log(`│    Status: 🔍 DISCOVERED (auto-cataloged)`);
        console.log(`│    Confidence: ${(detection.confidence * 100).toFixed(1)}% | Stars: ⭐ ${server.stargazers_count}`);
        console.log(`│    Language: ${server.language || 'Unknown'} | Developer: ${server.owner.login}`);
        console.log(`│    Description: ${analysis.inferredDescription || server.description || 'No description'}`);
        console.log(`│    Indicators: ${detection.indicators.join(', ')}`);
        console.log(`│    Actions: [📧 Contact Developer] [✅ Approve] [❌ Reject]`);
        console.log('│');
      });
      console.log('└─────────────────────────────────────────────────────────┘');

      console.log('\n💡 Discovery Catalog Benefits:');
      console.log('   • Auto-discovery: No manual submission required');
      console.log('   • Complete ecosystem visibility: See all MCP servers');
      console.log('   • Quality scoring: Confidence and trust metrics');
      console.log('   • Developer-friendly: "We found your server!" approach');
    }

    console.log('\n⚡ TIER 2: Active Registry (Developer-Approved)');
    console.log('===============================================');

    console.log('🔍 Step 2: Checking active, routable servers...');
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
      console.log(`✅ Found ${activeServers.length} active, routable servers`);

      console.log('\n⚡ Active Registry Entries (Developer-approved):');
      console.log('┌─────────────────────────────────────────────────────────┐');

      activeServers.slice(0, 3).forEach((server, i) => {
        console.log(`│ ${i + 1}. ${server.name}`);
        console.log(`│    Status: ⚡ ACTIVE & ROUTABLE`);
        console.log(`│    Type: ${server.type || 'Unknown'} | Trust: ${server.trustScore || 'N/A'}`);
        console.log(`│    Verified: ${server.verified ? '✅' : '❌'} | Capabilities: ${server.capabilities?.length || 0}`);
        console.log(`│    Developer: ${server.author?.name || 'Unknown'}`);
        console.log(`│    Actions: [🚀 Use in Claude] [📊 View Analytics] [⚙️ Configure]`);
        console.log('│');
      });
      console.log('└─────────────────────────────────────────────────────────┘');

      console.log('\n🎯 Active Registry Benefits:');
      console.log('   • Live endpoints: Actually routable and usable');
      console.log('   • Developer consent: Only approved servers');
      console.log('   • Quality assurance: Tested and monitored');
      console.log('   • Revenue eligible: Performance-based sharing');
    }

    console.log('\n🔄 WORKFLOW: Discovery → Contact → Approval → Activation');
    console.log('=======================================================');

    if (discoveryResult.candidates.length > 0) {
      const sampleServer = discoveryResult.candidates[0];
      console.log('\n📧 Example Developer Engagement Flow:');
      console.log('');
      console.log(`1. 🔍 DISCOVERED: ${sampleServer.repository.full_name}`);
      console.log(`   Confidence: ${(sampleServer.detection.confidence * 100).toFixed(1)}% | Auto-cataloged`);
      console.log('');
      console.log('2. 📧 CONTACT DEVELOPER:');
      console.log('   "Hi! We discovered your awesome MCP server and added it to our');
      console.log('   discovery catalog. Want to activate it for thousands of users?"');
      console.log('');
      console.log('3. ✅ DEVELOPER APPROVES:');
      console.log('   Provides endpoint, API key, confirms metadata');
      console.log('');
      console.log('4. ⚡ ACTIVATION:');
      console.log('   Server becomes live, routable, revenue-eligible');
    }

    console.log('\n🏗️ STRATEGIC ARCHITECTURE');
    console.log('==========================');

    console.log('\nTier 1: Discovery Catalog');
    console.log('├── Auto-discovery from GitHub');
    console.log('├── Confidence scoring & analysis');
    console.log('├── Developer contact tracking');
    console.log('└── Status: discovered → contacted → approved/rejected');

    console.log('\nTier 2: Active Registry');
    console.log('├── Developer-approved endpoints');
    console.log('├── Live routing & performance monitoring');
    console.log('├── Revenue sharing & analytics');
    console.log('└── Status: active → verified → optimized');

    console.log('\n🎉 BUSINESS VALUE');
    console.log('=================');
    console.log('✅ Massive Scale: Discover 100s of servers immediately');
    console.log('✅ Legal Safety: Catalog public info, activate with consent');
    console.log('✅ Developer Buy-in: Positive engagement, not data scraping');
    console.log('✅ Network Effects: Complete ecosystem visibility drives adoption');
    console.log('✅ Quality Curation: Confidence scoring + developer approval');

    console.log('\n🚀 This approach transforms us from "data scrapers" into');
    console.log('   "ecosystem builders" with respectful developer partnership!');

  } catch (error) {
    console.error('❌ Demo failed:', error.message);
    console.error('Full error:', error);
  }
}

// Run the demonstration
demonstrateTwoTierConcept().catch(console.error);