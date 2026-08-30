import { describe, it, expect } from 'vitest';
import { 
  calculatePipelineMetrics, 
  calculateCustomerMetrics,
  calculateFinancialMetrics, 
  calculateOperationalMetrics, 
  calculateCrossBoardMetrics,
  getCurrentQuarterInfo,
  getQuarterInfo
} from '../server/services/analyticsService.js';
import { aiService } from '../server/services/aiService.js';

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

  describe('Authoritative Quarter Intent Classification', () => {
    it('ensures local regex forces isQuarterQuery === true even when Gemini returns false', async () => {
      const res = await aiService.classifyIntent('How is our pipeline looking this quarter?');
      expect(res.isQuarterQuery).toBe(true);
    });

    it('detects explicit quarter queries correctly', async () => {
      const q1 = await aiService.classifyIntent('How was our pipeline in Q1 2026?');
      expect(q1.isQuarterQuery).toBe(true);
      expect(q1.targetQuarter).toBe(1);
      expect(q1.targetYear).toBe(2026);
    });
  });

  describe('Explicit Quarter & Sector Pipeline Filtering Tests', () => {
    const sampleDeals = [
      {
        id: '1',
        dealName: 'Q1 Deal 1',
        clientCode: 'COMPANY100',
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
        clientCode: 'COMPANY200',
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
        clientCode: 'COMPANY100',
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
        clientCode: 'COMPANY300',
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

    it('filters sector correctly for existing sector Mining', () => {
      const p = calculatePipelineMetrics(sampleDeals, { sector: 'Mining' });
      expect(p.isSectorFiltered).toBe(true);
      expect(p.targetSector).toBe('Mining');
      expect(p.activeDealsCount).toBe(2);
      expect(p.totalActivePipelineValue).toBe(7000000); // 2m + 5m
    });

    it('returns zero matching deals and zero pipeline value for nonexistent sector Aerospace', () => {
      const p = calculatePipelineMetrics(sampleDeals, { sector: 'Aerospace' });
      expect(p.isSectorFiltered).toBe(true);
      expect(p.targetSector).toBe('Aerospace');
      expect(p.activeDealsCount).toBe(0);
      expect(p.totalActivePipelineValue).toBe(0);
    });

    it('preserves total active pipeline when no sector or quarter filter is applied', () => {
      const p = calculatePipelineMetrics(sampleDeals, { filterQuarter: false });
      expect(p.isQuarterFiltered).toBe(false);
      expect(p.isSectorFiltered).toBe(false);
      expect(p.activeDealsCount).toBe(4);
      expect(p.totalActivePipelineValue).toBe(11000000);
    });

    it('calculates customer metrics and ranks top customers by deal value', () => {
      const cust = calculateCustomerMetrics(sampleDeals);
      expect(cust.totalCustomersCount).toBe(3);
      expect(cust.topCustomers[0].clientCode).toBe('COMPANY100');
      expect(cust.topCustomers[0].totalPipelineValue).toBe(6000000); // 1m + 5m
      expect(cust.topCustomers[1].clientCode).toBe('COMPANY300');
      expect(cust.topCustomers[1].totalPipelineValue).toBe(3000000);
      expect(cust.topCustomers[2].clientCode).toBe('COMPANY200');
      expect(cust.topCustomers[2].totalPipelineValue).toBe(2000000);
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
