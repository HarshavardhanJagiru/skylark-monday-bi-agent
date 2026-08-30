import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const API_TOKEN = (process.env.MONDAY_API_TOKEN || '').trim();
const DEALS_BOARD_ID = (process.env.MONDAY_DEALS_BOARD_ID || '').trim();
const WO_BOARD_ID = (process.env.MONDAY_WORK_ORDERS_BOARD_ID || '').trim();
const API_URL = (process.env.API_Endpoint || 'https://api.monday.com/v2').trim();

console.log('--- Inspecting Real Monday.com Credentials & Boards ---');
console.log('API Endpoint:', API_URL);
console.log('Deals Board ID:', DEALS_BOARD_ID);
console.log('Work Orders Board ID:', WO_BOARD_ID);
console.log('Token Present:', API_TOKEN ? `Yes (length: ${API_TOKEN.length})` : 'NO');

if (!API_TOKEN) {
  console.error('❌ MONDAY_API_TOKEN is missing!');
  process.exit(1);
}

async function queryMonday(query, variables = {}) {
  const response = await fetch(API_URL, {
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

async function inspectBoard(boardId, label) {
  console.log(`\n==================================================`);
  console.log(`📋 Inspecting Board: ${label} (ID: ${boardId})`);
  console.log(`==================================================`);

  const query = `
    query GetBoardDetails($boardIds: [ID!]) {
      boards(ids: $boardIds) {
        id
        name
        state
        columns {
          id
          title
          type
        }
        items_page(limit: 5) {
          cursor
          items {
            id
            name
            column_values {
              id
              text
              value
              type
            }
          }
        }
      }
    }
  `;

  const data = await queryMonday(query, { boardIds: [boardId] });

  if (!data.boards || data.boards.length === 0) {
    console.error(`❌ Board ${boardId} not found or inaccessible!`);
    return null;
  }

  const board = data.boards[0];
  console.log(`Board Name: "${board.name}"`);
  console.log(`Columns Count: ${board.columns.length}`);
  console.log('\nColumns Listing:');
  board.columns.forEach(col => {
    console.log(`  - ID: "${col.id}" | Title: "${col.title}" | Type: ${col.type}`);
  });

  const sampleItems = board.items_page?.items || [];
  console.log(`\nSample Items Fetched (Top ${sampleItems.length}):`);
  sampleItems.forEach((item, idx) => {
    console.log(`\n  Item #${idx + 1}: Name="${item.name}" (ID: ${item.id})`);
    item.column_values.forEach(cv => {
      if (cv.text || cv.value) {
        console.log(`    Col ID "${cv.id}" -> Text: "${cv.text}" | Value: ${cv.value}`);
      }
    });
  });

  return board;
}

async function main() {
  try {
    await inspectBoard(DEALS_BOARD_ID, 'Deals Board');
    await inspectBoard(WO_BOARD_ID, 'Work Orders Board');
  } catch (err) {
    console.error('❌ Inspection Failed:', err.message);
  }
}

main();
