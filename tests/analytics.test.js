import { describe, it, expect } from 'vitest';
import { 
  calculatePipelineMetrics, 
  calculateFinancialMetrics, 
  calculateOperationalMetrics, 
  calculateCrossBoardMetrics 
} from '../server/services/analyticsService.js';

describe('Deterministic Analytics Engine Tests', () => {
  const mockDeals = [
    {
      id: '1',
      dealName: 'Deal Alpha',
      sector: 'Renewables',
      dealStatus: 'Won',
      dealStage: 'Work Order Received',
      dealValue: 1000000,
      closureProbability: 0.8,
      tentativeCloseDate: '2025-11-01'
    },
    {
      id: '2',
      dealName: 'Deal Beta',
      sector: 'Mining',
      dealStatus: 'Open',
      dealStage: 'Proposal/Commercials Sent',
      dealValue: 2000000,
      closureProbability: 0.5,
      tentativeCloseDate: '2025-12-01'
    },
    {
      id: '3',
      dealName: 'Deal Gamma',
      sector: 'Mining',
      dealStatus: 'Dead',
      dealStage: 'Project Lost',
      dealValue: 500000,
      closureProbability: 0,
      tentativeCloseDate: '2025-08-01'
    }
  ];

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

  it('calculates pipeline metrics accurately', () => {
    const pipeline = calculatePipelineMetrics(mockDeals);
    expect(pipeline.totalDealsCount).toBe(3);
    expect(pipeline.activeDealsCount).toBe(2);
    expect(pipeline.totalActivePipelineValue).toBe(3000000);
    // (1,000,000 * 0.8) + (2,000,000 * 0.5) = 800,000 + 1,000,000 = 1,800,000
    expect(pipeline.weightedPipelineValue).toBe(1800000);
  });

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

  it('calculates cross-board sector metrics', () => {
    const cb = calculateCrossBoardMetrics(mockDeals, mockWorkOrders);
    expect(cb.sectorsCount).toBe(2);
    const miningSector = cb.sectorComparison.find(s => s.sector === 'Mining');
    expect(miningSector.pipelineValue).toBe(2000000);
    expect(miningSector.workOrdersCount).toBe(1);
  });
});
