import { GoogleGenerativeAI } from '@google/generative-ai';
import fetch from 'node-fetch';

/**
 * AI Query Understanding, Clarification & Executive Response Generator
 */
class AIService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || process.env.AI_API_KEY || '';
    if (this.apiKey) {
      this.genAI = new GoogleGenerativeAI(this.apiKey);
      this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    }
  }

  /**
   * Classify user query into structured intent and parameters
   */
  async classifyIntent(userQuery) {
    const promptLower = userQuery.toLowerCase();

    // If Gemini API Key is available, use Gemini for intent classification
    if (this.apiKey && this.model) {
      try {
        const systemPrompt = `
You are a Business Intelligence Intent Classifier for Skylark Drones.
Analyze the user prompt and respond with ONLY a valid JSON object matching this schema:

{
  "intent": "pipeline_analysis" | "sector_analysis" | "revenue_analysis" | "operational_analysis" | "receivables_analysis" | "cross_board_analysis" | "leadership_update" | "ambiguous_query" | "general_data_question",
  "sector": string | null,
  "period": string | null,
  "needsClarification": boolean,
  "clarificationQuestion": string | null
}

Guidelines for intent:
- "pipeline_analysis": questions about active deals, pipeline value, stages, win rates, forecasting.
- "sector_analysis": questions about sector breakdown, top sectors, performance by sector.
- "revenue_analysis": questions about billing, billed value, revenue, collected amounts, PO amounts.
- "operational_analysis": questions about work order execution, delays, work completion, PO status.
- "receivables_analysis": questions about outstanding amount, unpaid invoices, receivable priority, collections.
- "cross_board_analysis": questions comparing sales pipeline vs execution/delivery, sector bottlenecks.
- "leadership_update": requests for executive briefing, founder update, management summary.
- "ambiguous_query": vague or underspecified questions like "show top customers", "how are things", "show performance" without clear context.

User Prompt: "${userQuery}"
        `;

        const result = await this.model.generateContent(systemPrompt);
        const responseText = result.response.text().trim();
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      } catch (err) {
        console.warn('[AIService] Gemini classification failed, using fallback parser:', err.message);
      }
    }

    // Fallback Rule-Based Intent Classifier
    if (promptLower.includes('leadership') || promptLower.includes('executive') || promptLower.includes('founder update') || promptLower.includes('summary')) {
      return { intent: 'leadership_update', sector: null, needsClarification: false };
    }
    if (promptLower.includes('compare') || promptLower.includes('vs') || (promptLower.includes('pipeline') && promptLower.includes('execution'))) {
      return { intent: 'cross_board_analysis', sector: null, needsClarification: false };
    }
    if (promptLower.includes('receivable') || promptLower.includes('unpaid') || promptLower.includes('outstanding') || promptLower.includes('pending collection')) {
      return { intent: 'receivables_analysis', sector: null, needsClarification: false };
    }
    if (promptLower.includes('delayed') || promptLower.includes('work order') || promptLower.includes('execution') || promptLower.includes('not started') || promptLower.includes('operation')) {
      return { intent: 'operational_analysis', sector: null, needsClarification: false };
    }
    if (promptLower.includes('revenue') || promptLower.includes('billed') || promptLower.includes('collected') || promptLower.includes('billing')) {
      return { intent: 'revenue_analysis', sector: null, needsClarification: false };
    }
    if (promptLower.includes('sector') || promptLower.includes('mining') || promptLower.includes('renewable') || promptLower.includes('powerline')) {
      let sector = null;
      if (promptLower.includes('mining')) sector = 'Mining';
      if (promptLower.includes('renewable')) sector = 'Renewables';
      if (promptLower.includes('powerline')) sector = 'Powerline';
      if (promptLower.includes('railway')) sector = 'Railways';
      return { intent: 'sector_analysis', sector, needsClarification: false };
    }
    if (promptLower.includes('pipeline') || promptLower.includes('deal') || promptLower.includes('stage') || promptLower.includes('quarter')) {
      return { intent: 'pipeline_analysis', sector: null, needsClarification: false };
    }
    if (promptLower.includes('best customer') || promptLower.includes('top client') || promptLower.includes('how is performance') || promptLower.includes('top performance')) {
      return {
        intent: 'ambiguous_query',
        needsClarification: true,
        clarificationQuestion: 'Would you like to analyze top performance by pipeline deal value, billed revenue, or operational execution efficiency?'
      };
    }

    return { intent: 'general_data_question', sector: null, needsClarification: false };
  }

  /**
   * Synthesize founder-level executive answer using calculated data & caveats
   */
  async synthesizeResponse(userQuery, intentInfo, calculationResults, caveats) {
    // If Gemini is available, generate natural language response
    if (this.apiKey && this.model) {
      try {
        const prompt = `
You are an Executive Business Intelligence Agent for Skylark Drones, speaking directly to the Founder / CEO.
Respond concisely, clearly, and authoritatively using ONLY the provided verified metrics.

RULES:
1. Do NOT calculate or invent numbers. Use ONLY the supplied JSON calculation results.
2. Structure the answer into clear markdown sections:
   - **Key Answer**: 1-2 sentence executive summary answering the question directly.
   - **Supporting Metrics**: Bullet points of key figures (in ₹ Lakhs/Crores where relevant).
   - **Insights & Risks**: 2-3 strategic observations based on the data.
   - **Data Quality & Caveats**: Explicitly mention missing data limitations.
3. Be professional, direct, and founder-focused.

User Query: "${userQuery}"
Calculated BI Data: ${JSON.stringify(calculationResults, null, 2)}
Data Quality Audit: ${JSON.stringify(caveats, null, 2)}
        `;

        const result = await this.model.generateContent(prompt);
        return result.response.text();
      } catch (err) {
        console.warn('[AIService] Gemini synthesis failed, falling back to template renderer:', err.message);
      }
    }

    // Fallback Structured Natural Language Template Renderer
    return this.renderFallbackResponse(userQuery, intentInfo.intent, calculationResults, caveats);
  }

  /**
   * High-quality fallback template renderer when LLM API key is not present or rate-limited
   */
  renderFallbackResponse(query, intent, data, caveats) {
    const formatRupees = (amount) => {
      if (!amount || amount === 0) return '₹0';
      if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
      if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} Lakhs`;
      return `₹${amount.toLocaleString('en-IN')}`;
    };

    let answerText = '';

    if (intent === 'pipeline_analysis') {
      const p = data.pipeline;
      answerText = `
### 📊 Pipeline Health Analysis

**Key Answer**: 
Skylark currently has **${p.activeDealsCount} active deals** with a total unweighted pipeline value of **${formatRupees(p.totalActivePipelineValue)}**. The weighted pipeline value stands at **${formatRupees(p.weightedPipelineValue)}** based on available probability metrics.

**Supporting Metrics**:
* **Active Deals**: ${p.activeDealsCount}
* **Total Pipeline Value**: ${formatRupees(p.totalActivePipelineValue)}
* **Weighted Pipeline**: ${formatRupees(p.weightedPipelineValue)}
* **Deals with Close Date**: ${p.activeDealsCount - p.missingCloseDatesCount} of ${p.activeDealsCount}

**Stage Breakdown**:
${Object.entries(p.stageBreakdown || {}).map(([stage, val]) => `* **${stage}**: ${val.count} deals (${formatRupees(val.totalValue)})`).join('\n')}

**Data Quality Caveat**: 
${caveats.caveats.length > 0 ? caveats.caveats.slice(0, 2).join(' ') : 'No significant pipeline data gaps detected.'}
      `;
    } else if (intent === 'revenue_analysis' || intent === 'receivables_analysis') {
      const f = data.financial;
      answerText = `
### 💰 Revenue & Receivables Position

**Key Answer**: 
The total billed revenue across work orders is **${formatRupees(f.totalBilledValue)}**, with **${formatRupees(f.totalCollectedAmount)}** collected (**${f.collectionRatePercent}%** collection efficiency). Outstanding receivables stand at **${formatRupees(f.totalAmountReceivable)}**.

**Supporting Metrics**:
* **Total Billed Value**: ${formatRupees(f.totalBilledValue)}
* **Collected Amount**: ${formatRupees(f.totalCollectedAmount)}
* **Amount Receivable (Uncollected)**: ${formatRupees(f.totalAmountReceivable)}
* **Amount Yet To Be Billed**: ${formatRupees(f.totalAmountToBeBilled)}
* **Collection Efficiency**: ${f.collectionRatePercent}%

**Strategic Insights**:
* Primary focus should be placed on recovering the **${formatRupees(f.totalAmountReceivable)}** in outstanding receivables.
* There is **${formatRupees(f.totalAmountToBeBilled)}** in work orders ready to be billed upon ops milestone completion.

**Data Quality Caveat**:
${caveats.caveats.filter(c => c.includes('work orders') || c.includes('receivable')).join(' ') || 'All major financial records processed.'}
      `;
    } else if (intent === 'operational_analysis') {
      const o = data.operational;
      answerText = `
### 🛠️ Operations & Execution Status

**Key Answer**: 
Out of **${o.totalWorkOrders} total work orders**, **${o.executionStatusBreakdown['Completed'] || 0} are completed**, **${o.executionStatusBreakdown['In Progress'] || 0} are in progress**, and **${o.delayedProjectsCount} projects require attention or are delayed**.

**Execution Status Split**:
${Object.entries(o.executionStatusBreakdown || {}).map(([stat, count]) => `* **${stat}**: ${count} work orders`).join('\n')}

**Key Delayed / High-Value Unstarted Projects**:
${(o.delayedProjects || []).slice(0, 3).map(p => `* **${p.dealName}** (${p.sector}): Status = *${p.executionStatus}*, Value = ${formatRupees(p.amountExclGst)}`).join('\n')}

**Data Quality Caveat**:
${caveats.caveats.filter(c => c.includes('execution')).join(' ') || 'Execution status recorded across active work orders.'}
      `;
    } else if (intent === 'cross_board_analysis' || intent === 'sector_analysis') {
      const cb = data.crossBoard;
      answerText = `
### 🌐 Cross-Board Sector & Execution Comparison

**Key Answer**: 
**${cb.topPipelineSector}** leads in active sales pipeline value, while operational execution completion varies significantly across key sectors.

**Sector Breakdown (Pipeline vs Work Orders)**:
${(cb.sectorComparison || []).slice(0, 5).map(s => `* **${s.sector}**: Pipeline = ${formatRupees(s.pipelineValue)} | Work Orders = ${s.workOrdersCount} (${s.completedWOCount} Completed, ${s.executionCompletionRate}% Exec Rate) -> *${s.bottleneckStatus}*`).join('\n')}

**Strategic Takeaway**:
${cb.sectorComparison.find(s => s.bottleneckStatus.includes('Bottleneck')) ? `* Sector **${cb.sectorComparison.find(s => s.bottleneckStatus.includes('Bottleneck')).sector}** shows a strong sales pipeline but an operational completion rate under 40%.` : '* Operational execution and pipeline are balanced across major sectors.'}
      `;
    } else {
      // Default leadership summary fallback
      const p = data.pipeline;
      const f = data.financial;
      const o = data.operational;
      answerText = `
### 📈 Executive Business Intelligence Brief

**Key Answer**: 
Skylark Drones currently maintains **${p.activeDealsCount} active deals** worth **${formatRupees(p.totalActivePipelineValue)}** in pipeline. Year-to-date billed revenue is **${formatRupees(f.totalBilledValue)}** with **${formatRupees(f.totalAmountReceivable)}** in outstanding receivables.

**Executive Key Performance Indicators**:
* 🔹 **Active Pipeline Value**: ${formatRupees(p.totalActivePipelineValue)} (${formatRupees(p.weightedPipelineValue)} weighted)
* 🔹 **Billed Revenue**: ${formatRupees(f.totalBilledValue)}
* 🔹 **Collected Amount**: ${formatRupees(f.totalCollectedAmount)} (${f.collectionRatePercent}% collected)
* 🔹 **Outstanding Receivables**: ${formatRupees(f.totalAmountReceivable)}
* 🔹 **Work Orders**: ${o.totalWorkOrders} total (${o.delayedProjectsCount} delayed/unstarted)

**Data Quality Caveats**:
${caveats.caveats.slice(0, 3).map(c => `* ⚠️ ${c}`).join('\n')}
      `;
    }

    return answerText.trim();
  }
}

export const aiService = new AIService();
