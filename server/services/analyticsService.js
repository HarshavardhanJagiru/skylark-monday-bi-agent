import { normalizeDeal, normalizeWorkOrder, auditDataQuality } from './normalizationService.js';

/**
 * Deterministic Business Intelligence Calculations Engine
 * All numerical calculations are strictly computed in JavaScript.
 */

/**
 * Calculate quarter info from target quarter/year or reference Date
 */
export function getQuarterInfo({ quarter = null, year = null, referenceDate = new Date() } = {}) {
  const dateObj = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  const validDate = isNaN(dateObj.getTime()) ? new Date() : dateObj;

  const currentYear = validDate.getUTCFullYear();
  const currentMonth = validDate.getUTCMonth(); // 0-indexed: 0-11
  const currentQIndex = Math.floor(currentMonth / 3);

  // Parse target quarter (1, 2, 3, 4) if provided, otherwise default to current quarter
  const parsedQ = (quarter !== null && !isNaN(parseInt(quarter, 10))) ? parseInt(quarter, 10) : (currentQIndex + 1);
  const targetQ = (parsedQ >= 1 && parsedQ <= 4) ? parsedQ : (currentQIndex + 1);

  // Parse target year (e.g. 2026) if provided, otherwise default to current system year
  const parsedYear = (year !== null && !isNaN(parseInt(year, 10))) ? parseInt(year, 10) : currentYear;
  const targetYear = (parsedYear > 1900) ? parsedYear : currentYear;

  const quarterName = `Q${targetQ} ${targetYear}`;
  const qStartMonth = (targetQ - 1) * 3;
  const qEndMonth = qStartMonth + 2;

  // Start of quarter: YYYY-MM-01
  const startMonthStr = String(qStartMonth + 1).padStart(2, '0');
  const startDate = `${targetYear}-${startMonthStr}-01`;

  // End of quarter: last day of third month
  const lastDay = new Date(Date.UTC(targetYear, qEndMonth + 1, 0)).getUTCDate();
  const endMonthStr = String(qEndMonth + 1).padStart(2, '0');
  const endDate = `${targetYear}-${endMonthStr}-${String(lastDay).padStart(2, '0')}`;

  return {
    year: targetYear,
    quarter: targetQ,
    quarterName,
    startDate,
    endDate
  };
}

/**
 * Backward compatibility helper for current quarter
 */
export function getCurrentQuarterInfo(refDate = new Date()) {
  return getQuarterInfo({ referenceDate: refDate });
}

/**
 * Calculate Pipeline Analytics from raw/normalized Deals
 * Supports dynamic quarter-level filtering for specific target quarter & year
 */
export function calculatePipelineMetrics(normalizedDeals, options = {}) {
  // Filter out null records from header artifact removal
  const cleanDeals = (normalizedDeals || []).filter(Boolean);

  const { filterQuarter = false, quarter = null, year = null, referenceDate = new Date() } = options;
  const quarterInfo = getQuarterInfo({ quarter, year, referenceDate });

  // Active Deals Filtering Condition
  const activeDeals = cleanDeals.filter(d => 
    d.dealStatus !== 'Dead' && 
    !['Project Lost', 'L. Project Lost', 'O. Not Relevant at all', 'N. Not relevant at the moment'].includes(d.dealStage)
  );

  let dealsToProcess = activeDeals;
  let dealsExcludedMissingDate = 0;
  let dealsOutsideQuarter = 0;
  let dealsIncludedInQuarter = 0;

  if (filterQuarter) {
    dealsToProcess = [];
    activeDeals.forEach(deal => {
      // Field Selection: Tentative Close Date as primary expected close date, falling back to Close Date (A)
      const expectedCloseDate = deal.tentativeCloseDate || deal.actualCloseDate;
      if (!expectedCloseDate) {
        dealsExcludedMissingDate++;
      } else if (expectedCloseDate >= quarterInfo.startDate && expectedCloseDate <= quarterInfo.endDate) {
        dealsToProcess.push(deal);
        dealsIncludedInQuarter++;
      } else {
        dealsOutsideQuarter++;
      }
    });
  }

  let totalActivePipelineValue = 0;
  let weightedPipelineValue = 0;
  let dealsWithValueCount = 0;
  let dealsWithProbCount = 0;

  const stageBreakdown = {};
  const sectorBreakdown = {};
  const missingCloseDates = [];
  const approachingCloseDates = [];

  const todayStr = new Date().toISOString().split('T')[0];

  dealsToProcess.forEach(deal => {
    // Value accumulation
    if (deal.dealValue !== null) {
      totalActivePipelineValue += deal.dealValue;
      dealsWithValueCount++;
    }

    // Weighted value accumulation
    if (deal.dealValue !== null && deal.closureProbability !== null) {
      weightedPipelineValue += deal.dealValue * deal.closureProbability;
      dealsWithProbCount++;
    }

    // Stage breakdown
    const stage = deal.dealStage;
    if (!stageBreakdown[stage]) {
      stageBreakdown[stage] = { count: 0, totalValue: 0, deals: [] };
    }
    stageBreakdown[stage].count++;
    stageBreakdown[stage].totalValue += (deal.dealValue || 0);
    stageBreakdown[stage].deals.push(deal.dealName);

    // Sector breakdown
    const sector = deal.sector;
    if (!sectorBreakdown[sector]) {
      sectorBreakdown[sector] = { count: 0, totalValue: 0, weightedValue: 0 };
    }
    sectorBreakdown[sector].count++;
    sectorBreakdown[sector].totalValue += (deal.dealValue || 0);
    if (deal.dealValue !== null && deal.closureProbability !== null) {
      sectorBreakdown[sector].weightedValue += deal.dealValue * deal.closureProbability;
    }

    // Close date checks
    if (!deal.tentativeCloseDate && !deal.actualCloseDate) {
      missingCloseDates.push(deal);
    } else {
      const targetDate = deal.tentativeCloseDate || deal.actualCloseDate;
      if (targetDate && targetDate >= todayStr) {
        approachingCloseDates.push(deal);
      }
    }
  });

  return {
    isQuarterFiltered: filterQuarter,
    quarterInfo: filterQuarter ? quarterInfo : null,
    totalDealsCount: cleanDeals.length,
    activeDealsCountBeforeFilter: activeDeals.length,
    activeDealsCount: dealsToProcess.length,
    dealsIncludedInQuarter,
    dealsExcludedMissingDate,
    dealsOutsideQuarter,
    totalActivePipelineValue,
    weightedPipelineValue,
    dealsWithValueCount,
    dealsWithProbCount,
    stageBreakdown,
    sectorBreakdown,
    missingCloseDatesCount: missingCloseDates.length,
    approachingCloseDatesCount: approachingCloseDates.length,
    activeDealsSample: dealsToProcess.slice(0, 5)
  };
}

/**
 * Calculate Financial Analytics from normalized Work Orders
 */
export function calculateFinancialMetrics(normalizedWorkOrders) {
  const cleanWorkOrders = (normalizedWorkOrders || []).filter(Boolean);

  let totalBilledValue = 0;
  let totalCollectedAmount = 0;
  let totalAmountReceivable = 0;
  let totalAmountToBeBilled = 0;
  let totalOrderValueExclGst = 0;

  let billedCount = 0;
  let collectedCount = 0;
  let receivableCount = 0;
  let tobeBilledCount = 0;

  cleanWorkOrders.forEach(wo => {
    if (wo.amountExclGst !== null) {
      totalOrderValueExclGst += wo.amountExclGst;
    }
    if (wo.billedValue !== null) {
      totalBilledValue += wo.billedValue;
      if (wo.billedValue > 0) billedCount++;
    }
    if (wo.collectedAmount !== null) {
      totalCollectedAmount += wo.collectedAmount;
      if (wo.collectedAmount > 0) collectedCount++;
    }
    if (wo.amountReceivable !== null) {
      totalAmountReceivable += wo.amountReceivable;
      if (wo.amountReceivable > 0) receivableCount++;
    }
    if (wo.amountToBeBilled !== null) {
      totalAmountToBeBilled += wo.amountToBeBilled;
      if (wo.amountToBeBilled > 0) tobeBilledCount++;
    }
  });

  const collectionRate = totalBilledValue > 0 
    ? ((totalCollectedAmount / totalBilledValue) * 100).toFixed(1)
    : '0.0';

  return {
    totalWorkOrdersCount: cleanWorkOrders.length,
    totalOrderValueExclGst,
    totalBilledValue,
    totalCollectedAmount,
    totalAmountReceivable,
    totalAmountToBeBilled,
    collectionRatePercent: parseFloat(collectionRate),
    billedCount,
    collectedCount,
    receivableCount,
    tobeBilledCount
  };
}

/**
 * Calculate Operational Analytics from Work Orders
 */
export function calculateOperationalMetrics(normalizedWorkOrders) {
  const cleanWorkOrders = (normalizedWorkOrders || []).filter(Boolean);

  const executionStatusBreakdown = {};
  const woStatusBreakdown = {};
  const billingStatusBreakdown = {};
  const delayedProjects = [];

  const todayStr = new Date().toISOString().split('T')[0];

  cleanWorkOrders.forEach(wo => {
    // Execution Status
    const status = wo.executionStatus || 'Unspecified';
    executionStatusBreakdown[status] = (executionStatusBreakdown[status] || 0) + 1;

    // WO Status (billed)
    const woStat = wo.woStatus || 'Unspecified';
    woStatusBreakdown[woStat] = (woStatusBreakdown[woStat] || 0) + 1;

    // Billing Status
    const billStat = wo.billingStatus || 'Unspecified';
    billingStatusBreakdown[billStat] = (billingStatusBreakdown[billStat] || 0) + 1;

    // Delayed or overdue work orders
    if (wo.probableEndDate && wo.probableEndDate < todayStr && status !== 'Completed') {
      delayedProjects.push({
        id: wo.id,
        dealName: wo.dealName,
        customerCode: wo.customerCode,
        sector: wo.sector,
        executionStatus: wo.executionStatus,
        probableEndDate: wo.probableEndDate,
        amountExclGst: wo.amountExclGst
      });
    } else if (status === 'Not Started' || status === 'On Hold') {
      if (wo.amountExclGst && wo.amountExclGst > 500000) {
        delayedProjects.push({
          id: wo.id,
          dealName: wo.dealName,
          customerCode: wo.customerCode,
          sector: wo.sector,
          executionStatus: wo.executionStatus,
          probableEndDate: wo.probableEndDate || 'N/A',
          amountExclGst: wo.amountExclGst
        });
      }
    }
  });

  return {
    totalWorkOrders: cleanWorkOrders.length,
    executionStatusBreakdown,
    woStatusBreakdown,
    billingStatusBreakdown,
    delayedProjectsCount: delayedProjects.length,
    delayedProjects: delayedProjects.slice(0, 10)
  };
}

/**
 * Calculate Cross-Board Metrics by Sector (Sales Pipeline vs Work Order Execution)
 */
export function calculateCrossBoardMetrics(normalizedDeals, normalizedWorkOrders) {
  const pipelineMetrics = calculatePipelineMetrics(normalizedDeals, { filterQuarter: false });
  const financialMetrics = calculateFinancialMetrics(normalizedWorkOrders);

  const sectorComparison = {};

  // Aggregate Deals by Sector
  Object.entries(pipelineMetrics.sectorBreakdown).forEach(([sector, data]) => {
    sectorComparison[sector] = {
      sector,
      activeDealsCount: data.count,
      pipelineValue: data.totalValue,
      weightedPipelineValue: data.weightedValue,
      workOrdersCount: 0,
      completedWOCount: 0,
      inProgressWOCount: 0,
      totalBilledValue: 0,
      totalCollectedAmount: 0,
      totalReceivable: 0
    };
  });

  // Aggregate Work Orders by Sector
  const cleanWorkOrders = (normalizedWorkOrders || []).filter(Boolean);
  cleanWorkOrders.forEach(wo => {
    const sector = wo.sector;
    if (!sectorComparison[sector]) {
      sectorComparison[sector] = {
        sector,
        activeDealsCount: 0,
        pipelineValue: 0,
        weightedPipelineValue: 0,
        workOrdersCount: 0,
        completedWOCount: 0,
        inProgressWOCount: 0,
        totalBilledValue: 0,
        totalCollectedAmount: 0,
        totalReceivable: 0
      };
    }

    sectorComparison[sector].workOrdersCount++;
    if (wo.executionStatus === 'Completed') sectorComparison[sector].completedWOCount++;
    if (wo.executionStatus === 'In Progress') sectorComparison[sector].inProgressWOCount++;
    if (wo.billedValue) sectorComparison[sector].totalBilledValue += wo.billedValue;
    if (wo.collectedAmount) sectorComparison[sector].totalCollectedAmount += wo.collectedAmount;
    if (wo.amountReceivable) sectorComparison[sector].totalReceivable += wo.amountReceivable;
  });

  // Insights / Bottleneck Identification
  const crossBoardAnalysis = Object.values(sectorComparison).map(sc => {
    const execRate = sc.workOrdersCount > 0 
      ? Math.round((sc.completedWOCount / sc.workOrdersCount) * 100)
      : 0;

    let bottleneckStatus = 'Balanced';
    if (sc.pipelineValue > 10000000 && execRate < 40) {
      bottleneckStatus = 'High Sales Pipeline / Execution Bottleneck';
    } else if (sc.pipelineValue < 2000000 && execRate > 70) {
      bottleneckStatus = 'High Execution Rate / Low Sales Pipeline';
    }

    return {
      ...sc,
      executionCompletionRate: execRate,
      bottleneckStatus
    };
  });

  return {
    sectorsCount: crossBoardAnalysis.length,
    sectorComparison: crossBoardAnalysis,
    topPipelineSector: crossBoardAnalysis.sort((a,b) => b.pipelineValue - a.pipelineValue)[0]?.sector || 'N/A',
    topExecutionSector: crossBoardAnalysis.sort((a,b) => b.completedWOCount - a.completedWOCount)[0]?.sector || 'N/A'
  };
}

/**
 * Generate Comprehensive Executive Leadership Brief
 */
export function generateLeadershipUpdate(rawDeals, rawWorkOrders) {
  const deals = rawDeals.map(normalizeDeal).filter(Boolean);
  const workOrders = rawWorkOrders.map(normalizeWorkOrder).filter(Boolean);

  const pipeline = calculatePipelineMetrics(deals, { filterQuarter: false });
  const financial = calculateFinancialMetrics(workOrders);
  const operational = calculateOperationalMetrics(workOrders);
  const crossBoard = calculateCrossBoardMetrics(deals, workOrders);
  const quality = auditDataQuality(deals, workOrders);

  const formatRupees = (amount) => {
    if (!amount || amount === 0) return '₹0';
    if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} Lakhs`;
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  return {
    timestamp: new Date().toISOString(),
    executiveSummary: {
      activePipelineValue: formatRupees(pipeline.totalActivePipelineValue),
      weightedPipelineValue: formatRupees(pipeline.weightedPipelineValue),
      activeDealsCount: pipeline.activeDealsCount,
      billedValue: formatRupees(financial.totalBilledValue),
      collectedAmount: formatRupees(financial.totalCollectedAmount),
      amountReceivable: formatRupees(financial.totalAmountReceivable),
      amountToBeBilled: formatRupees(financial.totalAmountToBeBilled),
      collectionEfficiency: `${financial.collectionRatePercent}%`,
      workOrdersCount: operational.totalWorkOrders,
      delayedProjectsCount: operational.delayedProjectsCount,
      topSectorByPipeline: crossBoard.topPipelineSector
    },
    pipelineDetails: pipeline,
    financialDetails: financial,
    operationalDetails: operational,
    crossBoardDetails: crossBoard,
    dataQualityAudit: quality,
    recommendedActions: [
      `Accelerate collections on ₹${(financial.totalAmountReceivable / 100000).toFixed(1)} Lakhs in outstanding receivables.`,
      `Address operational execution bottlenecks in top sales sectors like ${crossBoard.topPipelineSector}.`,
      `Enforce mandatory close dates and probability data entry for the ${quality.missingCloseDate} active deals currently missing target dates.`,
      `Follow up on ${operational.delayedProjectsCount} delayed or unstarted high-value work orders to unlock unbilled value.`
    ]
  };
}
