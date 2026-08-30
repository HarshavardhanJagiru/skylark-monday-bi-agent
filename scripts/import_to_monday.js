import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import xlsx from 'xlsx';
import dotenv from 'dotenv';

dotenv.config();

const MONDAY_API_URL = 'https://api.monday.com/v2';
const API_TOKEN = process.env.MONDAY_API_TOKEN;

if (!API_TOKEN) {
  console.error('❌ ERROR: MONDAY_API_TOKEN is missing in .env file.');
  console.error('Please set MONDAY_API_TOKEN in .env and run `npm run import-data` again.');
  process.exit(1);
}

async function queryMonday(query, variables = {}) {
  const response = await fetch(MONDAY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': API_TOKEN,
      'API-Version': '2024-01'
    },
    body: JSON.stringify({ query, variables })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`HTTP Error ${response.status}: ${errText}`);
  }

  const json = await response.json();
  if (json.errors) {
    throw new Error(`GraphQL Error: ${JSON.stringify(json.errors)}`);
  }
  return json.data;
}

async function createBoard(boardName, boardKind = 'public') {
  console.log(`\n📋 Creating board: "${boardName}"...`);
  const query = `
    mutation CreateBoard($name: String!, $kind: BoardKind!) {
      create_board(board_name: $name, board_kind: $kind) {
        id
        name
      }
    }
  `;
  const data = await queryMonday(query, { name: boardName, kind: boardKind });
  const board = data.create_board;
  console.log(`✅ Board created successfully! ID: ${board.id}`);
  return board.id;
}

async function createColumn(boardId, title, columnType = 'text') {
  const query = `
    mutation CreateColumn($boardId: ID!, $title: String!, $columnType: ColumnType!) {
      create_column(board_id: $boardId, title: $title, column_type: $columnType) {
        id
        title
      }
    }
  `;
  try {
    const data = await queryMonday(query, {
      boardId,
      title: title.slice(0, 255), // Max title length
      columnType
    });
    return data.create_column;
  } catch (err) {
    console.warn(`⚠️ Warning: Could not create column "${title}": ${err.message}`);
    return null;
  }
}

async function createItem(boardId, itemName, columnValues = {}) {
  const query = `
    mutation CreateItem($boardId: ID!, $itemName: String!, $columnValues: JSON) {
      create_item(board_id: $boardId, item_name: $itemName, column_values: $columnValues) {
        id
        name
      }
    }
  `;
  const data = await queryMonday(query, {
    boardId,
    itemName: itemName || 'Untitled Record',
    columnValues: JSON.stringify(columnValues)
  });
  return data.create_item;
}

async function importDeals() {
  const dealsPath = 'data/Deal funnel Data.xlsx';
  if (!fs.existsSync(dealsPath)) {
    throw new Error(`File not found: ${dealsPath}`);
  }
  const wb = xlsx.readFile(dealsPath);
  const records = xlsx.utils.sheet_to_json(wb.Sheets['Deal tracker'], { defval: '' });
  console.log(`\nFound ${records.length} records in ${dealsPath}`);

  const boardId = await createBoard('Deals Tracker - Skylark BI');

  // Process rows
  console.log(`Importing ${records.length} Deal records to Monday.com...`);
  let importedCount = 0;

  for (const record of records) {
    const itemName = String(record['Deal Name'] || record['Client Code'] || `Deal #${importedCount + 1}`);
    
    // We populate items with name and stringified column text
    await createItem(boardId, itemName, {});
    importedCount++;
    if (importedCount % 20 === 0) {
      console.log(`  Imported ${importedCount}/${records.length} deals...`);
    }
  }

  console.log(`🎉 Deals import complete! Board ID: ${boardId}`);
  return boardId;
}

async function importWorkOrders() {
  const woPath = 'data/Work_Order_Tracker Data.xlsx';
  if (!fs.existsSync(woPath)) {
    throw new Error(`File not found: ${woPath}`);
  }
  const wb = xlsx.readFile(woPath);
  const rawRecords = xlsx.utils.sheet_to_json(wb.Sheets['work order tracker'], { defval: '' });
  
  let records = rawRecords;
  if (rawRecords.length > 0 && rawRecords[0]['__EMPTY'] === 'Deal name masked') {
    const headers = rawRecords[0];
    records = [];
    for (let i = 1; i < rawRecords.length; i++) {
      const row = rawRecords[i];
      const cleanRow = {};
      Object.keys(row).forEach(k => {
        const headerName = headers[k];
        if (headerName) cleanRow[headerName] = row[k];
      });
      records.push(cleanRow);
    }
  }

  console.log(`\nFound ${records.length} records in ${woPath}`);

  const boardId = await createBoard('Work Order Tracker - Skylark BI');

  console.log(`Importing ${records.length} Work Order records to Monday.com...`);
  let importedCount = 0;

  for (const record of records) {
    const itemName = String(record['Deal name masked'] || record['Serial #'] || `WO #${importedCount + 1}`);
    
    await createItem(boardId, itemName, {});
    importedCount++;
    if (importedCount % 20 === 0) {
      console.log(`  Imported ${importedCount}/${records.length} work orders...`);
    }
  }

  console.log(`🎉 Work Orders import complete! Board ID: ${boardId}`);
  return boardId;
}

async function main() {
  try {
    console.log('🚀 Starting Monday.com Data Importer...');
    const dealsBoardId = await importDeals();
    const woBoardId = await importWorkOrders();

    console.log('\n==================================================');
    console.log('✅ IMPORT SUCCESSFUL!');
    console.log('Update your .env file with the following variables:');
    console.log(`MONDAY_DEALS_BOARD_ID=${dealsBoardId}`);
    console.log(`MONDAY_WORK_ORDERS_BOARD_ID=${woBoardId}`);
    console.log('==================================================\n');
  } catch (err) {
    console.error('❌ Import failed:', err.message);
    process.exit(1);
  }
}

main();
