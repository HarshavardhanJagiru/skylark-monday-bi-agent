import fetch from 'node-fetch';

async function testLiveConnection() {
  console.log('--- Testing Live Server & Monday.com Connection ---');
  const response = await fetch('http://localhost:3001/api/health');
  if (!response.ok) {
    throw new Error(`Health check failed with HTTP status ${response.status}`);
  }

  const data = await response.json();
  console.log('\n==================================================');
  console.log('STATUS:', data.status);
  console.log('Monday API Connected:', data.mondayApiConnected ? '✅ YES' : '❌ NO');
  console.log('\nDEALS BOARD:');
  console.log('  - Name:', data.deals.boardName);
  console.log('  - Source:', data.deals.source);
  console.log('  - Record Count:', data.deals.itemCount);
  console.log('  - Field Mapping Status:', data.deals.mappedFieldsStatus);

  console.log('\nWORK ORDERS BOARD:');
  console.log('  - Name:', data.workOrders.boardName);
  console.log('  - Source:', data.workOrders.source);
  console.log('  - Record Count:', data.workOrders.itemCount);
  console.log('  - Field Mapping Status:', data.workOrders.mappedFieldsStatus);
  console.log('==================================================\n');
}

testLiveConnection().catch(err => {
  console.error('❌ Test failed:', err.message);
  process.exit(1);
});
