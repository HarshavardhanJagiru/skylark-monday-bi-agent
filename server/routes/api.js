import express from 'express';
import { mondayService } from '../services/mondayService.js';
import { normalizeDeal, normalizeWorkOrder, auditDataQuality, getFieldValue } from '../services/normalizationService.js';
import { 
  calculatePipelineMetrics, 
  calculateFinancialMetrics, 
  calculateOperationalMetrics, 
  calculateCrossBoardMetrics, 
  generateLeadershipUpdate 
} from '../services/analyticsService.js';
import { aiService } from '../services/aiService.js';

const router = express.Router();

/**
 * GET /api/health
 * Safe diagnostic endpoint checking live Monday connection & field mapping metadata
 */
router.get('/health', async (req, res) => {
  try {
    const dealsResult = await mondayService.getDealsData();
    const woResult = await mondayService.getWorkOrdersData();

    const dealsSampleRecord = dealsResult.records[0] || {};
    const woSampleRecord = woResult.records[0] || {};

    // Safe Field Mapping Audit
    const dealsMappedFields = {
      dealNameMapped: !!getFieldValue(dealsSampleRecord, 'name', 'Deal Name', 'Item Name'),
      clientCodeMapped: !!getFieldValue(dealsSampleRecord, 'text_mm6q351b', 'Client Code'),
      ownerCodeMapped: !!getFieldValue(dealsSampleRecord, 'text_mm6qeh24', 'Owner code'),
      productDealMapped: !!getFieldValue(dealsSampleRecord, 'text_mm6qrcfn', 'Product deal'),
      probabilityMapped: !!getFieldValue(dealsSampleRecord, 'text_mm6q45gj', 'Closure Probability'),
      closeDateAMapped: !!getFieldValue(dealsSampleRecord, 'date_mm6qrp3a', 'Close Date (A)'),
      tentativeCloseDateMapped: !!getFieldValue(dealsSampleRecord, 'date_mm6qaq9d', 'Tentative Close Date'),
      dealStageMapped: !!getFieldValue(dealsSampleRecord, 'color_mm6qn9mn', 'Deal Stage'),
      dealStatusMapped: !!getFieldValue(dealsSampleRecord, 'color_mm6qf7q8', 'Deal Status'),
      sectorMapped: !!getFieldValue(dealsSampleRecord, 'text_mm6qrfsw', 'Sector/service'),
      createdDateMapped: !!getFieldValue(dealsSampleRecord, 'date_mm6qbxq6', 'Created Date'),
      dealValueMapped: !!getFieldValue(dealsSampleRecord, 'numeric_mm6q8g6f', 'Masked Deal value')
    };

    const woMappedFields = {
      dealNameMaskedMapped: !!getFieldValue(woSampleRecord, 'name', 'Deal name masked'),
      customerCodeMapped: !!getFieldValue(woSampleRecord, 'text_mm6q6pe9', 'Customer Name Code'),
      serialNumberMapped: !!getFieldValue(woSampleRecord, 'text_mm6qc8c6', 'Serial #'),
      executionStatusMapped: !!getFieldValue(woSampleRecord, 'color_mm6q6xqq', 'Execution Status'),
      billedValueExclMapped: !!getFieldValue(woSampleRecord, 'numeric_mm6qapm6', 'Billed Value Excl. GST'),
      collectedAmountMapped: !!getFieldValue(woSampleRecord, 'numeric_mm6qycw3', 'Collected Amount'),
      amountReceivableMapped: !!getFieldValue(woSampleRecord, 'numeric_mm6qbzbw', 'Amount Receivable')
    };

    res.json({
      status: 'ok',
      mondayApiConnected: dealsResult.source === 'monday_api' && woResult.source === 'monday_api',
      deals: {
        source: dealsResult.source,
        boardName: dealsResult.boardName,
        itemCount: dealsResult.count,
        detectedColumns: (dealsResult.columns || []).map(c => ({ id: c.id, title: c.title, type: c.type })),
        mappedFieldsStatus: dealsMappedFields
      },
      workOrders: {
        source: woResult.source,
        boardName: woResult.boardName,
        itemCount: woResult.count,
        detectedColumns: (woResult.columns || []).map(c => ({ id: c.id, title: c.title, type: c.type })),
        mappedFieldsStatus: woMappedFields
      },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      mondayApiConnected: false,
      message: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/chat
 * Primary conversational endpoint for founder queries
 */
router.post('/chat', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query || typeof query !== 'string' || query.trim() === '') {
      return res.status(400).json({ error: 'Query parameter is required.' });
    }

    const trimmedQuery = query.trim();

    // 1. Fetch raw data dynamically from Monday.com
    const [dealsRawResult, woRawResult] = await Promise.all([
      mondayService.getDealsData(),
      mondayService.getWorkOrdersData()
    ]);

    // 2. Normalize datasets
    const deals = dealsRawResult.records.map(normalizeDeal);
    const workOrders = woRawResult.records.map(normalizeWorkOrder);

    // 3. Perform Data Quality Audit
    const dataQuality = auditDataQuality(deals, workOrders);

    // 4. AI Intent Classification & Ambiguity Detection
    const intentInfo = await aiService.classifyIntent(trimmedQuery);

    // If query is ambiguous, return clarification request
    if (intentInfo.needsClarification && intentInfo.clarificationQuestion) {
      return res.json({
        isClarification: true,
        clarificationQuestion: intentInfo.clarificationQuestion,
        options: [
          'Rank by Sales Pipeline Deal Value',
          'Rank by Billed Revenue',
          'Rank by Operational Execution Efficiency'
        ]
      });
    }

    // 5. Deterministic Business Calculations based on Intent
    const pipeline = calculatePipelineMetrics(deals);
    const financial = calculateFinancialMetrics(workOrders);
    const operational = calculateOperationalMetrics(workOrders);
    const crossBoard = calculateCrossBoardMetrics(deals, workOrders);

    const calculationResults = {
      intent: intentInfo.intent,
      sector: intentInfo.sector,
      pipeline,
      financial,
      operational,
      crossBoard
    };

    // 6. AI Natural Language Response Synthesis
    const aiResponseMarkdown = await aiService.synthesizeResponse(
      trimmedQuery,
      intentInfo,
      calculationResults,
      dataQuality
    );

    // 7. Compact Metric Cards for Frontend Display
    const formatRupees = (amount) => {
      if (!amount || amount === 0) return '₹0';
      if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
      if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`;
      return `₹${amount.toLocaleString('en-IN')}`;
    };

    const metricCards = [
      { title: 'Active Pipeline', value: formatRupees(pipeline.totalActivePipelineValue), subtitle: `${pipeline.activeDealsCount} active deals` },
      { title: 'Weighted Pipeline', value: formatRupees(pipeline.weightedPipelineValue), subtitle: `${pipeline.dealsWithProbCount} deals with probability` },
      { title: 'Billed Revenue', value: formatRupees(financial.totalBilledValue), subtitle: `${financial.billedCount} work orders billed` },
      { title: 'Collected Amount', value: formatRupees(financial.totalCollectedAmount), subtitle: `${financial.collectionRatePercent}% collection rate` },
      { title: 'Outstanding Receivables', value: formatRupees(financial.totalAmountReceivable), subtitle: 'Pending collection' }
    ];

    res.json({
      isClarification: false,
      response: aiResponseMarkdown,
      intent: intentInfo.intent,
      metricCards,
      caveats: dataQuality.caveats,
      dataSources: {
        dealsSource: dealsRawResult.source,
        workOrdersSource: woRawResult.source,
        dealsCount: deals.length,
        workOrdersCount: workOrders.length
      }
    });

  } catch (err) {
    console.error('[API Error /chat]:', err);
    res.status(500).json({
      error: 'An error occurred while processing your request.',
      details: err.message
    });
  }
});

/**
 * GET /api/leadership-update
 * Endpoint for generating full executive briefing
 */
router.get('/leadership-update', async (req, res) => {
  try {
    const [dealsRawResult, woRawResult] = await Promise.all([
      mondayService.getDealsData(),
      mondayService.getWorkOrdersData()
    ]);

    const leadershipData = generateLeadershipUpdate(dealsRawResult.records, woRawResult.records);

    // Synthesize natural language summary
    const aiResponseMarkdown = await aiService.synthesizeResponse(
      "Prepare a leadership update",
      { intent: "leadership_update" },
      {
        pipeline: leadershipData.pipelineDetails,
        financial: leadershipData.financialDetails,
        operational: leadershipData.operationalDetails,
        crossBoard: leadershipData.crossBoardDetails
      },
      leadershipData.dataQualityAudit
    );

    res.json({
      leadershipData,
      summaryMarkdown: aiResponseMarkdown
    });
  } catch (err) {
    console.error('[API Error /leadership-update]:', err);
    res.status(500).json({
      error: 'Failed to generate leadership update.',
      details: err.message
    });
  }
});

export default router;
