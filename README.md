# Skylark Drones — Monday.com Business Intelligence Conversational Agent

A production-oriented conversational Business Intelligence (BI) MVP built for Skylark Drones. The agent reads live data dynamically from two Monday.com boards (**Deals** and **Work Orders**) via Monday.com's GraphQL API, normalizes inconsistent/messy values, executes deterministic business calculations in JavaScript, and provides executive-ready natural language insights via Gemini AI.

---

## Overview

Executive teams need quick, reliable answers about revenue, pipeline health, sector bottlenecks, and operational delays without manually exporting spreadsheets or writing SQL queries. This application connects directly to Monday.com, processes messy real-world data, and provides founder-level answers with complete transparency around data quality limitations.

---

## Problem

* **Raw Data Messiness**: Deal records and Work Orders contain inconsistent text formatting, missing close dates, missing probability indicators, mixed currency strings, and unstructured sector names.
* **Math Risks in LLMs**: Generative AI models struggle with reliable arithmetic when calculating total pipeline values, weighted probabilities, or outstanding receivables.
* **Ambiguous Founder Queries**: Executive prompts like *"Show top performance"* can mean sales revenue, deal value, or execution speed, requiring contextual clarification rather than guessing.

---

## Solution

1. **Separation of Math & Language**: Deterministic JS/TS analytics engine handles all numerical aggregations, financial sums, and probability weightings. The LLM is restricted to intent classification, ambiguity detection, and natural-language executive synthesis.
2. **Dynamic Normalization & Audit**: Dynamic cleanup layer canonicalizes sector names (e.g. `energy` → `Energy`), parses dates (ISO, Excel serials, DD/MM/YYYY) to `YYYY-MM-DD`, strips currency formatting without converting nulls into fake zeroes, filters out 2 imported non-business header-artifact rows, and tracks data quality caveats.
3. **Monday.com GraphQL Integration**: Direct read-only connection via Monday.com GraphQL API v2 using full `cursor` pagination, stable column ID (`col_<id>`) mapping, in-memory caching, and automated board population scripts.

---

## Architecture

```
                       ┌──────────────────────────────┐
                       │     React + Vite Frontend    │
                       │  (Conversational BI Chat UI) │
                       └──────────────┬───────────────┘
                                      │ HTTP / JSON (POST /api/chat)
                                      ▼
                       ┌──────────────────────────────┐
                       │    Node.js / Express Backend  │
                       └──────────────┬───────────────┘
                                      │
         ┌────────────────────────────┼────────────────────────────┐
         ▼                            ▼                            ▼
┌─────────────────┐       ┌───────────────────────┐      ┌─────────────────┐
│ AI Query Engine │       │   Monday.com Service  │      │  BI & Analytics │
│(Intent Classifier│       │ (GraphQL API Client   │      │   Engine (JS)   │
│ & Gemini LLM)   │       │  with 60s Cache)      │      │(Pipeline, Rev,  │
└────────┬────────┘       └───────────┬───────────┘      │ Cross-Board BI) │
         │                            │                  └────────┬────────┘
         │                            ▼                           │
         │                 ┌────────────────────┐                 │
         │                 │  Monday.com Boards │                 │
         │                 │(Deals & WorkOrders)│                 │
         │                 └────────────────────┘                 │
         │                                                        │
         └────────────────────────────┬───────────────────────────┘
                                      ▼
                       ┌──────────────────────────────┐
                       │ Dynamic Data Normalization   │
                       │  & Quality Caveats Generator │
                       └──────────────────────────────┘
```

---

## Tech Stack

* **Frontend**: React 19, Vite, Lucide Icons, Vanilla CSS (Design System with HSL tokens, dark mode, glassmorphism).
* **Backend**: Node.js (ES Modules), Express.
* **Database / Source of Truth**: Monday.com GraphQL API v2 (`https://api.monday.com/v2`).
* **Testing**: Vitest (`npm test`).

---

## Monday.com Setup & Data Import

### Production Data Source of Truth
The supplied Excel spreadsheets (`Deal funnel Data.xlsx` and `Work_Order_Tracker Data.xlsx`) are used strictly to populate the Monday.com boards via the `npm run import-data` script. Live production queries read dynamically from the Monday.com GraphQL API and never parse the Excel files.

### 1. Obtain Monday.com API Token
1. Log into your [Monday.com](https://monday.com) workspace.
2. Go to **Avatar (Bottom Left) → Administration → API**.
3. Copy your Personal API Token.

### 2. Automated Import Script (`scripts/import_to_monday.js`)
We provide a zero-configuration script that automatically creates the **Deals** and **Work Orders** boards in your Monday.com workspace and populates them using the provided Excel files:

```bash
# 1. Set MONDAY_API_TOKEN in .env
MONDAY_API_TOKEN=your_monday_api_token_here

# 2. Run the automated importer
npm run import-data
```

The script will log the created board IDs:
```
✅ Deals Board Created: 1234567890
✅ Work Orders Board Created: 0987654321
```

Copy these IDs into your `.env` file!

---

## Environment Variables

Copy `.env.example` to `.env`:

```ini
# Monday.com API Configuration
MONDAY_API_TOKEN=your_monday_api_token_here
MONDAY_DEALS_BOARD_ID=Your_MONDAY_DEALS_BOARD_ID
MONDAY_WORK_ORDERS_BOARD_ID=Your_MONDAY_WORK_ORDERS_BOARD_ID

# Server Port
PORT=3001
```

---

## Local Setup & Running

```bash
# 1. Clone the repository
git clone https://github.com/HarshavardhanJagiru/skylark-monday-bi-agent.git
cd skylark-monday-bi-agent

# 2. Install dependencies
npm install

# 3. Run automated tests
npm test

# 4. Start full-stack development mode
# Runs Express Backend on http://localhost:3001 and Vite Frontend on http://localhost:5173
npm run server & npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Deployment Instructions

### Deployment Option 1: Unified Render / Railway Node Server (Recommended)
1. Build the production bundle:
   ```bash
   npm run build
   ```
2. Deploy to **Render** or **Railway** as a Web Service.
3. Build Command: `npm install && npm run build`
4. Start Command: `npm start`
5. Configure Environment Variables (`MONDAY_API_TOKEN`, `MONDAY_DEALS_BOARD_ID`, `MONDAY_WORK_ORDERS_BOARD_ID`, `GEMINI_API_KEY`) in the Render/Railway dashboard.

### Deployment Option 2: Split Vercel (Frontend) + Render (Backend)
* Deploy `server/` to Render Web Service.
* Deploy root directory to Vercel with build command `npm run build` and set `VITE_API_URL` to your Render backend domain.

---

## Dynamic & Explicit Quarter-Level Filtering

* **Current Quarter Queries**: Prompts specifying *"this quarter"* or *"current quarter"* dynamically compute calendar quarter boundaries from the system date (`new Date()`).
* **Calendar Quarter Boundaries**:
  * **Q1**: Jan 01 – Mar 31
  * **Q2**: Apr 01 – Jun 30
  * **Q3**: Jul 01 – Sep 30
  * **Q4**: Oct 01 – Dec 31
* **Explicit Quarter Queries**: Prompts such as *"Q1 2026"* or *"Q2 2026"* extract the explicit quarter number and target year dynamically. If year is unassigned, it defaults to the current system clock year.
* **Field Selection for Pipeline Close Date**: Uses `Tentative Close Date` as the primary expected close date field, falling back to `Close Date (A)` where applicable.
* **Exclusion & Quality Warnings**: Active deals with missing or invalid expected close dates are excluded from quarter-specific financial totals and explicitly surfaced as data-quality caveats.
* **Overall Active Pipeline**: General queries such as *"What is our total active pipeline?"* do NOT apply quarter filtering and return overall active pipeline totals.

---

## Supported Queries

1. **Pipeline Queries**: *"How is our pipeline looking this quarter?"* or *"How was our pipeline in Q1 2026?"*
2. **Sector Performance**: *"Which sector has the highest pipeline value?"*
3. **Financials & Receivables**: *"What is our current receivables position?"*
4. **Operations & Delays**: *"Which projects are delayed?"*
5. **Cross-Board Analysis**: *"Which sectors have strong sales pipeline but weak execution?"*
6. **Executive Briefing**: *"Prepare a leadership update"* (or click the top **Generate Leadership Update** button).
7. **Ambiguity Test**: *"Show me our best customers"* (Triggers intent clarification modal).

---

## Data Normalization & Header-Artifact Filtering

* **Text Normalization**: Trims trailing spaces. Maps variations like `energy`, `ENERGY`, `Renewable Sector` to canonical titles (`Energy`, `Renewables`). Strips prefixes from deal stages (`A. Lead Generated` → `Lead Generated`).
* **Header-Artifact Exclusion**: The normalization layer detects and excludes exactly 2 non-business header-artifact records introduced during spreadsheet import into Monday.com. These records contain literal header strings such as `Deal Stage` and `Deal Status`. Excluding these non-business header rows ensures active deal metrics represent real business opportunities (217 active business deals).
* **Dates**: Converts ISO strings, `DD/MM/YYYY`, and Excel timestamp serial numbers into `YYYY-MM-DD`. Returns `null` if invalid.
* **Numbers**: Removes `₹`, `$`, `,`, and whitespace. Converts to floating point. Missing/blank values remain `null` to avoid fake zeroes.

---

## Data Quality Handling

Every query response contains an explicit **Data Quality & Caveats Box**:
* Audits missing close dates, unrecorded deal values, and missing closure probabilities.
* Audits work orders missing execution status or receivables figures.
* Communicates explicit sample limitations (e.g. *"179 of 344 deal records do not have a deal value recorded and are excluded from financial totals."*).

---

## AI Approach & Safety

* **Zero Math in LLM**: The LLM is used purely for **Query Classification** (extracting intent, sector, quarter, target year) and **Executive Natural Language Synthesis**.
* **Deterministic Engine**: Pure JavaScript functions calculate pipeline sums, weighted values ($Value \times Probability$), receivables, and operational completion percentages.
* **Fallback Resilience**: If Gemini API key is not present or hits rate limits, the system seamlessly uses a deterministic rule-based query classifier and executive template generator.

---

## Error Handling

* **Monday.com API Failures**: Caught gracefully with clear diagnostic messages. Throws explicit authentication/board error messages when tokens or board IDs are invalid.
* **Invalid Input / Ambiguity**: Returns structured clarification options rather than making arbitrary guesses.
* **Secret Protection**: API tokens remain strictly on the backend Node server and are never sent to the browser client.

---

## Testing & Monday.com GraphQL Details

* **Automated Unit Tests**: Includes 20 automated Vitest unit tests covering sector normalization, numeric currency parsing, date parsing, data quality audits, Q1–Q4 quarter boundary calculations, missing dates, and cross-board analytics.
* **Test Status**: **20 / 20 tests currently passing** (`npm test`).
* **Monday.com GraphQL Retrieval**: Uses `cursor` pagination (`do { ... } while (cursor);`) to fetch 100% of items from both boards.
* **Field Mapping**: Uses stable Monday column IDs (`col_<id>`) as primary keys with human-readable titles as fallback for reliable record mapping.

---

## Assumptions & Trade-offs

* **Primary Matching Key**: `Deal Name` in Deals board matches `Deal name masked` in Work Orders.
* **Weighted Pipeline Calculation**: Excludes records missing probability rather than inventing $0\%$ or $100\%$.
* **Trade-off**: Chose a single unified Node/Express + Vite architecture to simplify deployment and allow evaluation with a single command.

---

## AI Tools Used

* **Gemini 1.5 Flash**: Intent classification & executive response synthesis.
* **Antigravity AI Agent**: Code generation, architecture design, unit testing, and documentation.

---
## Challenges Faced

* **Messy Source Data**: Inconsistent dates, currency formats, missing values, and imported header artifacts required a normalization and data-quality layer.
* **LLM Reliability**: Financial calculations needed to remain deterministic, so Gemini was restricted to intent classification and natural-language synthesis.
* **Production Debugging**: Some queries behaved differently after deployment because LLM classification and response synthesis required production-level validation.
* **Open-Ended Queries**: Ambiguous executive questions required clarification rather than arbitrary assumptions.

---

## Limitations & Future Improvements

* **Current Limitations**: Cross-Board matching relies on sector aggregation and deal name exact matching.
* **Future Roadmap**: Implement fuzzy string matching (Levenshtein distance) for deal names, add automated webhooks for real-time Monday.com change notifications, and support multi-currency conversion.
