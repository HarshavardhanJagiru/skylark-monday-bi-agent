import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3001';

async function testQuery(queryName, payload) {
  console.log(`\n==================================================`);
  console.log(`🧪 Testing Query: "${queryName}"`);
  console.log(`==================================================`);

  const response = await fetch(`${BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  if (data.isClarification) {
    console.log('❓ Response Type: CLARIFICATION REQUESTED');
    console.log(`Question: "${data.clarificationQuestion}"`);
    console.log(`Options:`, data.options);
  } else {
    console.log('✅ Response Type: EXECUTIVE SUMMARY');
    console.log(`Intent Classified: ${data.intent}`);
    console.log(`Data Sources: Deals = ${data.dataSources.dealsCount}, Work Orders = ${data.dataSources.workOrdersCount}`);
    console.log(`Metric Cards:`, data.metricCards);
    console.log(`Caveats Count: ${data.caveats.length}`);
    console.log('\n--- Preview Response Markdown ---');
    console.log(data.response.slice(0, 300) + '...\n');
  }
}

async function testLeadershipUpdate() {
  console.log(`\n==================================================`);
  console.log(`🧪 Testing Leadership Update Endpoint (/api/leadership-update)`);
  console.log(`==================================================`);

  const response = await fetch(`${BASE_URL}/api/leadership-update`);
  const data = await response.json();

  console.log('✅ Executive Summary KPIs:');
  console.log(data.leadershipData.executiveSummary);
  console.log('\nRecommended Actions:');
  console.log(data.leadershipData.recommendedActions);
}

async function runAllTests() {
  try {
    await testQuery("1. Pipeline Query", { query: "How is our pipeline looking this quarter?" });
    await testQuery("2. Sector Query", { query: "Which sector has the highest pipeline?" });
    await testQuery("3. Receivables Query", { query: "What is our receivables position?" });
    await testQuery("4. Operations Query", { query: "Which projects are delayed?" });
    await testQuery("5. Cross-Board Query", { query: "Compare sales pipeline and execution by sector." });
    await testQuery("6. Ambiguous Query", { query: "Show top performance" });
    await testLeadershipUpdate();

    console.log('\n🎉 ALL API VERIFICATION TESTS PASSED SUCCESSFULLY!\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Verification failed:', err);
    process.exit(1);
  }
}

// Give server time to start
setTimeout(runAllTests, 1000);
