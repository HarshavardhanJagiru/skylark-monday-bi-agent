# Decision Log — Skylark Monday.com Business Intelligence Agent MVP

**Author:** Full Stack Developer Candidate  
**Project:** Skylark Drones BI Agent  
**Date:** August 2026  

---

### 1. Key Assumptions

1. **Production Source of Truth:** Monday.com GraphQL API v2 is the sole production source of truth. The Excel spreadsheets are imported into Monday.com boards and are never embedded into frontend/backend code as hardcoded static JSON arrays.
2. **Cross-Board Matching Key:** `Deal Name` in the Deals board corresponds to `Deal name masked` in the Work Orders board.
3. **Probability & Weighted Pipeline Rules:** Weighted pipeline is calculated as $Value \times ClosureProbability$. If a record lacks closure probability or deal value, it is excluded from weighted calculations and flagged in the Data Quality Caveats box. Missing values are never converted to $0\%$ or $100\%$.
4. **Dates Standardisation:** All tentative close dates, actual close dates, PO dates, and delivery dates are normalized to `YYYY-MM-DD`. Missing/invalid date strings evaluate to `null`.

---

### 2. Architectural Decisions

* **Separation of Math and Natural Language:**
  * *Decision:* Implement all numerical calculations (pipeline totals, weighted probabilities, receivables, collection efficiency, operational completion rates) in pure JavaScript (`server/services/analyticsService.js`).
  * *Rationale:* LLMs frequently hallucinate arithmetic or mistabulate totals when processing hundreds of raw records. Restricting the LLM to intent classification and executive language synthesis eliminates math errors.
* **Backend Security & Token Protection:**
  * *Decision:* All Monday.com API queries and Gemini API calls execute strictly on the Node.js Express server.
  * *Rationale:* Keeps `MONDAY_API_TOKEN` and `GEMINI_API_KEY` safe on the server side, avoiding client-side credential exposure.
* **Unified Full-Stack Deployment Model:**
  * *Decision:* Express backend serves both REST API endpoints (`/api/chat`, `/api/leadership-update`, `/api/health`) and static Vite production assets (`/dist`).
  * *Rationale:* Simplifies deployment to a single Render/Railway service so the evaluator can test the application with a single command.

---

### 3. Data-Cleaning & Normalization Decisions

* **Sector Canonicalization:**
  * Applied explicit canonical mapping for sector strings (e.g. `energy` → `Energy`, `renewables sector` → `Renewables`). If an unknown sector appears, title-case formatting is applied rather than forcing it into `Others`.
* **Safe Numeric Parsing:**
  * Currency fields often contain `₹`, commas, spaces, or hyphen placeholders (`-`). `parseNumeric` strips non-numeric characters while preserving explicit `0`. Missing values remain `null`.
* **Stage Name Normalization:**
  * Deal stages in raw data contain ordering prefixes (e.g. `A. Lead Generated`, `H. Work Order Received`). The normalization layer preserves both the clean title (`Lead Generated`) and raw stage for precise filtering.

---

### 4. AI Approach & Ambiguity Handling

* **Structured Intent Classification:**
  * User queries are first classified into one of 8 structured intents (`pipeline_analysis`, `sector_analysis`, `revenue_analysis`, `operational_analysis`, `receivables_analysis`, `cross_board_analysis`, `leadership_update`, `ambiguous_query`).
* **Ambiguity Detection & Clarification:**
  * Prompts like *"Show top performance"* or *"Show top clients"* are flagged with `needsClarification: true`. Instead of guessing, the agent returns structured clarification choices (e.g., *"Rank by Sales Pipeline Value"*, *"Rank by Billed Revenue"*, or *"Rank by Operational Speed"*).
* **Deterministic Fallback Engine:**
  * If the LLM API key is absent or rate-limited, the agent falls back to a deterministic rule-based query classifier and structured executive template renderer, ensuring 100% uptime.

---

### 5. Interpretation of "Leadership Updates"

* **Executive Brief Structure:**
  * Interpreted as a top-level briefing containing:
    1. **Top-line KPIs**: Active Pipeline, Billed Revenue, Collected Revenue, Outstanding Receivables, Work Order Execution Rate.
    2. **Operations & Bottlenecks**: High-value unstarted work orders and sector bottlenecks.
    3. **Data Quality Caveats**: Audit of missing fields affecting forecast accuracy.
    4. **Actionable Recommendations**: 2–4 high-impact operational focus items (e.g. accelerating collection on receivables).

---

### 6. What Was Intentionally Not Implemented

1. **Complex Agentic Frameworks (LangChain / AutoGen):** Avoided adding heavy agent frameworks to keep the codebase simple, fast, readable, and easy to explain in an interview.
2. **Hardcoded Database Fallbacks:** Avoided storing static business datasets inside the code.
3. **Over-engineered UI Animations:** Focused effort on clear data presentation, metric cards, and quality warning badges rather than decorative animations.

---

### 7. Future Improvements with More Time

1. **Fuzzy Name Matching:** Implement Levenshtein distance string matching between Deals and Work Orders for non-exact client code variations.
2. **Real-time Webhooks:** Subscribe to Monday.com webhook events (`change_column_value`, `create_item`) to automatically flush in-memory caches upon live updates.
3. **Multi-Currency & Conversion:** Add support for USD / EUR currency conversions if international deals are added.
