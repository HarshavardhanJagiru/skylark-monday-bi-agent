import { describe, it, expect } from 'vitest';
import { 
  normalizeSector, 
  parseNumeric, 
  parseDate, 
  normalizeDeal, 
  normalizeWorkOrder,
  auditDataQuality 
} from '../server/services/normalizationService.js';

describe('Data Normalization Layer Tests', () => {
  describe('Sector Normalization', () => {
    it('canonicalizes variations of sector names', () => {
      expect(normalizeSector('energy')).toBe('Energy');
      expect(normalizeSector('ENERGY')).toBe('Energy');
      expect(normalizeSector(' Renewables ')).toBe('Renewables');
      expect(normalizeSector('mining sector')).toBe('Mining');
      expect(normalizeSector('powerline')).toBe('Powerline');
      expect(normalizeSector(null)).toBe('Unknown / Unspecified');
    });
  });

  describe('Numeric Currency Parsing', () => {
    it('safely parses currency strings without turning nulls into zeroes', () => {
      expect(parseNumeric('₹ 1,54,150')).toBe(154150);
      expect(parseNumeric('264398.08')).toBe(264398.08);
      expect(parseNumeric(' - ')).toBeNull();
      expect(parseNumeric(null)).toBeNull();
      expect(parseNumeric(undefined)).toBeNull();
      expect(parseNumeric('')).toBeNull();
      expect(parseNumeric(0)).toBe(0);
    });
  });

  describe('Date Parsing', () => {
    it('parses valid dates and returns YYYY-MM-DD or null', () => {
      expect(parseDate('2025-09-27')).toBe('2025-09-27');
      expect(parseDate('27/09/2025')).toBe('2025-09-27');
      expect(parseDate(45927)).toBe('2025-09-27'); // Excel serial number
      expect(parseDate(null)).toBeNull();
      expect(parseDate('invalid date')).toBeNull();
    });
  });

  describe('Record Normalization', () => {
    it('normalizes Deal records properly', () => {
      const raw = {
        'Deal Name': ' Test Deal ',
        'Sector/service': ' mining ',
        'Masked Deal value': '₹ 5,00,000',
        'Closure Probability': '75%',
        'Tentative Close Date': '2025-12-31',
        'Deal Status': 'Won',
        'Deal Stage': 'H. Work Order Received'
      };
      const deal = normalizeDeal(raw);
      expect(deal.dealName).toBe('Test Deal');
      expect(deal.sector).toBe('Mining');
      expect(deal.dealValue).toBe(500000);
      expect(deal.closureProbability).toBe(0.75);
      expect(deal.tentativeCloseDate).toBe('2025-12-31');
      expect(deal.dealStage).toBe('Work Order Received');
    });
  });

  describe('Data Quality Audit', () => {
    it('audits missing values and outputs structured caveats', () => {
      const deals = [
        { dealName: 'D1', dealValue: null, closureProbability: 0.5, tentativeCloseDate: null, actualCloseDate: null },
        { dealName: 'D2', dealValue: 100000, closureProbability: null, tentativeCloseDate: '2025-10-10' }
      ];
      const wos = [
        { executionStatus: 'Unspecified', amountReceivable: null }
      ];
      const audit = auditDataQuality(deals, wos);
      expect(audit.missingDealValue).toBe(1);
      expect(audit.missingProb).toBe(1);
      expect(audit.missingCloseDate).toBe(1);
      expect(audit.caveats.length).toBeGreaterThan(0);
    });
  });
});
