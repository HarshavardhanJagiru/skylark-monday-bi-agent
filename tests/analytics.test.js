import { describe, it, expect } from 'vitest';
import { 
  calculatePipelineMetrics, 
  calculateFinancialMetrics, 
  calculateOperationalMetrics, 
  calculateCrossBoardMetrics,
  getCurrentQuarterInfo,
  getQuarterInfo
} from '../server/services/analyticsService.js';

describe('Deterministic Analytics Engine Tests', () => {
  describe('Dynamic Quarter & Year Calculations', () => {
    it('correctly calculates Q1 info and boundary dates for explicit quarter/year', () => {
      const q = getQuarterInfo({ quarter: 1, year: 2026 });
      expect(q.quarter).toBe(1);
      expect(q.year).toBe(2026);
      expect(q.quarterName).toBe('Q1 2026');
      expect(q.startDate).toBe('2026-01-01');
      expect(q.endDate).toBe('2026-03-31');
    });

    it('correctly calculates Q2 info and boundary dates for explicit quarter/year', () => {
      const q = getQuarterInfo({ quarter: 2, year: 2026 });
      expect(q.quarter).toBe(2);
      expect(q.year).toBe(2026);
      expect(q.quarterName).toBe('Q2 2026');
      expect(q.startDate).toBe('2026-04-01');
      expect(q.endDate).toBe('2026-06-30');
    });

    it('correctly calculates Q3 info and boundary dates for explicit quarter/year', () => {
      const q = getQuarterInfo({ quarter: 3, year: 2026 });
      expect(q.quarter).toBe(3);
      expect(q.year).toBe(2026);
      expect(q.quarterName).toBe('Q3 2026');
      expect(q.startDate).toBe('2026-07-01');
      expect(q.endDate).toBe('2026-09-30');
    });

    it('correctly calculates Q4 info and boundary dates for explicit quarter/year', () => {
      const q = getQuarterInfo({ quarter: 4, year: 2026 });
      expect(q.quarter).toBe(4);
      expect(q.year).toBe(2026);
      expect(q.quarterName).toBe('Q4 2026');
      expect(q.startDate).toBe('2026-10-01');
      expect(q.endDate).toBe('2026-12-31');
    });

    it('defaults to current system year when year is unassigned', () => {
      const refDate = new Date('2026-08-30T00:00:00Z');
      const q = getQuarterInfo({ quarter: 2, referenceDate: refDate });
      expect(q.quarter).toBe(2);
      expect(q.year).toBe(2026);
      expect(q.quarterName).toBe('Q2 2026');
      expect(q.startDate).toBe('2026-04-01');
    });
  });

  describe('Explicit Quarter Pipeline Filtering Tests', () => {
    const sampleDeals = [
      {
        id: '1',
        dealName: 'Q1 Deal 1',
        sector: 'Renewables',
        dealStatus: 'Won',
        dealStage: 'Work Order Received',
        dealValue: 1000000,
        closureProbability: 0.8,
        tentativeCloseDate: '2026-02-15'
      },
      {
        id: '2',
        dealName: 'Q1 Deal 2',
        sector: 'Mining',
        dealStatus: 'Open',
        dealStage: 'Proposal/Commercials Sent',
        dealValue: 2000000,
        closureProbability: 0.5,
        tentativeCloseDate: '2026-03-31' // Boundary date
      },
      {
        id: '3',
        dealName: 'Q2 Deal',
        sector: 'Mining',
        dealStatus: 'Open',
        dealStage: 'Negotiations',
        dealValue: 5000000,
        closureProbability: 0.6,
        tentativeCloseDate: '2026-05-01'
      },
      {
        id: '4',
        dealName: 'Missing Date Deal',
        sector: 'Powerline',
        dealStatus: 'Open',
        dealStage: 'Lead Generated',
        dealValue: 3000000,
        closureProbability: 0.4,
        tentativeCloseDate: null,
        actualCloseDate: null
      }
    ];

    it('filters Q1 2026 explicitly', () => {
      const p = calculatePipelineMetrics(sampleDeals, { filterQuarter: true, quarter: 1, year: 2026 });
      expect(p.isQuarterFiltered).toBe(true);
      expect(p.quarterInfo.quarterName).toBe('Q1 2026');
      expect(p.activeDealsCount).toBe(2);
      expect(p.totalActivePipelineValue).toBe(3000000);
      expect(p.dealsOutsideQuarter).toBe(1);
      expect(p.dealsExcludedMissingDate).toBe(1);
    });

    it('filters Q2 2026 explicitly', () => {
      const p = calculatePipelineMetrics(sampleDeals, { filterQuarter: true, quarter: 2, year: 2026 });
      expect(p.isQuarterFiltered).toBe(true);
      expect(p.quarterInfo.quarterName).toBe('Q2 2026');
      expect(p.activeDealsCount).toBe(1);
      expect(p.totalActivePipelineValue).toBe(5000000);
      expect(p.dealsOutsideQuarter).toBe(2);
    });

    it('preserves total active pipeline when filterQuarter is false', () => {
      const p = calculatePipelineMetrics(sampleDeals, { filterQuarter: false });
      expect(p.isQuarterFiltered).toBe(false);
      expect(p.activeDealsCount).toBe(4);
      expect(p.totalActivePipelineValue).toBe(11000000);
    });
  });

  describe('Financial and Operational Analytics', () => {
    const mockWorkOrders = [
      {
        id: 'WO-1',
        dealName: 'Deal Alpha',
        sector: 'Renewables',
        executionStatus: 'Completed',
        amountExclGst: 1000000,
        billedValue: 1000000,
        collectedAmount: 800000,
        amountReceivable: 200000,
        amountToBeBilled: 0
      },
      {
        id: 'WO-2',
        dealName: 'Deal Beta',
        sector: 'Mining',
        executionStatus: 'Not Started',
        amountExclGst: 2000000,
        billedValue: 0,
        collectedAmount: 0,
        amountReceivable: 0,
        amountToBeBilled: 2000000
      }
    ];

    it('calculates financial receivables metrics accurately', () => {
      const fin = calculateFinancialMetrics(mockWorkOrders);
      expect(fin.totalBilledValue).toBe(1000000);
      expect(fin.totalCollectedAmount).toBe(800000);
      expect(fin.totalAmountReceivable).toBe(200000);
      expect(fin.totalAmountToBeBilled).toBe(2000000);
      expect(fin.collectionRatePercent).toBe(80.0);
    });

    it('calculates operational metrics accurately', () => {
      const ops = calculateOperationalMetrics(mockWorkOrders);
      expect(ops.totalWorkOrders).toBe(2);
      expect(ops.executionStatusBreakdown['Completed']).toBe(1);
      expect(ops.executionStatusBreakdown['Not Started']).toBe(1);
    });
  });
});
