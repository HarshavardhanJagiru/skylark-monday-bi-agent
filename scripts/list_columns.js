import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const API_TOKEN = (process.env.MONDAY_API_TOKEN || '').trim();
const DEALS_BOARD_ID = (process.env.MONDAY_DEALS_BOARD_ID || '').trim();
const WO_BOARD_ID = (process.env.MONDAY_WORK_ORDERS_BOARD_ID || '').trim();
const API_URL = (process.env.API_Endpoint || 'https://api.monday.com/v2').trim();

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

  const json = await response.json();
  return json.data;
}

async function getBoardColumns(boardId, label) {
  const query = `
    query GetColumns($boardIds: [ID!]) {
      boards(ids: $boardIds) {
        id
        name
        columns {
          id
          title
          type
        }
      }
    }
  `;
  const data = await queryMonday(query, { boardIds: [boardId] });
  const board = data.boards[0];
  console.log(`\n=== BOARD: ${label} ("${board.name}", ID: ${boardId}) ===`);
  board.columns.forEach(c => {
    console.log(`ID: "${c.id}" | Title: "${c.title}" | Type: ${c.type}`);
  });
}

async function main() {
  await getBoardColumns(DEALS_BOARD_ID, 'Deals');
  await getBoardColumns(WO_BOARD_ID, 'Work Orders');
}

main();
