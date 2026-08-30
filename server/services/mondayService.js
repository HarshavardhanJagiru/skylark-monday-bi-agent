import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import xlsx from 'xlsx';

const DEFAULT_API_URL = 'https://api.monday.com/v2';

/**
 * Service to handle dynamic Monday.com GraphQL API communication
 */
class MondayService {
  constructor() {
    this.cache = {
      deals: null,
      workOrders: null,
      lastFetched: 0
    };
    // Cache TTL: 60 seconds
    this.cacheTTL = 60 * 1000;
  }

  getApiToken() {
    return (process.env.MONDAY_API_TOKEN || '').trim();
  }

  getDealsBoardId() {
    return (process.env.MONDAY_DEALS_BOARD_ID || '').trim();
  }

  getWorkOrdersBoardId() {
    return (process.env.MONDAY_WORK_ORDERS_BOARD_ID || '').trim();
  }

  getApiUrl() {
    return (process.env.API_Endpoint || DEFAULT_API_URL).trim();
  }

  /**
   * Helper to execute GraphQL queries against Monday.com API
   */
  async queryMonday(query, variables = {}) {
    const token = this.getApiToken();
    if (!token) {
      throw new Error('MONDAY_API_TOKEN is not configured in environment variables.');
    }

    const apiUrl = this.getApiUrl();
    let response;
    try {
      response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token,
          'API-Version': '2024-01'
        },
        body: JSON.stringify({ query, variables })
      });
    } catch (netErr) {
      throw new Error(`Monday API Network Error: ${netErr.message}`);
    }

    if (!response.ok) {
      const errText = await response.text();
      if (response.status === 401 || response.status === 403) {
        throw new Error('Monday API Authentication Failed: Invalid or expired MONDAY_API_TOKEN.');
      }
      throw new Error(`Monday API HTTP Error ${response.status}: ${errText}`);
    }

    const json = await response.json();
    if (json.errors && json.errors.length > 0) {
      const msg = json.errors.map(e => e.message).join(', ');
      if (msg.includes('invalid board') || msg.includes('Not Authenticated')) {
        throw new Error(`Monday API Error: ${msg}`);
      }
      throw new Error(`Monday GraphQL Error: ${msg}`);
    }

    return json.data;
  }

  /**
   * Fetch all items dynamically from a given board ID handling pagination
   */
  async fetchBoardData(boardId) {
    const cleanBoardId = (boardId || '').trim();
    if (!cleanBoardId) {
      throw new Error('Board ID is required and cannot be empty.');
    }

    let allItems = [];
    let columns = [];
    let cursor = null;
    let boardName = '';

    do {
      const query = `
        query GetBoardItems($boardIds: [ID!], $cursor: String) {
          boards(ids: $boardIds) {
            id
            name
            columns {
              id
              title
              type
            }
            items_page(limit: 500, cursor: $cursor) {
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

      const data = await this.queryMonday(query, {
        boardIds: [cleanBoardId],
        cursor
      });

      if (!data.boards || data.boards.length === 0) {
        throw new Error(`Board ID ${cleanBoardId} not found or inaccessible.`);
      }

      const board = data.boards[0];
      boardName = board.name;
      columns = board.columns || [];

      const itemsPage = board.items_page;
      if (itemsPage && itemsPage.items) {
        allItems = allItems.concat(itemsPage.items);
        cursor = itemsPage.cursor;
      } else {
        cursor = null;
      }
    } while (cursor);

    // Build column ID and column title maps
    const columnMap = {};
    columns.forEach(col => {
      columnMap[col.id] = col.title;
    });

    const records = allItems.map(item => {
      const record = {
        _id: item.id,
        'Item Name': item.name,
        'Deal Name': item.name,
        'Deal name masked': item.name
      };

      if (item.column_values) {
        item.column_values.forEach(cv => {
          // Store by column ID (stable key)
          record[`col_${cv.id}`] = cv.text;

          // Also store by column title (human-readable key)
          const title = columnMap[cv.id];
          if (title) {
            record[title] = cv.text;
          }
        });
      }
      return record;
    });

    return { boardName, columns, records, count: records.length };
  }

  /**
   * Dynamic fallback parser for offline local datasets if API credentials are not provided
   */
  loadExcelFallback(filePath, sheetName) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Fallback data file not found at ${filePath}`);
    }
    const workbook = xlsx.readFile(filePath);
    const sheet = workbook.Sheets[sheetName || workbook.SheetNames[0]];
    const rawRecords = xlsx.utils.sheet_to_json(sheet, { defval: null });

    if (rawRecords.length > 0 && rawRecords[0]['__EMPTY'] === 'Deal name masked') {
      const headers = rawRecords[0];
      const cleanRecords = [];
      for (let i = 1; i < rawRecords.length; i++) {
        const row = rawRecords[i];
        const cleanRow = {};
        Object.keys(row).forEach(k => {
          const headerName = headers[k];
          if (headerName) {
            cleanRow[headerName] = row[k];
          }
        });
        cleanRecords.push(cleanRow);
      }
      return cleanRecords;
    }

    return rawRecords;
  }

  /**
   * Get Deals board items live from Monday.com (with fallback if credentials unconfigured)
   */
  async getDealsData() {
    const now = Date.now();
    if (this.cache.deals && (now - this.cache.lastFetched < this.cacheTTL)) {
      return this.cache.deals;
    }

    const token = this.getApiToken();
    const boardId = this.getDealsBoardId();
    let source = 'monday_api';
    let data;
    let columns = [];
    let boardName = '';

    if (token && boardId) {
      const boardResult = await this.fetchBoardData(boardId);
      data = boardResult.records;
      columns = boardResult.columns;
      boardName = boardResult.boardName;
    } else {
      source = 'excel_fallback';
      data = this.loadExcelFallback('data/Deal funnel Data.xlsx', 'Deal tracker');
    }

    const result = { source, boardName, columns, records: data, count: data.length };
    this.cache.deals = result;
    this.cache.lastFetched = now;
    return result;
  }

  /**
   * Get Work Orders board items live from Monday.com (with fallback if credentials unconfigured)
   */
  async getWorkOrdersData() {
    const now = Date.now();
    if (this.cache.workOrders && (now - this.cache.lastFetched < this.cacheTTL)) {
      return this.cache.workOrders;
    }

    const token = this.getApiToken();
    const boardId = this.getWorkOrdersBoardId();
    let source = 'monday_api';
    let data;
    let columns = [];
    let boardName = '';

    if (token && boardId) {
      const boardResult = await this.fetchBoardData(boardId);
      data = boardResult.records;
      columns = boardResult.columns;
      boardName = boardResult.boardName;
    } else {
      source = 'excel_fallback';
      data = this.loadExcelFallback('data/Work_Order_Tracker Data.xlsx', 'work order tracker');
    }

    const result = { source, boardName, columns, records: data, count: data.length };
    this.cache.workOrders = result;
    this.cache.lastFetched = now;
    return result;
  }

  /**
   * Clear in-memory cache
   */
  clearCache() {
    this.cache = { deals: null, workOrders: null, lastFetched: 0 };
  }
}

export const mondayService = new MondayService();
