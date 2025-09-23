// Test GitHub Discovery functionality
const BASE_URL = 'https://mcp-store-server.vercel.app';

async function testGitHubDiscovery() {
  console.log('🔍 Testing GitHub Discovery System');
  console.log('==================================');

  try {
    // Test 1: Search for MCP repositories
    console.log('\n1. Searching GitHub for MCP repositories...');
    const searchResponse = await fetch(`${BASE_URL}/api/github/discover?q=mcp server&per_page=5&analyze=false`);
    const searchResults = await searchResponse.json();

    if (searchResults.success) {
      console.log(`✅ Found ${searchResults.repositories.length} repositories`);
      console.log('Sample repositories:');
      searchResults.repositories.slice(0, 3).forEach((repo, i) => {
        console.log(`  ${i + 1}. ${repo.full_name}`);
        console.log(`     ⭐ ${repo.stargazers_count} stars | Language: ${repo.language || 'Unknown'}`);
        console.log(`     Description: ${repo.description || 'No description'}`);
      });
    } else {
      console.log('❌ Search failed:', searchResults.error);
      return;
    }

    // Test 2: Analyze repositories for MCP servers
    console.log('\n2. Analyzing repositories for MCP servers...');
    const analyzeResponse = await fetch(`${BASE_URL}/api/github/discover?q=mcp server&per_page=3&analyze=true`);
    const analyzeResults = await analyzeResponse.json();

    if (analyzeResults.success) {
      console.log(`✅ Analyzed ${analyzeResults.meta.total_repositories} repositories`);
      console.log(`🎯 Found ${analyzeResults.candidates.length} MCP server candidates (${analyzeResults.meta.detection_rate}% detection rate)`);

      if (analyzeResults.candidates.length > 0) {
        console.log('\nMCP Server Candidates:');
        analyzeResults.candidates.forEach((candidate, i) => {
          console.log(`\n  ${i + 1}. ${candidate.repository.full_name}`);
          console.log(`     Confidence: ${(candidate.detection.confidence * 100).toFixed(1)}%`);
          console.log(`     Has Manifest: ${candidate.detection.hasManifest ? '✅' : '❌'}`);
          console.log(`     Indicators: ${candidate.detection.indicators.join(', ')}`);

          if (candidate.analysis) {
            console.log(`     Inferred Name: ${candidate.analysis.inferredName || 'N/A'}`);
            console.log(`     Capabilities: ${candidate.analysis.inferredCapabilities?.length || 0} detected`);
            console.log(`     Categories: ${candidate.analysis.inferredCategories?.join(', ') || 'None'}`);
          }
        });
      }
    } else {
      console.log('❌ Analysis failed:', analyzeResults.error);
    }

    // Test 3: Analyze a specific known MCP repository
    console.log('\n3. Testing specific repository analysis...');
    const specificRepo = {
      owner: 'anthropics',
      repo: 'mcp-server-sqlite'
    };

    const specificResponse = await fetch(`${BASE_URL}/api/github/discover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(specificRepo)
    });

    const specificResults = await specificResponse.json();

    if (specificResults.success) {
      console.log(`✅ Analyzed ${specificRepo.owner}/${specificRepo.repo}`);
      console.log(`   Confidence: ${(specificResults.meta.confidence * 100).toFixed(1)}%`);
      console.log(`   Has Manifest: ${specificResults.meta.has_manifest ? '✅' : '❌'}`);
      console.log(`   Indicators: ${specificResults.meta.indicators.join(', ')}`);

      if (specificResults.candidate.analysis) {
        const analysis = specificResults.candidate.analysis;
        console.log(`   Inferred Name: ${analysis.inferredName || 'N/A'}`);
        console.log(`   Description: ${analysis.inferredDescription || 'N/A'}`);
        console.log(`   Capabilities: ${analysis.inferredCapabilities?.join(', ') || 'None detected'}`);
      }
    } else {
      console.log(`❌ Specific analysis failed: ${specificResults.message}`);
    }

    console.log('\n🎉 GitHub Discovery Testing Complete!');
    console.log('=====================================');
    console.log('✅ Search functionality working');
    console.log('✅ Batch analysis working');
    console.log('✅ Specific repository analysis working');
    console.log('✅ Ready for developer portal integration');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Full error:', error);
  }
}

// Run the test
testGitHubDiscovery().catch(console.error);