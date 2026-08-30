/**
 * Dynamic Data Normalization & Quality Audit Layer
 * Standardizes text, dates, numbers, and tracks missing fields.
 */

// Sector Canonicalization Map
const SECTOR_CANONICAL_MAP = {
  'energy': 'Energy',
  'renewables': 'Renewables',
  'renewable': 'Renewables',
  'renewables sector': 'Renewables',
  'mining': 'Mining',
  'mining sector': 'Mining',
  'railways': 'Railways',
  'railway': 'Railways',
  'powerline': 'Powerline',
  'powerlines': 'Powerline',
  'power line': 'Powerline',
  'construction': 'Construction',
  'dsp': 'DSP',
  'tender': 'Tender',
  'manufacturing': 'Manufacturing',
  'security and surveillance': 'Security & Surveillance',
  'security & surveillance': 'Security & Surveillance',
  'aviation': 'Aviation',
  'others': 'Others',
  'other': 'Others'
};

/**
 * Robust Field Extractor using Column ID first, then fallback titles
 */
export function getFieldValue(record, colId, ...titles) {
  if (!record) return null;
  // 1. Check stable column ID key
  if (colId && record[`col_${colId}`] !== undefined && record[`col_${colId}`] !== null) {
    return record[`col_${colId}`];
  }
  // 2. Check title keys
  for (const title of titles) {
    if (title && record[title] !== undefined && record[title] !== null) {
      return record[title];
    }
  }
  return null;
}

/**
 * Trim string and canonicalize casing/variants
 */
export function normalizeText(val) {
  if (val === null || val === undefined) return null;
  const str = String(val).trim();
  if (str === '' || str.toLowerCase() === 'nan' || str.toLowerCase() === 'null') return null;
  return str;
}

/**
 * Canonicalize sector names safely
 */
export function normalizeSector(val) {
  const text = normalizeText(val);
  if (!text) return 'Unknown / Unspecified';
  const lower = text.toLowerCase();
  if (SECTOR_CANONICAL_MAP[lower]) {
    return SECTOR_CANONICAL_MAP[lower];
  }
  // Return Title Case string if not explicitly mapped
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

/**
 * Parse currency/numeric fields without introducing fake zeroes
 */
export function parseNumeric(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') {
    return isNaN(val) ? null : val;
  }
  let str = String(val).trim();
  if (str === '' || str.toLowerCase() === 'nan' || str.toLowerCase() === 'null' || str === '-') {
    return null;
  }
  // Remove currency symbols, commas, spaces
  str = str.replace(/[₹$,\s]/g, '');
  const parsed = parseFloat(str);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Convert dates to standard YYYY-MM-DD
 */
export function parseDate(val) {
  if (val === null || val === undefined) return null;
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val.toISOString().split('T')[0];
  }
  
  // Excel serial number format
  if (typeof val === 'number') {
    if (val <= 0 || isNaN(val)) return null;
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const days = Math.floor(val);
    const date = new Date(excelEpoch.getTime() + days * 86400000);
    return date.toISOString().split('T')[0];
  }

  const str = String(val).trim();
  if (str === '' || str.toLowerCase() === 'nan' || str.toLowerCase() === 'null') return null;

  // Check ISO / Monday date string e.g. "2025-09-11 05:00" or "2025-09-11"
  const isoMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10) - 1;
    const day = parseInt(isoMatch[3], 10);
    const dateObj = new Date(Date.UTC(year, month, day));
    if (!isNaN(dateObj.getTime())) {
      return dateObj.toISOString().split('T')[0];
    }
  }

  // Try DD/MM/YYYY
  const ddmmyyyy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (ddmmyyyy) {
    const day = parseInt(ddmmyyyy[1], 10);
    const month = parseInt(ddmmyyyy[2], 10) - 1;
    const year = parseInt(ddmmyyyy[3], 10);
    const dateObj = new Date(Date.UTC(year, month, day));
    if (!isNaN(dateObj.getTime())) {
      return dateObj.toISOString().split('T')[0];
    }
  }

  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }

  return null;
}

/**
 * Clean Deal Stage name by stripping prefix while preserving full title
 */
export function normalizeStage(val) {
  const text = normalizeText(val);
  if (!text) return 'Unspecified Stage';
  const cleaned = text.replace(/^[A-Z]\.\s*/, '');
  return cleaned;
}

/**
 * Normalize an individual Deal record using real Monday.com Column IDs & Titles
 */
export function normalizeDeal(record) {
  const name = getFieldValue(record, 'name', 'Deal Name', 'Item Name', 'name') || record._id;
  const clientCode = getFieldValue(record, 'text_mm6q351b', 'Client Code');
  const ownerCode = getFieldValue(record, 'text_mm6qeh24', 'Owner code');
  const productDeal = getFieldValue(record, 'text_mm6qrcfn', 'Product deal');
  const rawProb = getFieldValue(record, 'text_mm6q45gj', 'Closure Probability', 'Probability');
  const closeDateA = getFieldValue(record, 'date_mm6qrp3a', 'Close Date (A)');
  const tentativeCloseDate = getFieldValue(record, 'date_mm6qaq9d', 'Tentative Close Date');
  const rawStage = getFieldValue(record, 'color_mm6qn9mn', 'Deal Stage', 'Stage');
  const rawStatus = getFieldValue(record, 'color_mm6qf7q8', 'Deal Status', 'Status');
  const rawSector = getFieldValue(record, 'text_mm6qrfsw', 'Sector/service', 'Sector');
  const createdDate = getFieldValue(record, 'date_mm6qbxq6', 'Created Date');
  const rawValue = getFieldValue(record, 'numeric_mm6q8g6f', 'Masked Deal value', 'Deal Value');

  const dealValue = parseNumeric(rawValue);
  const probability = parseNumeric(rawProb);
  const normalizedProb = (probability !== null && probability > 1) ? probability / 100 : probability;

  return {
    id: record._id || name || Math.random().toString(),
    dealName: normalizeText(name) || 'Unnamed Deal',
    ownerCode: normalizeText(ownerCode),
    clientCode: normalizeText(clientCode),
    dealStatus: normalizeText(rawStatus) || 'Unknown',
    dealStage: normalizeStage(rawStage),
    rawStage: normalizeText(rawStage),
    sector: normalizeSector(rawSector),
    dealValue: dealValue,
    closureProbability: normalizedProb,
    tentativeCloseDate: parseDate(tentativeCloseDate),
    actualCloseDate: parseDate(closeDateA),
    createdDate: parseDate(createdDate),
    productDeal: normalizeText(productDeal)
  };
}

/**
 * Normalize an individual Work Order record using real Monday.com Column IDs & Titles
 */
export function normalizeWorkOrder(record) {
  const dealName = getFieldValue(record, 'name', 'Deal name masked', 'Deal Name', 'Item Name');
  const customerCode = getFieldValue(record, 'text_mm6q6pe9', 'Customer Name Code');
  const serialNumber = getFieldValue(record, 'text_mm6qc8c6', 'Serial #');
  const natureOfWork = getFieldValue(record, 'text_mm6qzqvp', 'Nature of Work');
  const execStatus = getFieldValue(record, 'color_mm6q6xqq', 'Execution Status');
  const dataDeliveryDate = getFieldValue(record, 'date_mm6qaw67', 'Data Delivery Date');
  const poDate = getFieldValue(record, 'date_mm6q29mj', 'Date of PO/LOI');
  const startDate = getFieldValue(record, 'date_mm6q9gns', 'Probable Start Date');
  const endDate = getFieldValue(record, 'date_mm6qr4dr', 'Probable End Date');
  const sector = getFieldValue(record, 'text_mm6qzqn8', 'Sector');
  const typeOfWork = getFieldValue(record, 'text_mm6qnv6q', 'Type of Work');

  const amountExclGst = parseNumeric(getFieldValue(record, 'numeric_mm6qjmxa', 'Amount Excl. GST', 'Amount in Rupees (Excl of GST) (Masked)'));
  const amountInclGst = parseNumeric(getFieldValue(record, 'numeric_mm6qr798', 'Amount Incl. GST', 'Amount in Rupees (Incl of GST) (Masked)'));
  const billedValueExcl = parseNumeric(getFieldValue(record, 'numeric_mm6qapm6', 'Billed Value Excl. GST', 'Billed Value in Rupees (Excl of GST.) (Masked)'));
  const billedValueIncl = parseNumeric(getFieldValue(record, 'numeric_mm6qb0a2', 'Billed Value Incl. GST', 'Billed Value in Rupees (Incl of GST.) (Masked)'));
  const collectedAmount = parseNumeric(getFieldValue(record, 'numeric_mm6qycw3', 'Collected Amount', 'Collected Amount in Rupees (Incl of GST.) (Masked)'));
  const amountToBeBilledExcl = parseNumeric(getFieldValue(record, 'numeric_mm6q58jw', 'Amount to be billed Excl. GST', 'Amount to be billed in Rs. (Exl. of GST) (Masked)'));
  const amountToBeBilledIncl = parseNumeric(getFieldValue(record, 'numeric_mm6qc17x', 'Amount to be billed Incl. GST'));
  const amountReceivable = parseNumeric(getFieldValue(record, 'numeric_mm6qbzbw', 'Amount Receivable', 'Amount Receivable (Masked)'));

  const arPriority = getFieldValue(record, 'text_mm6qqa00', 'AR Priority');
  const qtyByOps = getFieldValue(record, 'numeric_mm6qjw20', 'Quantity by Ops');
  const qtyPo = getFieldValue(record, 'text_mm6qsxm2', 'Quantities as per PO');
  const qtyBilled = parseNumeric(getFieldValue(record, 'numeric_mm6qv3zk', 'Quantity billed'));
  const balanceQty = parseNumeric(getFieldValue(record, 'numeric_mm6qgeb9', 'Balance in quantity'));

  const invoiceStatus = getFieldValue(record, 'color_mm6qnsg4', 'Invoice Status');
  const expectedBillingMonth = getFieldValue(record, 'text_mm6qd7sm', 'Expected Billing Month');
  const actualBillingMonth = getFieldValue(record, 'text_mm6qg6g5', 'Actual Billing Month');
  const actualCollectionMonth = getFieldValue(record, 'text_mm6qxarf', 'Actual Collection Month');
  const woStatus = getFieldValue(record, 'color_mm6qy5fx', 'WO Status');
  const collectionStatus = getFieldValue(record, 'text_mm6q3d4q', 'Collection status');
  const collectionDate = getFieldValue(record, 'text_mm6qggn9', 'Collection Date');
  const billingStatus = getFieldValue(record, 'color_mm6qh0eq', 'Billing Status');

  return {
    id: record._id || serialNumber || Math.random().toString(),
    dealName: normalizeText(dealName) || 'Unnamed WO',
    customerCode: normalizeText(customerCode),
    serialNumber: normalizeText(serialNumber),
    natureOfWork: normalizeText(natureOfWork),
    executionStatus: normalizeText(execStatus) || 'Unspecified',
    poDate: parseDate(poDate),
    probableStartDate: parseDate(startDate),
    probableEndDate: parseDate(endDate),
    dataDeliveryDate: parseDate(dataDeliveryDate),
    sector: normalizeSector(sector),
    typeOfWork: normalizeText(typeOfWork),
    amountExclGst,
    amountInclGst,
    billedValue: billedValueExcl ?? billedValueIncl,
    collectedAmount,
    amountToBeBilled: amountToBeBilledExcl ?? amountToBeBilledIncl,
    amountReceivable,
    arPriority: normalizeText(arPriority),
    qtyByOps: parseNumeric(qtyByOps),
    qtyPo: normalizeText(qtyPo),
    qtyBilled,
    balanceQty,
    invoiceStatus: normalizeText(invoiceStatus),
    expectedBillingMonth: normalizeText(expectedBillingMonth),
    actualBillingMonth: normalizeText(actualBillingMonth),
    actualCollectionMonth: normalizeText(actualCollectionMonth),
    woStatus: normalizeText(woStatus),
    collectionStatus: normalizeText(collectionStatus),
    collectionDate: parseDate(collectionDate),
    billingStatus: normalizeText(billingStatus)
  };
}

/**
 * Audit Data Quality across normalized datasets
 */
export function auditDataQuality(deals, workOrders) {
  const caveats = [];

  const totalDeals = deals.length;
  const missingDealValue = deals.filter(d => d.dealValue === null).length;
  const missingProb = deals.filter(d => d.closureProbability === null).length;
  const missingCloseDate = deals.filter(d => d.tentativeCloseDate === null && d.actualCloseDate === null).length;

  if (missingDealValue > 0) {
    caveats.push(`${missingDealValue} of ${totalDeals} deal records do not have a deal value recorded and are excluded from financial totals.`);
  }
  if (missingProb > 0) {
    caveats.push(`${missingProb} deal records are missing closure probability, so weighted pipeline excludes those specific records.`);
  }
  if (missingCloseDate > 0) {
    caveats.push(`${missingCloseDate} active deals lack target closure dates, which may affect quarter-level forecasting.`);
  }

  const totalWO = workOrders.length;
  const missingExecStatus = workOrders.filter(w => !w.executionStatus || w.executionStatus === 'Unspecified').length;
  const missingReceivables = workOrders.filter(w => w.amountReceivable === null).length;

  if (missingExecStatus > 0) {
    caveats.push(`${missingExecStatus} of ${totalWO} work orders are missing explicit execution status.`);
  }
  if (missingReceivables > 0) {
    caveats.push(`${missingReceivables} work orders do not contain receivable values.`);
  }

  return {
    dealsCount: totalDeals,
    workOrdersCount: totalWO,
    missingDealValue,
    missingProb,
    missingCloseDate,
    missingExecStatus,
    caveats
  };
}
